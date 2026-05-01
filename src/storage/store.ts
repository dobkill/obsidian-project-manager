import { App, Events, Notice, TAbstractFile, TFolder, normalizePath } from "obsidian";
import {
  PluginConfig,
  ProgressPage,
  ProgressPagesFile,
  Project,
  ProjectInput,
  ProjectsFile,
  StoreSnapshot,
  Task,
  TaskDeleteScope,
  TaskInput,
  TaskOccurrence,
  TaskRecurrence,
  TaskUpdateScope,
  TasksFile
} from "../types";
import { addDays, addMinutes, compareDateKeys, now, parseDateKey, parseTimeToMinutes, toDateKey, toIsoLocal, toMonthKey } from "../utils/date";

export const DEFAULT_CONFIG: PluginConfig = {
  version: "0.2.0",
  dataFolder: "project-manager-data",
  overviewTab1Name: "任务总览",
  overviewTab2Name: "项目进度",
  weekStartsOn: "monday",
  timeSlotMinutes: 15,
  heatmapRange: "12months",
  showCompletedTasks: true,
  defaultTaskDurationMinutes: 30,
  defaultTaskStartTime: "07:00"
};

const PROJECTS_FILE = "projects.json";
const PROGRESS_FILE = "progress-pages.json";
const CONFIG_FILE = "config.json";
const TASKS_DIR = "tasks";

export class ProjectManagementStore extends Events {
  private app: App;
  private config: PluginConfig;
  private projects: Project[] = [];
  private progressPages: ProgressPage[] = [];
  private tasks = new Map<string, Task[]>();
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(app: App, config: PluginConfig) {
    super();
    this.app = app;
    this.config = config;
  }

  getSnapshot(): StoreSnapshot {
    return {
      config: structuredClone(this.config),
      projects: this.getProjects(),
      progressPages: this.getProgressPages(),
      tasks: this.getAllTasks(),
      occurrences: this.getAllTaskOccurrences()
    };
  }

  getConfig(): PluginConfig {
    return structuredClone(this.config);
  }

  async setConfig(next: PluginConfig): Promise<void> {
    this.config = structuredClone(next);
    await this.ensureDataFolder();
    await this.enqueueWrite(() => this.writeJson(this.pathFor(CONFIG_FILE), this.config));
    this.trigger("changed");
  }

  getProjects(): Project[] {
    return this.projects.map((project) => ({ ...project }));
  }

