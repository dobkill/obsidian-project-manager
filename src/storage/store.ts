import { App, Events, Notice, TFile, TFolder, normalizePath } from "obsidian";
import {
  AutoArrangeOptions,
  AutoArrangeResult,
  PluginConfig,
  NoteTaskIndexEntry,
  NoteTaskIndexFile,
  ProgressPage,
  ProgressPagesFile,
  Project,
  ProjectInput,
  ProjectsFile,
  StoreSnapshot,
  Task,
  TaskDeleteScope,
  TaskInput,
  TaskImportCompletionMode,
  TaskImportPreview,
  TaskImportPreviewTask,
  TaskKind,
  TaskMindmapComment,
  TaskNote,
  TaskOccurrence,
  TaskOccurrenceOverride,
  TaskOccurrenceState,
  TaskPriority,
  TaskRecurrence,
  TaskSourceLink,
  TaskStatus,
  TaskSubtask,
  TaskSubtaskInput,
  TaskUpdateScope,
  TasksFile,
  TaskViewState,
  WriteHistoryFile,
  WriteHistoryRecord
} from "../types";
import { addDays, addMinutes, compareDateKeys, formatMinutesToTime, now, parseDateKey, parseTimeToMinutes, toDateKey, toIsoLocal, toMonthKey } from "../utils/date";

export const DEFAULT_CONFIG: PluginConfig = {
  version: "0.3.0",
  dataFolder: "project-manager-data",
  overviewTab1Name: "任务总览",
  overviewTab2Name: "项目进度",
  dialogTabName: "快速记录",
  weekStartsOn: "monday",
  timeSlotMinutes: 15,
  heatmapRange: "12months",
  showCompletedTasks: true,
  defaultTaskDurationMinutes: 30,
  defaultTaskStartTime: "07:00",
  dailyNoteFolder: "日记",
  dailyNoteDateFormat: "YYYY-MM-DD",
  dailyNoteMode: "per-day",
  dailyNoteSingleFilePath: "日记/快速记录.md",
  taskNoteRecentLimit: 8,
  defaultDialogTarget: "daily-note"
};

const PROJECTS_FILE = "projects.json";
const PROGRESS_FILE = "project-pages.json";
const CONFIG_FILE = "config.json";
const NOTE_TASK_INDEX_FILE = "note-task-index.json";
const WRITE_HISTORY_FILE = "write-history.json";
const TASKS_DIR = "tasks";
const UNASSIGNED_PROJECT_LABEL = "未归属项目";

