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
  TaskKind,
  TaskOccurrence,
  TaskOccurrenceState,
  TaskRecurrence,
  TaskSubtask,
  TaskSubtaskInput,
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
  private readOnlyReason: string | null = null;

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
    this.assertWritable();
    const previousFolder = sanitizeFolder(this.config.dataFolder);
    const nextFolder = sanitizeFolder(next.dataFolder);
    const nextConfig = { ...next, dataFolder: nextFolder };
    if (previousFolder !== nextFolder) {
      await this.flushPendingWrites();
      const currentData = this.captureDataState();
      const usage = await this.inspectDataFolder(nextFolder);
      this.config = structuredClone(nextConfig);
      await this.ensureDataFolder();
      if (usage.hasData && usage.invalidPaths.length === 0) {
        const failedPaths = await this.loadCurrentFolderData();
        if (failedPaths.length === 0) {
          await this.flushAll();
          await this.reloadCurrentFolderData();
          new Notice(`数据目录已切换到 ${nextFolder}，已使用目标目录中的现有数据`);
        } else {
          this.restoreDataState(currentData);
          this.config = structuredClone(nextConfig);
          await this.flushAll();
          await this.reloadCurrentFolderData();
          new Notice(`目标目录数据格式异常，已用当前数据重新创建：${failedPaths.join("、")}`, 0);
        }
      } else {
        this.restoreDataState(currentData);
        await this.flushAll();
        await this.reloadCurrentFolderData();
        if (usage.invalidPaths.length > 0) {
          new Notice(`目标目录数据格式异常，已用当前数据重新创建：${usage.invalidPaths.join("、")}`, 0);
        } else {
          new Notice(`数据目录已切换到 ${nextFolder}，已创建新的数据文件`);
        }
      }
    } else {
      this.config = structuredClone(nextConfig);
      await this.ensureDataFolder();
      await this.enqueueWrite(() => this.writeJson(this.pathFor(CONFIG_FILE), this.config));
      await this.reloadCurrentFolderData();
    }
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
    const configResult = await this.loadConfigFile();
    this.config = configResult.config;
    await this.ensureDataFolder();
    const failedPaths = [...configResult.failedPaths, ...(await this.loadCurrentFolderData())].filter((path, index, list) => list.indexOf(path) === index);
    if (failedPaths.length > 0) {
      this.readOnlyReason = `检测到数据文件读取失败，已进入只读保护：${failedPaths.join("、")}`;
      new Notice(this.readOnlyReason, 0);
      console.error(this.readOnlyReason);
      return;
    }
    this.readOnlyReason = null;
    await this.flushAll();
  }

  async refreshFromDisk(options: { triggerChange?: boolean } = {}): Promise<void> {
    const { triggerChange = true } = options;
    const failedPaths = await this.loadCurrentFolderData();
    if (failedPaths.length > 0) {
      this.readOnlyReason = `检测到数据文件读取失败，已进入只读保护：${failedPaths.join("、")}`;
      throw new Error(this.readOnlyReason);
    }
    this.readOnlyReason = null;
    if (triggerChange) {
      this.trigger("changed");
    }
  }

  async flushPendingWrites(): Promise<void> {
    await this.writeQueue;
    if (!this.readOnlyReason) {
      await this.flushAll();
    }
  }

  async validateDataFolder(path: string): Promise<{ ok: boolean; message?: string }> {
    const raw = path.trim();
    const cleaned = sanitizeFolder(path);
    if (!cleaned) {
      return { ok: false, message: "数据目录不能为空" };
    }
    if (raw.startsWith("/") || cleaned.includes("..")) {
      return { ok: false, message: "数据目录必须是 Vault 内相对路径" };
    }
    const normalized = normalizePath(cleaned);
    const abstract = this.app.vault.getAbstractFileByPath(normalized);
    const stat = abstract ? null : await this.app.vault.adapter.stat(normalized);
    if (!abstract && !stat) {
      return { ok: true };
    }
    if (abstract && !(abstract instanceof TFolder)) {
      return { ok: false, message: "数据目录路径已被文件占用" };
    }
    if (!abstract && stat?.type !== "folder") {
      return { ok: false, message: "数据目录路径已被文件占用" };
    }

    const children = abstract instanceof TFolder ? abstract.children.map((child) => ({ name: child.name, isFolder: child instanceof TFolder })) : await this.listFolderEntries(normalized);
    const allowed = new Set([CONFIG_FILE, PROJECTS_FILE, PROGRESS_FILE, TASKS_DIR]);
    const invalid = children.some((child) => !allowed.has(child.name));
    if (invalid) {
      return { ok: false, message: "目录中存在非插件文件，拒绝使用" };
    }
    const invalidTasksPath = children.some((child) => child.name === TASKS_DIR && !child.isFolder);
    if (invalidTasksPath) {
      return { ok: false, message: "tasks 路径已被文件占用" };
    }
    return { ok: true };
  }

  async createTask(input: TaskInput): Promise<Task> {
    this.assertWritable();
    const normalized = this.normalizeTaskInput(input);
    const created = this.buildSeriesTask(normalized);
    this.assertNoConflicts([created], new Set());
    this.insertTask(created);
    await this.persistMonths(monthsForTasks([created]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return cloneTask(this.findTask(created.id) ?? created);
  }

  async updateTask(taskId: string, patch: Partial<TaskInput> & { completed?: boolean }, _scope: TaskUpdateScope = "series"): Promise<Task> {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("任务不存在");
    }
    const merged = this.normalizeTaskInput({
      kind: patch.kind ?? original.kind,
      title: patch.title ?? original.title,
      description: patch.description ?? original.description,
      projectId: patch.projectId === undefined ? original.projectId : patch.projectId,
      date: patch.date ?? original.date,
      startTime: patch.startTime === undefined ? original.startTime : patch.startTime,
      endTime: patch.endTime === undefined ? original.endTime : patch.endTime,
      recurrence: patch.recurrence ?? original.recurrence,
      recurrenceCount: patch.recurrenceCount ?? original.recurrenceCount ?? undefined,
      recurrenceUntil: patch.recurrenceUntil ?? original.recurrenceUntil ?? undefined,
      subtasks: patch.subtasks ?? original.subtasks,
      completed: patch.completed ?? isTaskFullyCompleted(original)
    });

    const next = this.buildSeriesTask(merged, original, patch.completed);
    this.assertNoConflicts([next], occurrenceKeysForTask(original));
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return cloneTask(this.findTask(next.id) ?? next);
  }

  async updateTaskOccurrenceCompletion(taskId: string, date: string, completed: boolean): Promise<void> {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("任务不存在");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("任务发生日期不存在");
    }
    const next = cloneTask(original);
    next.occurrenceStates = completed
      ? upsertOccurrenceState(original, date, {
          completedSubtaskIds: getAllSubtaskIds(original),
          completedAt: toIsoLocal(now())
        })
      : next.occurrenceStates.filter((item) => item.date !== date);
    next.updatedAt = toIsoLocal(now());
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async updateTaskOccurrenceSubtaskCompletion(taskId: string, date: string, subtaskId: string, completed: boolean): Promise<void> {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("任务不存在");
    }
    if (original.kind !== "composite") {
      throw new Error("当前任务不是组合任务");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("任务发生日期不存在");
    }
    if (!original.subtasks.some((item) => item.id === subtaskId)) {
      throw new Error("子任务不存在");
    }

    const state = getOccurrenceState(original, date);
    const completedSubtaskIds = new Set(state?.completedSubtaskIds ?? []);
    if (completed) {
      completedSubtaskIds.add(subtaskId);
    } else {
      completedSubtaskIds.delete(subtaskId);
    }

    const next = cloneTask(original);
    const nextCompletedIds = original.subtasks.map((item) => item.id).filter((id) => completedSubtaskIds.has(id));
    next.occurrenceStates =
      nextCompletedIds.length === 0
        ? next.occurrenceStates.filter((item) => item.date !== date)
        : upsertOccurrenceState(original, date, {
            completedSubtaskIds: nextCompletedIds,
            completedAt: nextCompletedIds.length === original.subtasks.length ? toIsoLocal(now()) : null
          });
    next.updatedAt = toIsoLocal(now());
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async deleteTask(taskId: string, scope: TaskDeleteScope = "series"): Promise<void> {
    this.assertWritable();
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
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async deleteTaskOccurrence(taskId: string, date: string): Promise<void> {
    this.assertWritable();
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
      await this.reloadCurrentFolderData();
      this.trigger("changed");
      return;
    }
    const next = cloneTask(task);
    next.occurrenceDates = task.occurrenceDates.filter((entry) => entry !== date);
    next.occurrenceStates = task.occurrenceStates.filter((entry) => entry.date !== date);
    next.date = next.occurrenceDates[0];
    next.recurrence = detectRecurrenceFromDates(next.occurrenceDates);
    next.recurrenceCount = next.recurrence === "once" ? null : next.occurrenceDates.length;
    next.recurrenceUntil = next.recurrence === "once" ? null : next.occurrenceDates[next.occurrenceDates.length - 1];
    next.updatedAt = toIsoLocal(now());
    this.assertNoConflicts([next], occurrenceKeysForTask(task));
    this.replaceTasks([task.id], [next]);
    await this.persistMonths(monthsForTasks([task, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async completeTaskSeries(taskId: string, throughDate?: string): Promise<void> {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    const effectiveDate = throughDate ?? task.occurrenceDates[task.occurrenceDates.length - 1];
    const next = cloneTask(task);
    const remainingDates = task.occurrenceDates.filter((date) => compareDateKeys(date, effectiveDate) <= 0);
    const stamp = toIsoLocal(now());
    next.occurrenceDates = remainingDates;
    next.occurrenceStates = remainingDates.reduce<TaskOccurrenceState[]>((records, date) => {
      const existing = getOccurrenceState(task, date);
      records.push(
        existing
          ? buildNormalizedOccurrenceState(date, task.kind, task.subtasks, existing.completedSubtaskIds ?? getAllSubtaskIds(task), stamp)
          : buildNormalizedOccurrenceState(date, task.kind, task.subtasks, getAllSubtaskIds(task), stamp)
      );
      return records;
    }, []);
    next.date = next.occurrenceDates[0];
    next.recurrence = detectRecurrenceFromDates(next.occurrenceDates);
    next.recurrenceCount = next.recurrence === "once" ? null : next.occurrenceDates.length;
    next.recurrenceUntil = next.recurrence === "once" ? null : next.occurrenceDates[next.occurrenceDates.length - 1];
    next.updatedAt = stamp;
    this.replaceTasks([task.id], [next]);
    await this.persistMonths(monthsForTasks([task, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async createProject(input: ProjectInput): Promise<Project> {
    this.assertWritable();
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
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return { ...project };
  }

  async updateProject(projectId: string, patch: Partial<ProjectInput>): Promise<void> {
    this.assertWritable();
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
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async deleteProject(projectId: string): Promise<void> {
    this.assertWritable();
    this.projects = this.projects.filter((project) => project.id !== projectId);
    this.progressPages = this.progressPages.filter((page) => page.projectId !== projectId);
    const removedTasks = this.replaceTasks(
      this.getTasksForProject(projectId).map((task) => task.id),
      []
    );
    const affectedMonths = [...new Set(monthsForTasks(removedTasks))];
    await this.enqueueWrite(async () => {
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects });
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages });
      for (const month of affectedMonths) {
        await this.flushMonth(month);
      }
    });
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async reorderProgressPage(projectId: string, direction: -1 | 1): Promise<void> {
    this.assertWritable();
    const index = this.progressPages.findIndex((page) => page.projectId === projectId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= this.progressPages.length) {
      return;
    }
    const [item] = this.progressPages.splice(index, 1);
    this.progressPages.splice(target, 0, item);
    await this.enqueueWrite(() => this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages }));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  getProjectProgress(projectId: string): number {
    const progress = summarizeOccurrencesProgress(this.getOccurrencesForProject(projectId));
    if (progress.totalSteps === 0) {
      return 0;
    }
    return Math.round((progress.completedSteps / progress.totalSteps) * 100);
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
    const kind = input.kind ?? "simple";
    const recurrenceCount = recurrence === "once" ? null : normalizePositiveInteger(input.recurrenceCount);
    const recurrenceUntil = recurrence === "once" ? null : normalizeDateOrUndefined(input.recurrenceUntil);
    const subtasks = normalizeSubtaskInputs(input.subtasks, kind);

    if (recurrence !== "once" && !recurrenceCount && !recurrenceUntil) {
      throw new Error("重复任务必须填写重复次数或结束日期");
    }
    if (recurrenceUntil && compareDateKeys(recurrenceUntil, date) < 0) {
      throw new Error("重复结束日期不能早于首个任务日期");
    }

    return {
      kind,
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || undefined,
      date,
      startTime,
      endTime,
      recurrence,
      recurrenceCount,
      recurrenceUntil,
      subtasks,
      completed: input.completed ?? false
    };
  }

  private buildSeriesTask(input: TaskInput, original?: Task, completedPatch?: boolean): Task {
    const timestamp = toIsoLocal(now());
    const occurrenceDates = buildOccurrenceDates(input);
    const subtasks = resolveTaskSubtasks(input.subtasks, input.kind ?? "simple", original?.subtasks ?? []);
    const occurrenceStates = resolveOccurrenceStates({
      input,
      original,
      subtasks,
      occurrenceDates,
      timestamp,
      completedPatch
    });
    return {
      id: original?.id ?? crypto.randomUUID(),
      kind: input.kind ?? "simple",
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      date: occurrenceDates[0],
      startTime: input.startTime,
      endTime: input.endTime,
      recurrence: input.recurrence,
      recurrenceCount: input.recurrenceCount ?? null,
      recurrenceUntil: input.recurrenceUntil ?? null,
      subtasks,
      occurrenceDates,
      occurrenceStates,
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

  private async loadConfigFile(): Promise<{ config: PluginConfig; failedPaths: string[] }> {
    const path = this.pathFor(CONFIG_FILE);
    const dataFolder = sanitizeFolder(this.config.dataFolder);
    const existing = await this.readJson<Partial<PluginConfig>>(path, isPartialPluginConfig);
    return {
      config: { ...DEFAULT_CONFIG, ...this.config, ...(existing.value ?? {}), dataFolder },
      failedPaths: existing.ok ? [] : [existing.path!]
    };
  }

  private async loadProjects(): Promise<BatchReadResult> {
    const data = await this.readJson<ProjectsFile>(this.pathFor(PROJECTS_FILE), isProjectsFile);
    this.projects = data.value?.projects ?? [];
    return { failedPaths: data.ok ? [] : [data.path!] };
  }

  private async loadProgressPages(): Promise<BatchReadResult> {
    const data = await this.readJson<ProgressPagesFile>(this.pathFor(PROGRESS_FILE), isProgressPagesFile);
    this.progressPages = data.value?.pages ?? [];
    return { failedPaths: data.ok ? [] : [data.path!] };
  }

  private async loadTasks(): Promise<BatchReadResult> {
    const tasksFolder = this.pathFor(TASKS_DIR);
    const folder = this.app.vault.getAbstractFileByPath(tasksFolder);
    const folderStat = folder ? null : await this.app.vault.adapter.stat(tasksFolder);
    if ((folder && !(folder instanceof TFolder)) || (!folder && folderStat && folderStat.type !== "folder")) {
      return { failedPaths: [tasksFolder] };
    }
    if (!folder && !folderStat) {
      this.tasks.clear();
      return { failedPaths: [] };
    }
    this.tasks.clear();
    const failedPaths: string[] = [];
    const monthFiles = await this.collectMonthFilePaths(tasksFolder);
    for (const childPath of monthFiles) {
      const data = await this.readJson<TasksFile>(childPath, isTasksFile);
      const month = childPath.split("/").pop()?.replace(/\.json$/, "") ?? "";
      if (!data.ok) {
        failedPaths.push(childPath);
      }
      this.tasks.set(month, (data.value?.tasks ?? []).map(normalizeStoredTask));
    }
    return { failedPaths };
  }

  private async loadCurrentFolderData(): Promise<string[]> {
    const configResult = await this.loadConfigFile();
    this.config = configResult.config;
    await this.ensureDataFolder();
    const projectResult = await this.loadProjects();
    const progressResult = await this.loadProgressPages();
    const taskResult = await this.loadTasks();
    return [...configResult.failedPaths, ...projectResult.failedPaths, ...progressResult.failedPaths, ...taskResult.failedPaths].filter(
      (path, index, list) => list.indexOf(path) === index
    );
  }

  private async reloadCurrentFolderData(): Promise<void> {
    await this.refreshFromDisk({ triggerChange: false });
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
    return this.pathInFolder(this.config.dataFolder, child);
  }

  private pathInFolder(folder: string, child: string): string {
    return normalizePath(`${sanitizeFolder(folder)}/${child}`);
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof TFolder) {
      return;
    }
    if (existing) {
      throw new Error(`${normalized} 已被文件占用`);
    }
    const existingStat = await this.app.vault.adapter.stat(normalized);
    if (existingStat?.type === "folder") {
      return;
    }
    if (existingStat?.type === "file") {
      throw new Error(`${normalized} 已被文件占用`);
    }
    try {
      await this.app.vault.createFolder(normalized);
    } catch (error) {
      const current = this.app.vault.getAbstractFileByPath(normalized);
      const currentStat = current ? null : await this.app.vault.adapter.stat(normalized);
      if ((current instanceof TFolder || currentStat?.type === "folder") && isFolderAlreadyExistsError(error)) {
        return;
      }
      throw error;
    }
  }

  private async readJson<T>(path: string, validate?: (value: unknown) => value is T, notifyOnError = true): Promise<ReadResult<T>> {
    const file = this.app.vault.getAbstractFileByPath(path);
    try {
      const raw = file ? await this.app.vault.cachedRead(file as any) : await this.readTextFromAdapter(path);
      if (raw === null) {
        return { ok: true, value: null };
      }
      const parsed = JSON.parse(raw) as unknown;
      if (validate && !validate(parsed)) {
        throw new Error("数据结构不符合当前插件格式");
      }
      return { ok: true, value: parsed as T };
    } catch (error) {
      console.error("Failed to read JSON file", path, error);
      if (notifyOnError) {
        new Notice(`读取数据失败，已停止自动写回: ${path}`, 0);
      }
      return { ok: false, value: null, path };
    }
  }

  private async writeJson(path: string, data: unknown): Promise<void> {
    const normalized = normalizePath(path);
    const payload = JSON.stringify(data, null, 2);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!file) {
      await this.app.vault.adapter.write(normalized, payload);
      return;
    }
    await this.app.vault.modify(file as any, payload);
  }

  private async enqueueWrite(job: () => Promise<void>): Promise<void> {
    const run = this.writeQueue.catch(() => undefined).then(job);
    this.writeQueue = run.catch((error) => {
      console.error("Project management data write failed", error);
    });
    return run;
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
      ...(await this.collectMonthFiles(this.pathFor(TASKS_DIR)))
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

  private assertWritable(): void {
    if (this.readOnlyReason) {
      throw new Error(this.readOnlyReason);
    }
  }

  private captureDataState(): StoreDataState {
    return {
      projects: this.projects.map((project) => ({ ...project })),
      progressPages: this.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] })),
      tasks: new Map([...this.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)]))
    };
  }

  private restoreDataState(state: StoreDataState): void {
    this.projects = state.projects.map((project) => ({ ...project }));
    this.progressPages = state.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] }));
    this.tasks = new Map([...state.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)]));
  }

  private async inspectDataFolder(folder: string): Promise<DataFolderUsage> {
    const normalized = normalizePath(sanitizeFolder(folder));
    const abstract = this.app.vault.getAbstractFileByPath(normalized);
    const stat = abstract ? null : await this.app.vault.adapter.stat(normalized);
    if ((abstract && !(abstract instanceof TFolder)) || (!abstract && stat && stat.type !== "folder")) {
      return { hasData: true, invalidPaths: [normalized] };
    }
    if (!abstract && !stat) {
      return { hasData: false, invalidPaths: [] };
    }

    const invalidPaths: string[] = [];
    let hasData = false;
    const check = async <T>(path: string, validate: (value: unknown) => value is T): Promise<void> => {
      const current = this.app.vault.getAbstractFileByPath(path);
      const currentStat = current ? null : await this.app.vault.adapter.stat(path);
      if (current && current instanceof TFolder) {
        hasData = true;
        invalidPaths.push(path);
        return;
      }
      if (!current && !currentStat) {
        return;
      }
      hasData = true;
      const result = await this.readJson<T>(path, validate, false);
      if (!result.ok) {
        invalidPaths.push(path);
      }
    };

    await check<Partial<PluginConfig>>(this.pathInFolder(folder, CONFIG_FILE), isPartialPluginConfig);
    await check<ProjectsFile>(this.pathInFolder(folder, PROJECTS_FILE), isProjectsFile);
    await check<ProgressPagesFile>(this.pathInFolder(folder, PROGRESS_FILE), isProgressPagesFile);

    const tasksPath = this.pathInFolder(folder, TASKS_DIR);
    const tasksFolder = this.app.vault.getAbstractFileByPath(tasksPath);
    const tasksStat = tasksFolder ? null : await this.app.vault.adapter.stat(tasksPath);
    if ((tasksFolder && !(tasksFolder instanceof TFolder)) || (!tasksFolder && tasksStat && tasksStat.type !== "folder")) {
      hasData = true;
      invalidPaths.push(tasksPath);
    } else {
      const monthFiles = await this.collectMonthFilePaths(tasksPath);
      for (const childPath of monthFiles) {
        hasData = true;
        const result = await this.readJson<TasksFile>(childPath, isTasksFile, false);
        if (!result.ok) {
          invalidPaths.push(childPath);
        }
      }
    }

    return { hasData, invalidPaths };
  }

  private async readTextFromAdapter(path: string): Promise<string | null> {
    const normalized = normalizePath(path);
    const stat = await this.app.vault.adapter.stat(normalized);
    if (!stat) {
      return null;
    }
    if (stat.type !== "file") {
      throw new Error(`${normalized} 不是文件`);
    }
    return this.app.vault.adapter.read(normalized);
  }

  private async listFolderEntries(path: string): Promise<Array<{ name: string; isFolder: boolean }>> {
    try {
      const listed = await this.app.vault.adapter.list(normalizePath(path));
      return [
        ...listed.folders.map((folder) => ({ name: folder.split("/").pop() ?? folder, isFolder: true })),
        ...listed.files.map((file) => ({ name: file.split("/").pop() ?? file, isFolder: false }))
      ];
    } catch {
      return [];
    }
  }

  private async collectMonthFilePaths(tasksFolder: string): Promise<string[]> {
    const folder = this.app.vault.getAbstractFileByPath(tasksFolder);
    if (folder instanceof TFolder) {
      return folder.children
        .filter((child) => !(child instanceof TFolder) && child.name.endsWith(".json"))
        .map((child) => child.path);
    }
    const entries = await this.listFolderEntries(tasksFolder);
    return entries
      .filter((child) => !child.isFolder && child.name.endsWith(".json"))
      .map((child) => normalizePath(`${tasksFolder}/${child.name}`));
  }

  private async collectMonthFiles(tasksFolder: string): Promise<string[]> {
    const paths = await this.collectMonthFilePaths(tasksFolder);
    return paths.map((path) => path.split("/").pop()?.replace(/\.json$/, "") ?? "").filter(Boolean);
  }
}