  getProgressPages(): ProgressPage[] {
    return this.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] }));
  }

  getAllTasks(): Task[] {
    return [...this.tasks.values()].flat().map(cloneTask);
  }

  getAllTaskOccurrences(): TaskOccurrence[] {
    return this.getAllTasks()
      .flatMap((task) => expandTask(task))
      .sort(compareOccurrences);
  }

  getTasksForDate(date: string): TaskOccurrence[] {
    return this.getAllTaskOccurrences().filter((task) => task.date === date);
  }

  getTasksForProject(projectId: string): Task[] {
    return this.getAllTasks()
      .filter((task) => task.projectId === projectId)
      .sort(compareSeriesTasks);
  }

  getOccurrencesForProject(projectId: string): TaskOccurrence[] {
    return this.getAllTaskOccurrences()
      .filter((task) => task.projectId === projectId)
      .sort(compareOccurrences);
  }

  getOccurrencesForTask(taskId: string): TaskOccurrence[] {
    const task = this.findTask(taskId);
    return task ? expandTask(task).sort(compareOccurrences) : [];
  }

  getTask(taskId: string): Task | undefined {
    const task = this.findTask(taskId);
    return task ? cloneTask(task) : undefined;
  }

  getProject(projectId?: string): Project | undefined {
    if (!projectId) {
      return undefined;
    }
    return this.projects.find((project) => project.id === projectId);
  }

  getSuggestedTaskWindow(date: string): { startTime: string; endTime: string } {
    const scheduled = this.getTasksForDate(date)
      .filter((task) => task.startTime && task.endTime)
      .sort(compareOccurrences);
    const defaultStartTime = this.config.defaultTaskStartTime;
    const fallback = {
      startTime: defaultStartTime,
      endTime: addMinutes(defaultStartTime, this.config.defaultTaskDurationMinutes)
    };
    if (scheduled.length === 0) {
      return fallback;
    }
    const latest = [...scheduled].reverse().find((task) => task.endTime);
    if (!latest?.endTime) {
      return fallback;
    }
    return {
      startTime: latest.endTime,
      endTime: addMinutes(latest.endTime, this.config.defaultTaskDurationMinutes)
    };
  }

  async initialize(): Promise<void> {
    this.config = await this.loadConfigFile();
    await this.ensureDataFolder();
    await this.loadProjects();
    await this.loadProgressPages();
    await this.loadTasks();
    await this.flushAll();
  }

  async validateDataFolder(path: string): Promise<{ ok: boolean; message?: string }> {
    const cleaned = sanitizeFolder(path);
    if (!cleaned) {
      return { ok: false, message: "数据目录不能为空" };
    }
    if (cleaned.startsWith("/") || cleaned.includes("..")) {
      return { ok: false, message: "数据目录必须是 Vault 内相对路径" };
    }
    const normalized = normalizePath(cleaned);
    const abstract = this.app.vault.getAbstractFileByPath(normalized);
    if (!abstract) {
      return { ok: true };
    }
    if (!(abstract instanceof TFolder)) {
      return { ok: false, message: "数据目录路径已被文件占用" };
    }
    const allowed = new Set([CONFIG_FILE, PROJECTS_FILE, PROGRESS_FILE, TASKS_DIR]);
    const invalid = abstract.children.some((child: TAbstractFile) => !allowed.has(child.name));
    if (invalid) {
      return { ok: false, message: "目录中存在非插件文件，拒绝使用" };
    }
    return { ok: true };
  }

  async createTask(input: TaskInput): Promise<Task> {
    const normalized = this.normalizeTaskInput(input);
    const created = this.buildSeriesTask(normalized);
    this.assertNoConflicts([created], new Set());
    this.insertTask(created);
    await this.persistMonths(monthsForTasks([created]));
    this.trigger("changed");
    return cloneTask(created);
  }

  async updateTask(taskId: string, patch: Partial<TaskInput> & { completed?: boolean }, _scope: TaskUpdateScope = "series"): Promise<Task> {
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("任务不存在");
    }
    const merged = this.normalizeTaskInput({
      title: patch.title ?? original.title,
      description: patch.description ?? original.description,
      projectId: patch.projectId === undefined ? original.projectId : patch.projectId,
      date: patch.date ?? original.date,
      startTime: patch.startTime === undefined ? original.startTime : patch.startTime,
      endTime: patch.endTime === undefined ? original.endTime : patch.endTime,
      recurrence: patch.recurrence ?? original.recurrence,
      recurrenceCount: patch.recurrenceCount ?? original.recurrenceCount ?? undefined,
      recurrenceUntil: patch.recurrenceUntil ?? original.recurrenceUntil ?? undefined,
      completed: patch.completed ?? isTaskFullyCompleted(original)
    });

    const next = this.buildSeriesTask(merged, original, patch.completed);
    this.assertNoConflicts([next], occurrenceKeysForTask(original));
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    this.trigger("changed");
    return cloneTask(next);
  }

  async updateTaskOccurrenceCompletion(taskId: string, date: string, completed: boolean): Promise<void> {
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("任务不存在");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("任务发生日期不存在");
    }
    const next = cloneTask(original);
    next.completedOccurrences = completed
      ? upsertCompletionRecord(original.completedOccurrences, date, toIsoLocal(now()))
      : original.completedOccurrences.filter((item) => item.date !== date);
    next.updatedAt = toIsoLocal(now());
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    this.trigger("changed");
  }

  async deleteTask(taskId: string, scope: TaskDeleteScope = "series"): Promise<void> {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    if (scope === "single" && task.occurrenceDates.length > 1) {
      await this.deleteTaskOccurrence(taskId, task.date);
      return;
    }
    const removed = this.replaceTasks([taskId], []);
    await this.persistMonths(monthsForTasks(removed));
    this.trigger("changed");
  }

  async deleteTaskOccurrence(taskId: string, date: string): Promise<void> {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    if (!task.occurrenceDates.includes(date)) {
      throw new Error("任务发生日期不存在");
    }
    if (task.occurrenceDates.length === 1) {
      const removed = this.replaceTasks([task.id], []);
      await this.persistMonths(monthsForTasks(removed));
      this.trigger("changed");
      return;
    }
    const next = cloneTask(task);
    next.occurrenceDates = task.occurrenceDates.filter((entry) => entry !== date);
    next.completedOccurrences = task.completedOccurrences.filter((entry) => entry.date !== date);
    next.date = next.occurrenceDates[0];
    next.recurrence = detectRecurrenceFromDates(next.occurrenceDates);
    next.recurrenceCount = next.recurrence === "once" ? null : next.occurrenceDates.length;
    next.recurrenceUntil = next.recurrence === "once" ? null : next.occurrenceDates[next.occurrenceDates.length - 1];
    next.updatedAt = toIsoLocal(now());
    this.assertNoConflicts([next], occurrenceKeysForTask(task));
    this.replaceTasks([task.id], [next]);
    await this.persistMonths(monthsForTasks([task, next]));
    this.trigger("changed");
  }

  async completeTaskSeries(taskId: string, throughDate?: string): Promise<void> {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    const effectiveDate = throughDate ?? task.occurrenceDates[task.occurrenceDates.length - 1];
    const next = cloneTask(task);
    const remainingDates = task.occurrenceDates.filter((date) => compareDateKeys(date, effectiveDate) <= 0);
    const stamp = toIsoLocal(now());
    next.occurrenceDates = remainingDates;
    next.completedOccurrences = remainingDates.reduce<Array<{ date: string; completedAt: string }>>((records, date) => {
      const existing = task.completedOccurrences.find((item) => item.date === date);
      records.push(existing ?? { date, completedAt: stamp });
      return records;
    }, []);
    next.date = next.occurrenceDates[0];
    next.recurrence = detectRecurrenceFromDates(next.occurrenceDates);
    next.recurrenceCount = next.recurrence === "once" ? null : next.occurrenceDates.length;
    next.recurrenceUntil = next.recurrence === "once" ? null : next.occurrenceDates[next.occurrenceDates.length - 1];
    next.updatedAt = stamp;
    this.replaceTasks([task.id], [next]);
    await this.persistMonths(monthsForTasks([task, next]));
    this.trigger("changed");
  }

  async createProject(input: ProjectInput): Promise<Project> {
    const timestamp = toIsoLocal(now());
    const project: Project = {
      id: crypto.randomUUID(),
      name: input.name.trim() || "未命名项目",
      description: input.description?.trim() || "",
      color: input.color?.trim() || randomColor(),
      status: input.status ?? "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const page: ProgressPage = {
      id: crypto.randomUUID(),
      projectId: project.id,
      name: project.name,
      columnOrder: ["title", "recurrence", "schedule", "completion", "description", "actions"],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.projects.push(project);
    this.progressPages.push(page);
    await this.enqueueWrite(async () => {
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects } satisfies ProjectsFile);
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages } satisfies ProgressPagesFile);
    });
    this.trigger("changed");
    return { ...project };
  }

  async updateProject(projectId: string, patch: Partial<ProjectInput>): Promise<void> {
    const project = this.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw new Error("项目不存在");
    }
    project.name = patch.name?.trim() || project.name;
    project.description = patch.description?.trim() ?? project.description;
    project.color = patch.color?.trim() || project.color;
    project.status = patch.status ?? project.status;
    project.updatedAt = toIsoLocal(now());
    const page = this.progressPages.find((entry) => entry.projectId === projectId);
    if (page) {
      page.name = project.name;
      page.updatedAt = project.updatedAt;
    }
    await this.enqueueWrite(async () => {
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects });
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages });
    });
    this.trigger("changed");
  }

  async deleteProject(projectId: string): Promise<void> {
    this.projects = this.projects.filter((project) => project.id !== projectId);
    this.progressPages = this.progressPages.filter((page) => page.projectId !== projectId);
    const timestamp = toIsoLocal(now());
    const tasks = this.getTasksForProject(projectId).map((task) => ({
      ...task,
      projectId: undefined,
      updatedAt: timestamp
    }));
    this.replaceTasks(tasks.map((task) => task.id), tasks);
    await this.enqueueWrite(async () => {
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects });
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages });
      await this.flushAllTasks();
    });
    this.trigger("changed");
  }

  async reorderProgressPage(projectId: string, direction: -1 | 1): Promise<void> {
    const index = this.progressPages.findIndex((page) => page.projectId === projectId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.progressPages.length) {
      return;
    }
    const [item] = this.progressPages.splice(index, 1);
    this.progressPages.splice(target, 0, item);
    await this.enqueueWrite(() => this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages }));
    this.trigger("changed");
  }

  getProjectProgress(projectId: string): number {
    const tasks = this.getOccurrencesForProject(projectId);
    if (tasks.length === 0) {
      return 0;
    }
    const done = tasks.filter((task) => task.completed).length;
    return Math.round((done / tasks.length) * 100);
  }

  private normalizeTaskInput(input: TaskInput): TaskInput {
    const title = input.title.trim();
    if (!title) {
      throw new Error("任务标题不能为空");
    }
    const date = input.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("任务日期格式错误");
    }
    const startTime = input.startTime?.trim() || undefined;
    const endTime = input.endTime?.trim() || undefined;
    const slot = this.config.timeSlotMinutes;
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if ((startTime && !endTime) || (!startTime && endTime)) {
      throw new Error("开始时间和结束时间必须同时填写");
    }
    if (start !== null && end !== null) {
      if (start >= end) {
        throw new Error("结束时间必须晚于开始时间");
      }
      if (start % slot !== 0 || end % slot !== 0) {
        throw new Error(`时间必须对齐到 ${slot} 分钟粒度`);
      }
    }

    const recurrence = input.recurrence ?? "once";
    const recurrenceCount = recurrence === "once" ? null : normalizePositiveInteger(input.recurrenceCount);
    const recurrenceUntil = recurrence === "once" ? null : normalizeDateOrUndefined(input.recurrenceUntil);

    if (recurrence !== "once" && !recurrenceCount && !recurrenceUntil) {
      throw new Error("重复任务必须填写重复次数或结束日期");
    }
    if (recurrenceUntil && compareDateKeys(recurrenceUntil, date) < 0) {
      throw new Error("重复结束日期不能早于首个任务日期");
    }

    return {
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || undefined,
      date,
      startTime,
      endTime,
      recurrence,
      recurrenceCount,
      recurrenceUntil,
      completed: input.completed ?? false
    };
  }

  private buildSeriesTask(input: TaskInput, original?: Task, completedPatch?: boolean): Task {
    const timestamp = toIsoLocal(now());
    const occurrenceDates = buildOccurrenceDates(input);
    const completedOccurrences = resolveCompletedOccurrences({
      input,
      original,
      occurrenceDates,
      timestamp,
      completedPatch
    });
    return {
      id: original?.id ?? crypto.randomUUID(),
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      date: occurrenceDates[0],
      startTime: input.startTime,
      endTime: input.endTime,
      recurrence: input.recurrence,
      recurrenceCount: input.recurrenceCount ?? null,
      recurrenceUntil: input.recurrenceUntil ?? null,
      occurrenceDates,
      completedOccurrences,
      createdAt: original?.createdAt ?? timestamp,
      updatedAt: timestamp
    };
  }

  private assertNoConflicts(candidates: Task[], excludedOccurrenceKeys: Set<string>): void {
    const existing = this.getAllTaskOccurrences().filter((task) => !excludedOccurrenceKeys.has(task.id));
    const candidateOccurrences = candidates.flatMap((task) => expandTask(task));
    for (const task of candidateOccurrences) {
      this.assertTaskWindowValid(task, existing);
    }
    for (let index = 0; index < candidateOccurrences.length; index += 1) {
      this.assertTaskWindowValid(
        candidateOccurrences[index],
        candidateOccurrences.filter((_, innerIndex) => innerIndex !== index)
      );
    }
  }

  private assertTaskWindowValid(task: TaskOccurrence, against: TaskOccurrence[]): void {
    const start = parseTimeToMinutes(task.startTime);
    const end = parseTimeToMinutes(task.endTime);
    if (start === null || end === null) {
      return;
    }
    const overlapped = against.some((item) => {
      if (item.date !== task.date) {
        return false;
      }
      const otherStart = parseTimeToMinutes(item.startTime);
      const otherEnd = parseTimeToMinutes(item.endTime);
      return otherStart !== null && otherEnd !== null && start < otherEnd && end > otherStart;
    });
    if (overlapped) {
      throw new Error(`任务时间冲突：${task.date} ${task.startTime}-${task.endTime}`);
    }
  }

  private insertTask(task: Task): void {
    const month = toMonthKeyFromTask(task);
    const existing = this.tasks.get(month) ?? [];
    existing.push(task);
    existing.sort(compareSeriesTasks);
    this.tasks.set(month, existing);
  }

  private replaceTasks(idsToRemove: string[], replacements: Task[]): Task[] {
    const removed: Task[] = [];
    const targetIds = new Set(idsToRemove);
    for (const [month, tasks] of this.tasks.entries()) {
      const nextTasks = tasks.filter((task) => {
        const shouldKeep = !targetIds.has(task.id);
        if (!shouldKeep) {
          removed.push(task);
        }
        return shouldKeep;
      });
      if (nextTasks.length === 0) {
        this.tasks.delete(month);
      } else {
        this.tasks.set(month, nextTasks);
      }
    }
    for (const task of replacements) {
      this.insertTask(task);
    }
    return removed;
  }

  private findTask(taskId: string): Task | undefined {
    for (const tasks of this.tasks.values()) {
      const found = tasks.find((task) => task.id === taskId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  private async loadConfigFile(): Promise<PluginConfig> {
    const path = this.pathFor(CONFIG_FILE);
    const existing = await this.readJson<PluginConfig>(path);
    return { ...DEFAULT_CONFIG, ...existing };
  }

  private async loadProjects(): Promise<void> {
    const data = await this.readJson<ProjectsFile>(this.pathFor(PROJECTS_FILE));
    this.projects = data?.projects ?? [];
  }

  private async loadProgressPages(): Promise<void> {
    const data = await this.readJson<ProgressPagesFile>(this.pathFor(PROGRESS_FILE));
    this.progressPages = data?.pages ?? [];
  }

  private async loadTasks(): Promise<void> {
    const tasksFolder = this.pathFor(TASKS_DIR);
    const folder = this.app.vault.getAbstractFileByPath(tasksFolder);
    if (!(folder instanceof TFolder)) {
      this.tasks.clear();
      return;
    }
    this.tasks.clear();
    for (const child of folder.children) {
      if (child instanceof TFolder || !child.name.endsWith(".json")) {
        continue;
      }
      const data = await this.readJson<TasksFile>(child.path);
      const month = child.name.replace(/\.json$/, "");
      this.tasks.set(month, (data?.tasks ?? []).map(cloneTask));
    }
  }

  private async ensureDataFolder(): Promise<void> {
    const validated = await this.validateDataFolder(this.config.dataFolder);
    if (!validated.ok) {
      throw new Error(validated.message);
    }
    await this.ensureFolder(this.config.dataFolder);
    await this.ensureFolder(this.pathFor(TASKS_DIR));
  }

  private pathFor(child: string): string {
    return normalizePath(`${sanitizeFolder(this.config.dataFolder)}/${child}`);
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    if (!this.app.vault.getAbstractFileByPath(normalized)) {
      await this.app.vault.createFolder(normalized);
    }
  }

  private async readJson<T>(path: string): Promise<T | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      return null;
    }
    try {
      const raw = await this.app.vault.cachedRead(file as any);
      return JSON.parse(raw) as T;
    } catch (error) {
      console.error("Failed to read JSON file", path, error);
      new Notice(`读取数据失败: ${path}`);
      return null;
    }
  }

  private async writeJson(path: string, data: unknown): Promise<void> {
    const normalized = normalizePath(path);
    const payload = JSON.stringify(data, null, 2);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!file) {
      await this.app.vault.create(normalized, payload);
      return;
    }
    await this.app.vault.modify(file as any, payload);
  }

  private async enqueueWrite(job: () => Promise<void>): Promise<void> {
    this.writeQueue = this.writeQueue.then(job);
    return this.writeQueue;
  }

  private async persistMonths(months: string[]): Promise<void> {
    const uniqueMonths = [...new Set(months)];
    await this.enqueueWrite(async () => {
      for (const month of uniqueMonths) {
        await this.flushMonth(month);
      }
    });
  }

  private async flushMonth(month: string): Promise<void> {
    const path = this.pathFor(`${TASKS_DIR}/${month}.json`);
    const tasks = this.tasks.get(month) ?? [];
    if (tasks.length === 0) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file) {
        await this.app.vault.delete(file);
      }
      return;
    }
    await this.writeJson(path, { month, tasks } satisfies TasksFile);
  }

  private async flushAllTasks(): Promise<void> {
    const months = new Set<string>([
      ...this.tasks.keys(),
      ...collectMonthFiles(this.app, this.pathFor(TASKS_DIR))
    ]);
    for (const month of months) {
      await this.flushMonth(month);
    }
  }

  private async flushAll(): Promise<void> {
    await this.enqueueWrite(async () => {
      await this.writeJson(this.pathFor(CONFIG_FILE), this.config);
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects });
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages });
      await this.flushAllTasks();
    });
  }
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    occurrenceDates: [...task.occurrenceDates],
    completedOccurrences: task.completedOccurrences.map((item) => ({ ...item }))
  };
}