export class ProjectManagementStore extends Events {
  private app: App;
  private config: PluginConfig;
  private projects: Project[] = [];
  private progressPages: ProgressPage[] = [];
  private tasks = new Map<string, Task[]>();
  private noteTaskIndex: NoteTaskIndexEntry[] = [];
  private writeHistory: WriteHistoryRecord[] = [];
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
      occurrences: this.getAllTaskOccurrences(),
      noteTaskIndex: this.noteTaskIndex.map((entry) => ({ ...entry, taskIds: [...entry.taskIds] })),
      writeHistory: this.writeHistory.map((record) => ({ ...record, taskIds: [...record.taskIds] }))
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
    this.seedDefaultDataIfEmpty();
    await this.flushAll();
    await this.normalizeDeferredSingleTasks();
  }

  async refreshFromDisk(options: { triggerChange?: boolean } = {}): Promise<void> {
    const { triggerChange = true } = options;
    const failedPaths = await this.loadCurrentFolderData();
    if (failedPaths.length > 0) {
      this.readOnlyReason = `检测到数据文件读取失败，已进入只读保护：${failedPaths.join("、")}`;
      throw new Error(this.readOnlyReason);
    }
    this.readOnlyReason = null;
    await this.normalizeDeferredSingleTasks();
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
    const allowed = new Set([CONFIG_FILE, PROJECTS_FILE, PROGRESS_FILE, NOTE_TASK_INDEX_FILE, WRITE_HISTORY_FILE, TASKS_DIR]);
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

  async createTask(input: TaskInput, options: { autoResolveConflicts?: boolean } = { autoResolveConflicts: true }): Promise<Task> {
    this.assertWritable();
    const normalized = this.normalizeTaskInput(input);
    const built = this.buildSeriesTask(normalized);
    const [created] = options.autoResolveConflicts !== false ? this.autoResolveTaskConflicts([built], new Set()) : [built];
    if (!created) {
      throw new Error("任务创建失败");
    }
    assertValidTaskMindmapParent(created, this.getAllTasks());
    this.assertNoConflicts([created], new Set());
    this.insertTask(created);
    await this.persistMonths(monthsForTasks([created]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return cloneTask(this.findTask(created.id) ?? created);
  }

  async updateTask(
    taskId: string,
    patch: Partial<TaskInput> & { completed?: boolean },
    _scope: TaskUpdateScope = "series",
    options: { autoResolveConflicts?: boolean } = {}
  ): Promise<Task> {
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
      status: patch.status ?? original.status,
      priority: patch.priority === undefined ? original.priority : patch.priority,
      tags: patch.tags ?? original.tags,
      date: patch.date ?? original.date,
      startTime: patch.startTime === undefined ? original.startTime : patch.startTime,
      endTime: patch.endTime === undefined ? original.endTime : patch.endTime,
      recurrence: patch.recurrence ?? original.recurrence,
      recurrenceCount: patch.recurrenceCount ?? original.recurrenceCount ?? undefined,
      recurrenceUntil: patch.recurrenceUntil ?? original.recurrenceUntil ?? undefined,
      occurrenceDates: patch.occurrenceDates ?? original.occurrenceDates,
      occurrenceOverrides: patch.occurrenceOverrides ?? original.occurrenceOverrides,
      subtasks: patch.subtasks ?? original.subtasks,
      viewState: patch.viewState ?? original.viewState,
      sourceLinks: patch.sourceLinks ?? original.sourceLinks,
      notes: patch.notes ?? original.notes,
      mindmapComments: patch.mindmapComments ?? original.mindmapComments,
      completed: patch.completed ?? isTaskFullyCompleted(original)
    });

    const built = this.buildSeriesTask(merged, original, patch.completed);
    const [next] = options.autoResolveConflicts ? this.autoResolveTaskConflicts([built], occurrenceKeysForTask(original)) : [built];
    if (!next) {
      throw new Error("任务更新失败");
    }
    assertValidTaskMindmapParent(next, this.getAllTasks().filter((task) => task.id !== original.id));
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

  async updateTaskOccurrenceWindow(taskId: string, date: string, startTime?: string, endTime?: string): Promise<void> {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("任务不存在");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("任务发生日期不存在");
    }
    const start = startTime?.trim() || undefined;
    const end = endTime?.trim() || undefined;
    if ((start && !end) || (!start && end)) {
      throw new Error("开始时间和结束时间必须同时填写");
    }
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      throw new Error("结束时间必须晚于开始时间");
    }

    const next = cloneTask(original);
    if (original.recurrence === "once" && original.occurrenceDates.length === 1) {
      next.startTime = start;
      next.endTime = end;
    } else {
      next.occurrenceOverrides = upsertOccurrenceOverride(next, {
        date,
        startTime: start,
        endTime: end
      });
    }
    next.updatedAt = toIsoLocal(now());
    next.revision = (next.revision ?? 0) + 1;
    this.assertNoConflicts([next], occurrenceKeysForTask(original));
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }

  async patchTask(
    taskId: string,
    patch: Partial<Pick<Task, "status" | "priority" | "tags" | "notes" | "sourceLinks" | "mindmapComments">> & { viewState?: Partial<TaskViewState> }
  ): Promise<Task> {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("任务不存在");
    }
    const next = cloneTask(original);
    if (patch.status) {
      next.status = normalizeTaskStatus(patch.status);
      next.viewState = mergeViewState(next.viewState, { board: { ...next.viewState.board, columnId: next.status } }, next.status);
    }
    if (patch.priority !== undefined) {
      next.priority = normalizeTaskPriority(patch.priority);
    }
    if (patch.tags) {
      next.tags = normalizeTags(patch.tags);
    }
    if (patch.viewState) {
      next.viewState = mergeViewState(next.viewState, patch.viewState, next.status);
    }
    if (patch.notes) {
      next.notes = normalizeTaskNotes(patch.notes);
    }
    if (patch.sourceLinks) {
      next.sourceLinks = normalizeSourceLinks(patch.sourceLinks);
    }
    if (patch.mindmapComments) {
      next.mindmapComments = normalizeMindmapComments(patch.mindmapComments, next.id);
    }
    assertValidTaskMindmapParent(next, this.getAllTasks().filter((task) => task.id !== original.id));
    next.updatedAt = toIsoLocal(now());
    next.revision = (next.revision ?? 0) + 1;
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return cloneTask(this.findTask(next.id) ?? next);
  }

  async addTaskMindmapComment(taskId: string, content: string, parentCommentId?: string | null): Promise<TaskMindmapComment> {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("任务不存在");
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("评语内容不能为空");
    }
    if (parentCommentId && !task.mindmapComments.some((comment) => comment.id === parentCommentId)) {
      throw new Error("父级评语不存在");
    }
    const timestamp = toIsoLocal(now());
    const siblingCount = task.mindmapComments.filter((comment) => (comment.parentCommentId ?? null) === (parentCommentId ?? null)).length;
    const comment: TaskMindmapComment = {
      id: crypto.randomUUID(),
      taskId,
      parentCommentId: parentCommentId ?? null,
      content: trimmed,
      childOrder: Date.now() + siblingCount,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    await this.patchTask(taskId, { mindmapComments: [...task.mindmapComments, comment] });
    return comment;
  }

  async updateTaskMindmapComment(
    taskId: string,
    commentId: string,
    patch: Partial<Pick<TaskMindmapComment, "content" | "parentCommentId" | "childOrder" | "x" | "y">>
  ): Promise<void> {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("任务不存在");
    }
    const comment = task.mindmapComments.find((item) => item.id === commentId);
    if (!comment) {
      throw new Error("评语不存在");
    }
    if (patch.parentCommentId && !task.mindmapComments.some((item) => item.id === patch.parentCommentId)) {
      throw new Error("父级评语不存在");
    }
    const nextParentCommentId = patch.parentCommentId === undefined ? comment.parentCommentId ?? null : patch.parentCommentId;
    assertValidCommentParent(task.mindmapComments, comment.id, nextParentCommentId ?? null);
    const nextComment: TaskMindmapComment = {
      ...comment,
      ...patch,
      parentCommentId: nextParentCommentId,
      content: patch.content === undefined ? comment.content : patch.content.trim(),
      updatedAt: toIsoLocal(now())
    };
    if (!nextComment.content) {
      throw new Error("评语内容不能为空");
    }
    await this.patchTask(taskId, {
      mindmapComments: task.mindmapComments.map((item) => (item.id === commentId ? nextComment : item))
    });
  }

  async deleteTaskMindmapComment(taskId: string, commentId: string): Promise<void> {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("任务不存在");
    }
    const removeIds = new Set<string>([commentId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const comment of task.mindmapComments) {
        if (comment.parentCommentId && removeIds.has(comment.parentCommentId) && !removeIds.has(comment.id)) {
          removeIds.add(comment.id);
          changed = true;
        }
      }
    }
    await this.patchTask(taskId, {
      mindmapComments: task.mindmapComments.filter((comment) => !removeIds.has(comment.id))
    });
  }

  async addTaskNote(taskId: string, content: string, source: TaskNote["source"] = "manual"): Promise<void> {
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("任务不存在");
    }
    const note: TaskNote = {
      id: crypto.randomUUID(),
      content: content.trim(),
      createdAt: toIsoLocal(now()),
      source
    };
    if (!note.content) {
      throw new Error("笔记内容不能为空");
    }
    await this.patchTask(taskId, { notes: [...task.notes, note] });
  }

  previewFormattedTasks(text: string, options: { projectId?: string; defaultDate?: string; source?: TaskSourceLink } = {}): TaskImportPreview {
    const parsed = parseFormattedTaskText(text, {
      projects: this.projects,
      projectId: options.projectId,
      defaultDate: options.defaultDate ?? toDateKey(now()),
      source: options.source
    });
    return this.buildTaskImportPreview(parsed.tasks, parsed.issues);
  }

  async importFormattedTasks(text: string, options: { projectId?: string; defaultDate?: string; source?: TaskSourceLink; historySummary?: string } = {}): Promise<Task[]> {
    this.assertWritable();
    const preview = this.previewFormattedTasks(text, options);
    if (preview.tasks.length === 0) {
      throw new Error(preview.issues[0]?.message ?? "没有可导入的任务");
    }
    const changed: Task[] = [];
    for (const entry of preview.tasks) {
      const task = await this.applyImportTask(entry);
      changed.push(task);
    }
    await this.recordWriteHistory({
      type: options.source?.type === "note" ? "note-sync" : "import",
      summary:
        options.historySummary ??
        `批量导入 ${preview.summary.total} 条：新增 ${preview.summary.createCount}，覆盖 ${preview.summary.overwriteCount}，完成今日 ${preview.summary.completeTodayCount}，提前结束 ${preview.summary.completeSeriesCount}`,
      taskIds: [...new Set(changed.map((task) => task.id))]
    });
    return changed;
  }

  exportTasksAsFormattedText(
    tasks: TaskOccurrence[],
    mode: "current" | "complete-today" | "complete-series" = "current"
  ): string {
    const grouped = new Map<string, TaskOccurrence[]>();
    tasks
      .slice()
      .sort(compareOccurrences)
      .forEach((task) => {
        const key = task.projectId ?? UNASSIGNED_PROJECT_LABEL;
        grouped.set(key, [...(grouped.get(key) ?? []), task]);
      });

    const sections: string[] = [];
    [...grouped.entries()].forEach(([projectKey, group], index) => {
      const projectName =
        projectKey === UNASSIGNED_PROJECT_LABEL ? UNASSIGNED_PROJECT_LABEL : this.getProject(projectKey)?.name ?? UNASSIGNED_PROJECT_LABEL;
      if (index > 0) {
        sections.push("");
      }
      sections.push(`#项目：${projectName}`);
      group.forEach((task) => {
        sections.push(renderTaskOccurrenceForExport(task, mode));
        if (task.kind === "composite") {
          task.subtasks.forEach((subtask) => {
            sections.push(`  - ${subtask.title}`);
          });
        }
      });
    });

    return sections.join("\n").trim();
  }

  async autoArrangeDate(date: string, options: Partial<AutoArrangeOptions> = {}): Promise<AutoArrangeResult> {
    this.assertWritable();
    const config: AutoArrangeOptions = {
      direction: options.direction ?? "forward",
      scope: options.scope ?? "same-day",
      includeCompleted: options.includeCompleted ?? false,
      includeLocked: options.includeLocked ?? false,
      timeSlotMinutes: options.timeSlotMinutes ?? this.config.timeSlotMinutes
    };
    const occurrences = this.getAllTaskOccurrences()
      .filter((task) => task.date === date)
      .filter((task) => task.startTime && task.endTime)
      .filter((task) => config.includeCompleted || !task.completed)
      .filter((task) => {
        const series = this.findTask(task.taskId);
        return config.includeLocked || !series?.viewState.gantt.locked;
      })
      .sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0));

    const moved: AutoArrangeResult["moved"] = [];
    const skipped: string[] = [];
    if (config.direction === "forward") {
      let cursor: number | null = null;
      for (const occurrence of occurrences) {
        const start = parseTimeToMinutes(occurrence.startTime);
        const end = parseTimeToMinutes(occurrence.endTime);
        if (start === null || end === null) {
          continue;
        }
        const duration = end - start;
        const nextStart = cursor === null ? start : Math.max(start, cursor);
        const snappedStart = snapMinutes(nextStart, config.timeSlotMinutes);
        const snappedEnd = snappedStart + duration;
        if (snappedEnd > 24 * 60) {
          skipped.push(occurrence.title);
          continue;
        }
        if (snappedStart !== start) {
          const from = `${occurrence.startTime}-${occurrence.endTime}`;
          const to = `${formatMinutesToTime(snappedStart)}-${formatMinutesToTime(snappedEnd)}`;
          await this.updateTaskOccurrenceWindow(occurrence.taskId, occurrence.date, formatMinutesToTime(snappedStart), formatMinutesToTime(snappedEnd));
          moved.push({ taskId: occurrence.taskId, date: occurrence.date, title: occurrence.title, from, to });
        }
        cursor = snappedEnd;
      }
    } else {
      let cursor = 24 * 60;
      for (const occurrence of [...occurrences].reverse()) {
        const start = parseTimeToMinutes(occurrence.startTime);
        const end = parseTimeToMinutes(occurrence.endTime);
        if (start === null || end === null) {
          continue;
        }
        const duration = end - start;
        const nextEnd = Math.min(end, cursor);
        const snappedEnd = snapMinutes(nextEnd, config.timeSlotMinutes);
        const snappedStart = snappedEnd - duration;
        if (snappedStart < 0) {
          skipped.push(occurrence.title);
          continue;
        }
        if (snappedStart !== start) {
          const from = `${occurrence.startTime}-${occurrence.endTime}`;
          const to = `${formatMinutesToTime(snappedStart)}-${formatMinutesToTime(snappedEnd)}`;
          await this.updateTaskOccurrenceWindow(occurrence.taskId, occurrence.date, formatMinutesToTime(snappedStart), formatMinutesToTime(snappedEnd));
          moved.push({ taskId: occurrence.taskId, date: occurrence.date, title: occurrence.title, from, to });
        }
        cursor = snappedStart;
      }
    }
    if (moved.length > 0) {
      await this.recordWriteHistory({
        type: "arrange",
        summary: `${date} 自动排程，移动 ${moved.length} 个任务`,
        taskIds: moved.map((item) => item.taskId),
        after: moved
      });
    }
    return { moved, skipped };
  }

  async syncAllNoteTasks(): Promise<number> {
    this.assertWritable();
    let total = 0;
    for (const file of this.app.vault.getMarkdownFiles()) {
      total += await this.syncNoteFile(file);
    }
    return total;
  }

  async syncNoteFile(fileOrPath: TFile | string): Promise<number> {
    this.assertWritable();
    const file =
      typeof fileOrPath === "string"
        ? this.app.vault.getAbstractFileByPath(fileOrPath)
        : fileOrPath;
    if (!(file instanceof TFile) || file.extension !== "md") {
      return 0;
    }
    const raw = await this.app.vault.cachedRead(file);
    const blockText = extractProjectTaskBlocks(raw);
    const existingIndex = this.noteTaskIndex.find((entry) => entry.path === file.path);
    if (!blockText && !existingIndex) {
      return 0;
    }
    const hash = hashText(blockText);
    if (existingIndex?.hash === hash) {
      return 0;
    }

    const stat = await this.app.vault.adapter.stat(file.path);
    const sourceBase = {
      type: "note" as const,
      path: file.path,
      syncMode: "linked" as const,
      lastSyncedAt: toIsoLocal(now())
    };
    const parsed = parseFormattedTaskText(blockText, {
      projects: this.projects,
      defaultDate: toDateKey(now()),
      source: {
        id: crypto.randomUUID(),
        ...sourceBase,
        hash
      }
    });

    const createdIds: string[] = [];
    for (const [index, parsedTask] of parsed.tasks.entries()) {
      const projectId = parsedTask.input.projectId ?? (await this.ensureImportProject(parsedTask.projectName));
      const taskHash = hashText(JSON.stringify(parsedTask.input));
      const sourceLink: TaskSourceLink = {
        id: crypto.randomUUID(),
        ...sourceBase,
        line: parsedTask.line,
        hash: taskHash
      };
      const existingTask = this.findTaskBySource(file.path, taskHash);
      const input: TaskInput = {
        ...parsedTask.input,
        projectId,
        sourceLinks: [sourceLink]
      };
      try {
        const saved = existingTask
          ? await this.updateTask(existingTask.id, { ...input, completed: false }, "series", { autoResolveConflicts: true })
          : await this.createTask({ ...input, completed: input.completed && parsedTask.completionMode === "pending" }, { autoResolveConflicts: true });
        if (input.completed && parsedTask.completionMode === "today") {
          await this.updateTaskOccurrenceCompletion(saved.id, input.date, true);
        } else if (input.completed && parsedTask.completionMode === "series") {
          await this.completeTaskSeries(saved.id, input.date);
        }
        createdIds.push(saved.id);
      } catch (error) {
        console.error("Failed to sync note task", file.path, error);
      }
    }

    const missingTaskIds = existingIndex?.taskIds.filter((taskId) => !createdIds.includes(taskId)) ?? [];
    for (const taskId of missingTaskIds) {
      const task = this.findTask(taskId);
      if (!task) {
        continue;
      }
      await this.patchTask(taskId, {
        sourceLinks: task.sourceLinks.map((source) => (source.path === file.path ? { ...source, missing: true } : source))
      });
    }

    const nextIndex: NoteTaskIndexEntry = {
      path: file.path,
      mtime: stat?.mtime ?? Date.now(),
      hash,
      taskIds: createdIds,
      parsedAt: toIsoLocal(now())
    };
    this.noteTaskIndex = [...this.noteTaskIndex.filter((entry) => entry.path !== file.path), nextIndex];
    await this.enqueueWrite(() => this.writeJson(this.pathFor(NOTE_TASK_INDEX_FILE), { files: this.noteTaskIndex } satisfies NoteTaskIndexFile));
    if (createdIds.length > 0 || missingTaskIds.length > 0) {
      await this.recordWriteHistory({
        type: "note-sync",
        summary: `同步笔记 ${file.path}，任务 ${createdIds.length} 个`,
        taskIds: createdIds
      });
      this.trigger("changed");
    }
    return createdIds.length;
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
    next.occurrenceOverrides = task.occurrenceOverrides.filter((entry) => entry.date !== date);
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
    next.occurrenceOverrides = task.occurrenceOverrides.filter((entry) => remainingDates.includes(entry.date));
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
      columnOrder: ["title", "status", "priority", "tags", "recurrence", "schedule", "completion", "description", "actions"],
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

  private buildTaskImportPreview(tasks: ParsedImportTask[], issues: TaskImportPreview["issues"]): TaskImportPreview {
    const newProjectNames = new Set<string>();
    const previewTasks = tasks.map<TaskImportPreviewTask>((entry) => {
      const projectResolution = this.resolveImportProject(entry);
      const matched = this.findTaskByImportIdentity(entry.input.title, projectResolution.projectId, entry.input.date);
      if (projectResolution.newProjectName) {
        newProjectNames.add(projectResolution.newProjectName);
      }
      return {
        line: entry.line,
        raw: entry.raw,
        input: {
          ...entry.input,
          projectId: projectResolution.projectId
        },
        projectId: projectResolution.projectId,
        projectName: projectResolution.projectName,
        matchedTaskId: matched?.id,
        matchedTaskTitle: matched?.title,
        action: resolveTaskImportAction(Boolean(matched), entry.completionMode),
        completionMode: entry.completionMode
      };
    });

    return {
      tasks: previewTasks,
      issues,
      summary: {
        total: previewTasks.length,
        completed: previewTasks.filter((task) => task.input.completed).length,
        composite: previewTasks.filter((task) => task.input.kind === "composite").length,
        createCount: previewTasks.filter((task) => task.action === "create").length,
        overwriteCount: previewTasks.filter((task) => task.action !== "create").length,
        completeTodayCount: previewTasks.filter((task) => task.action === "overwrite-and-complete-today").length,
        completeSeriesCount: previewTasks.filter((task) => task.action === "overwrite-and-complete-series").length,
        newProjectNames: [...newProjectNames]
      }
    };
  }

  private resolveImportProject(entry: ParsedImportTask): { projectId?: string; projectName?: string; newProjectName?: string } {
    if (entry.projectName === UNASSIGNED_PROJECT_LABEL) {
      return { projectName: UNASSIGNED_PROJECT_LABEL };
    }
    if (entry.input.projectId) {
      return {
        projectId: entry.input.projectId,
        projectName: this.getProject(entry.input.projectId)?.name
      };
    }
    if (entry.projectName) {
      const existing = this.projects.find((project) => project.name === entry.projectName);
      if (existing) {
        return { projectId: existing.id, projectName: existing.name };
      }
      return { projectName: entry.projectName, newProjectName: entry.projectName };
    }
    return {};
  }

  private findTaskByImportIdentity(title: string, projectId: string | undefined, date: string): Task | undefined {
    const sameProject = this.getAllTasks().filter(
      (task) => normalizeImportIdentity(task.title) === normalizeImportIdentity(title) && (task.projectId ?? undefined) === projectId
    );
    const sameDate = sameProject.find((task) => task.occurrenceDates.includes(date));
    if (sameDate) {
      return sameDate;
    }
    return sameProject.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }

  private async ensureImportProject(projectName?: string): Promise<string | undefined> {
    if (!projectName || projectName === UNASSIGNED_PROJECT_LABEL) {
      return undefined;
    }
    const existing = this.projects.find((project) => project.name === projectName);
    if (existing) {
      return existing.id;
    }
    const created = await this.createProject({ name: projectName, status: "active" });
    return created.id;
  }

  private async applyImportTask(entry: TaskImportPreviewTask): Promise<Task> {
    const projectId = entry.input.projectId ?? (await this.ensureImportProject(entry.projectName));
    const input: TaskInput = {
      ...entry.input,
      projectId
    };
    const existing = this.findTaskByImportIdentity(input.title, projectId, input.date);

    if (existing) {
      const normalizedPatch: TaskInput = {
        ...input,
        completed: false
      };
      const updated = await this.updateTask(existing.id, normalizedPatch, "series", { autoResolveConflicts: true });
      if (entry.completionMode === "today" && input.completed) {
        await this.updateTaskOccurrenceCompletion(updated.id, input.date, true);
        return this.getTask(updated.id) ?? updated;
      }
      if (entry.completionMode === "series" && input.completed) {
        await this.completeTaskSeries(updated.id, input.date);
        return this.getTask(updated.id) ?? updated;
      }
      return updated;
    }

    const created = await this.createTask(
      {
        ...input,
        completed: input.completed && entry.completionMode === "pending"
      },
      { autoResolveConflicts: true }
    );
    if (input.completed && entry.completionMode === "today") {
      await this.updateTaskOccurrenceCompletion(created.id, input.date, true);
      return this.getTask(created.id) ?? created;
    }
    if (input.completed && entry.completionMode === "series") {
      await this.completeTaskSeries(created.id, input.date);
      return this.getTask(created.id) ?? created;
    }
    return created;
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
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if ((startTime && !endTime) || (!startTime && endTime)) {
      throw new Error("开始时间和结束时间必须同时填写");
    }
    if (start !== null && end !== null) {
      if (start >= end) {
        throw new Error("结束时间必须晚于开始时间");
      }
    }

    const recurrence = input.recurrence ?? "once";
    const kind = input.kind ?? "simple";
    const recurrenceCount = recurrence === "once" ? null : normalizePositiveInteger(input.recurrenceCount);
    const recurrenceUntil = recurrence === "once" ? null : normalizeDateOrUndefined(input.recurrenceUntil);
    const subtasks = normalizeSubtaskInputs(input.subtasks, kind);

    if (recurrence !== "once" && recurrence !== "custom" && !recurrenceCount && !recurrenceUntil) {
      throw new Error("重复任务必须填写重复次数或结束日期");
    }
    if (recurrence === "custom" && !input.occurrenceDates?.length) {
      throw new Error("自定义重复必须提供发生日期集合");
    }
    if (recurrenceUntil && compareDateKeys(recurrenceUntil, date) < 0) {
      throw new Error("重复结束日期不能早于首个任务日期");
    }

    return {
      kind,
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || undefined,
      status: normalizeTaskStatus(input.status),
      priority: normalizeTaskPriority(input.priority),
      tags: normalizeTags(input.tags),
      date,
      startTime,
      endTime,
      recurrence,
      recurrenceCount,
      recurrenceUntil,
      occurrenceDates: normalizeOccurrenceDates(input.occurrenceDates),
      occurrenceOverrides: normalizeOccurrenceOverrides(input.occurrenceOverrides),
      subtasks,
      viewState: input.viewState,
      sourceLinks: normalizeSourceLinks(input.sourceLinks),
      notes: normalizeTaskNotes(input.notes),
      mindmapComments: normalizeMindmapComments(input.mindmapComments, ""),
      completed: input.completed ?? false
    };
  }

  private buildSeriesTask(input: TaskInput, original?: Task, completedPatch?: boolean): Task {
    const timestamp = toIsoLocal(now());
    const id = original?.id ?? crypto.randomUUID();
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
      id,
      kind: input.kind ?? "simple",
      title: input.title,
      description: input.description,
      projectId: input.projectId,
      status: input.status ?? original?.status ?? "todo",
      priority: input.priority ?? original?.priority,
      tags: [...(input.tags ?? original?.tags ?? [])],
      date: occurrenceDates[0],
      startTime: input.startTime,
      endTime: input.endTime,
      recurrence: input.recurrence,
      recurrenceCount: input.recurrenceCount ?? null,
      recurrenceUntil: input.recurrenceUntil ?? null,
      subtasks,
      occurrenceDates,
      occurrenceStates,
      occurrenceOverrides: (input.occurrenceOverrides ?? original?.occurrenceOverrides ?? []).filter((override) => occurrenceDates.includes(override.date)),
      viewState: mergeViewState(original?.viewState, input.viewState, input.status ?? original?.status ?? "todo"),
      sourceLinks: input.sourceLinks ?? original?.sourceLinks ?? [],
      notes: input.notes ?? original?.notes ?? [],
      mindmapComments: normalizeMindmapComments(input.mindmapComments ?? original?.mindmapComments, id),
      createdAt: original?.createdAt ?? timestamp,
      updatedAt: timestamp,
      revision: original ? (original.revision ?? 0) + 1 : 1
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

  private autoResolveTaskConflicts(candidates: Task[], excludedOccurrenceKeys: Set<string>): Task[] {
    const adjusted = candidates.map(cloneTask);
    const occupied = buildOccupiedMinutesMap(this.getAllTaskOccurrences().filter((task) => !excludedOccurrenceKeys.has(task.id)));

    adjusted.forEach((task) => {
      expandTask(task)
        .sort(compareOccurrences)
        .forEach((occurrence) => {
          const start = parseTimeToMinutes(occurrence.startTime);
          const end = parseTimeToMinutes(occurrence.endTime);
          if (start === null || end === null) {
            return;
          }
          const dateOccupied = occupied.get(occurrence.date) ?? [];
          if (!hasTimeOverlap(dateOccupied, start, end)) {
            dateOccupied.push({ start, end });
            occupied.set(occurrence.date, sortOccupiedMinutes(dateOccupied));
            return;
          }
          const resolved = findAvailableOneMinuteWindow(dateOccupied, start);
          applyOccurrenceWindow(task, occurrence.date, resolved.startTime, resolved.endTime);
          dateOccupied.push({ start: resolved.start, end: resolved.end });
          occupied.set(occurrence.date, sortOccupiedMinutes(dateOccupied));
        });
    });

    return adjusted;
  }

  private async normalizeDeferredSingleTasks(): Promise<void> {
    const today = toDateKey(now());
    const overdue = this.getAllTasks()
      .filter((task) => isOverdueSingleTask(task, today))
      .sort(compareSeriesTasks);
    if (overdue.length === 0) {
      return;
    }

    const stamp = toIsoLocal(now());
    const removeIds = overdue.map((task) => task.id);
    const occupied = buildOccupiedMinutesMap(this.getAllTaskOccurrences().filter((occurrence) => !removeIds.includes(occurrence.taskId)));
    const replacements = overdue.map((task) => {
      const next = cloneTask(task);
      const preferredStart = parseTimeToMinutes(task.startTime) ?? parseTimeToMinutes(this.config.defaultTaskStartTime) ?? 0;
      const dateOccupied = occupied.get(today) ?? [];
      const resolved = findAvailableOneMinuteWindow(dateOccupied, preferredStart);
      next.date = today;
      next.occurrenceDates = [today];
      next.occurrenceStates = task.occurrenceStates.map((state) => ({
        ...state,
        date: today,
        completedSubtaskIds: [...(state.completedSubtaskIds ?? [])]
      }));
      next.occurrenceOverrides = [];
      next.startTime = resolved.startTime;
      next.endTime = resolved.endTime;
      next.recurrence = "once";
      next.recurrenceCount = null;
      next.recurrenceUntil = null;
      next.updatedAt = stamp;
      next.revision = (next.revision ?? 0) + 1;
      dateOccupied.push({ start: resolved.start, end: resolved.end });
      occupied.set(today, sortOccupiedMinutes(dateOccupied));
      return next;
    });

    this.replaceTasks(removeIds, replacements);
    await this.persistMonths(monthsForTasks([...overdue, ...replacements]));
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

  private findTaskBySource(path: string, hash: string): Task | undefined {
    return this.getAllTasks().find((task) => task.sourceLinks.some((source) => source.path === path && source.hash === hash));
  }

  private async recordWriteHistory(input: Omit<WriteHistoryRecord, "id" | "createdAt">): Promise<void> {
    const record: WriteHistoryRecord = {
      id: crypto.randomUUID(),
      createdAt: toIsoLocal(now()),
      ...input
    };
    this.writeHistory = [record, ...this.writeHistory].slice(0, 100);
    await this.enqueueWrite(() => this.writeJson(this.pathFor(WRITE_HISTORY_FILE), { records: this.writeHistory } satisfies WriteHistoryFile));
  }

  private seedDefaultDataIfEmpty(): void {
    if (this.projects.length > 0 || this.getAllTasks().length > 0) {
      return;
    }
    const timestamp = toIsoLocal(now());
    const today = toDateKey(now());
    const projectId = crypto.randomUUID();
    const project: Project = {
      id: projectId,
      name: "插件体验示例",
      description: "用于展示今日任务、看板、甘特图、思维导图与快速记录能力，可直接删除。",
      color: "#2979ff",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const page: ProgressPage = {
      id: crypto.randomUUID(),
      projectId,
      name: project.name,
      columnOrder: ["title", "status", "priority", "tags", "recurrence", "schedule", "completion", "description", "actions"],
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.projects = [project];
    this.progressPages = [page];

    const planTask = this.buildSeriesTask({
      title: "梳理插件使用流程",
      description: "看板中可以切换状态，甘特图会展示计划时间。",
      projectId,
      status: "doing",
      priority: "high",
      tags: ["示例", "规划"],
      date: today,
      startTime: "09:00",
      endTime: "10:00",
      recurrence: "once",
      viewState: {
        board: { columnId: "doing", order: 10 },
        mindmap: { parentTaskId: null, childOrder: 10, expanded: true, x: 280, y: 110 }
      },
      mindmapComments: []
    });
    planTask.mindmapComments = normalizeMindmapComments(
      [
        {
          id: crypto.randomUUID(),
          taskId: planTask.id,
          parentCommentId: null,
          content: "评语节点只在思维导图中显示，不会进入任务列表。",
          childOrder: 10,
          x: 540,
          y: 70,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        {
          id: crypto.randomUUID(),
          taskId: planTask.id,
          parentCommentId: null,
          content: "可以从快速记录页继续追加评语。",
          childOrder: 20,
          x: 540,
          y: 160,
          createdAt: timestamp,
          updatedAt: timestamp
        }
      ],
      planTask.id
    );

    const buildTask = this.buildSeriesTask({
      title: "完成一个组合任务",
      description: "组合任务可逐项勾选子任务，进度会同步到总览。",
      projectId,
      status: "todo",
      priority: "medium",
      tags: ["示例"],
      date: today,
      startTime: "10:30",
      endTime: "11:30",
      recurrence: "once",
      kind: "composite",
      subtasks: [
        { title: "创建项目", order: 0 },
        { title: "新增任务", order: 1 },
        { title: "写入日记", order: 2 }
      ],
      viewState: {
        board: { columnId: "todo", order: 20 },
        mindmap: { parentTaskId: planTask.id, childOrder: 20, expanded: true, x: 540, y: 270 }
      }
    });

    const reviewTask = this.buildSeriesTask({
      title: "复盘今日记录",
      projectId,
      status: "done",
      priority: "low",
      tags: ["示例", "复盘"],
      date: today,
      startTime: "17:00",
      endTime: "17:30",
      recurrence: "once",
      completed: true,
      viewState: {
        board: { columnId: "done", order: 30 },
        mindmap: { parentTaskId: null, childOrder: 30, expanded: true, x: 280, y: 390 }
      }
    });

    [planTask, buildTask, reviewTask].forEach((task) => this.insertTask(task));
    this.writeHistory = [
      {
        id: crypto.randomUUID(),
        type: "import",
        summary: "初始化默认演示数据",
        taskIds: [planTask.id, buildTask.id, reviewTask.id],
        createdAt: timestamp
      }
    ];
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

  private async loadNoteTaskIndex(): Promise<BatchReadResult> {
    const data = await this.readJson<NoteTaskIndexFile>(this.pathFor(NOTE_TASK_INDEX_FILE), isNoteTaskIndexFile);
    this.noteTaskIndex = data.value?.files ?? [];
    return { failedPaths: data.ok ? [] : [data.path!] };
  }

  private async loadWriteHistory(): Promise<BatchReadResult> {
    const data = await this.readJson<WriteHistoryFile>(this.pathFor(WRITE_HISTORY_FILE), isWriteHistoryFile);
    this.writeHistory = data.value?.records ?? [];
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
    const noteIndexResult = await this.loadNoteTaskIndex();
    const writeHistoryResult = await this.loadWriteHistory();
    return [
      ...configResult.failedPaths,
      ...projectResult.failedPaths,
      ...progressResult.failedPaths,
      ...taskResult.failedPaths,
      ...noteIndexResult.failedPaths,
      ...writeHistoryResult.failedPaths
    ].filter(
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
      await this.writeJson(this.pathFor(NOTE_TASK_INDEX_FILE), { files: this.noteTaskIndex });
      await this.writeJson(this.pathFor(WRITE_HISTORY_FILE), { records: this.writeHistory });
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
      tasks: new Map([...this.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)])),
      noteTaskIndex: this.noteTaskIndex.map((entry) => ({ ...entry, taskIds: [...entry.taskIds] })),
      writeHistory: this.writeHistory.map((record) => ({ ...record, taskIds: [...record.taskIds] }))
    };
  }

  private restoreDataState(state: StoreDataState): void {
    this.projects = state.projects.map((project) => ({ ...project }));
    this.progressPages = state.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] }));
    this.tasks = new Map([...state.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)]));
    this.noteTaskIndex = state.noteTaskIndex.map((entry) => ({ ...entry, taskIds: [...entry.taskIds] }));
    this.writeHistory = state.writeHistory.map((record) => ({ ...record, taskIds: [...record.taskIds] }));
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
    await check<NoteTaskIndexFile>(this.pathInFolder(folder, NOTE_TASK_INDEX_FILE), isNoteTaskIndexFile);
    await check<WriteHistoryFile>(this.pathInFolder(folder, WRITE_HISTORY_FILE), isWriteHistoryFile);

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
  noteTaskIndex: NoteTaskIndexEntry[];
  writeHistory: WriteHistoryRecord[];
};