type ReadResult<T> = {
  ok: boolean;
  value: T | null;
  path?: string;
};

type BatchReadResult = {
  failedPaths: string[];
};

type StoreDataState = {
  projects: Project[];
  progressPages: ProgressPage[];
  tasks: Map<string, Task[]>;
};

type DataFolderUsage = {
  hasData: boolean;
  invalidPaths: string[];
};

function normalizeStoredTask(task: Task & { completedOccurrences?: Array<{ date: string; completedAt: string }> }): Task {
  const kind: TaskKind = task.kind ?? ((task.subtasks?.length ?? 0) > 0 ? "composite" : "simple");
  const subtasks = (task.subtasks ?? []).map((item) => ({ id: item.id, title: item.title }));
  const legacyStates = (task.completedOccurrences ?? []).map((item) =>
    buildNormalizedOccurrenceState(item.date, kind, subtasks, subtasks.map((subtask) => subtask.id), item.completedAt)
  );
  const occurrenceStates = (task.occurrenceStates ?? legacyStates).map((item) =>
    buildNormalizedOccurrenceState(item.date, kind, subtasks, item.completedSubtaskIds ?? subtasks.map((subtask) => subtask.id), item.completedAt ?? null)
  );
  return {
    ...task,
    kind,
    subtasks,
    occurrenceStates
  };
}