function expandTask(task: Task): TaskOccurrence[] {
  return task.occurrenceDates.map((date, index) => {
    const completedRecord = task.completedOccurrences.find((item) => item.date === date);
    return {
      id: buildOccurrenceKey(task.id, date),
      taskId: task.id,
      occurrenceDate: date,
      occurrenceNumber: index + 1,
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      date,
      startTime: task.startTime,
      endTime: task.endTime,
      recurrence: task.recurrence,
      recurrenceCount: task.recurrenceCount ?? null,
      recurrenceUntil: task.recurrenceUntil ?? null,
      completed: Boolean(completedRecord),
      completedAt: completedRecord?.completedAt ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };
  });
}

function buildOccurrenceDates(input: TaskInput): string[] {
  const countLimit = input.recurrenceCount ?? (input.recurrence === "once" ? 1 : 365);
  const until = input.recurrenceUntil ?? null;
  const dates: string[] = [];
  let cursor = parseDateKey(input.date);
  let createdCount = 0;

  while (true) {
    const dateKey = toDateKey(cursor);
    if (until && compareDateKeys(dateKey, until) > 0) {
      break;
    }
    if (input.recurrence !== "once" && input.recurrenceCount && createdCount >= input.recurrenceCount) {
      break;
    }
    if (input.recurrence === "once" && createdCount >= 1) {
      break;
    }

    dates.push(dateKey);
    createdCount += 1;

    if (input.recurrence === "once") {
      break;
    }

    cursor = addDays(cursor, input.recurrence === "daily" ? 1 : 7);
    if (createdCount >= countLimit && !input.recurrenceCount) {
      break;
    }
  }

  if (dates.length === 0) {
    throw new Error("未生成任何任务，请检查重复结束日期");
  }

  return dates;
}