type DataFolderUsage = {
  hasData: boolean;
  invalidPaths: string[];
};

function normalizeStoredTask(task: Task & { completedOccurrences?: Array<{ date: string; completedAt: string }> }): Task {
  const kind: TaskKind = task.kind ?? ((task.subtasks?.length ?? 0) > 0 ? "composite" : "simple");
  const status = normalizeTaskStatus(task.status);
  const subtasks = (task.subtasks ?? []).map((item, index) => ({ id: item.id, title: item.title, order: item.order ?? index }));
  const legacyStates = (task.completedOccurrences ?? []).map((item) =>
    buildNormalizedOccurrenceState(item.date, kind, subtasks, subtasks.map((subtask) => subtask.id), item.completedAt)
  );
  const occurrenceStates = (task.occurrenceStates ?? legacyStates).map((item) =>
    buildNormalizedOccurrenceState(item.date, kind, subtasks, item.completedSubtaskIds ?? subtasks.map((subtask) => subtask.id), item.completedAt ?? null)
  );
  return {
    ...task,
    kind,
    status,
    priority: normalizeTaskPriority(task.priority),
    tags: normalizeTags(task.tags),
    subtasks,
    occurrenceStates,
    occurrenceOverrides: normalizeOccurrenceOverrides(task.occurrenceOverrides),
    viewState: mergeViewState(undefined, task.viewState, status),
    sourceLinks: normalizeSourceLinks(task.sourceLinks),
    notes: normalizeTaskNotes(task.notes),
    mindmapComments: normalizeMindmapComments(task.mindmapComments, task.id),
    revision: task.revision ?? 1
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

function isNoteTaskIndexFile(value: unknown): value is NoteTaskIndexFile {
  return isRecord(value) && Array.isArray(value.files) && value.files.every(isRecord);
}

function isWriteHistoryFile(value: unknown): value is WriteHistoryFile {
  return isRecord(value) && Array.isArray(value.records) && value.records.every(isRecord);
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
    })),
    occurrenceOverrides: task.occurrenceOverrides.map((item) => ({ ...item })),
    tags: [...task.tags],
    viewState: cloneViewState(task.viewState),
    sourceLinks: task.sourceLinks.map((item) => ({ ...item })),
    notes: task.notes.map((item) => ({ ...item })),
    mindmapComments: task.mindmapComments.map((item) => ({ ...item }))
  };
}