function isPartialPluginConfig(value: unknown): value is Partial<PluginConfig> {
  return isRecord(value);
}

function isProjectsFile(value: unknown): value is ProjectsFile {
  return isRecord(value) && Array.isArray(value.projects) && value.projects.every(isRecord);
}

function isProgressPagesFile(value: unknown): value is ProgressPagesFile {
  return isRecord(value) && Array.isArray(value.pages) && value.pages.every(isRecord);
}

function isTasksFile(value: unknown): value is TasksFile {
  return isRecord(value) && typeof value.month === "string" && Array.isArray(value.tasks) && value.tasks.every(isStoredTaskRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredTaskRecord(value: unknown): value is Task {
  if (!isRecord(value)) {
    return false;
  }
  const subtasks = value.subtasks;
  const occurrenceStates = value.occurrenceStates;
  const completedOccurrences = value.completedOccurrences;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.date === "string" &&
    typeof value.recurrence === "string" &&
    Array.isArray(value.occurrenceDates) &&
    value.occurrenceDates.every((date) => typeof date === "string") &&
    (subtasks === undefined || (Array.isArray(subtasks) && subtasks.every(isTaskSubtaskRecord))) &&
    (occurrenceStates === undefined || (Array.isArray(occurrenceStates) && occurrenceStates.every(isOccurrenceStateRecord))) &&
    (completedOccurrences === undefined || (Array.isArray(completedOccurrences) && completedOccurrences.every(isCompletedOccurrenceRecord)))
  );
}

function isTaskSubtaskRecord(value: unknown): value is TaskSubtask {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string";
}

function isOccurrenceStateRecord(value: unknown): value is TaskOccurrenceState {
  return isRecord(value) && typeof value.date === "string";
}

function isCompletedOccurrenceRecord(value: unknown): value is { date: string; completedAt: string } {
  return isRecord(value) && typeof value.date === "string" && typeof value.completedAt === "string";
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    subtasks: task.subtasks.map((item) => ({ ...item })),
    occurrenceDates: [...task.occurrenceDates],
    occurrenceStates: task.occurrenceStates.map((item) => ({
      ...item,
      completedSubtaskIds: [...(item.completedSubtaskIds ?? [])]
    }))
  };
}