function resolveCompletedOccurrences(params: {
  input: TaskInput;
  original?: Task;
  occurrenceDates: string[];
  timestamp: string;
  completedPatch?: boolean;
}): Array<{ date: string; completedAt: string }> {
  const { input, original, occurrenceDates, timestamp, completedPatch } = params;
  if (completedPatch === true || (original === undefined && input.completed)) {
    return occurrenceDates.map((date) => ({ date, completedAt: timestamp }));
  }
  if (completedPatch === false) {
    return [];
  }
  const existing = new Map((original?.completedOccurrences ?? []).map((item) => [item.date, item.completedAt]));
  return occurrenceDates
    .filter((date) => existing.has(date))
    .map((date) => ({ date, completedAt: existing.get(date)! }));
}

function upsertCompletionRecord(
  records: Array<{ date: string; completedAt: string }>,
  date: string,
  completedAt: string
): Array<{ date: string; completedAt: string }> {
  const existing = records.find((item) => item.date === date);
  if (existing) {
    return records.map((item) => (item.date === date ? { ...item, completedAt } : { ...item }));
  }
  return [...records.map((item) => ({ ...item })), { date, completedAt }];
}

function buildOccurrenceKey(taskId: string, date: string): string {
  return `${taskId}::${date}`;
}

function occurrenceKeysForTask(task: Task): Set<string> {
  return new Set(task.occurrenceDates.map((date) => buildOccurrenceKey(task.id, date)));
}