function expandTask(task: Task): TaskOccurrence[] {
  return task.occurrenceDates.flatMap((date, index) => {
    const override = getOccurrenceOverride(task, date);
    if (override?.skipped) {
      return [];
    }
    const state = getOccurrenceState(task, date);
    const progress = getOccurrenceProgress(task, date);
    return [{
      id: buildOccurrenceKey(task.id, date),
      taskId: task.id,
      occurrenceDate: date,
      occurrenceNumber: index + 1,
      kind: task.kind,
      title: override?.title ?? task.title,
      description: task.description,
      projectId: task.projectId,
      status: task.status,
      priority: task.priority,
      tags: [...task.tags],
      date,
      startTime: override?.startTime ?? task.startTime,
      endTime: override?.endTime ?? task.endTime,
      recurrence: task.recurrence,
      recurrenceCount: task.recurrenceCount ?? null,
      recurrenceUntil: task.recurrenceUntil ?? null,
      subtasks: task.subtasks.map((item) => ({ ...item })),
      sourceLinks: task.sourceLinks.map((item) => ({ ...item })),
      notes: task.notes.map((item) => ({ ...item })),
      completedSubtaskIds: [...progress.completedSubtaskIds],
      progress: progress.progress,
      totalSteps: progress.totalSteps,
      completedSteps: progress.completedSteps,
      completed: progress.completed,
      completedAt: state?.completedAt ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      revision: task.revision
    }];
  });
}