function expandTask(task: Task): TaskOccurrence[] {
  return task.occurrenceDates.map((date, index) => {
    const state = getOccurrenceState(task, date);
    const progress = getOccurrenceProgress(task, date);
    return {
      id: buildOccurrenceKey(task.id, date),
      taskId: task.id,
      occurrenceDate: date,
      occurrenceNumber: index + 1,
      kind: task.kind,
      title: task.title,
      description: task.description,
      projectId: task.projectId,
      date,
      startTime: task.startTime,
      endTime: task.endTime,
      recurrence: task.recurrence,
      recurrenceCount: task.recurrenceCount ?? null,
      recurrenceUntil: task.recurrenceUntil ?? null,
      subtasks: task.subtasks.map((item) => ({ ...item })),
      completedSubtaskIds: [...progress.completedSubtaskIds],
      progress: progress.progress,
      totalSteps: progress.totalSteps,
      completedSteps: progress.completedSteps,
      completed: progress.completed,
      completedAt: state?.completedAt ?? null,
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

function resolveOccurrenceStates(params: {
  input: TaskInput;
  original?: Task;
  subtasks: TaskSubtask[];
  occurrenceDates: string[];
  timestamp: string;
  completedPatch?: boolean;
}): TaskOccurrenceState[] {
  const { input, original, subtasks, occurrenceDates, timestamp, completedPatch } = params;
  if (completedPatch === true || (original === undefined && input.completed)) {
    return occurrenceDates.map((date) => buildNormalizedOccurrenceState(date, input.kind ?? "simple", subtasks, subtasks.map((item) => item.id), timestamp));
  }
  if (completedPatch === false) {
    return [];
  }
  return occurrenceDates
    .map((date) => {
      const existing = getOccurrenceState(original, date);
      if (!existing) {
        return null;
      }
      return buildNormalizedOccurrenceState(
        date,
        input.kind ?? "simple",
        subtasks,
        existing.completedSubtaskIds ?? (original ? getAllSubtaskIds(original) : []),
        existing.completedAt ?? null
      );
    })
    .filter((item): item is TaskOccurrenceState => Boolean(item));
}

function normalizeSubtaskInputs(subtasks: TaskSubtaskInput[] | undefined, kind: TaskKind): TaskSubtaskInput[] {
  if (kind === "simple") {
    return [];
  }
  const normalized = (subtasks ?? [])
    .map((item) => ({ id: item.id, title: item.title.trim() }))
    .filter((item) => item.title.length > 0);
  if (normalized.length === 0) {
    throw new Error("组合任务至少需要一个子任务");
  }
  return normalized;
}

function resolveTaskSubtasks(inputSubtasks: TaskSubtaskInput[] | undefined, kind: TaskKind, originalSubtasks: TaskSubtask[]): TaskSubtask[] {
  if (kind === "simple") {
    return [];
  }
  return (inputSubtasks ?? []).map((item) => {
    const original = item.id ? originalSubtasks.find((entry) => entry.id === item.id) : undefined;
    return {
      id: original?.id ?? item.id ?? crypto.randomUUID(),
      title: item.title.trim()
    };
  });
}

function getOccurrenceState(task: Task | undefined, date: string): TaskOccurrenceState | undefined {
  return task?.occurrenceStates.find((item) => item.date === date);
}

function getAllSubtaskIds(task: Task): string[] {
  if (task.kind === "composite") {
    return task.subtasks.map((item) => item.id);
  }
  return [];
}

function buildNormalizedOccurrenceState(
  date: string,
  kind: TaskKind,
  subtasks: TaskSubtask[],
  completedSubtaskIds: string[],
  completedAt: string | null
): TaskOccurrenceState {
  if (kind === "simple") {
    return {
      date,
      completedAt: completedAt ?? toIsoLocal(now())
    };
  }
  const allowedIds = new Set(subtasks.map((item) => item.id));
  const uniqueIds = [...new Set(completedSubtaskIds)].filter((id) => allowedIds.has(id));
  const isComplete = uniqueIds.length === subtasks.length;
  return {
    date,
    completedSubtaskIds: uniqueIds,
    completedAt: isComplete ? completedAt ?? toIsoLocal(now()) : null
  };
}

function upsertOccurrenceState(task: Task, date: string, patch: { completedSubtaskIds: string[]; completedAt: string | null }): TaskOccurrenceState[] {
  const nextState = buildNormalizedOccurrenceState(date, task.kind, task.subtasks, patch.completedSubtaskIds, patch.completedAt);
  const existing = getOccurrenceState(task, date);
  if (existing) {
    return task.occurrenceStates.map((item) =>
      item.date === date
        ? nextState
        : {
            ...item,
            completedSubtaskIds: [...(item.completedSubtaskIds ?? [])]
          }
    );
  }
  return [...task.occurrenceStates.map((item) => ({ ...item, completedSubtaskIds: [...(item.completedSubtaskIds ?? [])] })), nextState];
}

function getOccurrenceProgress(
  task: Task,
  date: string
): { completed: boolean; progress: number; totalSteps: number; completedSteps: number; completedSubtaskIds: string[] } {
  if (task.kind === "simple") {
    const completed = Boolean(getOccurrenceState(task, date));
    return {
      completed,
      progress: completed ? 1 : 0,
      totalSteps: 1,
      completedSteps: completed ? 1 : 0,
      completedSubtaskIds: []
    };
  }

  const totalSteps = Math.max(task.subtasks.length, 1);
  const allowedIds = new Set(task.subtasks.map((item) => item.id));
  const completedSubtaskIds = [...new Set(getOccurrenceState(task, date)?.completedSubtaskIds ?? [])].filter((id) => allowedIds.has(id));
  const completedSteps = completedSubtaskIds.length;
  return {
    completed: completedSteps === totalSteps,
    progress: completedSteps / totalSteps,
    totalSteps,
    completedSteps,
    completedSubtaskIds
  };
}

function summarizeOccurrencesProgress(occurrences: TaskOccurrence[]): { totalSteps: number; completedSteps: number } {
  return occurrences.reduce(
    (summary, occurrence) => {
      summary.totalSteps += occurrence.totalSteps;
      summary.completedSteps += occurrence.completedSteps;
      return summary;
    },
    { totalSteps: 0, completedSteps: 0 }
  );
}

function buildOccurrenceKey(taskId: string, date: string): string {
  return `${taskId}::${date}`;
}

function occurrenceKeysForTask(task: Task): Set<string> {
  return new Set(task.occurrenceDates.map((date) => buildOccurrenceKey(task.id, date)));
}

function isTaskFullyCompleted(task: Task): boolean {
  return task.occurrenceDates.length > 0 && task.occurrenceDates.every((date) => getOccurrenceProgress(task, date).completed);
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

function sanitizeFolder(value: string): string {
  return value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

function isFolderAlreadyExistsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("folder already exists") || message.includes("already exists");
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