function isTaskFullyCompleted(task: Task): boolean {
  return task.occurrenceDates.length > 0 && task.completedOccurrences.length === task.occurrenceDates.length;
}

function detectRecurrenceFromDates(dates: string[]): TaskRecurrence {
  if (dates.length <= 1) {
    return "once";
  }
  const first = parseDateKey(dates[0]);
  const second = parseDateKey(dates[1]);
  const diffDays = Math.round((second.getTime() - first.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 1) {
    return "daily";
  }
  if (diffDays === 7) {
    return "weekly";
  }
  return "once";
}

function normalizePositiveInteger(value?: number | null): number | null {
  if (value === null || value === undefined || value === 0) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("重复次数必须为正整数");
  }
  return Math.floor(value);
}

function normalizeDateOrUndefined(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("重复结束日期格式错误");
  }
  return trimmed;
}

function collectMonthFiles(app: App, tasksFolder: string): string[] {
  const folder = app.vault.getAbstractFileByPath(tasksFolder);
  if (!(folder instanceof TFolder)) {
    return [];
  }
  return folder.children
    .filter((child) => !(child instanceof TFolder) && child.name.endsWith(".json"))
    .map((child) => child.name.replace(/\.json$/, ""));
}

function sanitizeFolder(value: string): string {
  return value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function toMonthKeyFromTask(task: Task): string {
  return task.date.slice(0, 7);
}

function monthsForTasks(tasks: Task[]): string[] {
  return tasks.map((task) => toMonthKeyFromTask(task));
}

function compareSeriesTasks(a: Task, b: Task): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }
  const startA = parseTimeToMinutes(a.startTime);
  const startB = parseTimeToMinutes(b.startTime);
  if (startA === null && startB === null) {
    return a.title.localeCompare(b.title);
  }
  if (startA === null) {
    return 1;
  }
  if (startB === null) {
    return -1;
  }
  return startA - startB || a.title.localeCompare(b.title);
}

function compareOccurrences(a: TaskOccurrence, b: TaskOccurrence): number {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }
  if (!!a.completed !== !!b.completed) {
    return a.completed ? 1 : -1;
  }
  const startA = parseTimeToMinutes(a.startTime);
  const startB = parseTimeToMinutes(b.startTime);
  if (startA === null && startB === null) {
    return a.occurrenceNumber - b.occurrenceNumber || a.title.localeCompare(b.title);
  }
  if (startA === null) {
    return 1;
  }
  if (startB === null) {
    return -1;
  }
  return startA - startB || a.title.localeCompare(b.title);
}

function randomColor(): string {
  const palette = ["#3d8bfd", "#0f9d58", "#ff8c42", "#d64550", "#8a5cf6", "#188fa7"];
  return palette[Math.floor(Math.random() * palette.length)];
}