function buildOccurrenceDates(input: TaskInput): string[] {
  if (input.recurrence === "custom" && input.occurrenceDates?.length) {
    return [...new Set(input.occurrenceDates)].sort(compareDateKeys);
  }
  if (input.recurrence === "custom") {
    throw new Error("自定义重复必须提供发生日期集合");
  }
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
    .map((item, index) => ({ id: item.id, title: item.title.trim(), order: item.order ?? index }))
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
  return (inputSubtasks ?? []).map((item, index) => {
    const original = item.id ? originalSubtasks.find((entry) => entry.id === item.id) : undefined;
    return {
      id: original?.id ?? item.id ?? crypto.randomUUID(),
      title: item.title.trim(),
      order: item.order ?? original?.order ?? index
    };
  });
}

function getOccurrenceState(task: Task | undefined, date: string): TaskOccurrenceState | undefined {
  return task?.occurrenceStates.find((item) => item.date === date);
}

function getOccurrenceOverride(task: Task | undefined, date: string): TaskOccurrenceOverride | undefined {
  return task?.occurrenceOverrides.find((item) => item.date === date);
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

function normalizeTaskStatus(value?: TaskStatus): TaskStatus {
  return value === "doing" || value === "blocked" || value === "done" ? value : "todo";
}

function normalizeTaskPriority(value?: TaskPriority): TaskPriority | undefined {
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
    return value;
  }
  return undefined;
}

function normalizeTags(tags?: string[]): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
}

function normalizeOccurrenceDates(dates?: string[]): string[] | undefined {
  if (!dates) {
    return undefined;
  }
  return [...new Set(dates.map((date) => date.trim()).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort(compareDateKeys);
}

function normalizeOccurrenceOverrides(overrides?: TaskOccurrenceOverride[]): TaskOccurrenceOverride[] {
  return (overrides ?? [])
    .filter((override) => /^\d{4}-\d{2}-\d{2}$/.test(override.date))
    .map((override) => ({
      date: override.date,
      startTime: override.startTime?.trim() || undefined,
      endTime: override.endTime?.trim() || undefined,
      title: override.title?.trim() || undefined,
      skipped: Boolean(override.skipped),
      reason: override.reason?.trim() || undefined
    }));
}

function normalizeSourceLinks(sourceLinks?: TaskSourceLink[]): TaskSourceLink[] {
  return (sourceLinks ?? []).map((source) => ({
    ...source,
    id: source.id || crypto.randomUUID(),
    syncMode: source.syncMode ?? "import-only"
  }));
}

function normalizeTaskNotes(notes?: TaskNote[]): TaskNote[] {
  return (notes ?? []).map((note) => ({
    ...note,
    id: note.id || crypto.randomUUID()
  }));
}

function normalizeMindmapComments(comments: TaskMindmapComment[] | undefined, taskId?: string): TaskMindmapComment[] {
  return (comments ?? [])
    .map((comment, index) => {
      const timestamp = comment.createdAt || toIsoLocal(now());
      return {
        id: comment.id || crypto.randomUUID(),
        taskId: comment.taskId || taskId || "",
        parentCommentId: comment.parentCommentId ?? null,
        content: comment.content.trim(),
        childOrder: comment.childOrder ?? index,
        x: Number.isFinite(comment.x) ? comment.x : undefined,
        y: Number.isFinite(comment.y) ? comment.y : undefined,
        createdAt: timestamp,
        updatedAt: comment.updatedAt || timestamp
      };
    })
    .filter((comment) => comment.content.length > 0);
}

function assertValidCommentParent(comments: TaskMindmapComment[], commentId: string, parentCommentId: string | null): void {
  if (!parentCommentId) {
    return;
  }
  if (parentCommentId === commentId) {
    throw new Error("评语不能指向自己");
  }
  const descendants = collectCommentDescendants(comments, commentId);
  if (descendants.has(parentCommentId)) {
    throw new Error("不能把评语挂到自己的子评语下面");
  }
}

function collectCommentDescendants(comments: TaskMindmapComment[], rootId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    comments.forEach((comment) => {
      if (comment.parentCommentId === current && !descendants.has(comment.id)) {
        descendants.add(comment.id);
        queue.push(comment.id);
      }
    });
  }
  return descendants;
}

function assertValidTaskMindmapParent(task: Task, tasks: Task[]): void {
  const parentTaskId = task.viewState.mindmap.parentTaskId ?? null;
  if (!parentTaskId) {
    return;
  }
  if (parentTaskId === task.id) {
    throw new Error("任务不能指向自己");
  }
  if (!tasks.some((item) => item.id === parentTaskId)) {
    throw new Error("父级任务不存在");
  }
  const descendants = collectTaskDescendants(tasks, task.id);
  if (descendants.has(parentTaskId)) {
    throw new Error("不能把任务挂到自己的子任务下面");
  }
}

function collectTaskDescendants(tasks: Task[], rootId: string): Set<string> {
  const descendants = new Set<string>();
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift();
    tasks.forEach((task) => {
      if ((task.viewState.mindmap.parentTaskId ?? null) === current && !descendants.has(task.id)) {
        descendants.add(task.id);
        queue.push(task.id);
      }
    });
  }
  return descendants;
}

function mergeViewState(current: TaskViewState | undefined, patch: Partial<TaskViewState> | undefined, status: TaskStatus): TaskViewState {
  const base = current ?? defaultTaskViewState(status);
  return {
    board: {
      columnId: patch?.board?.columnId ?? base.board.columnId ?? status,
      order: patch?.board?.order ?? base.board.order ?? 0
    },
    gantt: {
      rowOrder: patch?.gantt?.rowOrder ?? base.gantt.rowOrder ?? 0,
      dependencyIds: [...(patch?.gantt?.dependencyIds ?? base.gantt.dependencyIds ?? [])],
      locked: patch?.gantt?.locked ?? base.gantt.locked ?? false,
      milestone: patch?.gantt?.milestone ?? base.gantt.milestone ?? false
    },
    mindmap: {
      parentTaskId: patch?.mindmap?.parentTaskId === undefined ? base.mindmap.parentTaskId ?? null : patch.mindmap.parentTaskId,
      childOrder: patch?.mindmap?.childOrder ?? base.mindmap.childOrder ?? 0,
      expanded: patch?.mindmap?.expanded ?? base.mindmap.expanded ?? true,
      x: patch?.mindmap?.x ?? base.mindmap.x,
      y: patch?.mindmap?.y ?? base.mindmap.y
    }
  };
}

function defaultTaskViewState(status: TaskStatus): TaskViewState {
  return {
    board: {
      columnId: status,
      order: 0
    },
    gantt: {
      rowOrder: 0,
      dependencyIds: [],
      locked: false,
      milestone: false
    },
    mindmap: {
      parentTaskId: null,
      childOrder: 0,
      expanded: true
    }
  };
}

function cloneViewState(viewState: TaskViewState): TaskViewState {
  return {
    board: { ...viewState.board },
    gantt: {
      ...viewState.gantt,
      dependencyIds: [...viewState.gantt.dependencyIds]
    },
    mindmap: { ...viewState.mindmap }
  };
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

function upsertOccurrenceOverride(task: Task, override: TaskOccurrenceOverride): TaskOccurrenceOverride[] {
  const normalized = normalizeOccurrenceOverrides([override])[0];
  const existing = task.occurrenceOverrides.filter((item) => item.date !== override.date);
  return normalized ? [...existing, normalized].sort((a, b) => a.date.localeCompare(b.date)) : existing;
}

function snapMinutes(value: number, slot: number): number {
  return Math.ceil(value / slot) * slot;
}

function isOverdueSingleTask(task: Task, today: string): boolean {
  return task.recurrence === "once" && task.occurrenceDates.length === 1 && !isTaskFullyCompleted(task) && compareDateKeys(task.date, today) < 0;
}

function applyOccurrenceWindow(task: Task, date: string, startTime: string, endTime: string): void {
  if (task.recurrence === "once" && task.occurrenceDates.length === 1 && task.date === date) {
    task.startTime = startTime;
    task.endTime = endTime;
    return;
  }
  task.occurrenceOverrides = upsertOccurrenceOverride(task, {
    ...(getOccurrenceOverride(task, date) ?? { date }),
    date,
    startTime,
    endTime
  });
}

function buildOccupiedMinutesMap(occurrences: TaskOccurrence[]): Map<string, Array<{ start: number; end: number }>> {
  const occupied = new Map<string, Array<{ start: number; end: number }>>();
  occurrences.forEach((occurrence) => {
    const start = parseTimeToMinutes(occurrence.startTime);
    const end = parseTimeToMinutes(occurrence.endTime);
    if (start === null || end === null) {
      return;
    }
    const dateOccupied = occupied.get(occurrence.date) ?? [];
    dateOccupied.push({ start, end });
    occupied.set(occurrence.date, sortOccupiedMinutes(dateOccupied));
  });
  return occupied;
}

function sortOccupiedMinutes(intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  return intervals.slice().sort((left, right) => left.start - right.start || left.end - right.end);
}

function hasTimeOverlap(intervals: Array<{ start: number; end: number }>, start: number, end: number): boolean {
  return intervals.some((interval) => start < interval.end && end > interval.start);
}

function findAvailableOneMinuteWindow(
  intervals: Array<{ start: number; end: number }>,
  preferredStart: number
): { start: number; end: number; startTime: string; endTime: string } {
  const sorted = sortOccupiedMinutes(intervals);
  const normalizedPreferred = Math.min(Math.max(preferredStart, 0), 24 * 60 - 2);
  const attempt = findFreeMinuteFrom(sorted, normalizedPreferred) ?? findFreeMinuteFrom(sorted, 0, normalizedPreferred);
  if (attempt === null) {
    throw new Error("当天已无可用时间可自动调整");
  }
  return {
    start: attempt,
    end: attempt + 1,
    startTime: formatMinutesToTime(attempt),
    endTime: formatMinutesToTime(attempt + 1)
  };
}

function findFreeMinuteFrom(intervals: Array<{ start: number; end: number }>, startAt: number, endExclusive = 24 * 60 - 1): number | null {
  for (let minute = startAt; minute < endExclusive; minute += 1) {
    if (!hasTimeOverlap(intervals, minute, minute + 1)) {
      return minute;
    }
  }
  return null;
}

type ParsedImportTask = {
  line: number;
  raw: string;
  input: TaskInput;
  projectName?: string;
  completionMode: TaskImportCompletionMode;
};

function parseFormattedTaskText(
  text: string,
  options: {
    projects: Project[];
    projectId?: string;
    defaultDate: string;
    source?: TaskSourceLink;
  }
): { tasks: ParsedImportTask[]; issues: TaskImportPreview["issues"] } {
  const tasks: ParsedImportTask[] = [];
  const issues: TaskImportPreview["issues"] = [];
  const lines = text.split(/\r?\n/);
  let currentProjectId = options.projectId;
  let currentProjectName = options.projectId ? options.projects.find((project) => project.id === options.projectId)?.name : undefined;
  let currentTask: ParsedImportTask | null = null;

  const flushCurrent = (): void => {
    if (currentTask) {
      tasks.push(currentTask);
      currentTask = null;
    }
  };

  lines.forEach((line, index) => {
    const raw = line;
    const projectMatch = /^\s*#项目[:：]\s*(.*?)\s*$/.exec(line);
    if (projectMatch) {
      flushCurrent();
      if (options.projectId) {
        currentProjectId = options.projectId;
        currentProjectName = options.projects.find((project) => project.id === options.projectId)?.name;
        return;
      }
      const projectName = projectMatch[1].trim() || UNASSIGNED_PROJECT_LABEL;
      if (projectName === UNASSIGNED_PROJECT_LABEL) {
        currentProjectId = undefined;
        currentProjectName = UNASSIGNED_PROJECT_LABEL;
        return;
      }
      const existingProject = options.projects.find((project) => project.name === projectName || project.id === projectName);
      currentProjectId = existingProject?.id;
      currentProjectName = existingProject?.name ?? projectName;
      return;
    }

    const taskMatch = /^(\s*)-\s+\[( |x|X)\]\s+(.+)$/.exec(line);
    if (taskMatch && taskMatch[1].length === 0) {
      flushCurrent();
      try {
        const parsed = parseTaskLine(taskMatch[3], {
          completed: taskMatch[2].toLowerCase() === "x",
          projectId: currentProjectId,
          projectName: currentProjectName,
          defaultDate: options.defaultDate,
          source: options.source
        });
        currentTask = {
          line: index + 1,
          raw,
          input: parsed.input,
          projectName: parsed.projectName,
          completionMode: parsed.completionMode
        };
      } catch (error) {
        issues.push({ line: index + 1, message: error instanceof Error ? error.message : "任务解析失败", raw });
      }
      return;
    }

    const subtaskMatch = /^\s{2,}-\s+(.+)$/.exec(line);
    if (subtaskMatch && currentTask) {
      currentTask.input.kind = "composite";
      currentTask.input.subtasks = [
        ...(currentTask.input.subtasks ?? []),
        { title: subtaskMatch[1].trim(), order: currentTask.input.subtasks?.length ?? 0 }
      ];
      return;
    }

    if (line.trim()) {
      issues.push({ line: index + 1, message: "无法识别的行", raw });
    }
  });
  flushCurrent();
  return { tasks, issues };
}

function parseTaskLine(
  rawTitle: string,
  context: {
    completed: boolean;
    projectId?: string;
    projectName?: string;
    defaultDate: string;
    source?: TaskSourceLink;
  }
): { input: TaskInput; projectName?: string; completionMode: TaskImportCompletionMode } {
  let title = rawTitle.trim();
  const dateMatch = /@(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2})-(\d{2}:\d{2}))?/.exec(title);
  const repeatMatch = /\brepeat:(once|daily|weekly|custom)\b/.exec(title);
  const countMatch = /\bcount:(\d+)\b/.exec(title);
  const untilMatch = /\buntil:(\d{4}-\d{2}-\d{2})\b/.exec(title);
  const statusMatch = /\bstatus:(todo|doing|blocked|done)\b/.exec(title);
  const finishMatch = /\bfinish:(today|series)\b/.exec(title);
  const priorityMatch = /!(low|medium|high|urgent)\b/.exec(title);
  const tags = [...title.matchAll(/#([^\s#]+)/g)].map((match) => match[1]).filter((tag) => !tag.startsWith("项目"));

  title = title
    .replace(/@\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}-\d{2}:\d{2})?/g, "")
    .replace(/\brepeat:(once|daily|weekly|custom)\b/g, "")
    .replace(/\bcount:\d+\b/g, "")
    .replace(/\buntil:\d{4}-\d{2}-\d{2}\b/g, "")
    .replace(/\bstatus:(todo|doing|blocked|done)\b/g, "")
    .replace(/\bfinish:(today|series)\b/g, "")
    .replace(/!(low|medium|high|urgent)\b/g, "")
    .replace(/#[^\s#]+/g, "")
    .trim();

  if (!title) {
    throw new Error("任务标题不能为空");
  }

  return {
    input: {
      title,
      projectId: context.projectId,
      date: dateMatch?.[1] ?? context.defaultDate,
      startTime: dateMatch?.[2],
      endTime: dateMatch?.[3],
      recurrence: (repeatMatch?.[1] as TaskRecurrence | undefined) ?? "once",
      recurrenceCount: countMatch ? Number(countMatch[1]) : null,
      recurrenceUntil: untilMatch?.[1] ?? null,
      status: (statusMatch?.[1] as TaskStatus | undefined) ?? (context.completed ? "done" : "todo"),
      priority: priorityMatch?.[1] as TaskPriority | undefined,
      tags,
      sourceLinks: context.source ? [context.source] : [],
      completed: context.completed
    },
    projectName: context.projectName,
    completionMode: context.completed ? ((finishMatch?.[1] as TaskImportCompletionMode | undefined) ?? "today") : "pending"
  };
}

function resolveTaskImportAction(matched: boolean, completionMode: TaskImportCompletionMode): TaskImportPreviewTask["action"] {
  if (!matched) {
    return "create";
  }
  if (completionMode === "series") {
    return "overwrite-and-complete-series";
  }
  if (completionMode === "today") {
    return "overwrite-and-complete-today";
  }
  return "overwrite";
}

function normalizeImportIdentity(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-Hans-CN");
}

function renderTaskOccurrenceForExport(
  task: TaskOccurrence,
  mode: "current" | "complete-today" | "complete-series"
): string {
  const shouldComplete = mode === "current" ? task.completed : true;
  const parts = [task.title];
  if (task.date) {
    parts.push(`@${task.date}${task.startTime && task.endTime ? ` ${task.startTime}-${task.endTime}` : ""}`);
  }
  task.tags.forEach((tag) => parts.push(`#${tag}`));
  if (task.priority) {
    parts.push(`!${task.priority}`);
  }
  parts.push(`status:${task.status}`);
  if (task.recurrence !== "once") {
    parts.push(`repeat:${task.recurrence}`);
  }
  if (task.recurrenceCount) {
    parts.push(`count:${task.recurrenceCount}`);
  }
  if (task.recurrenceUntil) {
    parts.push(`until:${task.recurrenceUntil}`);
  }
  const completionMode = resolveExportCompletionMode(task, mode);
  if (shouldComplete && completionMode !== "pending") {
    parts.push(`finish:${completionMode}`);
  }
  return `- [${shouldComplete ? "x" : " "}] ${parts.join(" ")}`.trim();
}

function resolveExportCompletionMode(
  task: TaskOccurrence,
  mode: "current" | "complete-today" | "complete-series"
): TaskImportCompletionMode {
  if (mode === "complete-series" && task.recurrence !== "once") {
    return "series";
  }
  if ((mode === "complete-today" || (mode === "current" && task.completed)) && task.recurrence !== "once") {
    return "today";
  }
  return "pending";
}

function extractProjectTaskBlocks(text: string): string {
  const blocks = [...text.matchAll(/<!--\s*pm:start\s*-->([\s\S]*?)<!--\s*pm:end\s*-->/g)].map((match) => match[1].trim());
  return blocks.length > 0 ? blocks.join("\n") : "";
}

function hashText(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function randomColor(): string {
  const palette = ["#3d8bfd", "#0f9d58", "#ff8c42", "#d64550", "#8a5cf6", "#188fa7"];
  return palette[Math.floor(Math.random() * palette.length)];
}
