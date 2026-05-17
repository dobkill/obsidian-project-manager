"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ProjectManagementPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian13 = require("obsidian");

// src/storage/store.ts
var import_obsidian = require("obsidian");

// src/utils/date.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
var WEEKDAY_LABELS = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"];
function pad(value) {
  return String(value).padStart(2, "0");
}
function now() {
  return /* @__PURE__ */ new Date();
}
function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function toMonthKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}
function toIsoLocal(date) {
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const abs = Math.abs(tz);
  const hours = pad(Math.floor(abs / 60));
  const minutes = pad(abs % 60);
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${minutes}`;
}
function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
function parseTimeToMinutes(value) {
  if (!value) {
    return null;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}
function formatMinutesToTime(total) {
  const safe = (total % 1440 + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}
function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}
function addMinutes(time, minutes) {
  const parsed = parseTimeToMinutes(time);
  if (parsed === null) {
    return time;
  }
  return formatMinutesToTime(parsed + minutes);
}
function startOfWeek(date) {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(current, diff);
}
function getWeekDates(anchor) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}
function getChineseWeekday(date) {
  return WEEKDAY_LABELS[date.getDay()];
}
function formatShortMonth(date) {
  return `${date.getMonth() + 1}\u6708`;
}
function compareDateKeys(a, b) {
  return a.localeCompare(b);
}
function isToday(dateKey) {
  return dateKey === toDateKey(now());
}
function isPastDateKey(dateKey, anchor = now()) {
  return compareDateKeys(dateKey, toDateKey(anchor)) < 0;
}
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}
function getLastTwelveMonthsDays(anchor = now()) {
  const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const start = addDays(end, -364);
  const result = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    result.push(new Date(cursor));
  }
  return result;
}

// src/storage/store.ts
var DEFAULT_CONFIG = {
  version: "0.3.0",
  dataFolder: "project-manager-data",
  overviewTab1Name: "\u4EFB\u52A1\u603B\u89C8",
  overviewTab2Name: "\u9879\u76EE\u8FDB\u5EA6",
  dialogTabName: "\u5FEB\u901F\u8BB0\u5F55",
  weekStartsOn: "monday",
  timeSlotMinutes: 15,
  heatmapRange: "12months",
  showCompletedTasks: true,
  defaultTaskDurationMinutes: 30,
  defaultTaskStartTime: "07:00",
  dailyNoteFolder: "\u65E5\u8BB0",
  dailyNoteDateFormat: "YYYY-MM-DD",
  dailyNoteMode: "per-day",
  dailyNoteSingleFilePath: "\u65E5\u8BB0/\u5FEB\u901F\u8BB0\u5F55.md",
  taskNoteRecentLimit: 8,
  defaultDialogTarget: "daily-note"
};
var PROJECTS_FILE = "projects.json";
var PROGRESS_FILE = "project-pages.json";
var CONFIG_FILE = "config.json";
var NOTE_TASK_INDEX_FILE = "note-task-index.json";
var WRITE_HISTORY_FILE = "write-history.json";
var TASKS_DIR = "tasks";
var UNASSIGNED_PROJECT_LABEL = "\u672A\u5F52\u5C5E\u9879\u76EE";
var ProjectManagementStore = class extends import_obsidian.Events {
  constructor(app, config) {
    super();
    this.projects = [];
    this.progressPages = [];
    this.tasks = /* @__PURE__ */ new Map();
    this.noteTaskIndex = [];
    this.writeHistory = [];
    this.writeQueue = Promise.resolve();
    this.readOnlyReason = null;
    this.app = app;
    this.config = config;
  }
  getSnapshot() {
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
  getConfig() {
    return structuredClone(this.config);
  }
  async setConfig(next) {
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
          new import_obsidian.Notice(`\u6570\u636E\u76EE\u5F55\u5DF2\u5207\u6362\u5230 ${nextFolder}\uFF0C\u5DF2\u4F7F\u7528\u76EE\u6807\u76EE\u5F55\u4E2D\u7684\u73B0\u6709\u6570\u636E`);
        } else {
          this.restoreDataState(currentData);
          this.config = structuredClone(nextConfig);
          await this.flushAll();
          await this.reloadCurrentFolderData();
          new import_obsidian.Notice(`\u76EE\u6807\u76EE\u5F55\u6570\u636E\u683C\u5F0F\u5F02\u5E38\uFF0C\u5DF2\u7528\u5F53\u524D\u6570\u636E\u91CD\u65B0\u521B\u5EFA\uFF1A${failedPaths.join("\u3001")}`, 0);
        }
      } else {
        this.restoreDataState(currentData);
        await this.flushAll();
        await this.reloadCurrentFolderData();
        if (usage.invalidPaths.length > 0) {
          new import_obsidian.Notice(`\u76EE\u6807\u76EE\u5F55\u6570\u636E\u683C\u5F0F\u5F02\u5E38\uFF0C\u5DF2\u7528\u5F53\u524D\u6570\u636E\u91CD\u65B0\u521B\u5EFA\uFF1A${usage.invalidPaths.join("\u3001")}`, 0);
        } else {
          new import_obsidian.Notice(`\u6570\u636E\u76EE\u5F55\u5DF2\u5207\u6362\u5230 ${nextFolder}\uFF0C\u5DF2\u521B\u5EFA\u65B0\u7684\u6570\u636E\u6587\u4EF6`);
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
  getProjects() {
    return this.projects.map((project) => ({ ...project }));
  }
  getProgressPages() {
    return this.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] }));
  }
  getAllTasks() {
    return [...this.tasks.values()].flat().map(cloneTask);
  }
  getAllTaskOccurrences() {
    return this.getAllTasks().flatMap((task) => expandTask(task)).sort(compareOccurrences);
  }
  getTasksForDate(date) {
    return this.getAllTaskOccurrences().filter((task) => task.date === date);
  }
  getTasksForProject(projectId) {
    return this.getAllTasks().filter((task) => task.projectId === projectId).sort(compareSeriesTasks);
  }
  getOccurrencesForProject(projectId) {
    return this.getAllTaskOccurrences().filter((task) => task.projectId === projectId).sort(compareOccurrences);
  }
  getOccurrencesForTask(taskId) {
    const task = this.findTask(taskId);
    return task ? expandTask(task).sort(compareOccurrences) : [];
  }
  getTask(taskId) {
    const task = this.findTask(taskId);
    return task ? cloneTask(task) : void 0;
  }
  getProject(projectId) {
    if (!projectId) {
      return void 0;
    }
    return this.projects.find((project) => project.id === projectId);
  }
  getSuggestedTaskWindow(date) {
    const scheduled = this.getTasksForDate(date).filter((task) => task.startTime && task.endTime).sort(compareOccurrences);
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
  async initialize() {
    const configResult = await this.loadConfigFile();
    this.config = configResult.config;
    await this.ensureDataFolder();
    const failedPaths = [...configResult.failedPaths, ...await this.loadCurrentFolderData()].filter((path, index, list) => list.indexOf(path) === index);
    if (failedPaths.length > 0) {
      this.readOnlyReason = `\u68C0\u6D4B\u5230\u6570\u636E\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF0C\u5DF2\u8FDB\u5165\u53EA\u8BFB\u4FDD\u62A4\uFF1A${failedPaths.join("\u3001")}`;
      new import_obsidian.Notice(this.readOnlyReason, 0);
      console.error(this.readOnlyReason);
      return;
    }
    this.readOnlyReason = null;
    this.seedDefaultDataIfEmpty();
    await this.flushAll();
    await this.normalizeDeferredSingleTasks();
  }
  async refreshFromDisk(options = {}) {
    const { triggerChange = true } = options;
    const failedPaths = await this.loadCurrentFolderData();
    if (failedPaths.length > 0) {
      this.readOnlyReason = `\u68C0\u6D4B\u5230\u6570\u636E\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF0C\u5DF2\u8FDB\u5165\u53EA\u8BFB\u4FDD\u62A4\uFF1A${failedPaths.join("\u3001")}`;
      throw new Error(this.readOnlyReason);
    }
    this.readOnlyReason = null;
    await this.normalizeDeferredSingleTasks();
    if (triggerChange) {
      this.trigger("changed");
    }
  }
  async flushPendingWrites() {
    await this.writeQueue;
    if (!this.readOnlyReason) {
      await this.flushAll();
    }
  }
  async validateDataFolder(path) {
    const raw = path.trim();
    const cleaned = sanitizeFolder(path);
    if (!cleaned) {
      return { ok: false, message: "\u6570\u636E\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A" };
    }
    if (raw.startsWith("/") || cleaned.includes("..")) {
      return { ok: false, message: "\u6570\u636E\u76EE\u5F55\u5FC5\u987B\u662F Vault \u5185\u76F8\u5BF9\u8DEF\u5F84" };
    }
    const normalized = (0, import_obsidian.normalizePath)(cleaned);
    const abstract = this.app.vault.getAbstractFileByPath(normalized);
    const stat = abstract ? null : await this.app.vault.adapter.stat(normalized);
    if (!abstract && !stat) {
      return { ok: true };
    }
    if (abstract && !(abstract instanceof import_obsidian.TFolder)) {
      return { ok: false, message: "\u6570\u636E\u76EE\u5F55\u8DEF\u5F84\u5DF2\u88AB\u6587\u4EF6\u5360\u7528" };
    }
    if (!abstract && stat?.type !== "folder") {
      return { ok: false, message: "\u6570\u636E\u76EE\u5F55\u8DEF\u5F84\u5DF2\u88AB\u6587\u4EF6\u5360\u7528" };
    }
    const children = abstract instanceof import_obsidian.TFolder ? abstract.children.map((child) => ({ name: child.name, isFolder: child instanceof import_obsidian.TFolder })) : await this.listFolderEntries(normalized);
    const allowed = /* @__PURE__ */ new Set([CONFIG_FILE, PROJECTS_FILE, PROGRESS_FILE, NOTE_TASK_INDEX_FILE, WRITE_HISTORY_FILE, TASKS_DIR]);
    const invalid = children.some((child) => !allowed.has(child.name));
    if (invalid) {
      return { ok: false, message: "\u76EE\u5F55\u4E2D\u5B58\u5728\u975E\u63D2\u4EF6\u6587\u4EF6\uFF0C\u62D2\u7EDD\u4F7F\u7528" };
    }
    const invalidTasksPath = children.some((child) => child.name === TASKS_DIR && !child.isFolder);
    if (invalidTasksPath) {
      return { ok: false, message: "tasks \u8DEF\u5F84\u5DF2\u88AB\u6587\u4EF6\u5360\u7528" };
    }
    return { ok: true };
  }
  async createTask(input, options = { autoResolveConflicts: true }) {
    this.assertWritable();
    const normalized = this.normalizeTaskInput(input);
    const built = this.buildSeriesTask(normalized);
    const [created] = options.autoResolveConflicts !== false ? this.autoResolveTaskConflicts([built], /* @__PURE__ */ new Set()) : [built];
    if (!created) {
      throw new Error("\u4EFB\u52A1\u521B\u5EFA\u5931\u8D25");
    }
    assertValidTaskMindmapParent(created, this.getAllTasks());
    this.assertNoConflicts([created], /* @__PURE__ */ new Set());
    this.insertTask(created);
    await this.persistMonths(monthsForTasks([created]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return cloneTask(this.findTask(created.id) ?? created);
  }
  async updateTask(taskId, patch, _scope = "series", options = {}) {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const merged = this.normalizeTaskInput({
      kind: patch.kind ?? original.kind,
      title: patch.title ?? original.title,
      description: patch.description ?? original.description,
      projectId: patch.projectId === void 0 ? original.projectId : patch.projectId,
      status: patch.status ?? original.status,
      priority: patch.priority === void 0 ? original.priority : patch.priority,
      tags: patch.tags ?? original.tags,
      date: patch.date ?? original.date,
      startTime: patch.startTime === void 0 ? original.startTime : patch.startTime,
      endTime: patch.endTime === void 0 ? original.endTime : patch.endTime,
      recurrence: patch.recurrence ?? original.recurrence,
      recurrenceCount: patch.recurrenceCount ?? original.recurrenceCount ?? void 0,
      recurrenceUntil: patch.recurrenceUntil ?? original.recurrenceUntil ?? void 0,
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
      throw new Error("\u4EFB\u52A1\u66F4\u65B0\u5931\u8D25");
    }
    assertValidTaskMindmapParent(next, this.getAllTasks().filter((task) => task.id !== original.id));
    this.assertNoConflicts([next], occurrenceKeysForTask(original));
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return cloneTask(this.findTask(next.id) ?? next);
  }
  async updateTaskOccurrenceCompletion(taskId, date, completed) {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const next = cloneTask(original);
    next.occurrenceStates = completed ? upsertOccurrenceState(original, date, {
      completedSubtaskIds: getAllSubtaskIds(original),
      completedAt: toIsoLocal(now())
    }) : next.occurrenceStates.filter((item) => item.date !== date);
    next.updatedAt = toIsoLocal(now());
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }
  async updateTaskOccurrenceSubtaskCompletion(taskId, date, subtaskId, completed) {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    if (original.kind !== "composite") {
      throw new Error("\u5F53\u524D\u4EFB\u52A1\u4E0D\u662F\u7EC4\u5408\u4EFB\u52A1");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    if (!original.subtasks.some((item) => item.id === subtaskId)) {
      throw new Error("\u5B50\u4EFB\u52A1\u4E0D\u5B58\u5728");
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
    next.occurrenceStates = nextCompletedIds.length === 0 ? next.occurrenceStates.filter((item) => item.date !== date) : upsertOccurrenceState(original, date, {
      completedSubtaskIds: nextCompletedIds,
      completedAt: nextCompletedIds.length === original.subtasks.length ? toIsoLocal(now()) : null
    });
    next.updatedAt = toIsoLocal(now());
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }
  async updateTaskOccurrenceWindow(taskId, date, startTime, endTime) {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const start = startTime?.trim() || void 0;
    const end = endTime?.trim() || void 0;
    if (start && !end || !start && end) {
      throw new Error("\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u540C\u65F6\u586B\u5199");
    }
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      throw new Error("\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4");
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
  async patchTask(taskId, patch) {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const next = cloneTask(original);
    if (patch.status) {
      next.status = normalizeTaskStatus(patch.status);
      next.viewState = mergeViewState(next.viewState, { board: { ...next.viewState.board, columnId: next.status } }, next.status);
    }
    if (patch.priority !== void 0) {
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
  async addTaskMindmapComment(taskId, content, parentCommentId) {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("\u8BC4\u8BED\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
    }
    if (parentCommentId && !task.mindmapComments.some((comment2) => comment2.id === parentCommentId)) {
      throw new Error("\u7236\u7EA7\u8BC4\u8BED\u4E0D\u5B58\u5728");
    }
    const timestamp = toIsoLocal(now());
    const siblingCount = task.mindmapComments.filter((comment2) => (comment2.parentCommentId ?? null) === (parentCommentId ?? null)).length;
    const comment = {
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
  async updateTaskMindmapComment(taskId, commentId, patch) {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const comment = task.mindmapComments.find((item) => item.id === commentId);
    if (!comment) {
      throw new Error("\u8BC4\u8BED\u4E0D\u5B58\u5728");
    }
    if (patch.parentCommentId && !task.mindmapComments.some((item) => item.id === patch.parentCommentId)) {
      throw new Error("\u7236\u7EA7\u8BC4\u8BED\u4E0D\u5B58\u5728");
    }
    const nextParentCommentId = patch.parentCommentId === void 0 ? comment.parentCommentId ?? null : patch.parentCommentId;
    assertValidCommentParent(task.mindmapComments, comment.id, nextParentCommentId ?? null);
    const nextComment = {
      ...comment,
      ...patch,
      parentCommentId: nextParentCommentId,
      content: patch.content === void 0 ? comment.content : patch.content.trim(),
      updatedAt: toIsoLocal(now())
    };
    if (!nextComment.content) {
      throw new Error("\u8BC4\u8BED\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
    }
    await this.patchTask(taskId, {
      mindmapComments: task.mindmapComments.map((item) => item.id === commentId ? nextComment : item)
    });
  }
  async deleteTaskMindmapComment(taskId, commentId) {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const removeIds = /* @__PURE__ */ new Set([commentId]);
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
  async addTaskNote(taskId, content, source = "manual") {
    const task = this.findTask(taskId);
    if (!task) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const note = {
      id: crypto.randomUUID(),
      content: content.trim(),
      createdAt: toIsoLocal(now()),
      source
    };
    if (!note.content) {
      throw new Error("\u7B14\u8BB0\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
    }
    await this.patchTask(taskId, { notes: [...task.notes, note] });
  }
  previewFormattedTasks(text, options = {}) {
    const parsed = parseFormattedTaskText(text, {
      projects: this.projects,
      projectId: options.projectId,
      defaultDate: options.defaultDate ?? toDateKey(now()),
      source: options.source
    });
    return this.buildTaskImportPreview(parsed.tasks, parsed.issues);
  }
  async importFormattedTasks(text, options = {}) {
    this.assertWritable();
    const preview = this.previewFormattedTasks(text, options);
    if (preview.tasks.length === 0) {
      throw new Error(preview.issues[0]?.message ?? "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u4EFB\u52A1");
    }
    const changed = [];
    for (const entry of preview.tasks) {
      const task = await this.applyImportTask(entry);
      changed.push(task);
    }
    await this.recordWriteHistory({
      type: options.source?.type === "note" ? "note-sync" : "import",
      summary: options.historySummary ?? `\u6279\u91CF\u5BFC\u5165 ${preview.summary.total} \u6761\uFF1A\u65B0\u589E ${preview.summary.createCount}\uFF0C\u8986\u76D6 ${preview.summary.overwriteCount}\uFF0C\u5B8C\u6210\u4ECA\u65E5 ${preview.summary.completeTodayCount}\uFF0C\u63D0\u524D\u7ED3\u675F ${preview.summary.completeSeriesCount}`,
      taskIds: [...new Set(changed.map((task) => task.id))]
    });
    return changed;
  }
  exportTasksAsFormattedText(tasks, mode = "current") {
    const grouped = /* @__PURE__ */ new Map();
    tasks.slice().sort(compareOccurrences).forEach((task) => {
      const key = task.projectId ?? UNASSIGNED_PROJECT_LABEL;
      grouped.set(key, [...grouped.get(key) ?? [], task]);
    });
    const sections = [];
    [...grouped.entries()].forEach(([projectKey, group], index) => {
      const projectName = projectKey === UNASSIGNED_PROJECT_LABEL ? UNASSIGNED_PROJECT_LABEL : this.getProject(projectKey)?.name ?? UNASSIGNED_PROJECT_LABEL;
      if (index > 0) {
        sections.push("");
      }
      sections.push(`#\u9879\u76EE\uFF1A${projectName}`);
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
  async autoArrangeDate(date, options = {}) {
    this.assertWritable();
    const config = {
      direction: options.direction ?? "forward",
      scope: options.scope ?? "same-day",
      includeCompleted: options.includeCompleted ?? false,
      includeLocked: options.includeLocked ?? false,
      timeSlotMinutes: options.timeSlotMinutes ?? this.config.timeSlotMinutes
    };
    const occurrences = this.getAllTaskOccurrences().filter((task) => task.date === date).filter((task) => task.startTime && task.endTime).filter((task) => config.includeCompleted || !task.completed).filter((task) => {
      const series = this.findTask(task.taskId);
      return config.includeLocked || !series?.viewState.gantt.locked;
    }).sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0));
    const moved = [];
    const skipped = [];
    if (config.direction === "forward") {
      let cursor = null;
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
        summary: `${date} \u81EA\u52A8\u6392\u7A0B\uFF0C\u79FB\u52A8 ${moved.length} \u4E2A\u4EFB\u52A1`,
        taskIds: moved.map((item) => item.taskId),
        after: moved
      });
    }
    return { moved, skipped };
  }
  async syncAllNoteTasks() {
    this.assertWritable();
    let total = 0;
    for (const file of this.app.vault.getMarkdownFiles()) {
      total += await this.syncNoteFile(file);
    }
    return total;
  }
  async syncNoteFile(fileOrPath) {
    this.assertWritable();
    const file = typeof fileOrPath === "string" ? this.app.vault.getAbstractFileByPath(fileOrPath) : fileOrPath;
    if (!(file instanceof import_obsidian.TFile) || file.extension !== "md") {
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
      type: "note",
      path: file.path,
      syncMode: "linked",
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
    const createdIds = [];
    for (const [index, parsedTask] of parsed.tasks.entries()) {
      const projectId = parsedTask.input.projectId ?? await this.ensureImportProject(parsedTask.projectName);
      const taskHash = hashText(JSON.stringify(parsedTask.input));
      const sourceLink = {
        id: crypto.randomUUID(),
        ...sourceBase,
        line: parsedTask.line,
        hash: taskHash
      };
      const existingTask = this.findTaskBySource(file.path, taskHash);
      const input = {
        ...parsedTask.input,
        projectId,
        sourceLinks: [sourceLink]
      };
      try {
        const saved = existingTask ? await this.updateTask(existingTask.id, { ...input, completed: false }, "series", { autoResolveConflicts: true }) : await this.createTask({ ...input, completed: input.completed && parsedTask.completionMode === "pending" }, { autoResolveConflicts: true });
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
        sourceLinks: task.sourceLinks.map((source) => source.path === file.path ? { ...source, missing: true } : source)
      });
    }
    const nextIndex = {
      path: file.path,
      mtime: stat?.mtime ?? Date.now(),
      hash,
      taskIds: createdIds,
      parsedAt: toIsoLocal(now())
    };
    this.noteTaskIndex = [...this.noteTaskIndex.filter((entry) => entry.path !== file.path), nextIndex];
    await this.enqueueWrite(() => this.writeJson(this.pathFor(NOTE_TASK_INDEX_FILE), { files: this.noteTaskIndex }));
    if (createdIds.length > 0 || missingTaskIds.length > 0) {
      await this.recordWriteHistory({
        type: "note-sync",
        summary: `\u540C\u6B65\u7B14\u8BB0 ${file.path}\uFF0C\u4EFB\u52A1 ${createdIds.length} \u4E2A`,
        taskIds: createdIds
      });
      this.trigger("changed");
    }
    return createdIds.length;
  }
  async deleteTask(taskId, scope = "series") {
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
  async deleteTaskOccurrence(taskId, date) {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    if (!task.occurrenceDates.includes(date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
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
  async completeTaskSeries(taskId, throughDate) {
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
    next.occurrenceStates = remainingDates.reduce((records, date) => {
      const existing = getOccurrenceState(task, date);
      records.push(
        existing ? buildNormalizedOccurrenceState(date, task.kind, task.subtasks, existing.completedSubtaskIds ?? getAllSubtaskIds(task), stamp) : buildNormalizedOccurrenceState(date, task.kind, task.subtasks, getAllSubtaskIds(task), stamp)
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
  async createProject(input) {
    this.assertWritable();
    const timestamp = toIsoLocal(now());
    const project = {
      id: crypto.randomUUID(),
      name: input.name.trim() || "\u672A\u547D\u540D\u9879\u76EE",
      description: input.description?.trim() || "",
      color: input.color?.trim() || randomColor(),
      status: input.status ?? "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const page = {
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
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects });
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages });
    });
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return { ...project };
  }
  async updateProject(projectId, patch) {
    this.assertWritable();
    const project = this.projects.find((entry) => entry.id === projectId);
    if (!project) {
      throw new Error("\u9879\u76EE\u4E0D\u5B58\u5728");
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
  async deleteProject(projectId) {
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
  async reorderProgressPage(projectId, direction) {
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
  getProjectProgress(projectId) {
    const progress = summarizeOccurrencesProgress(this.getOccurrencesForProject(projectId));
    if (progress.totalSteps === 0) {
      return 0;
    }
    return Math.round(progress.completedSteps / progress.totalSteps * 100);
  }
  buildTaskImportPreview(tasks, issues) {
    const newProjectNames = /* @__PURE__ */ new Set();
    const previewTasks = tasks.map((entry) => {
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
  resolveImportProject(entry) {
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
  findTaskByImportIdentity(title, projectId, date) {
    const sameProject = this.getAllTasks().filter(
      (task) => normalizeImportIdentity(task.title) === normalizeImportIdentity(title) && (task.projectId ?? void 0) === projectId
    );
    const sameDate = sameProject.find((task) => task.occurrenceDates.includes(date));
    if (sameDate) {
      return sameDate;
    }
    return sameProject.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }
  async ensureImportProject(projectName) {
    if (!projectName || projectName === UNASSIGNED_PROJECT_LABEL) {
      return void 0;
    }
    const existing = this.projects.find((project) => project.name === projectName);
    if (existing) {
      return existing.id;
    }
    const created = await this.createProject({ name: projectName, status: "active" });
    return created.id;
  }
  async applyImportTask(entry) {
    const projectId = entry.input.projectId ?? await this.ensureImportProject(entry.projectName);
    const input = {
      ...entry.input,
      projectId
    };
    const existing = this.findTaskByImportIdentity(input.title, projectId, input.date);
    if (existing) {
      const normalizedPatch = {
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
  normalizeTaskInput(input) {
    const title = input.title.trim();
    if (!title) {
      throw new Error("\u4EFB\u52A1\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    }
    const date = input.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("\u4EFB\u52A1\u65E5\u671F\u683C\u5F0F\u9519\u8BEF");
    }
    const startTime = input.startTime?.trim() || void 0;
    const endTime = input.endTime?.trim() || void 0;
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if (startTime && !endTime || !startTime && endTime) {
      throw new Error("\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u540C\u65F6\u586B\u5199");
    }
    if (start !== null && end !== null) {
      if (start >= end) {
        throw new Error("\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4");
      }
    }
    const recurrence = input.recurrence ?? "once";
    const kind = input.kind ?? "simple";
    const recurrenceCount = recurrence === "once" ? null : normalizePositiveInteger(input.recurrenceCount);
    const recurrenceUntil = recurrence === "once" ? null : normalizeDateOrUndefined(input.recurrenceUntil);
    const subtasks = normalizeSubtaskInputs(input.subtasks, kind);
    if (recurrence !== "once" && recurrence !== "custom" && !recurrenceCount && !recurrenceUntil) {
      throw new Error("\u91CD\u590D\u4EFB\u52A1\u5FC5\u987B\u586B\u5199\u91CD\u590D\u6B21\u6570\u6216\u7ED3\u675F\u65E5\u671F");
    }
    if (recurrence === "custom" && !input.occurrenceDates?.length) {
      throw new Error("\u81EA\u5B9A\u4E49\u91CD\u590D\u5FC5\u987B\u63D0\u4F9B\u53D1\u751F\u65E5\u671F\u96C6\u5408");
    }
    if (recurrenceUntil && compareDateKeys(recurrenceUntil, date) < 0) {
      throw new Error("\u91CD\u590D\u7ED3\u675F\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u9996\u4E2A\u4EFB\u52A1\u65E5\u671F");
    }
    return {
      kind,
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || void 0,
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
  buildSeriesTask(input, original, completedPatch) {
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
      tags: [...input.tags ?? original?.tags ?? []],
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
  assertNoConflicts(candidates, excludedOccurrenceKeys) {
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
  assertTaskWindowValid(task, against) {
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
      throw new Error(`\u4EFB\u52A1\u65F6\u95F4\u51B2\u7A81\uFF1A${task.date} ${task.startTime}-${task.endTime}`);
    }
  }
  autoResolveTaskConflicts(candidates, excludedOccurrenceKeys) {
    const adjusted = candidates.map(cloneTask);
    const occupied = buildOccupiedMinutesMap(this.getAllTaskOccurrences().filter((task) => !excludedOccurrenceKeys.has(task.id)));
    adjusted.forEach((task) => {
      expandTask(task).sort(compareOccurrences).forEach((occurrence) => {
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
  async normalizeDeferredSingleTasks() {
    const today = toDateKey(now());
    const overdue = this.getAllTasks().filter((task) => isOverdueSingleTask(task, today)).sort(compareSeriesTasks);
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
        completedSubtaskIds: [...state.completedSubtaskIds ?? []]
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
  insertTask(task) {
    const month = toMonthKeyFromTask(task);
    const existing = this.tasks.get(month) ?? [];
    existing.push(task);
    existing.sort(compareSeriesTasks);
    this.tasks.set(month, existing);
  }
  replaceTasks(idsToRemove, replacements) {
    const removed = [];
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
  findTask(taskId) {
    for (const tasks of this.tasks.values()) {
      const found = tasks.find((task) => task.id === taskId);
      if (found) {
        return found;
      }
    }
    return void 0;
  }
  findTaskBySource(path, hash) {
    return this.getAllTasks().find((task) => task.sourceLinks.some((source) => source.path === path && source.hash === hash));
  }
  async recordWriteHistory(input) {
    const record = {
      id: crypto.randomUUID(),
      createdAt: toIsoLocal(now()),
      ...input
    };
    this.writeHistory = [record, ...this.writeHistory].slice(0, 100);
    await this.enqueueWrite(() => this.writeJson(this.pathFor(WRITE_HISTORY_FILE), { records: this.writeHistory }));
  }
  seedDefaultDataIfEmpty() {
    if (this.projects.length > 0 || this.getAllTasks().length > 0) {
      return;
    }
    const timestamp = toIsoLocal(now());
    const today = toDateKey(now());
    const projectId = crypto.randomUUID();
    const project = {
      id: projectId,
      name: "\u63D2\u4EF6\u4F53\u9A8C\u793A\u4F8B",
      description: "\u7528\u4E8E\u5C55\u793A\u4ECA\u65E5\u4EFB\u52A1\u3001\u770B\u677F\u3001\u7518\u7279\u56FE\u3001\u601D\u7EF4\u5BFC\u56FE\u4E0E\u5FEB\u901F\u8BB0\u5F55\u80FD\u529B\uFF0C\u53EF\u76F4\u63A5\u5220\u9664\u3002",
      color: "#2979ff",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const page = {
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
      title: "\u68B3\u7406\u63D2\u4EF6\u4F7F\u7528\u6D41\u7A0B",
      description: "\u770B\u677F\u4E2D\u53EF\u4EE5\u5207\u6362\u72B6\u6001\uFF0C\u7518\u7279\u56FE\u4F1A\u5C55\u793A\u8BA1\u5212\u65F6\u95F4\u3002",
      projectId,
      status: "doing",
      priority: "high",
      tags: ["\u793A\u4F8B", "\u89C4\u5212"],
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
          content: "\u8BC4\u8BED\u8282\u70B9\u53EA\u5728\u601D\u7EF4\u5BFC\u56FE\u4E2D\u663E\u793A\uFF0C\u4E0D\u4F1A\u8FDB\u5165\u4EFB\u52A1\u5217\u8868\u3002",
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
          content: "\u53EF\u4EE5\u4ECE\u5FEB\u901F\u8BB0\u5F55\u9875\u7EE7\u7EED\u8FFD\u52A0\u8BC4\u8BED\u3002",
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
      title: "\u5B8C\u6210\u4E00\u4E2A\u7EC4\u5408\u4EFB\u52A1",
      description: "\u7EC4\u5408\u4EFB\u52A1\u53EF\u9010\u9879\u52FE\u9009\u5B50\u4EFB\u52A1\uFF0C\u8FDB\u5EA6\u4F1A\u540C\u6B65\u5230\u603B\u89C8\u3002",
      projectId,
      status: "todo",
      priority: "medium",
      tags: ["\u793A\u4F8B"],
      date: today,
      startTime: "10:30",
      endTime: "11:30",
      recurrence: "once",
      kind: "composite",
      subtasks: [
        { title: "\u521B\u5EFA\u9879\u76EE", order: 0 },
        { title: "\u65B0\u589E\u4EFB\u52A1", order: 1 },
        { title: "\u5199\u5165\u65E5\u8BB0", order: 2 }
      ],
      viewState: {
        board: { columnId: "todo", order: 20 },
        mindmap: { parentTaskId: planTask.id, childOrder: 20, expanded: true, x: 540, y: 270 }
      }
    });
    const reviewTask = this.buildSeriesTask({
      title: "\u590D\u76D8\u4ECA\u65E5\u8BB0\u5F55",
      projectId,
      status: "done",
      priority: "low",
      tags: ["\u793A\u4F8B", "\u590D\u76D8"],
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
        summary: "\u521D\u59CB\u5316\u9ED8\u8BA4\u6F14\u793A\u6570\u636E",
        taskIds: [planTask.id, buildTask.id, reviewTask.id],
        createdAt: timestamp
      }
    ];
  }
  async loadConfigFile() {
    const path = this.pathFor(CONFIG_FILE);
    const dataFolder = sanitizeFolder(this.config.dataFolder);
    const existing = await this.readJson(path, isPartialPluginConfig);
    return {
      config: { ...DEFAULT_CONFIG, ...this.config, ...existing.value ?? {}, dataFolder },
      failedPaths: existing.ok ? [] : [existing.path]
    };
  }
  async loadProjects() {
    const data = await this.readJson(this.pathFor(PROJECTS_FILE), isProjectsFile);
    this.projects = data.value?.projects ?? [];
    return { failedPaths: data.ok ? [] : [data.path] };
  }
  async loadProgressPages() {
    const data = await this.readJson(this.pathFor(PROGRESS_FILE), isProgressPagesFile);
    this.progressPages = data.value?.pages ?? [];
    return { failedPaths: data.ok ? [] : [data.path] };
  }
  async loadNoteTaskIndex() {
    const data = await this.readJson(this.pathFor(NOTE_TASK_INDEX_FILE), isNoteTaskIndexFile);
    this.noteTaskIndex = data.value?.files ?? [];
    return { failedPaths: data.ok ? [] : [data.path] };
  }
  async loadWriteHistory() {
    const data = await this.readJson(this.pathFor(WRITE_HISTORY_FILE), isWriteHistoryFile);
    this.writeHistory = data.value?.records ?? [];
    return { failedPaths: data.ok ? [] : [data.path] };
  }
  async loadTasks() {
    const tasksFolder = this.pathFor(TASKS_DIR);
    const folder = this.app.vault.getAbstractFileByPath(tasksFolder);
    const folderStat = folder ? null : await this.app.vault.adapter.stat(tasksFolder);
    if (folder && !(folder instanceof import_obsidian.TFolder) || !folder && folderStat && folderStat.type !== "folder") {
      return { failedPaths: [tasksFolder] };
    }
    if (!folder && !folderStat) {
      this.tasks.clear();
      return { failedPaths: [] };
    }
    this.tasks.clear();
    const failedPaths = [];
    const monthFiles = await this.collectMonthFilePaths(tasksFolder);
    for (const childPath of monthFiles) {
      const data = await this.readJson(childPath, isTasksFile);
      const month = childPath.split("/").pop()?.replace(/\.json$/, "") ?? "";
      if (!data.ok) {
        failedPaths.push(childPath);
      }
      this.tasks.set(month, (data.value?.tasks ?? []).map(normalizeStoredTask));
    }
    return { failedPaths };
  }
  async loadCurrentFolderData() {
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
  async reloadCurrentFolderData() {
    await this.refreshFromDisk({ triggerChange: false });
  }
  async ensureDataFolder() {
    const validated = await this.validateDataFolder(this.config.dataFolder);
    if (!validated.ok) {
      throw new Error(validated.message);
    }
    await this.ensureFolder(this.config.dataFolder);
    await this.ensureFolder(this.pathFor(TASKS_DIR));
  }
  pathFor(child) {
    return this.pathInFolder(this.config.dataFolder, child);
  }
  pathInFolder(folder, child) {
    return (0, import_obsidian.normalizePath)(`${sanitizeFolder(folder)}/${child}`);
  }
  async ensureFolder(path) {
    const normalized = (0, import_obsidian.normalizePath)(path);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof import_obsidian.TFolder) {
      return;
    }
    if (existing) {
      throw new Error(`${normalized} \u5DF2\u88AB\u6587\u4EF6\u5360\u7528`);
    }
    const existingStat = await this.app.vault.adapter.stat(normalized);
    if (existingStat?.type === "folder") {
      return;
    }
    if (existingStat?.type === "file") {
      throw new Error(`${normalized} \u5DF2\u88AB\u6587\u4EF6\u5360\u7528`);
    }
    try {
      await this.app.vault.createFolder(normalized);
    } catch (error) {
      const current = this.app.vault.getAbstractFileByPath(normalized);
      const currentStat = current ? null : await this.app.vault.adapter.stat(normalized);
      if ((current instanceof import_obsidian.TFolder || currentStat?.type === "folder") && isFolderAlreadyExistsError(error)) {
        return;
      }
      throw error;
    }
  }
  async readJson(path, validate, notifyOnError = true) {
    const file = this.app.vault.getAbstractFileByPath(path);
    try {
      const raw = file ? await this.app.vault.cachedRead(file) : await this.readTextFromAdapter(path);
      if (raw === null) {
        return { ok: true, value: null };
      }
      const parsed = JSON.parse(raw);
      if (validate && !validate(parsed)) {
        throw new Error("\u6570\u636E\u7ED3\u6784\u4E0D\u7B26\u5408\u5F53\u524D\u63D2\u4EF6\u683C\u5F0F");
      }
      return { ok: true, value: parsed };
    } catch (error) {
      console.error("Failed to read JSON file", path, error);
      if (notifyOnError) {
        new import_obsidian.Notice(`\u8BFB\u53D6\u6570\u636E\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u81EA\u52A8\u5199\u56DE: ${path}`, 0);
      }
      return { ok: false, value: null, path };
    }
  }
  async writeJson(path, data) {
    const normalized = (0, import_obsidian.normalizePath)(path);
    const payload = JSON.stringify(data, null, 2);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!file) {
      await this.app.vault.adapter.write(normalized, payload);
      return;
    }
    await this.app.vault.modify(file, payload);
  }
  async enqueueWrite(job) {
    const run = this.writeQueue.catch(() => void 0).then(job);
    this.writeQueue = run.catch((error) => {
      console.error("Project management data write failed", error);
    });
    return run;
  }
  async persistMonths(months) {
    const uniqueMonths = [...new Set(months)];
    await this.enqueueWrite(async () => {
      for (const month of uniqueMonths) {
        await this.flushMonth(month);
      }
    });
  }
  async flushMonth(month) {
    const path = this.pathFor(`${TASKS_DIR}/${month}.json`);
    const tasks = this.tasks.get(month) ?? [];
    if (tasks.length === 0) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file) {
        await this.app.vault.delete(file);
      }
      return;
    }
    await this.writeJson(path, { month, tasks });
  }
  async flushAllTasks() {
    const months = /* @__PURE__ */ new Set([
      ...this.tasks.keys(),
      ...await this.collectMonthFiles(this.pathFor(TASKS_DIR))
    ]);
    for (const month of months) {
      await this.flushMonth(month);
    }
  }
  async flushAll() {
    await this.enqueueWrite(async () => {
      await this.writeJson(this.pathFor(CONFIG_FILE), this.config);
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects });
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages });
      await this.writeJson(this.pathFor(NOTE_TASK_INDEX_FILE), { files: this.noteTaskIndex });
      await this.writeJson(this.pathFor(WRITE_HISTORY_FILE), { records: this.writeHistory });
      await this.flushAllTasks();
    });
  }
  assertWritable() {
    if (this.readOnlyReason) {
      throw new Error(this.readOnlyReason);
    }
  }
  captureDataState() {
    return {
      projects: this.projects.map((project) => ({ ...project })),
      progressPages: this.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] })),
      tasks: new Map([...this.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)])),
      noteTaskIndex: this.noteTaskIndex.map((entry) => ({ ...entry, taskIds: [...entry.taskIds] })),
      writeHistory: this.writeHistory.map((record) => ({ ...record, taskIds: [...record.taskIds] }))
    };
  }
  restoreDataState(state) {
    this.projects = state.projects.map((project) => ({ ...project }));
    this.progressPages = state.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] }));
    this.tasks = new Map([...state.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)]));
    this.noteTaskIndex = state.noteTaskIndex.map((entry) => ({ ...entry, taskIds: [...entry.taskIds] }));
    this.writeHistory = state.writeHistory.map((record) => ({ ...record, taskIds: [...record.taskIds] }));
  }
  async inspectDataFolder(folder) {
    const normalized = (0, import_obsidian.normalizePath)(sanitizeFolder(folder));
    const abstract = this.app.vault.getAbstractFileByPath(normalized);
    const stat = abstract ? null : await this.app.vault.adapter.stat(normalized);
    if (abstract && !(abstract instanceof import_obsidian.TFolder) || !abstract && stat && stat.type !== "folder") {
      return { hasData: true, invalidPaths: [normalized] };
    }
    if (!abstract && !stat) {
      return { hasData: false, invalidPaths: [] };
    }
    const invalidPaths = [];
    let hasData = false;
    const check = async (path, validate) => {
      const current = this.app.vault.getAbstractFileByPath(path);
      const currentStat = current ? null : await this.app.vault.adapter.stat(path);
      if (current && current instanceof import_obsidian.TFolder) {
        hasData = true;
        invalidPaths.push(path);
        return;
      }
      if (!current && !currentStat) {
        return;
      }
      hasData = true;
      const result = await this.readJson(path, validate, false);
      if (!result.ok) {
        invalidPaths.push(path);
      }
    };
    await check(this.pathInFolder(folder, CONFIG_FILE), isPartialPluginConfig);
    await check(this.pathInFolder(folder, PROJECTS_FILE), isProjectsFile);
    await check(this.pathInFolder(folder, PROGRESS_FILE), isProgressPagesFile);
    await check(this.pathInFolder(folder, NOTE_TASK_INDEX_FILE), isNoteTaskIndexFile);
    await check(this.pathInFolder(folder, WRITE_HISTORY_FILE), isWriteHistoryFile);
    const tasksPath = this.pathInFolder(folder, TASKS_DIR);
    const tasksFolder = this.app.vault.getAbstractFileByPath(tasksPath);
    const tasksStat = tasksFolder ? null : await this.app.vault.adapter.stat(tasksPath);
    if (tasksFolder && !(tasksFolder instanceof import_obsidian.TFolder) || !tasksFolder && tasksStat && tasksStat.type !== "folder") {
      hasData = true;
      invalidPaths.push(tasksPath);
    } else {
      const monthFiles = await this.collectMonthFilePaths(tasksPath);
      for (const childPath of monthFiles) {
        hasData = true;
        const result = await this.readJson(childPath, isTasksFile, false);
        if (!result.ok) {
          invalidPaths.push(childPath);
        }
      }
    }
    return { hasData, invalidPaths };
  }
  async readTextFromAdapter(path) {
    const normalized = (0, import_obsidian.normalizePath)(path);
    const stat = await this.app.vault.adapter.stat(normalized);
    if (!stat) {
      return null;
    }
    if (stat.type !== "file") {
      throw new Error(`${normalized} \u4E0D\u662F\u6587\u4EF6`);
    }
    return this.app.vault.adapter.read(normalized);
  }
  async listFolderEntries(path) {
    try {
      const listed = await this.app.vault.adapter.list((0, import_obsidian.normalizePath)(path));
      return [
        ...listed.folders.map((folder) => ({ name: folder.split("/").pop() ?? folder, isFolder: true })),
        ...listed.files.map((file) => ({ name: file.split("/").pop() ?? file, isFolder: false }))
      ];
    } catch {
      return [];
    }
  }
  async collectMonthFilePaths(tasksFolder) {
    const folder = this.app.vault.getAbstractFileByPath(tasksFolder);
    if (folder instanceof import_obsidian.TFolder) {
      return folder.children.filter((child) => !(child instanceof import_obsidian.TFolder) && child.name.endsWith(".json")).map((child) => child.path);
    }
    const entries = await this.listFolderEntries(tasksFolder);
    return entries.filter((child) => !child.isFolder && child.name.endsWith(".json")).map((child) => (0, import_obsidian.normalizePath)(`${tasksFolder}/${child.name}`));
  }
  async collectMonthFiles(tasksFolder) {
    const paths = await this.collectMonthFilePaths(tasksFolder);
    return paths.map((path) => path.split("/").pop()?.replace(/\.json$/, "") ?? "").filter(Boolean);
  }
};
function normalizeStoredTask(task) {
  const kind = task.kind ?? ((task.subtasks?.length ?? 0) > 0 ? "composite" : "simple");
  const status = normalizeTaskStatus(task.status);
  const subtasks = (task.subtasks ?? []).map((item, index) => ({ id: item.id, title: item.title, order: item.order ?? index }));
  const legacyStates = (task.completedOccurrences ?? []).map(
    (item) => buildNormalizedOccurrenceState(item.date, kind, subtasks, subtasks.map((subtask) => subtask.id), item.completedAt)
  );
  const occurrenceStates = (task.occurrenceStates ?? legacyStates).map(
    (item) => buildNormalizedOccurrenceState(item.date, kind, subtasks, item.completedSubtaskIds ?? subtasks.map((subtask) => subtask.id), item.completedAt ?? null)
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
    viewState: mergeViewState(void 0, task.viewState, status),
    sourceLinks: normalizeSourceLinks(task.sourceLinks),
    notes: normalizeTaskNotes(task.notes),
    mindmapComments: normalizeMindmapComments(task.mindmapComments, task.id),
    revision: task.revision ?? 1
  };
}
function isPartialPluginConfig(value) {
  return isRecord(value);
}
function isProjectsFile(value) {
  return isRecord(value) && Array.isArray(value.projects) && value.projects.every(isRecord);
}
function isProgressPagesFile(value) {
  return isRecord(value) && Array.isArray(value.pages) && value.pages.every(isRecord);
}
function isNoteTaskIndexFile(value) {
  return isRecord(value) && Array.isArray(value.files) && value.files.every(isRecord);
}
function isWriteHistoryFile(value) {
  return isRecord(value) && Array.isArray(value.records) && value.records.every(isRecord);
}
function isTasksFile(value) {
  return isRecord(value) && typeof value.month === "string" && Array.isArray(value.tasks) && value.tasks.every(isStoredTaskRecord);
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStoredTaskRecord(value) {
  if (!isRecord(value)) {
    return false;
  }
  const subtasks = value.subtasks;
  const occurrenceStates = value.occurrenceStates;
  const completedOccurrences = value.completedOccurrences;
  return typeof value.id === "string" && typeof value.title === "string" && typeof value.date === "string" && typeof value.recurrence === "string" && Array.isArray(value.occurrenceDates) && value.occurrenceDates.every((date) => typeof date === "string") && (subtasks === void 0 || Array.isArray(subtasks) && subtasks.every(isTaskSubtaskRecord)) && (occurrenceStates === void 0 || Array.isArray(occurrenceStates) && occurrenceStates.every(isOccurrenceStateRecord)) && (completedOccurrences === void 0 || Array.isArray(completedOccurrences) && completedOccurrences.every(isCompletedOccurrenceRecord));
}
function isTaskSubtaskRecord(value) {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string";
}
function isOccurrenceStateRecord(value) {
  return isRecord(value) && typeof value.date === "string";
}
function isCompletedOccurrenceRecord(value) {
  return isRecord(value) && typeof value.date === "string" && typeof value.completedAt === "string";
}
function cloneTask(task) {
  return {
    ...task,
    subtasks: task.subtasks.map((item) => ({ ...item })),
    occurrenceDates: [...task.occurrenceDates],
    occurrenceStates: task.occurrenceStates.map((item) => ({
      ...item,
      completedSubtaskIds: [...item.completedSubtaskIds ?? []]
    })),
    occurrenceOverrides: task.occurrenceOverrides.map((item) => ({ ...item })),
    tags: [...task.tags],
    viewState: cloneViewState(task.viewState),
    sourceLinks: task.sourceLinks.map((item) => ({ ...item })),
    notes: task.notes.map((item) => ({ ...item })),
    mindmapComments: task.mindmapComments.map((item) => ({ ...item }))
  };
}
function expandTask(task) {
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
function buildOccurrenceDates(input) {
  if (input.recurrence === "custom" && input.occurrenceDates?.length) {
    return [...new Set(input.occurrenceDates)].sort(compareDateKeys);
  }
  if (input.recurrence === "custom") {
    throw new Error("\u81EA\u5B9A\u4E49\u91CD\u590D\u5FC5\u987B\u63D0\u4F9B\u53D1\u751F\u65E5\u671F\u96C6\u5408");
  }
  const countLimit = input.recurrenceCount ?? (input.recurrence === "once" ? 1 : 365);
  const until = input.recurrenceUntil ?? null;
  const dates = [];
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
    throw new Error("\u672A\u751F\u6210\u4EFB\u4F55\u4EFB\u52A1\uFF0C\u8BF7\u68C0\u67E5\u91CD\u590D\u7ED3\u675F\u65E5\u671F");
  }
  return dates;
}
function resolveOccurrenceStates(params) {
  const { input, original, subtasks, occurrenceDates, timestamp, completedPatch } = params;
  if (completedPatch === true || original === void 0 && input.completed) {
    return occurrenceDates.map((date) => buildNormalizedOccurrenceState(date, input.kind ?? "simple", subtasks, subtasks.map((item) => item.id), timestamp));
  }
  if (completedPatch === false) {
    return [];
  }
  return occurrenceDates.map((date) => {
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
  }).filter((item) => Boolean(item));
}
function normalizeSubtaskInputs(subtasks, kind) {
  if (kind === "simple") {
    return [];
  }
  const normalized = (subtasks ?? []).map((item, index) => ({ id: item.id, title: item.title.trim(), order: item.order ?? index })).filter((item) => item.title.length > 0);
  if (normalized.length === 0) {
    throw new Error("\u7EC4\u5408\u4EFB\u52A1\u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u5B50\u4EFB\u52A1");
  }
  return normalized;
}
function resolveTaskSubtasks(inputSubtasks, kind, originalSubtasks) {
  if (kind === "simple") {
    return [];
  }
  return (inputSubtasks ?? []).map((item, index) => {
    const original = item.id ? originalSubtasks.find((entry) => entry.id === item.id) : void 0;
    return {
      id: original?.id ?? item.id ?? crypto.randomUUID(),
      title: item.title.trim(),
      order: item.order ?? original?.order ?? index
    };
  });
}
function getOccurrenceState(task, date) {
  return task?.occurrenceStates.find((item) => item.date === date);
}
function getOccurrenceOverride(task, date) {
  return task?.occurrenceOverrides.find((item) => item.date === date);
}
function getAllSubtaskIds(task) {
  if (task.kind === "composite") {
    return task.subtasks.map((item) => item.id);
  }
  return [];
}
function buildNormalizedOccurrenceState(date, kind, subtasks, completedSubtaskIds, completedAt) {
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
function upsertOccurrenceState(task, date, patch) {
  const nextState = buildNormalizedOccurrenceState(date, task.kind, task.subtasks, patch.completedSubtaskIds, patch.completedAt);
  const existing = getOccurrenceState(task, date);
  if (existing) {
    return task.occurrenceStates.map(
      (item) => item.date === date ? nextState : {
        ...item,
        completedSubtaskIds: [...item.completedSubtaskIds ?? []]
      }
    );
  }
  return [...task.occurrenceStates.map((item) => ({ ...item, completedSubtaskIds: [...item.completedSubtaskIds ?? []] })), nextState];
}
function getOccurrenceProgress(task, date) {
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
function summarizeOccurrencesProgress(occurrences) {
  return occurrences.reduce(
    (summary, occurrence) => {
      summary.totalSteps += occurrence.totalSteps;
      summary.completedSteps += occurrence.completedSteps;
      return summary;
    },
    { totalSteps: 0, completedSteps: 0 }
  );
}
function buildOccurrenceKey(taskId, date) {
  return `${taskId}::${date}`;
}
function occurrenceKeysForTask(task) {
  return new Set(task.occurrenceDates.map((date) => buildOccurrenceKey(task.id, date)));
}
function isTaskFullyCompleted(task) {
  return task.occurrenceDates.length > 0 && task.occurrenceDates.every((date) => getOccurrenceProgress(task, date).completed);
}
function detectRecurrenceFromDates(dates) {
  if (dates.length <= 1) {
    return "once";
  }
  const first = parseDateKey(dates[0]);
  const second = parseDateKey(dates[1]);
  const diffDays = Math.round((second.getTime() - first.getTime()) / (24 * 60 * 60 * 1e3));
  if (diffDays === 1) {
    return "daily";
  }
  if (diffDays === 7) {
    return "weekly";
  }
  return "once";
}
function normalizePositiveInteger(value) {
  if (value === null || value === void 0 || value === 0) {
    return null;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("\u91CD\u590D\u6B21\u6570\u5FC5\u987B\u4E3A\u6B63\u6574\u6570");
  }
  return Math.floor(value);
}
function normalizeDateOrUndefined(value) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error("\u91CD\u590D\u7ED3\u675F\u65E5\u671F\u683C\u5F0F\u9519\u8BEF");
  }
  return trimmed;
}
function normalizeTaskStatus(value) {
  return value === "doing" || value === "blocked" || value === "done" ? value : "todo";
}
function normalizeTaskPriority(value) {
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
    return value;
  }
  return void 0;
}
function normalizeTags(tags) {
  return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
}
function normalizeOccurrenceDates(dates) {
  if (!dates) {
    return void 0;
  }
  return [...new Set(dates.map((date) => date.trim()).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort(compareDateKeys);
}
function normalizeOccurrenceOverrides(overrides) {
  return (overrides ?? []).filter((override) => /^\d{4}-\d{2}-\d{2}$/.test(override.date)).map((override) => ({
    date: override.date,
    startTime: override.startTime?.trim() || void 0,
    endTime: override.endTime?.trim() || void 0,
    title: override.title?.trim() || void 0,
    skipped: Boolean(override.skipped),
    reason: override.reason?.trim() || void 0
  }));
}
function normalizeSourceLinks(sourceLinks) {
  return (sourceLinks ?? []).map((source) => ({
    ...source,
    id: source.id || crypto.randomUUID(),
    syncMode: source.syncMode ?? "import-only"
  }));
}
function normalizeTaskNotes(notes) {
  return (notes ?? []).map((note) => ({
    ...note,
    id: note.id || crypto.randomUUID()
  }));
}
function normalizeMindmapComments(comments, taskId) {
  return (comments ?? []).map((comment, index) => {
    const timestamp = comment.createdAt || toIsoLocal(now());
    return {
      id: comment.id || crypto.randomUUID(),
      taskId: comment.taskId || taskId || "",
      parentCommentId: comment.parentCommentId ?? null,
      content: comment.content.trim(),
      childOrder: comment.childOrder ?? index,
      x: Number.isFinite(comment.x) ? comment.x : void 0,
      y: Number.isFinite(comment.y) ? comment.y : void 0,
      createdAt: timestamp,
      updatedAt: comment.updatedAt || timestamp
    };
  }).filter((comment) => comment.content.length > 0);
}
function assertValidCommentParent(comments, commentId, parentCommentId) {
  if (!parentCommentId) {
    return;
  }
  if (parentCommentId === commentId) {
    throw new Error("\u8BC4\u8BED\u4E0D\u80FD\u6307\u5411\u81EA\u5DF1");
  }
  const descendants = collectCommentDescendants(comments, commentId);
  if (descendants.has(parentCommentId)) {
    throw new Error("\u4E0D\u80FD\u628A\u8BC4\u8BED\u6302\u5230\u81EA\u5DF1\u7684\u5B50\u8BC4\u8BED\u4E0B\u9762");
  }
}
function collectCommentDescendants(comments, rootId) {
  const descendants = /* @__PURE__ */ new Set();
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
function assertValidTaskMindmapParent(task, tasks) {
  const parentTaskId = task.viewState.mindmap.parentTaskId ?? null;
  if (!parentTaskId) {
    return;
  }
  if (parentTaskId === task.id) {
    throw new Error("\u4EFB\u52A1\u4E0D\u80FD\u6307\u5411\u81EA\u5DF1");
  }
  if (!tasks.some((item) => item.id === parentTaskId)) {
    throw new Error("\u7236\u7EA7\u4EFB\u52A1\u4E0D\u5B58\u5728");
  }
  const descendants = collectTaskDescendants(tasks, task.id);
  if (descendants.has(parentTaskId)) {
    throw new Error("\u4E0D\u80FD\u628A\u4EFB\u52A1\u6302\u5230\u81EA\u5DF1\u7684\u5B50\u4EFB\u52A1\u4E0B\u9762");
  }
}
function collectTaskDescendants(tasks, rootId) {
  const descendants = /* @__PURE__ */ new Set();
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
function mergeViewState(current, patch, status) {
  const base = current ?? defaultTaskViewState(status);
  return {
    board: {
      columnId: patch?.board?.columnId ?? base.board.columnId ?? status,
      order: patch?.board?.order ?? base.board.order ?? 0
    },
    gantt: {
      rowOrder: patch?.gantt?.rowOrder ?? base.gantt.rowOrder ?? 0,
      dependencyIds: [...patch?.gantt?.dependencyIds ?? base.gantt.dependencyIds ?? []],
      locked: patch?.gantt?.locked ?? base.gantt.locked ?? false,
      milestone: patch?.gantt?.milestone ?? base.gantt.milestone ?? false
    },
    mindmap: {
      parentTaskId: patch?.mindmap?.parentTaskId === void 0 ? base.mindmap.parentTaskId ?? null : patch.mindmap.parentTaskId,
      childOrder: patch?.mindmap?.childOrder ?? base.mindmap.childOrder ?? 0,
      expanded: patch?.mindmap?.expanded ?? base.mindmap.expanded ?? true,
      x: patch?.mindmap?.x ?? base.mindmap.x,
      y: patch?.mindmap?.y ?? base.mindmap.y
    }
  };
}
function defaultTaskViewState(status) {
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
function cloneViewState(viewState) {
  return {
    board: { ...viewState.board },
    gantt: {
      ...viewState.gantt,
      dependencyIds: [...viewState.gantt.dependencyIds]
    },
    mindmap: { ...viewState.mindmap }
  };
}
function sanitizeFolder(value) {
  return value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}
function isFolderAlreadyExistsError(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("folder already exists") || message.includes("already exists");
}
function toMonthKeyFromTask(task) {
  return task.date.slice(0, 7);
}
function monthsForTasks(tasks) {
  return tasks.map((task) => toMonthKeyFromTask(task));
}
function compareSeriesTasks(a, b) {
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
function compareOccurrences(a, b) {
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
function upsertOccurrenceOverride(task, override) {
  const normalized = normalizeOccurrenceOverrides([override])[0];
  const existing = task.occurrenceOverrides.filter((item) => item.date !== override.date);
  return normalized ? [...existing, normalized].sort((a, b) => a.date.localeCompare(b.date)) : existing;
}
function snapMinutes(value, slot) {
  return Math.ceil(value / slot) * slot;
}
function isOverdueSingleTask(task, today) {
  return task.recurrence === "once" && task.occurrenceDates.length === 1 && !isTaskFullyCompleted(task) && compareDateKeys(task.date, today) < 0;
}
function applyOccurrenceWindow(task, date, startTime, endTime) {
  if (task.recurrence === "once" && task.occurrenceDates.length === 1 && task.date === date) {
    task.startTime = startTime;
    task.endTime = endTime;
    return;
  }
  task.occurrenceOverrides = upsertOccurrenceOverride(task, {
    ...getOccurrenceOverride(task, date) ?? { date },
    date,
    startTime,
    endTime
  });
}
function buildOccupiedMinutesMap(occurrences) {
  const occupied = /* @__PURE__ */ new Map();
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
function sortOccupiedMinutes(intervals) {
  return intervals.slice().sort((left, right) => left.start - right.start || left.end - right.end);
}
function hasTimeOverlap(intervals, start, end) {
  return intervals.some((interval) => start < interval.end && end > interval.start);
}
function findAvailableOneMinuteWindow(intervals, preferredStart) {
  const sorted = sortOccupiedMinutes(intervals);
  const normalizedPreferred = Math.min(Math.max(preferredStart, 0), 24 * 60 - 2);
  const attempt = findFreeMinuteFrom(sorted, normalizedPreferred) ?? findFreeMinuteFrom(sorted, 0, normalizedPreferred);
  if (attempt === null) {
    throw new Error("\u5F53\u5929\u5DF2\u65E0\u53EF\u7528\u65F6\u95F4\u53EF\u81EA\u52A8\u8C03\u6574");
  }
  return {
    start: attempt,
    end: attempt + 1,
    startTime: formatMinutesToTime(attempt),
    endTime: formatMinutesToTime(attempt + 1)
  };
}
function findFreeMinuteFrom(intervals, startAt, endExclusive = 24 * 60 - 1) {
  for (let minute = startAt; minute < endExclusive; minute += 1) {
    if (!hasTimeOverlap(intervals, minute, minute + 1)) {
      return minute;
    }
  }
  return null;
}
function parseFormattedTaskText(text, options) {
  const tasks = [];
  const issues = [];
  const lines = text.split(/\r?\n/);
  let currentProjectId = options.projectId;
  let currentProjectName = options.projectId ? options.projects.find((project) => project.id === options.projectId)?.name : void 0;
  let currentTask = null;
  const flushCurrent = () => {
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
        currentProjectId = void 0;
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
        issues.push({ line: index + 1, message: error instanceof Error ? error.message : "\u4EFB\u52A1\u89E3\u6790\u5931\u8D25", raw });
      }
      return;
    }
    const subtaskMatch = /^\s{2,}-\s+(.+)$/.exec(line);
    if (subtaskMatch && currentTask) {
      currentTask.input.kind = "composite";
      currentTask.input.subtasks = [
        ...currentTask.input.subtasks ?? [],
        { title: subtaskMatch[1].trim(), order: currentTask.input.subtasks?.length ?? 0 }
      ];
      return;
    }
    if (line.trim()) {
      issues.push({ line: index + 1, message: "\u65E0\u6CD5\u8BC6\u522B\u7684\u884C", raw });
    }
  });
  flushCurrent();
  return { tasks, issues };
}
function parseTaskLine(rawTitle, context) {
  let title = rawTitle.trim();
  const dateMatch = /@(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2})-(\d{2}:\d{2}))?/.exec(title);
  const repeatMatch = /\brepeat:(once|daily|weekly|custom)\b/.exec(title);
  const countMatch = /\bcount:(\d+)\b/.exec(title);
  const untilMatch = /\buntil:(\d{4}-\d{2}-\d{2})\b/.exec(title);
  const statusMatch = /\bstatus:(todo|doing|blocked|done)\b/.exec(title);
  const finishMatch = /\bfinish:(today|series)\b/.exec(title);
  const priorityMatch = /!(low|medium|high|urgent)\b/.exec(title);
  const tags = [...title.matchAll(/#([^\s#]+)/g)].map((match) => match[1]).filter((tag) => !tag.startsWith("\u9879\u76EE"));
  title = title.replace(/@\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}-\d{2}:\d{2})?/g, "").replace(/\brepeat:(once|daily|weekly|custom)\b/g, "").replace(/\bcount:\d+\b/g, "").replace(/\buntil:\d{4}-\d{2}-\d{2}\b/g, "").replace(/\bstatus:(todo|doing|blocked|done)\b/g, "").replace(/\bfinish:(today|series)\b/g, "").replace(/!(low|medium|high|urgent)\b/g, "").replace(/#[^\s#]+/g, "").trim();
  if (!title) {
    throw new Error("\u4EFB\u52A1\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
  }
  return {
    input: {
      title,
      projectId: context.projectId,
      date: dateMatch?.[1] ?? context.defaultDate,
      startTime: dateMatch?.[2],
      endTime: dateMatch?.[3],
      recurrence: repeatMatch?.[1] ?? "once",
      recurrenceCount: countMatch ? Number(countMatch[1]) : null,
      recurrenceUntil: untilMatch?.[1] ?? null,
      status: statusMatch?.[1] ?? (context.completed ? "done" : "todo"),
      priority: priorityMatch?.[1],
      tags,
      sourceLinks: context.source ? [context.source] : [],
      completed: context.completed
    },
    projectName: context.projectName,
    completionMode: context.completed ? finishMatch?.[1] ?? "today" : "pending"
  };
}
function resolveTaskImportAction(matched, completionMode) {
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
function normalizeImportIdentity(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-Hans-CN");
}
function renderTaskOccurrenceForExport(task, mode) {
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
function resolveExportCompletionMode(task, mode) {
  if (mode === "complete-series" && task.recurrence !== "once") {
    return "series";
  }
  if ((mode === "complete-today" || mode === "current" && task.completed) && task.recurrence !== "once") {
    return "today";
  }
  return "pending";
}
function extractProjectTaskBlocks(text) {
  const blocks = [...text.matchAll(/<!--\s*pm:start\s*-->([\s\S]*?)<!--\s*pm:end\s*-->/g)].map((match) => match[1].trim());
  return blocks.length > 0 ? blocks.join("\n") : "";
}
function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = hash * 33 ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
function randomColor() {
  const palette = ["#3d8bfd", "#0f9d58", "#ff8c42", "#d64550", "#8a5cf6", "#188fa7"];
  return palette[Math.floor(Math.random() * palette.length)];
}

// src/settings.ts
var import_obsidian2 = require("obsidian");
var IMPORT_SAMPLE_TEXT = [
  "#\u9879\u76EE\uFF1A\u82F1\u8BED\u56DB\u7EA7\u51B2\u523A",
  "- [ ] \u642D\u5EFA\u590D\u4E60\u770B\u677F @2026-05-18 09:00-10:30 #planning !high status:doing",
  "  - \u6574\u7406\u8BCD\u6C47\u4EFB\u52A1",
  "  - \u5B89\u6392\u9605\u8BFB\u8BA1\u5212",
  "- [ ] \u6A21\u8003\u590D\u76D8 @2026-05-19 19:30-21:00 #mock !medium status:todo repeat:weekly count:4",
  "- [x] \u63D0\u4EA4\u62A5\u540D\u6750\u6599 @2026-05-17 18:00-18:30 #admin status:done",
  "#\u9879\u76EE\uFF1A\u5199\u4F5C\u7D20\u6750\u5E93",
  "- [ ] \u4FEE\u8BA2\u4F5C\u6587\u6A21\u677F @2026-05-20 20:00-21:30 #writing !urgent status:blocked",
  "- [x] \u5468\u590D\u76D8\u603B\u4EFB\u52A1 @2026-05-21 21:00-21:30 #review status:done repeat:weekly count:6 finish:series",
  "#\u9879\u76EE\uFF1A",
  "- [ ] \u8865\u4E00\u6761\u672A\u5F52\u5C5E\u4E34\u65F6\u4EFB\u52A1 @2026-05-18 22:00-22:30 #adhoc status:todo"
].join("\n");
var ProjectManagementSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u9879\u76EE\u7BA1\u7406\u63D2\u4EF6\u8BBE\u7F6E" });
    const doc = containerEl.createDiv({ cls: "pm-settings-doc" });
    doc.createEl("h3", { text: "\u6279\u91CF\u5BFC\u5165\u6570\u636E\u8303\u4F8B" });
    doc.createDiv({
      cls: "pm-muted",
      text: "\u8FD9\u91CC\u7684\u8303\u4F8B\u53EF\u76F4\u63A5\u7F16\u8F91\u3001\u5B9E\u65F6\u89C2\u5BDF\u5BFC\u5165\u6548\u679C\uFF0C\u4F46\u4E0D\u4F1A\u4FDD\u5B58\uFF1B\u6BCF\u6B21\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u9875\u90FD\u4F1A\u6062\u590D\u9ED8\u8BA4\u5C55\u793A\u5185\u5BB9\u3002"
    });
    const sampleInput = doc.createEl("textarea", { cls: "pm-settings-sample-input" });
    sampleInput.value = IMPORT_SAMPLE_TEXT;
    const insight = doc.createDiv({ cls: "pm-settings-preview" });
    const renderSamplePreview = () => {
      insight.empty();
      const preview = this.plugin.store.previewFormattedTasks(sampleInput.value, {
        defaultDate: "2026-05-18"
      });
      const statusCount = preview.tasks.reduce((counts, task) => {
        const key = task.input.status ?? "todo";
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {});
      const dates = preview.tasks.map((task) => task.input.date).sort();
      const summary = insight.createDiv({ cls: "pm-settings-preview-grid" });
      [
        ["\u8868\u683C\u4EFB\u52A1\u6570", String(preview.summary.total)],
        ["\u8986\u76D6/\u65B0\u589E", `${preview.summary.overwriteCount}/${preview.summary.createCount}`],
        ["\u770B\u677F\u5217\u5206\u5E03", `\u5F85\u529E ${statusCount.todo ?? 0} \xB7 \u8FDB\u884C\u4E2D ${statusCount.doing ?? 0} \xB7 \u963B\u585E ${statusCount.blocked ?? 0} \xB7 \u5DF2\u5B8C\u6210 ${statusCount.done ?? 0}`],
        ["\u7518\u7279\u8DE8\u5EA6", dates.length > 0 ? `${dates[0]} -> ${dates[dates.length - 1]}` : "\u6682\u65E0"],
        ["\u5B8C\u6210\u7EDF\u8BA1", `\u5DF2\u52FE\u9009 ${preview.summary.completed}\uFF0C\u7EC4\u5408\u4EFB\u52A1 ${preview.summary.composite}`],
        ["\u9879\u76EE\u53D8\u5316", preview.summary.newProjectNames.length > 0 ? `\u4F1A\u65B0\u5EFA ${preview.summary.newProjectNames.join("\u3001")}` : "\u5168\u90E8\u9879\u76EE\u5DF2\u5B58\u5728\u6216\u672A\u5F52\u5C5E"]
      ].forEach(([label, value]) => {
        const card = summary.createDiv({ cls: "pm-settings-preview-card" });
        card.createDiv({ cls: "pm-muted", text: label });
        card.createEl("strong", { text: value });
      });
      const notes = insight.createDiv({ cls: "pm-settings-preview-notes" });
      [
        "\u8868\u683C\u89C6\u56FE\u4F1A\u5C55\u793A\u6807\u9898\u3001\u72B6\u6001\u3001\u4F18\u5148\u7EA7\u3001\u6807\u7B7E\u3001\u91CD\u590D\u89C4\u5219\u4E0E\u5B8C\u6210\u8FDB\u5EA6\u3002",
        "\u770B\u677F\u4F1A\u6309\u7167 status:todo / doing / blocked / done \u81EA\u52A8\u5206\u5217\u3002",
        "\u7518\u7279\u56FE\u76F4\u63A5\u8BFB\u53D6\u65E5\u671F\u548C\u65F6\u95F4\u8303\u56F4\uFF1Brepeat \u4EFB\u52A1\u4F1A\u4FDD\u7559\u7CFB\u5217\u4FE1\u606F\u3002",
        "\u601D\u7EF4\u5BFC\u56FE\u7684\u8BC4\u8BED\u8282\u70B9\u3001\u4EFB\u52A1\u6302\u8F7D\u5173\u7CFB\u548C\u4F9D\u8D56\u5173\u7CFB\uFF0C\u5BFC\u5165\u540E\u7EE7\u7EED\u5728\u9879\u76EE\u8FDB\u5EA6\u9875\u6216\u5FEB\u901F\u8BB0\u5F55\u9875\u8865\u5145\u3002"
      ].forEach((item) => notes.createEl("div", { text: item, cls: "pm-settings-note-item" }));
      if (preview.issues.length > 0) {
        const issueList = insight.createEl("ul", { cls: "pm-import-issues" });
        preview.issues.slice(0, 6).forEach((issue) => {
          issueList.createEl("li", { text: `\u7B2C ${issue.line} \u884C\uFF1A${issue.message}` });
        });
      }
    };
    sampleInput.addEventListener("input", renderSamplePreview);
    doc.createEl("h3", { text: "\u5BFC\u5165\u540E\u4F1A\u5448\u73B0\u4EC0\u4E48" });
    const list = doc.createEl("ul");
    [
      "\u8868\u683C\u89C6\u56FE\u4F1A\u5C55\u793A\u6807\u9898\u3001\u72B6\u6001\u3001\u4F18\u5148\u7EA7\u3001\u6807\u7B7E\u3001\u91CD\u590D\u89C4\u5219\u548C\u7EC4\u5408\u4EFB\u52A1\u8FDB\u5EA6\u3002",
      "\u770B\u677F\u89C6\u56FE\u4F1A\u6309 status:todo / doing / blocked / done \u81EA\u52A8\u5206\u5217\u3002",
      "\u7518\u7279\u56FE\u4F1A\u76F4\u63A5\u8BFB\u53D6\u65E5\u671F\u548C\u65F6\u95F4\u8303\u56F4\u751F\u6210\u65F6\u95F4\u8F74\u6761\u5E26\u3002",
      "\u5DF2\u5B8C\u6210\u7EDF\u8BA1\u4F1A\u628A - [x] \u4EFB\u52A1\u76F4\u63A5\u8BA1\u5165\u5B8C\u6210\u6570\u91CF\u4E0E\u5B8C\u6210\u7387\uFF0Crepeat \u4EFB\u52A1\u8FD8\u652F\u6301 finish:series \u63D0\u524D\u7ED3\u675F\u6574\u4E2A\u7CFB\u5217\u3002",
      "\u601D\u7EF4\u5BFC\u56FE\u4F1A\u5148\u751F\u6210\u4EFB\u52A1\u8282\u70B9\uFF1B\u8BC4\u8BED\u8282\u70B9\u3001\u4EFB\u52A1\u7236\u5B50\u5173\u7CFB\u548C\u4F9D\u8D56\u5173\u7CFB\u5728\u9879\u76EE\u8FDB\u5EA6\u9875\u6216\u5FEB\u901F\u8BB0\u5F55\u9875\u7EE7\u7EED\u8865\u5145\u3002"
    ].forEach((item) => list.createEl("li", { text: item }));
    renderSamplePreview();
    new import_obsidian2.Setting(containerEl).setName("\u6570\u636E\u76EE\u5F55\u8DEF\u5F84").setDesc("\u5FC5\u987B\u662F\u5F53\u524D Vault \u5185\u76F8\u5BF9\u8DEF\u5F84\u3002\u76EE\u6807\u76EE\u5F55\u5DF2\u6709\u6709\u6548\u63D2\u4EF6\u6570\u636E\u65F6\u4F1A\u76F4\u63A5\u52A0\u8F7D\uFF1B\u76EE\u5F55\u4E0D\u5B58\u5728\u3001\u4E3A\u7A7A\u6216\u63D2\u4EF6\u6570\u636E\u635F\u574F\u65F6\u4F1A\u7528\u5F53\u524D\u6570\u636E\u521B\u5EFA\u65B0\u6587\u4EF6\u3002").addText(
      (text) => text.setValue(this.plugin.settings.dataFolder).onChange(async (value) => {
        this.plugin.pendingSettings.dataFolder = value.trim();
      })
    ).addButton(
      (button) => button.setButtonText("\u5E94\u7528").setCta().onClick(async () => {
        const path = this.plugin.pendingSettings.dataFolder ?? this.plugin.settings.dataFolder;
        const validation = await this.plugin.store.validateDataFolder(path);
        if (!validation.ok) {
          new import_obsidian2.Notice(validation.message ?? "\u6570\u636E\u76EE\u5F55\u4E0D\u53EF\u7528");
          return;
        }
        await this.plugin.updateSettings({ dataFolder: path });
        new import_obsidian2.Notice("\u6570\u636E\u76EE\u5F55\u5DF2\u66F4\u65B0");
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u6D3B\u8DC3\u5EA6 Tab \u540D\u79F0").addText(
      (text) => text.setValue(this.plugin.settings.overviewTab1Name).onChange(async (value) => {
        await this.plugin.updateSettings({ overviewTab1Name: value.trim() || "\u6D3B\u8DC3\u5EA6" });
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u9879\u76EE\u8FDB\u5EA6 Tab \u540D\u79F0").addText(
      (text) => text.setValue(this.plugin.settings.overviewTab2Name).onChange(async (value) => {
        await this.plugin.updateSettings({ overviewTab2Name: value.trim() || "\u9879\u76EE\u8FDB\u5EA6" });
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u5FEB\u901F\u8BB0\u5F55\u9875\u540D\u79F0").addText(
      (text) => text.setValue(this.plugin.settings.dialogTabName).onChange(async (value) => {
        await this.plugin.updateSettings({ dialogTabName: value.trim() || "\u5FEB\u901F\u8BB0\u5F55" });
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u65E5\u8BB0\u6587\u4EF6\u5939").setDesc("\u6309\u5929\u751F\u6210\u65E5\u8BB0\u65F6\u4F7F\u7528\u7684 Vault \u5185\u76F8\u5BF9\u8DEF\u5F84\u3002").addText(
      (text) => text.setValue(this.plugin.settings.dailyNoteFolder).onChange(async (value) => {
        await this.plugin.updateSettings({ dailyNoteFolder: value.trim() || "\u65E5\u8BB0" });
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u65E5\u8BB0\u4FDD\u5B58\u65B9\u5F0F").setDesc("\u9ED8\u8BA4\u6BCF\u5929\u4E00\u4E2A\u6587\u4EF6\uFF1B\u4E5F\u53EF\u4EE5\u628A\u5FEB\u901F\u8BB0\u5F55\u7EDF\u4E00\u8FFD\u52A0\u5230\u4E00\u4E2A\u6C47\u603B\u6587\u4EF6\u3002").addDropdown((dropdown) => {
      dropdown.addOption("per-day", "\u6BCF\u5929\u4E00\u4E2A\u6587\u4EF6").addOption("single-file", "\u6C47\u603B\u5230\u5355\u6587\u4EF6").setValue(this.plugin.settings.dailyNoteMode).onChange(async (value) => {
        await this.plugin.updateSettings({ dailyNoteMode: value });
      });
    });
    new import_obsidian2.Setting(containerEl).setName("\u65E5\u8BB0\u6C47\u603B\u6587\u4EF6").setDesc("\u65E5\u8BB0\u4FDD\u5B58\u65B9\u5F0F\u4E3A\u201C\u6C47\u603B\u5230\u5355\u6587\u4EF6\u201D\u65F6\u4F7F\u7528\uFF0C\u4F8B\u5982\uFF1A\u65E5\u8BB0/\u5FEB\u901F\u8BB0\u5F55.md\u3002").addText(
      (text) => text.setValue(this.plugin.settings.dailyNoteSingleFilePath).onChange(async (value) => {
        await this.plugin.updateSettings({ dailyNoteSingleFilePath: value.trim() || "\u65E5\u8BB0/\u5FEB\u901F\u8BB0\u5F55.md" });
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u6700\u8FD1\u7B14\u8BB0\u6570\u91CF").setDesc("\u5FEB\u901F\u8BB0\u5F55\u8FFD\u52A0\u4EFB\u610F\u7B14\u8BB0\u65F6\u663E\u793A\u7684\u6700\u8FD1\u4FEE\u6539\u6587\u4EF6\u6570\u91CF\u3002").addText(
      (text) => text.setValue(String(this.plugin.settings.taskNoteRecentLimit)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          await this.plugin.updateSettings({ taskNoteRecentLimit: Math.min(30, Math.floor(parsed)) });
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u5FEB\u901F\u8BB0\u5F55\u9ED8\u8BA4\u76EE\u6807").addDropdown((dropdown) => {
      dropdown.addOption("daily-note", "\u5199\u5165\u6BCF\u65E5\u65E5\u8BB0").addOption("task-note", "\u8FFD\u52A0\u5230\u4EFB\u52A1\u7B14\u8BB0").addOption("quick-task", "\u5FEB\u901F\u521B\u5EFA\u4EFB\u52A1").addOption("mindmap", "\u6269\u5145\u601D\u7EF4\u5BFC\u56FE").setValue(this.plugin.settings.defaultDialogTarget).onChange(async (value) => {
        await this.plugin.updateSettings({ defaultDialogTarget: value });
      });
    });
    new import_obsidian2.Setting(containerEl).setName("\u65F6\u95F4\u7C92\u5EA6").setDesc("MVP \u9ED8\u8BA4 15 \u5206\u949F").addText(
      (text) => text.setValue(String(this.plugin.settings.timeSlotMinutes)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          await this.plugin.updateSettings({ timeSlotMinutes: parsed });
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u9ED8\u8BA4\u4EFB\u52A1\u65F6\u957F").setDesc("\u5355\u4F4D\uFF1A\u5206\u949F").addText(
      (text) => text.setValue(String(this.plugin.settings.defaultTaskDurationMinutes)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) {
          await this.plugin.updateSettings({ defaultTaskDurationMinutes: parsed });
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u9ED8\u8BA4\u5F00\u59CB\u65F6\u95F4").setDesc("\u5F53\u67D0\u4E00\u5929\u5C1A\u65E0\u5DF2\u6392\u671F\u4EFB\u52A1\u65F6\uFF0C\u65B0\u589E\u4EFB\u52A1\u9ED8\u8BA4\u4ECE\u8BE5\u65F6\u95F4\u5F00\u59CB").addText(
      (text) => text.setValue(this.plugin.settings.defaultTaskStartTime).onChange(async (value) => {
        if (/^\d{2}:\d{2}$/.test(value.trim())) {
          await this.plugin.updateSettings({ defaultTaskStartTime: value.trim() });
        }
      })
    );
    new import_obsidian2.Setting(containerEl).setName("\u663E\u793A\u5DF2\u5B8C\u6210\u4EFB\u52A1").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showCompletedTasks).onChange(async (value) => {
        await this.plugin.updateSettings({ showCompletedTasks: value });
      })
    );
  }
};

// src/views/dialogView.ts
var import_obsidian5 = require("obsidian");

// src/components/entitySuggestModal.ts
var import_obsidian3 = require("obsidian");
var EntitySuggestModal = class extends import_obsidian3.FuzzySuggestModal {
  constructor(app, options) {
    super(app);
    this.options = options;
    this.emptyStateText = options.emptyStateText ?? "\u6CA1\u6709\u53EF\u9009\u9879";
  }
  onOpen() {
    super.onOpen();
    this.setPlaceholder(this.options.placeholder);
  }
  getItems() {
    return this.options.items;
  }
  getItemText(item) {
    return this.options.getItemText(item);
  }
  renderSuggestion(item, el) {
    const group = this.options.getItemGroup?.(item.item);
    if (group) {
      el.createDiv({ cls: "pm-suggest-group", text: group });
    }
    el.createDiv({ cls: "pm-suggest-title", text: this.options.getItemText(item.item) });
    const note = this.options.getItemNote?.(item.item);
    if (note) {
      el.createDiv({ cls: "pm-suggest-note", text: note });
    }
  }
  onChooseItem(item) {
    this.options.onChoose(item);
  }
};

// src/views/base.ts
var import_obsidian4 = require("obsidian");
var BaseProjectView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  async onOpen() {
    this.registerEvent(this.plugin.store.on("changed", () => this.render()));
    await this.render();
  }
};

// src/views/dialogView.ts
var DIALOG_VIEW_TYPE = "project-management-dialog-view";
var _QuickDialogView = class _QuickDialogView extends BaseProjectView {
  constructor(leaf, plugin) {
    super(leaf, plugin);
    this.target = "daily-note";
    this.selectedMindmapProjectId = "";
    this.selectedTaskId = "";
    this.selectedCommentId = "";
    this.selectedNotePath = "";
    this.draftContent = "";
    this.mindmapInsertMode = "child";
    this.target = plugin.settings.defaultDialogTarget;
  }
  getViewType() {
    return DIALOG_VIEW_TYPE;
  }
  getDisplayText() {
    return this.plugin.settings.dialogTabName;
  }
  getIcon() {
    return "message-square-plus";
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("pm-view", "pm-dialog-view");
    const tasks = sortTasksForMindmapSelection(this.plugin.store.getAllTasks(), (task) => this.projectNameForTask(task));
    const recentFiles = this.getRecentMarkdownFiles();
    const mindmapProjects = buildMindmapProjectOptions(tasks, (task) => this.projectNameForTask(task));
    this.ensureDialogSelections(tasks, recentFiles, mindmapProjects);
    const projectTasks = this.selectedMindmapProjectId ? tasks.filter((task) => mindmapProjectKey(task) === this.selectedMindmapProjectId) : [];
    const projectNodeOptions = buildMindmapAnchorOptions(projectTasks);
    const selectedNode = this.ensureMindmapNodeSelection(projectNodeOptions);
    const recentNodeOptions = this.resolveRecentMindmapTargets(buildMindmapAnchorOptions(tasks));
    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "\u5FEB\u901F\u8BB0\u5F55" });
    title.createDiv({ cls: "pm-muted", text: "\u5FEB\u901F\u8BB0\u5F55\u3001\u5199\u65E5\u8BB0\u3001\u8FFD\u52A0\u4EFB\u610F\u7B14\u8BB0\uFF0C\u6216\u7ED9\u601D\u7EF4\u5BFC\u56FE\u8865\u5145\u8BC4\u8BED\u3002" });
    const targetCards = container.createDiv({ cls: "pm-dialog-target-grid" });
    getTargetCards().forEach((item) => {
      const card = targetCards.createEl("button", {
        cls: `pm-dialog-target ${this.target === item.value ? "is-active" : ""}`
      });
      const icon = card.createDiv({ cls: "pm-dialog-target-icon" });
      (0, import_obsidian5.setIcon)(icon, item.icon);
      card.createSpan({ cls: "pm-dialog-target-title", text: item.label });
      card.createSpan({ cls: "pm-dialog-target-desc", text: item.desc });
      card.addEventListener("click", () => {
        this.target = item.value;
        this.render();
      });
    });
    if (this.target === "daily-note") {
      this.renderPathCard(container, {
        icon: "calendar-days",
        title: "\u5199\u5165\u4F4D\u7F6E",
        path: this.resolveDailyNotePath(),
        muted: this.plugin.settings.dailyNoteMode === "single-file" ? "\u5355\u6587\u4EF6\u6A21\u5F0F" : "\u6309\u65E5\u751F\u6210 Markdown \u6587\u4EF6"
      });
    }
    if (this.target === "task-note") {
      this.renderTaskNoteControls(container, recentFiles);
    }
    if (this.target === "mindmap") {
      this.renderMindmapControls(container, mindmapProjects, projectNodeOptions, recentNodeOptions, selectedNode);
    }
    if (this.target === "quick-task") {
      const importHint = container.createDiv({ cls: "pm-input-card" });
      const hintHeader = importHint.createDiv({ cls: "pm-input-card-header" });
      hintHeader.createEl("strong", { text: "\u4EFB\u52A1\u5BFC\u5165\u89C4\u5219" });
      hintHeader.createDiv({ cls: "pm-muted", text: "\u8FD9\u5957\u8BED\u6CD5\u4E0E\u9879\u76EE\u9875\u6279\u91CF\u5BFC\u5165\u3001\u4ECA\u65E5\u4EFB\u52A1\u5BFC\u51FA\u5B8C\u5168\u4E92\u901A\u3002" });
      [
        "\u53EF\u7528 #\u9879\u76EE\uFF1A\u65B0\u9879\u76EE\u540D \u81EA\u52A8\u5EFA\u9879\u76EE\uFF1B#\u9879\u76EE\uFF1A \u4F1A\u5BFC\u5165\u4E3A\u672A\u5F52\u5C5E\u4EFB\u52A1\u3002",
        "\u540C\u9879\u76EE\u4E0B\u82E5\u4EFB\u52A1\u540D\u91CD\u590D\uFF0C\u4F1A\u76F4\u63A5\u8986\u76D6\u65E7\u4EFB\u52A1\uFF0C\u800C\u4E0D\u662F\u91CD\u590D\u65B0\u589E\uFF1B\u82E5\u65F6\u95F4\u51B2\u7A81\uFF0C\u4F1A\u81EA\u52A8\u6539\u6210\u540C\u65E5 1 \u5206\u949F\u7A7A\u6863\u5360\u4F4D\u3002",
        "\u52FE\u9009 - [x] \u9ED8\u8BA4\u53EA\u5B8C\u6210\u5F53\u5929\uFF1Brepeat \u4EFB\u52A1\u52A0 finish:series \u53EF\u63D0\u524D\u7ED3\u675F\u6574\u4E2A\u7CFB\u5217\u3002"
      ].forEach((item) => importHint.createDiv({ cls: "pm-settings-note-item", text: item }));
    }
    const editorCard = container.createDiv({ cls: "pm-editor-card" });
    const editorHeader = editorCard.createDiv({ cls: "pm-editor-header" });
    const editorCopy = editorHeader.createDiv();
    editorCopy.createEl("h3", { text: "\u5185\u5BB9\u7F16\u8F91" });
    editorCopy.createDiv({ cls: "pm-muted", text: editorHint(this.target, this.mindmapInsertMode) });
    const textarea = editorCard.createEl("textarea", {
      cls: "pm-dialog-input",
      placeholder: this.placeholderForTarget()
    });
    textarea.value = this.draftContent;
    textarea.addEventListener("input", () => {
      this.draftContent = textarea.value;
      const counter = editorCard.querySelector(".pm-editor-count");
      if (counter instanceof HTMLElement) {
        counter.setText(`\u5B57\u6570\uFF1A${this.draftContent.length}`);
      }
    });
    const toolbar = editorCard.createDiv({ cls: "pm-editor-toolbar" });
    const toolActions = [
      { label: "B", action: "bold" },
      { label: "I", action: "italic" },
      { label: "H", action: "heading" },
      { label: "\u5217\u8868", action: "list" },
      { label: "\u5F15\u7528", action: "quote" },
      { label: "\u4EE3\u7801", action: "code" }
    ];
    toolActions.forEach((item) => {
      const button = toolbar.createEl("button", { text: item.label, cls: "pm-button pm-button-ghost pm-editor-tool" });
      button.addEventListener("click", () => {
        applyEditorFormat(textarea, item.action);
        this.draftContent = textarea.value;
        const counter = editorCard.querySelector(".pm-editor-count");
        if (counter instanceof HTMLElement) {
          counter.setText(`\u5B57\u6570\uFF1A${this.draftContent.length}`);
        }
      });
    });
    const footer = editorCard.createDiv({ cls: "pm-editor-footer" });
    footer.createDiv({ cls: "pm-editor-count pm-muted", text: `\u5B57\u6570\uFF1A${this.draftContent.length}` });
    const submitButton = footer.createEl("button", { text: "\u63D0\u4EA4\u5185\u5BB9", cls: "pm-button pm-button-primary" });
    submitButton.addEventListener("click", async () => {
      try {
        await this.submit(this.draftContent, tasks);
        this.draftContent = "";
        textarea.value = "";
        footer.querySelector(".pm-editor-count")?.setText("\u5B57\u6570\uFF1A0");
        new import_obsidian5.Notice("\u5DF2\u4FDD\u5B58");
      } catch (error) {
        new import_obsidian5.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
  }
  renderTaskNoteControls(container, recentFiles) {
    const pathCard = this.renderPathCard(container, {
      icon: "file-text",
      title: "\u76EE\u6807\u6587\u4EF6",
      path: this.selectedNotePath || "\u8BF7\u9009\u62E9 Markdown \u6587\u4EF6",
      muted: "\u652F\u6301\u6700\u8FD1\u6587\u4EF6\u5FEB\u6377\u9009\u62E9\uFF0C\u4E5F\u53EF\u4EE5\u624B\u52A8\u8F93\u5165 Vault \u5185\u8DEF\u5F84\u3002"
    });
    const actions = pathCard.createDiv({ cls: "pm-path-actions" });
    const pickerButton = actions.createEl("button", { cls: "pm-button pm-button-secondary pm-path-button" });
    (0, import_obsidian5.setIcon)(pickerButton, "folder-open");
    pickerButton.title = "\u9009\u62E9\u6587\u4EF6";
    pickerButton.addEventListener("click", () => {
      new EntitySuggestModal(this.app, {
        items: recentFiles,
        placeholder: "\u9009\u62E9 Markdown \u6587\u4EF6",
        emptyStateText: "\u6CA1\u6709\u53EF\u9009\u7684 Markdown \u6587\u4EF6",
        getItemText: (file) => file.basename,
        getItemNote: (file) => file.path,
        onChoose: (file) => {
          this.selectedNotePath = file.path;
          this.render();
        }
      }).open();
    });
    const inputCard = container.createDiv({ cls: "pm-input-card" });
    inputCard.createDiv({ cls: "pm-muted", text: "\u624B\u52A8\u8DEF\u5F84" });
    const pathInput = inputCard.createEl("input", {
      type: "text",
      value: this.selectedNotePath,
      placeholder: "\u4F8B\u5982\uFF1AProjects/\u82F1\u8BED\u56DB\u7EA7.md"
    });
    pathInput.addEventListener("input", () => {
      this.selectedNotePath = pathInput.value.trim();
      const pathEl = pathCard.querySelector(".pm-path-value");
      if (pathEl instanceof HTMLElement) {
        pathEl.setText(this.selectedNotePath || "\u8BF7\u9009\u62E9 Markdown \u6587\u4EF6");
      }
    });
  }
  renderMindmapControls(container, projects, nodeOptions, recentNodeOptions, selectedNode) {
    const project = projects.find((item) => item.id === this.selectedMindmapProjectId);
    const projectCard = this.renderPathCard(container, {
      icon: "folders",
      title: "\u76EE\u6807\u9879\u76EE",
      path: project?.label ?? "\u8BF7\u9009\u62E9\u9879\u76EE",
      muted: project?.note ?? "\u5148\u9009\u62E9\u9879\u76EE\uFF0C\u518D\u5C55\u5F00\u8BE5\u9879\u76EE\u4E0B\u7684\u4EFB\u52A1\u8282\u70B9\u548C\u8BC4\u8BED\u8282\u70B9\u3002"
    });
    const projectActions = projectCard.createDiv({ cls: "pm-path-actions" });
    const projectPicker = projectActions.createEl("button", { cls: "pm-button pm-button-secondary pm-path-button" });
    (0, import_obsidian5.setIcon)(projectPicker, "folder-tree");
    projectPicker.title = "\u9009\u62E9\u9879\u76EE";
    projectPicker.addEventListener("click", () => {
      new EntitySuggestModal(this.app, {
        items: projects,
        placeholder: "\u5148\u9009\u62E9\u9879\u76EE",
        emptyStateText: "\u6682\u65E0\u53EF\u8865\u5145\u5BFC\u56FE\u7684\u9879\u76EE",
        getItemText: (item) => item.label,
        getItemNote: (item) => item.note,
        onChoose: (item) => {
          this.selectedMindmapProjectId = item.id;
          this.selectedTaskId = "";
          this.selectedCommentId = "";
          this.render();
        }
      }).open();
    });
    const nodeCard = this.renderPathCard(container, {
      icon: "workflow",
      title: "\u76EE\u6807\u8282\u70B9",
      path: selectedNode?.pathLabel ?? "\u8BF7\u9009\u62E9\u5BFC\u56FE\u8282\u70B9",
      muted: selectedNode?.note ?? "\u5F53\u524D\u9879\u76EE\u5185\u7684\u4EFB\u52A1\u8282\u70B9\u4E0E\u8BC4\u8BED\u8282\u70B9\u90FD\u4F1A\u5728\u8FD9\u91CC\u5C55\u793A\u3002"
    });
    const nodeActions = nodeCard.createDiv({ cls: "pm-path-actions" });
    const nodePicker = nodeActions.createEl("button", { cls: "pm-button pm-button-secondary pm-path-button" });
    nodePicker.disabled = nodeOptions.length === 0;
    (0, import_obsidian5.setIcon)(nodePicker, "list-tree");
    nodePicker.title = "\u9009\u62E9\u8282\u70B9";
    nodePicker.addEventListener("click", () => {
      new EntitySuggestModal(this.app, {
        items: nodeOptions,
        placeholder: "\u9009\u62E9\u9879\u76EE\u5185\u7684\u4EFB\u52A1\u6216\u8BC4\u8BED\u8282\u70B9",
        emptyStateText: "\u5F53\u524D\u9879\u76EE\u4E0B\u6682\u65E0\u53EF\u7528\u8282\u70B9",
        getItemGroup: (item) => item.taskTitle,
        getItemText: (item) => item.label,
        getItemNote: (item) => item.note,
        onChoose: (item) => {
          this.selectMindmapNode(item);
          this.render();
        }
      }).open();
    });
    const modeTabs = container.createDiv({ cls: "pm-segmented-control" });
    [
      ["child", "\u521B\u5EFA\u5B50\u8282\u70B9"],
      ["inside", "\u8FFD\u52A0\u5230\u8282\u70B9\u6B63\u6587"]
    ].forEach(([value, label]) => {
      const button = modeTabs.createEl("button", {
        text: label,
        cls: `pm-segmented-item ${this.mindmapInsertMode === value ? "is-active" : ""}`
      });
      button.addEventListener("click", () => {
        this.mindmapInsertMode = value;
        this.render();
      });
    });
    const shortcutCard = container.createDiv({ cls: "pm-input-card" });
    const shortcutHeader = shortcutCard.createDiv({ cls: "pm-input-card-header" });
    shortcutHeader.createEl("strong", { text: "\u5FEB\u6377\u8282\u70B9" });
    shortcutHeader.createDiv({ cls: "pm-muted", text: "\u8DE8\u4EFB\u52A1\u5171\u4EAB\uFF0C\u53EA\u4FDD\u7559\u6700\u8FD1\u4F7F\u7528\u7684 6 \u4E2A\u8282\u70B9\uFF0C\u5E76\u6807\u6CE8\u6240\u5C5E\u4EFB\u52A1\u3002" });
    const shortcuts = shortcutCard.createDiv({ cls: "pm-anchor-chip-list pm-anchor-shortcut-list" });
    if (recentNodeOptions.length === 0) {
      shortcuts.createDiv({ cls: "pm-muted", text: "\u8FD8\u6CA1\u6709\u5FEB\u6377\u8282\u70B9\uFF0C\u4FDD\u5B58\u8FC7\u4E00\u6B21\u5BFC\u56FE\u8865\u5145\u540E\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" });
    } else {
      recentNodeOptions.forEach((option) => {
        const chip = shortcuts.createEl("button", {
          cls: `pm-anchor-chip pm-anchor-shortcut ${selectedNode?.taskId === option.taskId && selectedNode?.commentId === option.commentId ? "is-active" : ""}`
        });
        chip.title = `${option.taskTitle} \xB7 ${option.note}`;
        chip.createSpan({ cls: "pm-anchor-shortcut-task", text: option.taskTitle });
        chip.createSpan({ cls: "pm-anchor-shortcut-label", text: option.kind === "task" ? "\u4EFB\u52A1\u8282\u70B9" : option.pathLabel });
        chip.addEventListener("click", () => {
          this.selectedMindmapProjectId = option.projectId;
          this.selectMindmapNode(option);
          this.render();
        });
      });
    }
  }
  renderPathCard(container, options) {
    const card = container.createDiv({ cls: "pm-path-card" });
    const icon = card.createDiv({ cls: "pm-path-icon" });
    (0, import_obsidian5.setIcon)(icon, options.icon);
    const body = card.createDiv({ cls: "pm-path-copy" });
    body.createDiv({ cls: "pm-path-label pm-muted", text: options.title });
    body.createDiv({ cls: "pm-path-value", text: options.path });
    body.createDiv({ cls: "pm-path-note pm-muted", text: options.muted });
    return card;
  }
  ensureDialogSelections(tasks, recentFiles, projects) {
    if ((!this.selectedTaskId || !tasks.some((task) => task.id === this.selectedTaskId)) && tasks.length > 0) {
      this.selectedTaskId = tasks[0].id;
      this.selectedCommentId = "";
    }
    if ((!this.selectedNotePath || !recentFiles.some((file) => file.path === this.selectedNotePath)) && recentFiles.length > 0) {
      this.selectedNotePath = recentFiles[0].path;
    }
    if ((!this.selectedMindmapProjectId || !projects.some((project) => project.id === this.selectedMindmapProjectId)) && tasks.length > 0) {
      const selectedTask = tasks.find((task) => task.id === this.selectedTaskId);
      this.selectedMindmapProjectId = selectedTask ? mindmapProjectKey(selectedTask) : projects[0]?.id ?? "";
    }
  }
  projectNameForTask(task) {
    return task.projectId ? this.plugin.store.getProject(task.projectId)?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" : "\u672A\u5F52\u5C5E\u9879\u76EE";
  }
  placeholderForTarget() {
    if (this.target === "quick-task") {
      return "#\u9879\u76EE\uFF1A\u65B0\u7684\u5B66\u4E60\u8BA1\u5212\n- [ ] \u5FEB\u901F\u4EFB\u52A1 @2026-05-18 09:00-10:00 #tag !high status:doing\n- [x] \u6BCF\u5468\u56DE\u987E @2026-05-18 20:00-20:30 #review status:done repeat:weekly count:4 finish:series";
    }
    if (this.target === "mindmap") {
      return this.mindmapInsertMode === "inside" ? "\u8F93\u5165\u540E\u4F1A\u8FFD\u52A0\u5230\u5F53\u524D\u8282\u70B9\u6B63\u6587\u2026" : "\u6BCF\u4E00\u884C\u4F1A\u521B\u5EFA\u4E3A\u4E00\u4E2A\u8BC4\u8BED\u5B50\u8282\u70B9\uFF0C\u4F8B\u5982\uFF1A\n\u4ECA\u5929\u9605\u8BFB\u6548\u7387\u4E0D\u9519\n\u8BED\u6CD5\u9898\u9700\u8981\u5355\u72EC\u590D\u76D8";
    }
    if (this.target === "task-note") {
      return "\u5728\u6B64\u8F93\u5165\u6216\u7C98\u8D34\u5185\u5BB9\u2026";
    }
    return "\u5728\u6B64\u8F93\u5165\u6216\u7C98\u8D34\u5185\u5BB9\u2026";
  }
  async submit(content, tasks) {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("\u5185\u5BB9\u4E0D\u80FD\u4E3A\u7A7A");
    }
    if (this.target === "daily-note") {
      await this.appendDailyNote(trimmed);
      return;
    }
    if (this.target === "quick-task") {
      await this.plugin.store.importFormattedTasks(trimmed, {
        defaultDate: toDateKey(now()),
        source: {
          id: crypto.randomUUID(),
          type: "dialog",
          syncMode: "import-only",
          lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        historySummary: "\u4ECE\u5FEB\u901F\u8BB0\u5F55\u521B\u5EFA\u4EFB\u52A1"
      });
      return;
    }
    if (this.target === "task-note") {
      await this.appendMarkdownNote(this.selectedNotePath, trimmed);
      return;
    }
    const selected = this.plugin.store.getTask(this.selectedTaskId) ?? tasks.find((task) => task.id === this.selectedTaskId);
    if (!selected) {
      throw new Error("\u8BF7\u5148\u9009\u62E9\u5BFC\u56FE\u8282\u70B9");
    }
    if (this.mindmapInsertMode === "inside") {
      await this.appendToMindmapNode(selected, trimmed);
      this.recordRecentMindmapTarget(selected.id, this.selectedCommentId || null);
      return;
    }
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      await this.plugin.store.addTaskMindmapComment(selected.id, line.replace(/^-\s*/, ""), this.selectedCommentId || null);
    }
    this.recordRecentMindmapTarget(selected.id, this.selectedCommentId || null);
  }
  ensureMindmapNodeSelection(options) {
    const selected = options.find((option) => option.taskId === this.selectedTaskId && option.commentId === (this.selectedCommentId || null)) ?? options[0];
    if (!selected) {
      this.selectedTaskId = "";
      this.selectedCommentId = "";
      return void 0;
    }
    this.selectMindmapNode(selected);
    return selected;
  }
  selectMindmapNode(option) {
    this.selectedTaskId = option.taskId;
    this.selectedCommentId = option.commentId ?? "";
  }
  resolveRecentMindmapTargets(allNodeOptions) {
    const lookup = new Map(allNodeOptions.map((option) => [`${option.taskId}::${option.commentId ?? ""}`, option]));
    _QuickDialogView.recentMindmapTargets = _QuickDialogView.recentMindmapTargets.filter(
      (item) => lookup.has(`${item.taskId}::${item.commentId ?? ""}`)
    );
    return _QuickDialogView.recentMindmapTargets.map((item) => lookup.get(`${item.taskId}::${item.commentId ?? ""}`)).filter((item) => Boolean(item)).slice(0, 6);
  }
  recordRecentMindmapTarget(taskId, commentId) {
    const key = `${taskId}::${commentId ?? ""}`;
    _QuickDialogView.recentMindmapTargets = [
      { taskId, commentId },
      ..._QuickDialogView.recentMindmapTargets.filter((item) => `${item.taskId}::${item.commentId ?? ""}` !== key)
    ].slice(0, 6);
  }
  async appendToMindmapNode(task, content) {
    const latestTask = this.plugin.store.getTask(task.id);
    if (!latestTask) {
      throw new Error("\u76EE\u6807\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    if (this.selectedCommentId) {
      const comment = latestTask.mindmapComments.find((item) => item.id === this.selectedCommentId);
      if (!comment) {
        throw new Error("\u8BC4\u8BED\u8282\u70B9\u4E0D\u5B58\u5728");
      }
      await this.plugin.store.updateTaskMindmapComment(latestTask.id, comment.id, {
        content: joinParagraphs(comment.content, content)
      });
      return;
    }
    await this.plugin.store.updateTask(latestTask.id, {
      description: joinParagraphs(latestTask.description ?? "", content)
    });
  }
  resolveDailyNotePath() {
    return this.plugin.settings.dailyNoteMode === "single-file" ? (0, import_obsidian5.normalizePath)(this.plugin.settings.dailyNoteSingleFilePath) : (0, import_obsidian5.normalizePath)(`${this.plugin.settings.dailyNoteFolder}/${toDateKey(now())}.md`);
  }
  async appendDailyNote(content) {
    await this.appendMarkdownNote(this.resolveDailyNotePath(), content);
  }
  async appendMarkdownNote(path, content) {
    const filePath = (0, import_obsidian5.normalizePath)(path.trim());
    if (!filePath || filePath.endsWith("/")) {
      throw new Error("\u8BF7\u9009\u62E9\u6216\u8F93\u5165\u6709\u6548\u7684 Markdown \u6587\u4EF6\u8DEF\u5F84");
    }
    await this.ensureParentFolder(filePath);
    const existing = await this.app.vault.adapter.read(filePath).catch(() => "");
    const next = `${existing.trimEnd()}

## ${toDateKey(now())} ${(/* @__PURE__ */ new Date()).toLocaleTimeString()}

${content}
`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.app.vault.modify(file, next);
    } else {
      await this.app.vault.adapter.write(filePath, next);
    }
  }
  async ensureParentFolder(filePath) {
    const parts = filePath.split("/");
    parts.pop();
    const folder = (0, import_obsidian5.normalizePath)(parts.join("/"));
    if (folder) {
      await this.ensureFolder(folder);
    }
  }
  getRecentMarkdownFiles() {
    return this.app.vault.getMarkdownFiles().sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, this.plugin.settings.taskNoteRecentLimit);
  }
  async ensureFolder(path) {
    const normalized = (0, import_obsidian5.normalizePath)(path);
    const parts = normalized.split("/").filter(Boolean);
    let cursor = "";
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      const folder = this.app.vault.getAbstractFileByPath(cursor);
      if (folder instanceof import_obsidian5.TFolder) {
        continue;
      }
      const stat = await this.app.vault.adapter.stat(cursor);
      if (stat?.type === "folder") {
        continue;
      }
      await this.app.vault.createFolder(cursor);
    }
  }
};
_QuickDialogView.recentMindmapTargets = [];
var QuickDialogView = _QuickDialogView;
function getTargetCards() {
  return [
    { value: "daily-note", label: "\u5199\u65E5\u8BB0", desc: "\u4FDD\u5B58\u5230\u6BCF\u65E5\u8BB0\u5F55", icon: "book-marked" },
    { value: "task-note", label: "\u8FFD\u52A0\u7B14\u8BB0", desc: "\u9009\u62E9\u4EFB\u610F Markdown \u6587\u4EF6", icon: "file-pen-line" },
    { value: "quick-task", label: "\u521B\u5EFA\u4EFB\u52A1", desc: "\u89E3\u6790\u591A\u884C\u4EFB\u52A1\u8BED\u6CD5", icon: "list-plus" },
    { value: "mindmap", label: "\u8865\u5145\u5BFC\u56FE", desc: "\u652F\u6301\u8282\u70B9\u6B63\u6587 / \u5B50\u8282\u70B9\u4E24\u79CD\u65B9\u5F0F", icon: "git-branch-plus" }
  ];
}
function sortTasksForMindmapSelection(tasks, getProjectName) {
  return [...tasks].sort((left, right) => {
    const leftProject = getProjectName(left);
    const rightProject = getProjectName(right);
    const projectCompare = leftProject.localeCompare(rightProject, "zh-Hans-CN");
    if (projectCompare !== 0) {
      return projectCompare;
    }
    const titleCompare = left.title.localeCompare(right.title, "zh-Hans-CN");
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return left.date.localeCompare(right.date);
  });
}
function buildMindmapProjectOptions(tasks, getProjectName) {
  const projects = /* @__PURE__ */ new Map();
  tasks.forEach((task) => {
    const key = mindmapProjectKey(task);
    if (projects.has(key)) {
      return;
    }
    projects.set(key, {
      id: key,
      label: getProjectName(task),
      note: key === UNASSIGNED_PROJECT_KEY ? "\u672A\u5F52\u5C5E\u9879\u76EE\u4EFB\u52A1\u4F1A\u5728\u8FD9\u91CC\u96C6\u4E2D\u5C55\u793A\u3002" : "\u9009\u62E9\u540E\u53EA\u5C55\u793A\u8BE5\u9879\u76EE\u4E0B\u7684\u4EFB\u52A1\u8282\u70B9\u4E0E\u8BC4\u8BED\u8282\u70B9\u3002"
    });
  });
  return [...projects.values()].sort((left, right) => {
    if (left.id === UNASSIGNED_PROJECT_KEY) {
      return 1;
    }
    if (right.id === UNASSIGNED_PROJECT_KEY) {
      return -1;
    }
    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });
}
function buildMindmapAnchorOptions(tasks) {
  if (tasks.length === 0) {
    return [];
  }
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskChildrenByParent = /* @__PURE__ */ new Map();
  tasks.forEach((task) => {
    const parentId = task.viewState.mindmap.parentTaskId ?? null;
    const key = parentId && taskById.has(parentId) ? parentId : null;
    taskChildrenByParent.set(key, [...taskChildrenByParent.get(key) ?? [], task]);
  });
  taskChildrenByParent.forEach((items) => items.sort((a, b) => a.viewState.mindmap.childOrder - b.viewState.mindmap.childOrder || compareTaskTitles(a, b)));
  const options = [];
  const visitComments = (task, parentCommentId, depth) => {
    const comments = task.mindmapComments.filter((comment) => (comment.parentCommentId ?? null) === parentCommentId).sort((left, right) => left.childOrder - right.childOrder);
    comments.forEach((comment) => {
      const prefix = depth > 0 ? "\xB7 ".repeat(depth) : "";
      options.push({
        taskId: task.id,
        commentId: comment.id,
        projectId: mindmapProjectKey(task),
        label: `${prefix}\u8BC4\u8BED \xB7 ${truncateText(comment.content, 20)}`,
        note: comment.content,
        taskTitle: task.title,
        pathLabel: `\u8BC4\u8BED \xB7 ${truncateText(comment.content, 24)}`,
        kind: "comment"
      });
      visitComments(task, comment.id, depth + 1);
    });
  };
  const visitTasks = (parentTaskId, depth) => {
    (taskChildrenByParent.get(parentTaskId) ?? []).forEach((task) => {
      const prefix = depth > 0 ? "\xB7 ".repeat(depth) : "";
      options.push({
        taskId: task.id,
        commentId: null,
        projectId: mindmapProjectKey(task),
        label: `${prefix}${task.title}`,
        note: `${task.projectId ? "\u9879\u76EE\u4EFB\u52A1" : "\u672A\u5F52\u5C5E\u9879\u76EE"} \xB7 ${task.date} \xB7 ${statusText(task.status)}`,
        taskTitle: task.title,
        pathLabel: task.title,
        kind: "task"
      });
      visitComments(task, null, depth + 1);
      visitTasks(task.id, depth + 1);
    });
  };
  visitTasks(null, 0);
  return options;
}
function editorHint(target, mode) {
  if (target === "mindmap") {
    return mode === "inside" ? "\u5F53\u524D\u4F1A\u628A\u5185\u5BB9\u5E76\u5165\u6240\u9009\u8282\u70B9\u6B63\u6587\u3002" : "\u5F53\u524D\u4F1A\u628A\u6BCF\u4E00\u884C\u89E3\u6790\u6210\u4E00\u4E2A\u65B0\u7684\u8BC4\u8BED\u8282\u70B9\u3002";
  }
  if (target === "quick-task") {
    return "\u652F\u6301\u4EFB\u52A1\u8BED\u6CD5\u6279\u91CF\u5BFC\u5165\uFF0C\u9002\u5408\u5FEB\u901F\u62C6\u5206\u5F85\u529E\u3002";
  }
  return "\u7F16\u8F91\u533A\u5DF2\u5305\u88F9\u6210\u72EC\u7ACB\u5361\u7247\uFF0C\u4FBF\u4E8E\u4E13\u6CE8\u8F93\u5165\u3002";
}
function applyEditorFormat(textarea, action) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  let next = selected;
  if (action === "bold") {
    next = `**${selected || "\u52A0\u7C97"}**`;
  } else if (action === "italic") {
    next = `*${selected || "\u659C\u4F53"}*`;
  } else if (action === "heading") {
    next = `## ${selected || "\u6807\u9898"}`;
  } else if (action === "list") {
    next = prefixEachLine(selected || "\u5217\u8868\u9879", "- ");
  } else if (action === "quote") {
    next = prefixEachLine(selected || "\u5F15\u7528", "> ");
  } else if (action === "code") {
    next = selected.includes("\n") ? `\`\`\`
${selected || "\u4EE3\u7801"}
\`\`\`` : `\`${selected || "\u4EE3\u7801"}\``;
  }
  textarea.setRangeText(next, start, end, "end");
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
}
function prefixEachLine(value, prefix) {
  return value.split(/\r?\n/).map((line) => `${prefix}${line}`).join("\n");
}
function joinParagraphs(current, addition) {
  const trimmedCurrent = current.trim();
  const trimmedAddition = addition.trim();
  if (!trimmedCurrent) {
    return trimmedAddition;
  }
  return `${trimmedCurrent}
${trimmedAddition}`;
}
var UNASSIGNED_PROJECT_KEY = "__pm-unassigned-project__";
function mindmapProjectKey(task) {
  return task.projectId ?? UNASSIGNED_PROJECT_KEY;
}
function compareTaskTitles(left, right) {
  const titleCompare = left.title.localeCompare(right.title, "zh-Hans-CN");
  if (titleCompare !== 0) {
    return titleCompare;
  }
  return left.date.localeCompare(right.date);
}
function statusText(status) {
  if (status === "doing") {
    return "\u8FDB\u884C\u4E2D";
  }
  if (status === "blocked") {
    return "\u963B\u585E";
  }
  if (status === "done") {
    return "\u5DF2\u5B8C\u6210";
  }
  return "\u5F85\u529E";
}
function truncateText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 1))}\u2026` : value;
}

// src/views/overviewView.ts
var import_obsidian11 = require("obsidian");

// src/components/dayTasksModal.ts
var import_obsidian6 = require("obsidian");
var DayTasksModal = class extends import_obsidian6.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal");
    contentEl.createEl("h2", { text: this.options.date });
    contentEl.createEl("div", { cls: "pm-muted", text: `\u76F8\u5173\u4EFB\u52A1 ${this.options.tasks.length} \u6761` });
    if (this.options.tasks.length === 0) {
      contentEl.createDiv({ cls: "pm-empty", text: "\u5F53\u5929\u6CA1\u6709\u76F8\u5173\u4EFB\u52A1\u3002" });
      return;
    }
    const list = contentEl.createDiv({ cls: "pm-task-list" });
    this.options.tasks.forEach((task) => {
      const row = list.createDiv({ cls: "pm-task-row" });
      const copy = row.createDiv({ cls: "pm-task-copy" });
      copy.createEl("div", { text: `${task.completed ? "\u2713" : "\u25CB"} ${task.title}`, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = copy.createDiv({ cls: "pm-task-meta" });
      meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F" });
      meta.createSpan({ text: recurrenceLabel(task) });
      meta.createSpan({ text: this.options.getProject(task.projectId)?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
    });
  }
};
function recurrenceLabel(task) {
  if (task.recurrence === "daily") {
    return "\u6BCF\u65E5\u91CD\u590D";
  }
  if (task.recurrence === "weekly") {
    return "\u6BCF\u5468\u6B64\u65F6\u91CD\u590D";
  }
  return "\u5355\u6B21\u4EFB\u52A1";
}

// src/components/bulkImportModal.ts
var import_obsidian7 = require("obsidian");
var BulkImportModal = class extends import_obsidian7.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal", "pm-bulk-import-modal");
    contentEl.createEl("h2", { text: this.options.title });
    const projectName = this.options.projectId ? this.options.store.getProject(this.options.projectId)?.name ?? "\u5F53\u524D\u9879\u76EE" : "";
    contentEl.createDiv({
      cls: "pm-import-guide",
      text: this.options.projectId ? `\u5F53\u524D\u5904\u4E8E\u9879\u76EE\u5BFC\u5165\u6A21\u5F0F\uFF1A\u672A\u663E\u5F0F\u5207\u6362\u9879\u76EE\u65F6\uFF0C\u4EFB\u52A1\u4F1A\u6309\u201C${projectName}\u201D\u5904\u7406\u3002\u540C\u540D\u4EFB\u52A1\u4F1A\u8986\u76D6\uFF1B\u5982\u679C\u65F6\u95F4\u51B2\u7A81\uFF0C\u4F1A\u81EA\u52A8\u6539\u6210\u540C\u65E5 1 \u5206\u949F\u7A7A\u6863\u5360\u4F4D\u3002- [x] \u9ED8\u8BA4\u5B8C\u6210\u5F53\u5929\uFF0Crepeat \u4EFB\u52A1\u53EF\u7528 finish:series \u63D0\u524D\u7ED3\u675F\u6574\u4E2A\u7CFB\u5217\u3002` : "\u652F\u6301 #\u9879\u76EE\uFF1A\u65B0\u9879\u76EE\u540D \u81EA\u52A8\u5EFA\u9879\u76EE\uFF1B\u540C\u540D\u4EFB\u52A1\u4F1A\u8986\u76D6\uFF1B\u5982\u679C\u65F6\u95F4\u51B2\u7A81\uFF0C\u4F1A\u81EA\u52A8\u6539\u6210\u540C\u65E5 1 \u5206\u949F\u7A7A\u6863\u5360\u4F4D\u3002- [x] \u9ED8\u8BA4\u5B8C\u6210\u5F53\u5929\uFF0Crepeat \u4EFB\u52A1\u53EF\u7528 finish:series \u63D0\u524D\u7ED3\u675F\u6574\u4E2A\u7CFB\u5217\u3002"
    });
    const state = {
      text: "",
      defaultDate: this.options.defaultDate
    };
    new import_obsidian7.Setting(contentEl).setName("\u9ED8\u8BA4\u65E5\u671F").addText(
      (text) => text.setValue(state.defaultDate).onChange((value) => {
        state.defaultDate = value.trim();
        renderPreview();
      })
    );
    const input = contentEl.createEl("textarea", {
      cls: "pm-bulk-import-input",
      placeholder: "#\u9879\u76EE\uFF1A\u63D2\u4EF6\u4F53\u9A8C\u793A\u4F8B\n- [ ] \u5F00\u53D1\u4EFB\u52A1\u89E3\u6790\u5668 @2026-05-18 09:00-10:30 #parser !high status:doing\n  - \u89E3\u6790\u6807\u9898\n  - \u89E3\u6790\u65E5\u671F\n- [x] \u6BCF\u5468\u590D\u76D8\u5BFC\u5165\u6D41\u7A0B @2026-05-18 20:00-20:30 #review status:done repeat:weekly count:4 finish:series"
    });
    input.addEventListener("input", () => {
      state.text = input.value;
      renderPreview();
    });
    const previewEl = contentEl.createDiv({ cls: "pm-import-preview" });
    const renderPreview = () => {
      previewEl.empty();
      const preview = this.options.store.previewFormattedTasks(state.text, {
        projectId: this.options.projectId,
        defaultDate: state.defaultDate
      });
      previewEl.createDiv({
        cls: "pm-muted",
        text: `\u89E3\u6790 ${preview.summary.total} \u6761\uFF0C\u95EE\u9898 ${preview.issues.length} \u6761`
      });
      const summaryGrid = previewEl.createDiv({ cls: "pm-import-summary-grid" });
      [
        ["\u65B0\u589E\u4EFB\u52A1", String(preview.summary.createCount)],
        ["\u8986\u76D6\u4EFB\u52A1", String(preview.summary.overwriteCount)],
        ["\u5B8C\u6210\u4ECA\u65E5", String(preview.summary.completeTodayCount)],
        ["\u63D0\u524D\u7ED3\u675F", String(preview.summary.completeSeriesCount)],
        ["\u7EC4\u5408\u4EFB\u52A1", String(preview.summary.composite)],
        ["\u5DF2\u52FE\u9009\u5B8C\u6210", String(preview.summary.completed)]
      ].forEach(([label, value]) => {
        const card = summaryGrid.createDiv({ cls: "pm-import-summary-card" });
        card.createDiv({ cls: "pm-muted", text: label });
        card.createEl("strong", { text: value });
      });
      if (preview.summary.newProjectNames.length > 0) {
        previewEl.createDiv({
          cls: "pm-import-project-hint",
          text: `\u5C06\u81EA\u52A8\u65B0\u5EFA\u9879\u76EE\uFF1A${preview.summary.newProjectNames.join("\u3001")}`
        });
      }
      if (preview.tasks.length > 0) {
        const list = previewEl.createEl("ul", { cls: "pm-import-preview-list" });
        preview.tasks.slice(0, 12).forEach((task) => {
          const line = [
            importActionText(task.action),
            task.projectName ?? "\u672A\u5F52\u5C5E\u9879\u76EE",
            task.input.completed ? "\u5DF2\u52FE\u9009\u5B8C\u6210" : task.input.status === "doing" ? "\u8FDB\u884C\u4E2D" : task.input.status === "blocked" ? "\u963B\u585E" : "\u5F85\u529E",
            task.input.date,
            task.input.startTime && task.input.endTime ? `${task.input.startTime}-${task.input.endTime}` : "\u672A\u6392\u671F"
          ].join(" \xB7 ");
          list.createEl("li", { text: `${task.input.title} \xB7 ${line}` });
        });
      }
      if (preview.issues.length > 0) {
        const issueList = previewEl.createEl("ul", { cls: "pm-import-issues" });
        preview.issues.slice(0, 8).forEach((issue) => {
          issueList.createEl("li", { text: `\u7B2C ${issue.line} \u884C\uFF1A${issue.message}` });
        });
      }
    };
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian7.ButtonComponent(footer).setButtonText("\u5BFC\u5165").setCta().onClick(async () => {
      try {
        const created = await this.options.store.importFormattedTasks(state.text, {
          projectId: this.options.projectId,
          defaultDate: state.defaultDate
        });
        new import_obsidian7.Notice(`\u5DF2\u5904\u7406 ${created.length} \u6761\u4EFB\u52A1`);
        this.close();
      } catch (error) {
        new import_obsidian7.Notice(error instanceof Error ? error.message : "\u5BFC\u5165\u5931\u8D25");
      }
    });
    new import_obsidian7.ButtonComponent(footer).setButtonText("\u53D6\u6D88").onClick(() => this.close());
    renderPreview();
  }
};
function importActionText(action) {
  if (action === "overwrite-and-complete-series") {
    return "\u8986\u76D6\u5E76\u63D0\u524D\u7ED3\u675F";
  }
  if (action === "overwrite-and-complete-today") {
    return "\u8986\u76D6\u5E76\u5B8C\u6210\u4ECA\u65E5";
  }
  if (action === "overwrite") {
    return "\u8986\u76D6";
  }
  return "\u65B0\u589E";
}

// src/components/projectModal.ts
var import_obsidian8 = require("obsidian");
var ProjectModal = class extends import_obsidian8.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal");
    contentEl.createEl("h2", { text: this.options.title });
    const state = { ...this.options.initial };
    new import_obsidian8.Setting(contentEl).setName("\u9879\u76EE\u540D\u79F0").addText(
      (text) => text.setValue(state.name ?? "").onChange((value) => {
        state.name = value;
      })
    );
    new import_obsidian8.Setting(contentEl).setName("\u9879\u76EE\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    new import_obsidian8.Setting(contentEl).setName("\u9879\u76EE\u989C\u8272").addText(
      (text) => text.setPlaceholder("#4f8cff").setValue(state.color ?? "").onChange((value) => {
        state.color = value;
      })
    );
    new import_obsidian8.Setting(contentEl).setName("\u9879\u76EE\u72B6\u6001").addDropdown((dropdown) => {
      const statuses = ["active", "paused", "completed", "archived"];
      statuses.forEach((status) => dropdown.addOption(status, status));
      dropdown.setValue(state.status ?? "active");
      dropdown.onChange((value) => {
        state.status = value;
      });
    });
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian8.ButtonComponent(footer).setButtonText("\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(state);
        this.close();
      } catch (error) {
        new import_obsidian8.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    if (this.options.onDelete) {
      new import_obsidian8.ButtonComponent(footer).setButtonText("\u5220\u9664\u9879\u76EE").setWarning().onClick(async () => {
        await this.options.onDelete?.();
        this.close();
      });
    }
  }
};

// src/components/taskModal.ts
var import_obsidian9 = require("obsidian");
var TaskModal = class extends import_obsidian9.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal");
    contentEl.createEl("h2", { text: this.options.title });
    const state = { ...this.options.initial };
    state.kind = state.kind ?? "simple";
    state.subtasks = [...state.subtasks ?? []];
    if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      contentEl.createDiv({
        cls: "pm-muted",
        text: this.options.occurrenceContext ? `\u5F53\u524D\u6B63\u5728\u67E5\u770B ${this.options.occurrenceContext.occurrenceDate} \u8FD9\u6B21\u53D1\u751F\uFF0C\u4F46\u4FDD\u5B58\u4F1A\u66F4\u65B0\u6574\u6761\u91CD\u590D\u4EFB\u52A1\u3002` : "\u5F53\u524D\u7F16\u8F91\u7684\u662F\u6574\u6761\u91CD\u590D\u4EFB\u52A1\uFF0C\u4E0B\u9762\u7684\u65E5\u671F\u4E0E\u91CD\u590D\u89C4\u5219\u4F1A\u4E00\u8D77\u66F4\u65B0\u5168\u90E8\u53D1\u751F\u65F6\u95F4\u3002"
      });
    }
    new import_obsidian9.Setting(contentEl).setName("\u6807\u9898").addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u4EFB\u52A1\u6807\u9898").setValue(state.title).onChange((value) => {
        state.title = value;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u4EFB\u52A1\u7C7B\u578B").setDesc("\u666E\u901A\u4EFB\u52A1\u76F4\u63A5\u52FE\u9009\u5B8C\u6210\uFF1B\u7EC4\u5408\u4EFB\u52A1\u53EF\u62C6\u6210\u591A\u4E2A\u5B50\u4EFB\u52A1\u5206\u522B\u5B8C\u6210").addDropdown((dropdown) => {
      const labels = {
        simple: "\u666E\u901A\u4EFB\u52A1",
        composite: "\u7EC4\u5408\u4EFB\u52A1"
      };
      Object.keys(labels).forEach((key) => dropdown.addOption(key, labels[key]));
      dropdown.setValue(state.kind ?? "simple");
      dropdown.onChange((value) => {
        state.kind = value;
        state.subtasks = state.kind === "composite" ? state.subtasks ?? [{ title: "" }] : [];
        renderSubtaskFields();
      });
    });
    new import_obsidian9.Setting(contentEl).setName("\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u65E5\u671F").addText(
      (text) => text.setPlaceholder("YYYY-MM-DD").setValue(state.date).onChange((value) => {
        state.date = value;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u5F00\u59CB\u65F6\u95F4").addText(
      (text) => text.setPlaceholder("07:00").setValue(state.startTime ?? "").onChange((value) => {
        state.startTime = value || void 0;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u7ED3\u675F\u65F6\u95F4").addText(
      (text) => text.setPlaceholder("07:30").setValue(state.endTime ?? "").onChange((value) => {
        state.endTime = value || void 0;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u6240\u5C5E\u9879\u76EE").addDropdown((dropdown) => {
      dropdown.addOption("", "\u672A\u5F52\u5C5E\u9879\u76EE");
      this.options.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.setValue(state.projectId ?? "");
      dropdown.onChange((value) => {
        state.projectId = value || void 0;
      });
    });
    new import_obsidian9.Setting(contentEl).setName("\u72B6\u6001").addDropdown((dropdown) => {
      const labels = {
        todo: "\u5F85\u529E",
        doing: "\u8FDB\u884C\u4E2D",
        blocked: "\u963B\u585E",
        done: "\u5DF2\u5B8C\u6210"
      };
      Object.keys(labels).forEach((key) => dropdown.addOption(key, labels[key]));
      dropdown.setValue(state.status ?? "todo");
      dropdown.onChange((value) => {
        state.status = value;
      });
    });
    new import_obsidian9.Setting(contentEl).setName("\u4F18\u5148\u7EA7").addDropdown((dropdown) => {
      dropdown.addOption("", "\u65E0");
      const labels = {
        low: "\u4F4E",
        medium: "\u4E2D",
        high: "\u9AD8",
        urgent: "\u7D27\u6025"
      };
      Object.keys(labels).forEach((key) => dropdown.addOption(key, labels[key]));
      dropdown.setValue(state.priority ?? "");
      dropdown.onChange((value) => {
        state.priority = value || void 0;
      });
    });
    new import_obsidian9.Setting(contentEl).setName("\u6807\u7B7E").setDesc("\u591A\u4E2A\u6807\u7B7E\u7528\u9017\u53F7\u5206\u9694").addText(
      (text) => text.setPlaceholder("\u4F8B\u5982 parser, ui").setValue((state.tags ?? []).join(", ")).onChange((value) => {
        state.tags = value.split(",").map((item) => item.trim()).filter(Boolean);
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u91CD\u590D\u7C7B\u578B").setDesc("\u5355\u6B21\u3001\u6BCF\u65E5\u91CD\u590D\u3001\u6BCF\u5468\u6B64\u65F6\u91CD\u590D").addDropdown((dropdown) => {
      const labels = [
        ["once", "\u5355\u6B21\u4EFB\u52A1"],
        ["daily", "\u6BCF\u65E5\u91CD\u590D"],
        ["weekly", "\u6BCF\u5468\u6B64\u65F6\u91CD\u590D"]
      ];
      labels.forEach(([key, label]) => dropdown.addOption(key, label));
      dropdown.setValue(state.recurrence);
      dropdown.onChange((value) => {
        state.recurrence = value;
        if (state.recurrence === "once") {
          state.recurrenceCount = null;
          state.recurrenceUntil = null;
        }
        renderRecurrenceFields();
      });
    });
    const recurrenceFields = contentEl.createDiv();
    const subtaskFields = contentEl.createDiv();
    const renderRecurrenceFields = () => {
      recurrenceFields.empty();
      if (state.recurrence === "once") {
        return;
      }
      new import_obsidian9.Setting(recurrenceFields).setName("\u91CD\u590D\u6B21\u6570").setDesc("\u91CD\u590D\u4EFB\u52A1\u81F3\u5C11\u586B\u5199\u6B21\u6570\u6216\u7ED3\u675F\u65E5\u671F\u4E4B\u4E00").addText(
        (text) => text.setPlaceholder("\u4F8B\u5982 10").setValue(state.recurrenceCount ? String(state.recurrenceCount) : "").onChange((value) => {
          state.recurrenceCount = value.trim() ? Number(value) : null;
        })
      );
      new import_obsidian9.Setting(recurrenceFields).setName("\u91CD\u590D\u7ED3\u675F\u65E5\u671F").addText(
        (text) => text.setPlaceholder("YYYY-MM-DD").setValue(state.recurrenceUntil ?? "").onChange((value) => {
          state.recurrenceUntil = value.trim() || null;
        })
      );
    };
    renderRecurrenceFields();
    const renderSubtaskFields = () => {
      subtaskFields.empty();
      if (state.kind !== "composite") {
        return;
      }
      subtaskFields.addClass("pm-subtask-editor");
      subtaskFields.createDiv({ cls: "pm-muted", text: "\u7EC4\u5408\u4EFB\u52A1\u4F1A\u5728\u5468\u4EFB\u52A1\u56FE\u548C\u4ECA\u65E5\u4EFB\u52A1\u4E2D\u6E32\u67D3\u4E3A\u4E00\u4E2A\u5927\u6846\uFF0C\u5185\u90E8\u5B50\u4EFB\u52A1\u53EF\u5355\u72EC\u52FE\u9009\u5B8C\u6210\u3002" });
      const list = subtaskFields.createDiv({ cls: "pm-subtask-editor-list" });
      const subtasks = state.subtasks ?? [];
      subtasks.forEach((subtask, index) => {
        const row = list.createDiv({ cls: "pm-subtask-editor-row" });
        row.createSpan({ cls: "pm-subtask-editor-index", text: `${index + 1}.` });
        const input = row.createEl("input", {
          type: "text",
          placeholder: `\u5B50\u4EFB\u52A1 ${index + 1}`
        });
        input.value = subtask.title;
        input.addEventListener("input", () => {
          subtasks[index] = {
            ...subtasks[index],
            title: input.value
          };
          state.subtasks = [...subtasks];
        });
        row.createEl("button", { text: "\u5220\u9664", cls: "mod-warning" }).addEventListener("click", () => {
          subtasks.splice(index, 1);
          state.subtasks = [...subtasks];
          renderSubtaskFields();
        });
      });
      const actions = subtaskFields.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "\u65B0\u589E\u5B50\u4EFB\u52A1" }).addEventListener("click", () => {
        state.subtasks = [...state.subtasks ?? [], { title: "" }];
        renderSubtaskFields();
      });
    };
    renderSubtaskFields();
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian9.ButtonComponent(footer).setButtonText(this.options.occurrenceContext ? "\u4FDD\u5B58\u6574\u6761\u7CFB\u5217" : "\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(state, "series");
        this.close();
      } catch (error) {
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    if (this.options.occurrenceContext && this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      new import_obsidian9.ButtonComponent(footer).setButtonText("\u4EC5\u4FDD\u5B58\u672C\u6B21\u65F6\u95F4").onClick(async () => {
        try {
          await this.options.onSubmit(state, "occurrence");
          this.close();
        } catch (error) {
          new import_obsidian9.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
        }
      });
    }
    if (this.options.onDelete) {
      if (this.options.allowSingleDelete) {
        new import_obsidian9.ButtonComponent(footer).setButtonText("\u5220\u9664\u672C\u6B21\u5B9E\u4F8B").setWarning().onClick(async () => {
          await this.options.onDelete?.("single");
          this.close();
        });
      }
      if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
        new import_obsidian9.ButtonComponent(footer).setButtonText("\u5220\u9664\u6574\u4E2A\u7CFB\u5217").setWarning().onClick(async () => {
          await this.options.onDelete?.("series");
          this.close();
        });
      }
    }
    if (this.options.onCompleteSeries && this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      new import_obsidian9.ButtonComponent(footer).setButtonText("\u5230\u672C\u6B21\u4E3A\u6B62\u7ED3\u675F\u91CD\u590D").onClick(async () => {
        await this.options.onCompleteSeries?.();
        this.close();
      });
    }
  }
};

// src/components/textEntryModal.ts
var import_obsidian10 = require("obsidian");
var TextEntryModal = class extends import_obsidian10.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal");
    contentEl.createEl("h2", { text: this.options.title });
    if (this.options.description) {
      contentEl.createDiv({ cls: "pm-muted", text: this.options.description });
    }
    const textarea = contentEl.createEl("textarea", {
      cls: "pm-text-entry",
      placeholder: this.options.placeholder ?? ""
    });
    textarea.value = this.options.initialValue ?? "";
    textarea.focus();
    textarea.select();
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian10.ButtonComponent(footer).setButtonText(this.options.confirmText ?? "\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(textarea.value);
        this.close();
      } catch (error) {
        new import_obsidian10.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    new import_obsidian10.ButtonComponent(footer).setButtonText("\u53D6\u6D88").onClick(() => this.close());
  }
};

// src/views/overviewView.ts
var OVERVIEW_VIEW_TYPE = "project-management-overview-view";
var OverviewView = class extends BaseProjectView {
  constructor(leaf, plugin) {
    super(leaf, plugin);
    this.activePrimaryTab = "activity";
    this.activeProjectView = "table";
    this.selectedProjectId = null;
    this.weekAnchor = now();
    this.projectTablePage = 1;
    this.projectTablePageSize = 8;
    this.selectedMindmapNodeId = null;
    this.mindmapMinZoom = MINDMAP_MIN_ZOOM;
    this.mindmapMaxZoom = MINDMAP_MAX_ZOOM;
    this.mindmapZoomStep = MINDMAP_ZOOM_STEP;
    this.mindmapZoom = 1;
    this.mindmapPan = { x: 0, y: 0 };
    this.mindmapViewport = null;
    this.mindmapContent = null;
    this.mindmapZoomLabel = null;
    this.mindmapResizeObserver = null;
    this.mindmapFitTimer = null;
    this.mindmapNodes = [];
    this.mindmapProjectId = null;
    this.mindmapLayoutSignature = "";
    this.mindmapNeedsAutoFit = true;
    this.mindmapViewportWidth = 0;
    this.mindmapViewportHeight = 0;
    this.ganttScale = null;
    this.ganttZoom = 0.75;
    this.ganttProjectId = null;
    this.ganttDataSignature = "";
    this.ganttScrollLeft = 0;
    this.ganttPendingAnchor = null;
    this.ganttPendingFocus = null;
  }
  getViewType() {
    return OVERVIEW_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u4EFB\u52A1\u603B\u89C8";
  }
  getIcon() {
    return "layout-dashboard";
  }
  async onClose() {
    this.destroyMindmapViewport();
  }
  async render() {
    this.destroyMindmapViewport();
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("pm-view", "pm-overview-view");
    const snapshot = this.plugin.store.getSnapshot();
    if (!this.selectedProjectId && snapshot.progressPages.length > 0) {
      this.selectedProjectId = snapshot.progressPages[0].projectId;
    }
    if (this.selectedProjectId && !snapshot.projects.some((project) => project.id === this.selectedProjectId)) {
      this.selectedProjectId = snapshot.progressPages[0]?.projectId ?? null;
    }
    const hero = container.createDiv({ cls: "pm-overview-hero" });
    const titleBlock = hero.createDiv();
    titleBlock.createEl("h1", { text: "\u4EFB\u52A1\u603B\u89C8" });
    titleBlock.createDiv({ cls: "pm-muted", text: "\u70ED\u5EA6\u56FE\u3001\u5468\u4EFB\u52A1\u56FE\u548C\u8FD1 30 \u5929\u8D8B\u52BF\u7EDF\u4E00\u6309\u4EFB\u52A1\u53D1\u751F\u5B9E\u4F8B\u7EDF\u8BA1\u3002" });
    const heroActions = hero.createDiv({ cls: "pm-tab-bar" });
    this.createPrimaryTab(heroActions, this.plugin.settings.overviewTab1Name, "activity");
    this.createPrimaryTab(heroActions, this.plugin.settings.overviewTab2Name, "projects");
    if (this.activePrimaryTab === "activity") {
      this.renderActivityTab(container, snapshot.occurrences, snapshot.projects);
    } else {
      this.renderProjectsTab(container, snapshot.progressPages, snapshot.projects, snapshot.tasks);
    }
  }
  createPrimaryTab(container, label, key) {
    const button = container.createEl("button", { text: label, cls: this.activePrimaryTab === key ? "is-active" : "" });
    button.addEventListener("click", () => {
      this.activePrimaryTab = key;
      this.render();
    });
  }
  renderActivityTab(container, tasks, projects) {
    const summary = container.createDiv({ cls: "pm-summary-strip" });
    const today = toDateKey(now());
    const weekStart = toDateKey(startOfWeek(this.weekAnchor));
    const weekEnd = toDateKey(addDays(startOfWeek(this.weekAnchor), 6));
    const thisWeekTasks = tasks.filter((task) => compareDateKeys(task.date, weekStart) >= 0 && compareDateKeys(task.date, weekEnd) <= 0);
    const completedToday = tasks.filter((task) => task.completedAt?.slice(0, 10) === today).length;
    const incompleteToday = tasks.filter((task) => task.date === today && !task.completed).length;
    [
      { label: "\u4ECA\u65E5\u5F85\u529E", value: String(incompleteToday) },
      { label: "\u4ECA\u65E5\u5B8C\u6210", value: String(completedToday) },
      { label: "\u672C\u5468\u4EFB\u52A1", value: String(thisWeekTasks.length) },
      { label: "\u9879\u76EE\u6570", value: String(projects.length) }
    ].forEach((item) => {
      const card = summary.createDiv({ cls: "pm-summary-card" });
      card.createDiv({ cls: "pm-muted", text: item.label });
      card.createEl("strong", { text: item.value });
    });
    const heatmapSection = container.createDiv({ cls: "pm-section" });
    const heatmapHeader = heatmapSection.createDiv({ cls: "pm-page-header" });
    heatmapHeader.createEl("h3", { text: "\u70ED\u5EA6\u56FE" });
    heatmapHeader.createDiv({ cls: "pm-muted", text: "\u6700\u8FD1 12 \u4E2A\u6708\u5B8C\u6210\u4EFB\u52A1\u5206\u5E03" });
    this.renderHeatmap(heatmapSection, tasks);
    const weekSection = container.createDiv({ cls: "pm-section" });
    const top = weekSection.createDiv({ cls: "pm-week-header" });
    const left = top.createDiv();
    const weekDates = getWeekDates(this.weekAnchor);
    left.createEl("h3", { text: "\u5468\u4EFB\u52A1\u56FE" });
    left.createDiv({ cls: "pm-muted", text: `${toDateKey(weekDates[0])} \u81F3 ${toDateKey(weekDates[6])}` });
    const controls = top.createDiv({ cls: "pm-week-controls" });
    controls.createEl("button", { text: "\u4E0A\u4E00\u5468" }).addEventListener("click", () => {
      this.weekAnchor = addDays(this.weekAnchor, -7);
      this.render();
    });
    controls.createEl("button", { text: "\u672C\u5468" }).addEventListener("click", () => {
      this.weekAnchor = now();
      this.render();
    });
    controls.createEl("button", { text: "\u4E0B\u4E00\u5468" }).addEventListener("click", () => {
      this.weekAnchor = addDays(this.weekAnchor, 7);
      this.render();
    });
    this.renderWeekBoard(weekSection, tasks, projects);
    const trendSection = container.createDiv({ cls: "pm-section" });
    const trendHeader = trendSection.createDiv({ cls: "pm-page-header" });
    trendHeader.createEl("h3", { text: "\u6700\u8FD1 30 \u5929\u4EFB\u52A1\u8D8B\u52BF" });
    trendHeader.createDiv({ cls: "pm-muted", text: "\u6298\u7EBF\u56FE\u540C\u65F6\u5C55\u793A\u6BCF\u65E5\u4EFB\u52A1\u603B\u91CF\u548C\u6BCF\u65E5\u5B8C\u6210\u6570\u91CF" });
    this.renderMonthlyTrend(trendSection, tasks);
  }
  renderHeatmap(container, tasks) {
    const allDays = getLastTwelveMonthsDays();
    const counts = /* @__PURE__ */ new Map();
    tasks.forEach((task) => {
      if (!task.completed || !task.completedAt) {
        return;
      }
      const key = task.completedAt.slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const weeks = buildHeatmapWeeks(allDays);
    const months = buildMonthLabels(weeks);
    const heatmap = container.createDiv({ cls: "pm-heatmap-shell" });
    const monthsRow = heatmap.createDiv({ cls: "pm-heatmap-months" });
    monthsRow.style.gridTemplateColumns = `repeat(${weeks.length}, 14px)`;
    months.forEach((month) => {
      const label = monthsRow.createDiv({ cls: "pm-heatmap-month-label" });
      label.style.gridColumn = `${month.column} / span ${month.span}`;
      label.setText(month.label);
    });
    const body = heatmap.createDiv({ cls: "pm-heatmap-body" });
    const weekdayColumn = body.createDiv({ cls: "pm-heatmap-weekdays" });
    ["\u5468\u4E00", "\u5468\u4E09", "\u5468\u4E94"].forEach((label) => weekdayColumn.createDiv({ text: label }));
    const grid = body.createDiv({ cls: "pm-heatmap-grid" });
    grid.style.gridTemplateColumns = `repeat(${weeks.length}, 14px)`;
    weeks.forEach((week) => {
      week.forEach((date) => {
        const key = toDateKey(date);
        const count = counts.get(key) ?? 0;
        const cell = grid.createDiv({ cls: `pm-heatmap-cell level-${heatLevel(count)}` });
        cell.setAttribute("aria-label", `${key}: ${count} \u4E2A\u5B8C\u6210\u4EFB\u52A1`);
        cell.title = `${key}: ${count} \u4E2A\u5B8C\u6210\u4EFB\u52A1`;
        cell.addEventListener("click", () => {
          const dayTasks = tasks.filter((task) => task.completedAt?.slice(0, 10) === key || task.date === key);
          new DayTasksModal(this.app, {
            date: key,
            tasks: dayTasks,
            getProject: (projectId) => this.plugin.store.getProject(projectId)
          }).open();
        });
      });
    });
  }
  renderMonthlyTrend(container, tasks) {
    const days = Array.from({ length: 30 }, (_, index) => addDays(now(), -(29 - index)));
    const dailyTotals = days.map((date) => {
      const key = toDateKey(date);
      return {
        key,
        total: tasks.filter((task) => task.date === key).length,
        completed: tasks.filter((task) => task.completedAt?.slice(0, 10) === key).length
      };
    });
    const max = Math.max(1, ...dailyTotals.map((item) => Math.max(item.total, item.completed)));
    const yAxisValues = buildYAxisValues(max);
    const legend = container.createDiv({ cls: "pm-line-chart-legend" });
    [
      { label: "\u4EFB\u52A1\u603B\u6570", cls: "pm-line-chart-total" },
      { label: "\u5DF2\u5B8C\u6210", cls: "pm-line-chart-completed" }
    ].forEach((item) => {
      const chip = legend.createDiv({ cls: `pm-line-chart-legend-item ${item.cls}` });
      chip.createSpan({ text: item.label });
    });
    const chartLayout = container.createDiv({ cls: "pm-line-chart-layout" });
    const axis = chartLayout.createDiv({ cls: "pm-line-chart-axis" });
    yAxisValues.forEach((value) => axis.createDiv({ text: String(value) }));
    const chart = chartLayout.createDiv({ cls: "pm-line-chart" });
    const svg = chart.createSvg("svg", {
      attr: {
        viewBox: "0 0 900 240",
        preserveAspectRatio: "none",
        "aria-label": "\u6700\u8FD1 30 \u5929\u4EFB\u52A1\u8D8B\u52BF\u56FE"
      }
    });
    yAxisValues.forEach((value) => {
      const y = valueToChartY(value, max);
      svg.createSvg("line", {
        attr: {
          x1: "20",
          y1: String(y),
          x2: "880",
          y2: String(y),
          class: "pm-line-chart-gridline"
        }
      });
    });
    svg.createSvg("polyline", { attr: { points: dailyTotals.map((item, index) => toChartPoint(index, item.total, max)).join(" "), class: "pm-line-chart-total" } });
    svg.createSvg("polyline", { attr: { points: dailyTotals.map((item, index) => toChartPoint(index, item.completed, max)).join(" "), class: "pm-line-chart-completed" } });
    dailyTotals.forEach((item, index) => {
      const totalPoint = toChartCoordinates(index, item.total, max);
      const completedPoint = toChartCoordinates(index, item.completed, max);
      const totalDot = svg.createSvg("circle", {
        attr: { cx: String(totalPoint.x), cy: String(totalPoint.y), r: "4", class: "pm-line-chart-point pm-line-chart-total" }
      });
      totalDot.createSvg("title").textContent = `${item.key}\uFF1A\u4EFB\u52A1 ${item.total}\uFF0C\u5B8C\u6210 ${item.completed}`;
      const completedDot = svg.createSvg("circle", {
        attr: { cx: String(completedPoint.x), cy: String(completedPoint.y), r: "4", class: "pm-line-chart-point pm-line-chart-completed" }
      });
      completedDot.createSvg("title").textContent = `${item.key}\uFF1A\u4EFB\u52A1 ${item.total}\uFF0C\u5B8C\u6210 ${item.completed}`;
    });
    const labels = container.createDiv({ cls: "pm-line-chart-labels" });
    dailyTotals.forEach((item, index) => {
      const label = labels.createDiv({ cls: "pm-line-chart-label" });
      if (index === 0 || index === dailyTotals.length - 1 || index % 7 === 0) {
        label.setText(item.key.slice(5));
      }
      label.title = `${item.key}\uFF1A\u4EFB\u52A1 ${item.total}\uFF0C\u5B8C\u6210 ${item.completed}`;
    });
  }
  renderWeekBoard(container, tasks, projects) {
    const weekDates = getWeekDates(this.weekAnchor);
    const board = container.createDiv({ cls: "pm-week-board" });
    weekDates.forEach((date) => {
      const key = toDateKey(date);
      const column = board.createDiv({
        cls: [
          "pm-week-day",
          isToday(key) ? "is-today" : "",
          isPastDateKey(key) ? "is-past" : "",
          isWeekend(date) ? "is-weekend" : ""
        ].filter(Boolean).join(" ")
      });
      const header = column.createDiv({ cls: "pm-week-day-header" });
      const title = header.createDiv({ cls: "pm-week-day-title" });
      title.createSpan({ text: getChineseWeekday(date), cls: "pm-week-day-weekday" });
      title.createSpan({ text: key, cls: "pm-week-day-date" });
      header.createEl("button", { text: "\u65B0\u589E", cls: "mod-cta pm-week-day-add" }).addEventListener("click", () => {
        this.openCreateTaskModal("\u65B0\u589E\u4EFB\u52A1", projects, {
          title: "",
          description: "",
          date: key,
          status: "todo",
          tags: [],
          recurrence: "once",
          completed: false,
          ...this.plugin.store.getSuggestedTaskWindow(key)
        });
      });
      const dayTasks = tasks.filter((task) => task.date === key).sort(compareWeekTasks);
      if (dayTasks.length === 0) {
        column.createDiv({ cls: "pm-empty pm-week-day-empty", text: "\u6682\u65E0\u4EFB\u52A1" });
        return;
      }
      const list = column.createDiv({ cls: "pm-week-day-list" });
      dayTasks.forEach((task) => this.renderWeekTaskCard(list, task));
    });
  }
  renderWeekTaskCard(container, task) {
    const project = this.plugin.store.getProject(task.projectId);
    const card = container.createDiv({ cls: `pm-week-task ${task.completed ? "is-complete" : ""} ${task.kind === "composite" ? "is-composite" : ""}` });
    if (project?.color) {
      card.style.borderLeftColor = project.color;
    }
    const top = card.createDiv({ cls: "pm-week-task-top" });
    if (task.kind === "simple") {
      const checkbox = top.createEl("input", { type: "checkbox" });
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", async () => {
        try {
          await this.plugin.store.updateTaskOccurrenceCompletion(task.taskId, task.date, checkbox.checked);
        } catch (error) {
          checkbox.checked = !checkbox.checked;
          new import_obsidian11.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
    }
    const titleLine = top.createDiv({ cls: "pm-week-task-title-line" });
    titleLine.createSpan({ text: task.title, cls: "pm-task-title" });
    titleLine.createSpan({ text: recurrenceLabel2(task.recurrence), cls: "pm-tag pm-week-recurrence-tag" });
    const editButton = top.createEl("button", { text: "\u270E", cls: "pm-week-task-edit" });
    editButton.setAttribute("aria-label", "\u7F16\u8F91\u4EFB\u52A1");
    editButton.title = "\u7F16\u8F91\u4EFB\u52A1";
    editButton.addEventListener("click", () => this.openEditOccurrenceModal(task));
    const meta = card.createDiv({ cls: "pm-task-meta" });
    meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F" });
    meta.createSpan({ text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
    if (task.recurrence !== "once") {
      meta.createSpan({ text: `\u7B2C ${task.occurrenceNumber} \u6B21` });
    }
    if (task.kind === "composite") {
      meta.createSpan({ text: `${task.completedSteps}/${task.totalSteps} \u5B50\u4EFB\u52A1` });
      this.renderCompositeSubtasks(card, task);
    }
  }
  renderCompositeSubtasks(container, task) {
    const grid = container.createDiv({ cls: "pm-subtask-grid" });
    task.subtasks.forEach((subtask) => {
      const item = grid.createEl("button", {
        text: subtask.title,
        cls: `pm-subtask-chip ${task.completedSubtaskIds.includes(subtask.id) ? "is-complete" : ""}`
      });
      item.addEventListener("click", async () => {
        const completed = !task.completedSubtaskIds.includes(subtask.id);
        try {
          await this.plugin.store.updateTaskOccurrenceSubtaskCompletion(task.taskId, task.date, subtask.id, completed);
        } catch (error) {
          new import_obsidian11.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
    });
  }
  renderProjectsTab(container, pages, projects, allTasks) {
    const header = container.createDiv({ cls: "pm-page-header" });
    const headerCopy = header.createDiv();
    headerCopy.createEl("h3", { text: "\u9879\u76EE\u8FDB\u5EA6" });
    headerCopy.createDiv({ cls: "pm-muted", text: "\u56F4\u7ED5\u5355\u4E2A\u9879\u76EE\u7EDF\u4E00\u67E5\u770B\u8868\u683C\u3001\u770B\u677F\u3001\u7518\u7279\u56FE\u4E0E\u601D\u7EF4\u5BFC\u56FE\u3002" });
    header.createEl("button", { text: "\u65B0\u589E\u9879\u76EE", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
      new ProjectModal(this.app, {
        title: "\u65B0\u589E\u9879\u76EE",
        initial: {
          name: "",
          description: "",
          color: "",
          status: "active"
        },
        onSubmit: async (input) => {
          const project2 = await this.plugin.store.createProject(input);
          this.selectedProjectId = project2.id;
          this.projectTablePage = 1;
          this.selectedMindmapNodeId = null;
        }
      }).open();
    });
    const tabs = container.createDiv({ cls: "pm-secondary-tabs pm-segmented-control" });
    pages.forEach((page) => {
      const button = tabs.createDiv({ cls: `pm-secondary-tab pm-segmented-item ${this.selectedProjectId === page.projectId ? "is-active" : ""}` });
      button.createSpan({ text: page.name });
      const actions = button.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "\u2191", cls: "pm-button pm-button-ghost pm-compact-button" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, -1);
      });
      actions.createEl("button", { text: "\u2193", cls: "pm-button pm-button-ghost pm-compact-button" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, 1);
      });
      actions.createEl("button", { text: "\u7F16\u8F91", cls: "pm-button pm-button-ghost pm-compact-button" }).addEventListener("click", (event) => {
        event.stopPropagation();
        const project2 = projects.find((item) => item.id === page.projectId);
        if (!project2) {
          return;
        }
        new ProjectModal(this.app, {
          title: "\u7F16\u8F91\u9879\u76EE",
          initial: project2,
          onSubmit: async (input) => {
            await this.plugin.store.updateProject(project2.id, input);
          },
          onDelete: async () => {
            await this.plugin.store.deleteProject(project2.id);
          }
        }).open();
      });
      button.addEventListener("click", () => {
        this.selectedProjectId = page.projectId;
        this.projectTablePage = 1;
        this.selectedMindmapNodeId = null;
        this.mindmapNeedsAutoFit = true;
        this.render();
      });
    });
    if (!this.selectedProjectId) {
      container.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u9879\u76EE\uFF0C\u8BF7\u5148\u521B\u5EFA\u9879\u76EE\u3002" });
      return;
    }
    const project = projects.find((item) => item.id === this.selectedProjectId);
    if (!project) {
      container.createDiv({ cls: "pm-empty", text: "\u9879\u76EE\u4E0D\u5B58\u5728\u3002" });
      return;
    }
    const tasks = allTasks.filter((task) => task.projectId === project.id).sort(compareSeriesTasks2);
    const occurrences = this.plugin.store.getOccurrencesForProject(project.id);
    const progress = this.plugin.store.getProjectProgress(project.id);
    const completedCount = occurrences.filter((task) => task.completed).length;
    const summaryCard = container.createDiv({ cls: "pm-project-summary-card" });
    const summaryLeft = summaryCard.createDiv({ cls: "pm-project-summary-main" });
    summaryLeft.createDiv({ cls: "pm-muted", text: "\u6574\u4F53\u8FDB\u5EA6" });
    summaryLeft.createEl("strong", { text: project.name });
    summaryLeft.createDiv({ cls: "pm-muted", text: project.description || "\u9879\u76EE\u7EA7\u4EFB\u52A1\u96C6\u4E2D\u7BA1\u7406\u89C6\u56FE\uFF0C\u53EF\u76F4\u63A5\u7EF4\u62A4\u91CD\u590D\u4EFB\u52A1\u7CFB\u5217\u3002" });
    summaryLeft.createDiv({ cls: "pm-progress-bar" }).createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${progress}%` }
    });
    summaryLeft.createDiv({ cls: "pm-muted", text: `\u5B8C\u6210\u7387 ${progress}%` });
    const summaryRight = summaryCard.createDiv({ cls: "pm-project-summary-metrics" });
    [
      { label: "\u9879\u76EE\u4EFB\u52A1", value: String(tasks.length) },
      { label: "\u603B\u6B21\u6570", value: String(occurrences.length) },
      { label: "\u5DF2\u5B8C\u6210", value: String(completedCount) },
      { label: "\u5B8C\u6210\u7387", value: `${progress}%` }
    ].forEach((item) => {
      const metric = summaryRight.createDiv({ cls: "pm-project-metric" });
      metric.createDiv({ cls: "pm-muted", text: item.label });
      metric.createEl("strong", { text: item.value });
    });
    const body = container.createDiv({ cls: "pm-section pm-project-shell" });
    const top = body.createDiv({ cls: "pm-page-header" });
    const title = top.createDiv();
    title.createEl("h3", { text: project.name });
    title.createDiv({ cls: "pm-muted", text: "\u4F18\u5148\u5904\u7406\u6B63\u786E\u6027\uFF0C\u518D\u7EDF\u4E00\u4F18\u5316\u89C6\u89C9\u4E0E\u4EA4\u4E92\u5C42\u7EA7\u3002" });
    const projectActions = top.createDiv({ cls: "pm-inline-actions" });
    projectActions.createEl("button", { text: "\u6279\u91CF\u5BFC\u5165", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      new BulkImportModal(this.app, {
        title: "\u6279\u91CF\u5BFC\u5165\u9879\u76EE\u4EFB\u52A1",
        store: this.plugin.store,
        projectId: project.id,
        defaultDate: toDateKey(now())
      }).open();
    });
    projectActions.createEl("button", { text: "\u4ECA\u65E5\u81EA\u52A8\u6392\u7A0B", cls: "pm-button pm-button-secondary" }).addEventListener("click", async () => {
      try {
        const result = await this.plugin.store.autoArrangeDate(toDateKey(now()));
        new import_obsidian11.Notice(result.moved.length > 0 ? `\u5DF2\u79FB\u52A8 ${result.moved.length} \u4E2A\u4EFB\u52A1` : "\u4ECA\u65E5\u4EFB\u52A1\u65E0\u9700\u8C03\u6574");
      } catch (error) {
        new import_obsidian11.Notice(error instanceof Error ? error.message : "\u81EA\u52A8\u6392\u7A0B\u5931\u8D25");
      }
    });
    projectActions.createEl("button", { text: "+ \u65B0\u589E\u4EFB\u52A1", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
      this.openCreateTaskModal("\u65B0\u589E\u9879\u76EE\u4EFB\u52A1", projects, {
        title: "",
        description: "",
        projectId: project.id,
        status: "todo",
        tags: [],
        date: toDateKey(now()),
        recurrence: "once",
        completed: false,
        ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
      });
    });
    const viewTabs = body.createDiv({ cls: "pm-view-switcher pm-segmented-control" });
    [
      ["table", "\u8868\u683C"],
      ["board", "\u770B\u677F"],
      ["gantt", "\u7518\u7279\u56FE"],
      ["mindmap", "\u601D\u7EF4\u5BFC\u56FE"]
    ].forEach(([key, label]) => {
      const button = viewTabs.createEl("button", {
        text: label,
        cls: `pm-segmented-item ${this.activeProjectView === key ? "is-active" : ""}`
      });
      button.addEventListener("click", () => {
        this.activeProjectView = key;
        this.projectTablePage = 1;
        this.mindmapNeedsAutoFit = key === "mindmap";
        this.render();
      });
    });
    if (tasks.length === 0) {
      body.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u4EFB\u52A1" });
      return;
    }
    if (this.activeProjectView === "table") {
      this.renderProjectTable(body, tasks);
    } else if (this.activeProjectView === "board") {
      this.renderProjectBoard(body, project, tasks);
    } else if (this.activeProjectView === "gantt") {
      this.renderProjectGantt(body, project, tasks);
    } else {
      this.renderProjectMindmap(body, project, tasks);
    }
  }
  renderProjectTable(container, tasks) {
    const totalPages = Math.max(1, Math.ceil(tasks.length / this.projectTablePageSize));
    this.projectTablePage = Math.min(this.projectTablePage, totalPages);
    const pageTasks = tasks.slice((this.projectTablePage - 1) * this.projectTablePageSize, this.projectTablePage * this.projectTablePageSize);
    const card = container.createDiv({ cls: "pm-table-card" });
    const table = card.createEl("table", { cls: "pm-table" });
    const head = table.createEl("thead");
    const headRow = head.createEl("tr");
    ["\u4EFB\u52A1\u540D\u79F0", "\u72B6\u6001", "\u4F18\u5148\u7EA7", "\u6807\u7B7E", "\u91CD\u590D", "\u8BA1\u5212", "\u5B8C\u6210", "\u63CF\u8FF0", "\u64CD\u4F5C"].forEach((label) => headRow.createEl("th", { text: label }));
    const bodyEl = table.createEl("tbody");
    pageTasks.forEach((task) => {
      const row = bodyEl.createEl("tr");
      const titleCell = row.createEl("td");
      titleCell.createEl("strong", { text: task.title });
      titleCell.createDiv({ cls: "pm-muted", text: `${task.date} \xB7 ${task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "\u672A\u6392\u671F"}` });
      const statusCell = row.createEl("td");
      appendBadge(statusCell, statusLabel(task.status), `status-${task.status}`);
      const priorityCell = row.createEl("td");
      appendBadge(priorityCell, priorityLabel(task.priority), priorityTone(task.priority));
      const tagsCell = row.createEl("td");
      if (task.tags.length > 0) {
        task.tags.forEach((tag) => appendBadge(tagsCell, `#${tag}`, "tag"));
      } else {
        tagsCell.createDiv({ cls: "pm-muted", text: "-" });
      }
      const recurrenceCell = row.createEl("td");
      appendBadge(recurrenceCell, recurrenceLabel2(task.recurrence), "repeat");
      const scheduleCell = row.createEl("td");
      scheduleCell.createDiv({ text: task.occurrenceDates.length > 1 ? `${task.occurrenceDates[0]} -> ${task.occurrenceDates[task.occurrenceDates.length - 1]}` : task.date });
      scheduleCell.createDiv({ cls: "pm-muted", text: task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "\u672A\u6392\u671F" });
      const completionCell = row.createEl("td");
      const progress = Math.round(seriesProgress(task) * 100);
      completionCell.createDiv({ text: completionSummary(task) });
      completionCell.createDiv({ cls: "pm-progress-bar pm-progress-bar-compact" }).createDiv({
        cls: "pm-progress-bar-fill",
        attr: { style: `width: ${progress}%` }
      });
      const descriptionCell = row.createEl("td");
      descriptionCell.createDiv({ cls: "pm-table-desc", text: task.description || "-" });
      const actionCell = row.createEl("td");
      const menuButton = actionCell.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "\u66F4\u591A\u64CD\u4F5C" } });
      (0, import_obsidian11.setIcon)(menuButton, "ellipsis");
      menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, task));
    });
    const footer = card.createDiv({ cls: "pm-table-footer" });
    footer.createDiv({ cls: "pm-muted", text: `\u5171 ${tasks.length} \u9879` });
    const pager = footer.createDiv({ cls: "pm-inline-actions" });
    const prev = pager.createEl("button", { text: "\u4E0A\u4E00\u9875", cls: "pm-button pm-button-secondary" });
    prev.disabled = this.projectTablePage <= 1;
    prev.addEventListener("click", () => {
      this.projectTablePage -= 1;
      this.render();
    });
    pager.createDiv({ cls: "pm-muted", text: `${this.projectTablePage} / ${totalPages}` });
    const next = pager.createEl("button", { text: "\u4E0B\u4E00\u9875", cls: "pm-button pm-button-secondary" });
    next.disabled = this.projectTablePage >= totalPages;
    next.addEventListener("click", () => {
      this.projectTablePage += 1;
      this.render();
    });
  }
  renderProjectBoard(container, project, tasks) {
    const board = container.createDiv({ cls: "pm-project-board" });
    const columns = [
      ["todo", "\u5F85\u529E"],
      ["doing", "\u8FDB\u884C\u4E2D"],
      ["blocked", "\u963B\u585E"],
      ["done", "\u5DF2\u5B8C\u6210"]
    ];
    columns.forEach(([status, label]) => {
      const items = tasks.filter((task) => (task.viewState.board.columnId ?? task.status) === status).sort((a, b) => a.viewState.board.order - b.viewState.board.order || compareSeriesTasks2(a, b));
      const column = board.createDiv({ cls: `pm-board-column pm-status-${status}` });
      column.dataset.status = status;
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        column.addClass("is-drop-target");
      });
      column.addEventListener("dragleave", () => column.removeClass("is-drop-target"));
      column.addEventListener("drop", async (event) => {
        event.preventDefault();
        column.removeClass("is-drop-target");
        const taskId = event.dataTransfer?.getData("text/plain");
        const task = tasks.find((item) => item.id === taskId);
        if (!task) {
          return;
        }
        await this.moveTaskToStatus(task, status);
      });
      const columnHeader = column.createDiv({ cls: "pm-board-column-header" });
      const title = columnHeader.createDiv();
      title.createEl("h4", { text: label });
      title.createDiv({ cls: "pm-muted", text: `${items.length} \u9879` });
      const addButton = columnHeader.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "\u65B0\u5EFA\u4EFB\u52A1" } });
      (0, import_obsidian11.setIcon)(addButton, "plus");
      addButton.addEventListener("click", () => {
        this.openCreateTaskModal("\u65B0\u589E\u9879\u76EE\u4EFB\u52A1", this.plugin.store.getProjects(), {
          title: "",
          description: "",
          projectId: project.id,
          status,
          tags: [],
          date: toDateKey(now()),
          recurrence: "once",
          completed: false,
          viewState: { board: { columnId: status, order: Date.now() } },
          ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
        });
      });
      const list = column.createDiv({ cls: "pm-board-list" });
      items.forEach((task) => {
        const card = list.createDiv({ cls: `pm-board-card is-${task.status}` });
        card.draggable = true;
        card.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData("text/plain", task.id);
          card.addClass("is-dragging");
        });
        card.addEventListener("dragend", () => {
          card.removeClass("is-dragging");
          board.querySelectorAll(".pm-board-column").forEach((item) => item.removeClass("is-drop-target"));
        });
        const top = card.createDiv({ cls: "pm-board-card-top" });
        top.createDiv({ cls: "pm-task-title", text: task.title });
        const menuButton = top.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "\u66F4\u591A\u64CD\u4F5C" } });
        (0, import_obsidian11.setIcon)(menuButton, "ellipsis");
        menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, task));
        const badges = card.createDiv({ cls: "pm-board-badges" });
        appendBadge(badges, priorityLabel(task.priority), priorityTone(task.priority));
        task.tags.slice(0, 3).forEach((tag) => appendBadge(badges, `#${tag}`, "tag"));
        if (status === "blocked") {
          appendBadge(badges, task.viewState.gantt.dependencyIds.length > 0 ? "\u4F9D\u8D56\u672A\u5B8C\u6210" : "\u7B49\u5F85\u5904\u7406", "status-blocked");
        }
        card.createDiv({ cls: "pm-board-schedule", text: task.occurrenceDates.length > 1 ? `${task.occurrenceDates[0].slice(5)} -> ${task.occurrenceDates[task.occurrenceDates.length - 1].slice(5)}` : task.date.slice(5) });
        card.createDiv({ cls: "pm-board-completion", text: completionSummary(task).replace(" \xB7 ", " | ") });
        const progress = Math.round(seriesProgress(task) * 100);
        card.createDiv({ cls: "pm-progress-bar pm-progress-bar-compact" }).createDiv({
          cls: "pm-progress-bar-fill",
          attr: { style: `width: ${progress}%` }
        });
      });
      column.createEl("button", { text: "+ \u65B0\u5EFA\u4EFB\u52A1", cls: "pm-button pm-button-ghost pm-board-add-button" }).addEventListener("click", () => {
        this.openCreateTaskModal("\u65B0\u589E\u9879\u76EE\u4EFB\u52A1", this.plugin.store.getProjects(), {
          title: "",
          description: "",
          projectId: project.id,
          status,
          tags: [],
          date: toDateKey(now()),
          recurrence: "once",
          completed: false,
          viewState: { board: { columnId: status, order: Date.now() } },
          ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
        });
      });
    });
    const overdueCount = tasks.filter((task) => !isTaskSeriesCompleted(task) && compareDateKeys(defaultCompletionDate(task), toDateKey(now())) < 0).length;
    const stats = container.createDiv({ cls: "pm-board-stats" });
    [
      { label: "\u603B\u4EFB\u52A1", value: String(tasks.length) },
      { label: "\u8FDB\u884C\u4E2D", value: String(tasks.filter((task) => task.status === "doing").length) },
      { label: "\u5DF2\u5B8C\u6210", value: String(tasks.filter((task) => isTaskSeriesCompleted(task)).length) },
      { label: "\u5B8C\u6210\u7387", value: `${Math.round(tasks.filter((task) => isTaskSeriesCompleted(task)).length / Math.max(1, tasks.length) * 100)}%` },
      { label: "\u903E\u671F", value: String(overdueCount) }
    ].forEach((item) => {
      const stat = stats.createDiv({ cls: "pm-board-stat" });
      stat.createDiv({ cls: "pm-muted", text: item.label });
      stat.createEl("strong", { text: item.value });
    });
  }
  renderProjectGantt(container, project, tasks) {
    const items = tasks.map((task) => ({
      task,
      startDate: task.occurrenceDates[0] ?? task.date,
      endDate: defaultCompletionDate(task),
      progress: Math.round(seriesProgress(task) * 100)
    })).sort(
      (a, b) => a.task.viewState.gantt.rowOrder - b.task.viewState.gantt.rowOrder || a.startDate.localeCompare(b.startDate) || compareSeriesTasks2(a.task, b.task)
    );
    const card = container.createDiv({ cls: "pm-gantt-card tm-gantt-card" });
    if (items.length === 0) {
      card.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u4EFB\u52A1" });
      return;
    }
    const dataSignature = buildGanttDataSignature(project.id, items);
    const viewportEstimate = Math.max(container.clientWidth - GANTT_LEFT_WIDTH - 84, 360);
    if (this.ganttProjectId !== project.id || this.ganttDataSignature !== dataSignature || !this.ganttScale) {
      const fit = fitGanttTimeline(items, viewportEstimate);
      this.ganttScale = fit.scale;
      this.ganttZoom = fit.zoom;
      this.ganttScrollLeft = 0;
      this.ganttPendingAnchor = null;
      this.ganttPendingFocus = "today";
      this.ganttProjectId = project.id;
      this.ganttDataSignature = dataSignature;
    }
    const scale = this.ganttScale ?? "week";
    const geometry = buildGanttGeometry(items, scale, this.ganttZoom);
    const header = card.createDiv({ cls: "pm-gantt-header tm-gantt-header" });
    const headerCopy = header.createDiv();
    headerCopy.createEl("h3", { text: "\u9879\u76EE\u65F6\u95F4\u8F74" });
    headerCopy.createDiv({ cls: "pm-muted", text: "\u6309\u4EFB\u52A1\u7CFB\u5217\u5C55\u793A\u9879\u76EE\u65F6\u95F4\u8F74\uFF0C\u957F\u5468\u671F\u4EFB\u52A1\u9ED8\u8BA4\u6309\u5468\u805A\u5408\u663E\u793A\u3002" });
    let viewportEl = null;
    let contentWidth = geometry.contentWidth;
    const toolbar = header.createDiv({ cls: "pm-gantt-toolbar tm-gantt-toolbar" });
    toolbar.createEl("button", { text: "\u4ECA\u5929", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      if (!viewportEl) {
        return;
      }
      scrollTimelineToDate(viewportEl, geometry, toDateKey(now()), 0.35);
      this.ganttScrollLeft = viewportEl.scrollLeft;
    });
    toolbar.createEl("button", { text: "-", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      if (viewportEl) {
        this.ganttPendingAnchor = captureTimelineAnchor(viewportEl, contentWidth, viewportEl.clientWidth / 2);
      }
      this.ganttZoom = clamp(roundTimelineZoom(this.ganttZoom - GANTT_ZOOM_STEP), GANTT_MIN_ZOOM, GANTT_MAX_ZOOM);
      this.render();
    });
    toolbar.createDiv({ cls: "pm-gantt-zoom-label", text: `${Math.round(this.ganttZoom * 100)}%` });
    toolbar.createEl("button", { text: "+", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      if (viewportEl) {
        this.ganttPendingAnchor = captureTimelineAnchor(viewportEl, contentWidth, viewportEl.clientWidth / 2);
      }
      this.ganttZoom = clamp(roundTimelineZoom(this.ganttZoom + GANTT_ZOOM_STEP), GANTT_MIN_ZOOM, GANTT_MAX_ZOOM);
      this.render();
    });
    const scaleSwitch = toolbar.createDiv({ cls: "pm-segmented-control" });
    ["day", "week", "month"].forEach((value) => {
      const button = scaleSwitch.createEl("button", {
        text: value === "day" ? "\u65E5" : value === "week" ? "\u5468" : "\u6708",
        cls: `pm-segmented-item ${scale === value ? "is-active" : ""}`
      });
      button.addEventListener("click", () => {
        if (scale === value) {
          return;
        }
        if (viewportEl) {
          this.ganttPendingAnchor = captureTimelineAnchor(viewportEl, contentWidth, viewportEl.clientWidth / 2);
        }
        this.ganttScale = value;
        this.render();
      });
    });
    toolbar.createEl("button", { text: "\u9002\u5E94", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      const fit = fitGanttTimeline(items, viewportEl?.clientWidth ?? viewportEstimate);
      this.ganttScale = fit.scale;
      this.ganttZoom = fit.zoom;
      this.ganttPendingAnchor = null;
      this.ganttPendingFocus = "today";
      this.render();
    });
    toolbar.createEl("button", { text: "\u91CD\u7F6E", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      const minDate = items.reduce((earliest, item) => compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest, items[0].startDate);
      const maxDate = items.reduce((latest, item) => compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest, items[0].endDate);
      const spanDays = diffDateKeys(minDate, maxDate) + 1;
      this.ganttScale = recommendedGanttScale(spanDays);
      this.ganttZoom = 0.75;
      this.ganttPendingAnchor = null;
      this.ganttPendingFocus = "start";
      this.render();
    });
    const body = card.createDiv({ cls: "pm-gantt-body tm-gantt-body" });
    body.style.setProperty("--pm-gantt-row-height", `${GANTT_ROW_HEIGHT}px`);
    body.style.setProperty("--pm-gantt-header-height", `${GANTT_HEADER_HEIGHT}px`);
    body.style.setProperty("--pm-gantt-left-width", `${GANTT_LEFT_WIDTH}px`);
    const left = body.createDiv({ cls: "pm-gantt-left tm-gantt-left" });
    const leftHeader = left.createDiv({ cls: "pm-gantt-left-header tm-gantt-left-header" });
    ["\u4EFB\u52A1", "\u72B6\u6001", "\u4F18\u5148\u7EA7", "\u8BA1\u5212"].forEach((label) => leftHeader.createDiv({ text: label }));
    viewportEl = body.createDiv({ cls: "pm-gantt-timeline-viewport tm-gantt-timeline-viewport" });
    const content = viewportEl.createDiv({ cls: "pm-gantt-timeline-content tm-gantt-timeline-content" });
    contentWidth = geometry.contentWidth;
    content.style.width = `${geometry.contentWidth}px`;
    const timeHeader = content.createDiv({ cls: "pm-gantt-time-header tm-gantt-time-header" });
    const majorRow = timeHeader.createDiv({ cls: "pm-gantt-time-major" });
    geometry.majorCells.forEach((cell) => {
      const majorCell = majorRow.createDiv({ cls: `pm-gantt-major-cell ${scale === "week" ? "tm-gantt-week-cell" : ""} ${cell.tone ? `is-${cell.tone}` : ""}` });
      majorCell.style.left = `${cell.left}px`;
      majorCell.style.width = `${cell.width}px`;
      majorCell.createSpan({ text: cell.label });
    });
    const minorRow = timeHeader.createDiv({ cls: "pm-gantt-time-minor" });
    geometry.minorCells.forEach((cell) => {
      const minorCell = minorRow.createDiv({
        cls: `pm-gantt-day-minor tm-gantt-day-minor ${cell.weekend ? "is-weekend" : ""} ${cell.isToday ? "is-today" : ""}`
      });
      minorCell.style.left = `${cell.left}px`;
      minorCell.style.width = `${cell.width}px`;
      minorCell.setText(cell.label);
    });
    const rows = content.createDiv({ cls: "pm-gantt-grid tm-gantt-grid" });
    items.forEach((item) => {
      const leftRow = left.createDiv({ cls: "pm-gantt-left-row tm-gantt-left-row" });
      const taskCell = leftRow.createDiv({ cls: "pm-gantt-task-cell" });
      const taskTop = taskCell.createDiv({ cls: "pm-gantt-task-top" });
      taskTop.createEl("strong", { text: item.task.title });
      const rowActions = taskTop.createDiv({ cls: "pm-inline-actions" });
      rowActions.createEl("button", {
        text: item.task.viewState.gantt.locked ? "\u89E3\u9501" : "\u9501\u5B9A",
        cls: "pm-button pm-button-ghost pm-compact-button"
      }).addEventListener("click", async () => {
        await this.plugin.store.patchTask(item.task.id, {
          viewState: { gantt: { ...item.task.viewState.gantt, locked: !item.task.viewState.gantt.locked } }
        });
      });
      rowActions.createEl("button", {
        text: item.task.viewState.gantt.milestone ? "\u53D6\u6D88\u91CC\u7A0B\u7891" : "\u8BBE\u4E3A\u91CC\u7A0B\u7891",
        cls: "pm-button pm-button-ghost pm-compact-button"
      }).addEventListener("click", async () => {
        await this.plugin.store.patchTask(item.task.id, {
          viewState: { gantt: { ...item.task.viewState.gantt, milestone: !item.task.viewState.gantt.milestone } }
        });
      });
      const menuButton = rowActions.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "\u66F4\u591A\u64CD\u4F5C" } });
      (0, import_obsidian11.setIcon)(menuButton, "ellipsis");
      menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, item.task));
      taskCell.createDiv({ cls: "pm-muted pm-gantt-task-desc", text: item.task.description?.trim() || completionSummary(item.task) });
      const statusCell = leftRow.createDiv({ cls: "pm-gantt-status-cell" });
      appendBadge(statusCell, statusLabel(item.task.status), `status-${item.task.status}`);
      if (item.task.viewState.gantt.locked) {
        appendBadge(statusCell, "\u5DF2\u9501\u5B9A", "status-blocked");
      }
      const priorityCell = leftRow.createDiv({ cls: "pm-gantt-priority-cell" });
      appendBadge(priorityCell, priorityLabel(item.task.priority), priorityTone(item.task.priority));
      if (item.task.viewState.gantt.milestone) {
        appendBadge(priorityCell, "\u91CC\u7A0B\u7891", "priority-medium");
      }
      const planCell = leftRow.createDiv({ cls: "pm-gantt-plan-cell" });
      planCell.createDiv({ text: item.startDate === item.endDate ? item.startDate : `${item.startDate} -> ${item.endDate}` });
      planCell.createDiv({ cls: "pm-muted", text: item.task.startTime && item.task.endTime ? `${item.task.startTime}-${item.task.endTime}` : "\u672A\u6392\u671F" });
      const row = rows.createDiv({ cls: "pm-gantt-bar-row tm-gantt-bar-row" });
      geometry.minorCells.forEach((cell) => {
        const gridCell = row.createDiv({
          cls: `pm-gantt-grid-row tm-gantt-grid-row ${cell.weekend ? "is-weekend" : ""} ${cell.isToday ? "is-today" : ""}`
        });
        gridCell.style.left = `${cell.left}px`;
        gridCell.style.width = `${cell.width}px`;
      });
      const barLeft = clamp(dateToTimelineX(item.startDate, geometry.rangeStart, scale, geometry.unitWidth), 0, geometry.contentWidth);
      const barRight = clamp(
        dateToTimelineX(toDateKey(addDays(parseDateKey(item.endDate), 1)), geometry.rangeStart, scale, geometry.unitWidth),
        0,
        geometry.contentWidth
      );
      const minBarWidth = item.startDate === item.endDate ? 64 : 24;
      const barWidth = clamp(Math.max(barRight - barLeft, minBarWidth), minBarWidth, geometry.contentWidth - barLeft);
      const bar = row.createDiv({
        cls: `pm-gantt-bar tm-gantt-bar pm-status-${item.task.status} ${item.task.viewState.gantt.locked ? "is-locked" : ""} ${barWidth < 96 ? "is-compact" : ""}`
      });
      bar.style.left = `${barLeft}px`;
      bar.style.width = `${barWidth}px`;
      bar.title = [item.task.title, `${item.startDate} -> ${item.endDate}`, `\u8FDB\u5EA6 ${item.progress}%`, `\u72B6\u6001 ${statusLabel(item.task.status)}`].join("\n");
      bar.addEventListener("click", () => this.openEditTaskModal(item.task));
      bar.createSpan({ text: item.task.viewState.gantt.milestone ? `\u25C6 ${item.progress}%` : `${item.progress}%` });
      if (item.task.viewState.gantt.dependencyIds.length > 0) {
        const dep = row.createDiv({ cls: "pm-gantt-dependency-note pm-muted", text: `\u4F9D\u8D56 ${item.task.viewState.gantt.dependencyIds.length} \u9879` });
        dep.style.left = `${Math.min(geometry.contentWidth - 92, barLeft + barWidth + 8)}px`;
      }
    });
    if (geometry.todayX !== null) {
      const todayLine = content.createDiv({ cls: "pm-gantt-today-line tm-gantt-today-line" });
      todayLine.style.left = `${geometry.todayX}px`;
      const todayBadge = todayLine.createDiv({ cls: "pm-gantt-today-badge" });
      todayBadge.setText("\u4ECA\u5929");
    }
    const minimap = card.createDiv({ cls: "pm-gantt-minimap tm-gantt-minimap" });
    const minimapTrack = minimap.createDiv({ cls: "pm-gantt-minimap-track" });
    items.forEach((item) => {
      const leftRatio = dateToTimelineX(item.startDate, geometry.rangeStart, scale, geometry.unitWidth) / Math.max(geometry.contentWidth, 1);
      const rightRatio = dateToTimelineX(toDateKey(addDays(parseDateKey(item.endDate), 1)), geometry.rangeStart, scale, geometry.unitWidth) / Math.max(geometry.contentWidth, 1);
      const miniBar = minimapTrack.createDiv({ cls: `pm-gantt-minimap-bar is-${item.task.status}` });
      miniBar.style.left = `${leftRatio * 100}%`;
      miniBar.style.width = `${Math.max((rightRatio - leftRatio) * 100, 1.4)}%`;
      miniBar.style.top = `${12 + items.indexOf(item) * 10}px`;
    });
    const minimapSelection = minimapTrack.createDiv({ cls: "pm-gantt-minimap-selection" });
    const updateMinimapSelection = () => {
      if (!viewportEl) {
        return;
      }
      const maxScroll = Math.max(geometry.contentWidth - viewportEl.clientWidth, 0);
      const widthRatio = viewportEl.clientWidth / Math.max(geometry.contentWidth, 1);
      const leftRatio = maxScroll === 0 ? 0 : viewportEl.scrollLeft / Math.max(geometry.contentWidth, 1);
      minimapSelection.style.width = `${Math.min(widthRatio * 100, 100)}%`;
      minimapSelection.style.left = `${leftRatio * 100}%`;
    };
    minimapTrack.addEventListener("click", (event) => {
      if (!viewportEl) {
        return;
      }
      const rect = minimapTrack.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / Math.max(rect.width, 1), 0, 1);
      const target = ratio * geometry.contentWidth - viewportEl.clientWidth / 2;
      viewportEl.scrollLeft = clamp(target, 0, Math.max(geometry.contentWidth - viewportEl.clientWidth, 0));
      this.ganttScrollLeft = viewportEl.scrollLeft;
      updateMinimapSelection();
    });
    const legend = card.createDiv({ cls: "pm-gantt-legend tm-gantt-legend" });
    [
      ["\u5DF2\u5B8C\u6210", "completed"],
      ["\u8FDB\u884C\u4E2D", "doing"],
      ["\u5F85\u529E", "todo"],
      ["\u963B\u585E", "blocked"]
    ].forEach(([label, tone]) => {
      const chip = legend.createDiv({ cls: `pm-gantt-legend-item is-${tone}` });
      chip.createSpan({ cls: "pm-gantt-legend-dot" });
      chip.createSpan({ text: label });
    });
    viewportEl.addEventListener("scroll", () => {
      this.ganttScrollLeft = viewportEl?.scrollLeft ?? 0;
      updateMinimapSelection();
    });
    viewportEl.addEventListener(
      "wheel",
      (event) => {
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          if (!viewportEl) {
            return;
          }
          const rect = viewportEl.getBoundingClientRect();
          const offset = event.clientX - rect.left;
          this.ganttPendingAnchor = captureTimelineAnchor(viewportEl, contentWidth, offset);
          const nextZoom = clamp(
            roundTimelineZoom(this.ganttZoom + (event.deltaY < 0 ? GANTT_ZOOM_STEP : -GANTT_ZOOM_STEP)),
            GANTT_MIN_ZOOM,
            GANTT_MAX_ZOOM
          );
          if (nextZoom !== this.ganttZoom) {
            this.ganttZoom = nextZoom;
            this.render();
          }
          return;
        }
        if (event.shiftKey && viewportEl) {
          event.preventDefault();
          viewportEl.scrollLeft += event.deltaY + event.deltaX;
          this.ganttScrollLeft = viewportEl.scrollLeft;
          updateMinimapSelection();
        }
      },
      { passive: false }
    );
    window.requestAnimationFrame(() => {
      if (!viewportEl) {
        return;
      }
      const maxScroll = Math.max(geometry.contentWidth - viewportEl.clientWidth, 0);
      if (this.ganttPendingAnchor) {
        viewportEl.scrollLeft = clamp(this.ganttPendingAnchor.ratio * geometry.contentWidth - this.ganttPendingAnchor.offset, 0, maxScroll);
      } else if (this.ganttPendingFocus === "today") {
        scrollTimelineToDate(viewportEl, geometry, toDateKey(now()), 0.35);
      } else if (this.ganttPendingFocus === "start") {
        viewportEl.scrollLeft = 0;
      } else {
        viewportEl.scrollLeft = clamp(this.ganttScrollLeft, 0, maxScroll);
      }
      this.ganttScrollLeft = viewportEl.scrollLeft;
      this.ganttPendingAnchor = null;
      this.ganttPendingFocus = null;
      updateMinimapSelection();
    });
  }
  renderProjectMindmap(container, project, tasks) {
    const shell = container.createDiv({ cls: "pm-mindmap-layout pm-mindmap-main tm-mindmap-main" });
    const nodes = this.buildMindmapNodes(project, tasks);
    const layoutSignature = buildMindmapLayoutSignature(nodes);
    if (this.mindmapProjectId !== project.id || this.mindmapLayoutSignature !== layoutSignature) {
      this.mindmapNeedsAutoFit = true;
    }
    this.mindmapProjectId = project.id;
    this.mindmapLayoutSignature = layoutSignature;
    this.mindmapNodes = nodes;
    const selectedNode = nodes.find((node) => node.id === this.selectedMindmapNodeId) ?? nodes[0];
    this.selectedMindmapNodeId = selectedNode?.id ?? null;
    const canvasCard = shell.createDiv({ cls: "pm-mindmap-canvas-card" });
    const toolbar = canvasCard.createDiv({ cls: "pm-mindmap-toolbar tm-mindmap-toolbar" });
    const toolbarCopy = toolbar.createDiv();
    toolbarCopy.createDiv({ cls: "pm-muted", text: "\u70B9\u51FB\u8282\u70B9\u540E\u53EF\u5728\u53F3\u4FA7\u771F\u5B9E\u7F16\u8F91\u8BC4\u8BED\u3001\u4EFB\u52A1\u7C7B\u578B\u4E0E\u5173\u7CFB\u3002" });
    toolbarCopy.createDiv({ cls: "pm-muted", text: "\u753B\u5E03\u652F\u6301\u7F29\u653E\u3001\u62D6\u62FD\u5E73\u79FB\u4E0E\u81EA\u9002\u5E94\u89C6\u53E3\uFF1B\u8282\u70B9\u62D6\u62FD\u4ECD\u4F1A\u4FDD\u5B58\u4F4D\u7F6E\u3002" });
    const toolbarActions = toolbar.createDiv({ cls: "pm-inline-actions" });
    toolbarActions.createEl("button", { text: "\u65B0\u589E\u6839\u4EFB\u52A1", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
      this.openCreateTaskModal("\u65B0\u589E\u6839\u4EFB\u52A1", this.plugin.store.getProjects(), {
        title: "",
        description: "",
        projectId: project.id,
        status: "todo",
        tags: [],
        date: toDateKey(now()),
        recurrence: "once",
        completed: false,
        viewState: {
          mindmap: {
            parentTaskId: null,
            childOrder: Date.now(),
            expanded: true
          }
        },
        ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
      });
    });
    const zoomOutButton = toolbarActions.createEl("button", { text: "-", cls: "pm-button pm-button-secondary" });
    zoomOutButton.addEventListener("click", () => this.stepMindmapZoom(-1));
    this.mindmapZoomLabel = toolbarActions.createDiv({ cls: "pm-muted", text: `${Math.round(this.mindmapZoom * 100)}%` });
    const zoomInButton = toolbarActions.createEl("button", { text: "+", cls: "pm-button pm-button-secondary" });
    zoomInButton.addEventListener("click", () => this.stepMindmapZoom(1));
    toolbarActions.createEl("button", { text: "\u9002\u5E94", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      this.fitMindmapView();
    });
    toolbarActions.createEl("button", { text: "\u91CD\u7F6E", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      this.resetMindmapView();
    });
    const viewport = canvasCard.createDiv({ cls: "pm-mindmap-viewport tm-mindmap-viewport" });
    const content = viewport.createDiv({ cls: "pm-mindmap-content tm-mindmap-content" });
    const svg = content.createSvg("svg", { attr: { class: "pm-mindmap-lines pm-mindmap-svg tm-mindmap-svg" } });
    const redrawConnections = () => {
      while (svg.firstChild) {
        svg.firstChild.remove();
      }
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      nodes.forEach((node) => {
        if (!node.parentId) {
          return;
        }
        const parent = nodeById.get(node.parentId);
        if (!parent) {
          return;
        }
        svg.createSvg("path", {
          attr: {
            d: buildMindmapPath(parent, node),
            class: node.type === "comment" ? "pm-mindmap-line is-comment" : "pm-mindmap-line"
          }
        });
      });
    };
    nodes.forEach((node) => {
      const element = content.createDiv({
        cls: `pm-mindmap-node tm-mindmap-node is-${node.type} ${node.summary ? "has-summary" : ""} ${this.selectedMindmapNodeId === node.id ? "is-selected" : ""}`
      });
      element.style.left = `${node.x}px`;
      element.style.top = `${node.y}px`;
      element.style.minHeight = `${node.height}px`;
      element.dataset.nodeId = node.id;
      element.addEventListener("click", () => {
        this.selectedMindmapNodeId = node.id;
        this.render();
      });
      if (node.type === "task") {
        element.addEventListener("dblclick", () => this.openEditTaskModal(node.task));
      }
      if (node.type === "comment") {
        element.addEventListener("dblclick", () => void this.editMindmapComment(node.comment));
      }
      element.createDiv({ cls: "pm-task-title", text: node.label });
      if (node.summary) {
        element.createDiv({ cls: "pm-mindmap-node-summary", text: node.summary });
      }
      const meta = element.createDiv({ cls: "pm-task-meta" });
      if (node.type === "project") {
        appendBadge(meta, "\u9879\u76EE\u6839\u8282\u70B9", "tag");
      } else if (node.task && node.type === "task") {
        appendBadge(meta, priorityLabel(node.task.priority), priorityTone(node.task.priority));
        appendBadge(meta, recurrenceLabel2(node.task.recurrence), "repeat");
        if (node.task.kind === "composite") {
          appendBadge(meta, `${node.task.subtasks.length} \u4E2A\u5B50\u4EFB\u52A1`, "tag");
        }
      } else {
        appendBadge(meta, "\u8BC4\u8BED", "tag");
      }
      this.makeMindmapNodeDraggable(element, node, redrawConnections);
    });
    const bounds = measureMindmapBounds(nodes);
    const contentWidth = Math.max(bounds.maxX + MINDMAP_VIEW_PADDING, 640);
    const contentHeight = Math.max(bounds.maxY + MINDMAP_VIEW_PADDING, 420);
    content.style.width = `${contentWidth}px`;
    content.style.height = `${contentHeight}px`;
    svg.setAttribute("width", String(contentWidth));
    svg.setAttribute("height", String(contentHeight));
    svg.setAttribute("viewBox", `0 0 ${contentWidth} ${contentHeight}`);
    redrawConnections();
    this.attachMindmapViewport(viewport, content);
    const inspector = shell.createDiv({ cls: "pm-mindmap-inspector pm-mindmap-details tm-mindmap-details" });
    this.renderMindmapInspector(inspector, project, tasks, selectedNode);
  }
  renderMindmapInspector(container, project, tasks, node) {
    container.empty();
    container.createEl("h4", { text: "\u8282\u70B9\u8BE6\u60C5" });
    if (!node) {
      container.createDiv({ cls: "pm-muted", text: "\u8BF7\u9009\u62E9\u4E00\u4E2A\u8282\u70B9\u3002" });
      return;
    }
    if (node.type === "project") {
      container.createDiv({ cls: "pm-muted", text: "\u9879\u76EE\u6839\u8282\u70B9\u7528\u4E8E\u7EC4\u7EC7\u5168\u90E8\u4EFB\u52A1\u5206\u652F\u3002" });
      container.createEl("button", { text: "+ \u65B0\u589E\u6839\u4EFB\u52A1", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
        this.openCreateTaskModal("\u65B0\u589E\u6839\u4EFB\u52A1", this.plugin.store.getProjects(), {
          title: "",
          description: "",
          projectId: project.id,
          status: "todo",
          tags: [],
          date: toDateKey(now()),
          recurrence: "once",
          completed: false,
          viewState: {
            mindmap: {
              parentTaskId: null,
              childOrder: Date.now(),
              expanded: true
            }
          },
          ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
        });
      });
      return;
    }
    if (node.task && node.type === "task") {
      container.createEl("strong", { text: node.task.title });
      const badges = container.createDiv({ cls: "pm-task-meta" });
      appendBadge(badges, statusLabel(node.task.status), `status-${node.task.status}`);
      appendBadge(badges, priorityLabel(node.task.priority), priorityTone(node.task.priority));
      appendBadge(badges, recurrenceLabel2(node.task.recurrence), "repeat");
      if (node.task.description) {
        container.createDiv({ cls: "pm-muted", text: node.task.description });
      }
      const actions = container.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "\u7F16\u8F91\u4EFB\u52A1", cls: "pm-button pm-button-primary" }).addEventListener("click", () => this.openEditTaskModal(node.task));
      actions.createEl("button", { text: "\u65B0\u589E\u5B50\u4EFB\u52A1", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
        this.openCreateTaskModal("\u65B0\u589E\u5B50\u4EFB\u52A1", this.plugin.store.getProjects(), {
          title: "",
          description: "",
          projectId: project.id,
          status: "todo",
          tags: [],
          date: toDateKey(now()),
          recurrence: "once",
          completed: false,
          viewState: {
            mindmap: {
              parentTaskId: node.task.id,
              childOrder: Date.now(),
              expanded: true
            }
          },
          ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
        });
      });
      actions.createEl("button", { text: "\u65B0\u589E\u8BC4\u8BED", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
        void this.addMindmapComment(node.task.id);
      });
      if (node.task.kind === "simple") {
        container.createEl("button", { text: "\u8F6C\u4E3A\u7EC4\u5408\u4EFB\u52A1", cls: "pm-button pm-button-ghost" }).addEventListener("click", async () => {
          await this.plugin.store.updateTask(node.task.id, {
            kind: "composite",
            subtasks: [{ title: "\u65B0\u5B50\u4EFB\u52A1" }]
          });
          this.openEditTaskModal(this.plugin.store.getTask(node.task.id) ?? node.task);
        });
      } else {
        container.createDiv({ cls: "pm-muted", text: `\u5F53\u524D\u4E3A\u7EC4\u5408\u4EFB\u52A1\uFF0C\u5171 ${node.task.subtasks.length} \u4E2A\u5B50\u4EFB\u52A1\u3002` });
      }
      const relationCard = container.createDiv({ cls: "pm-input-card" });
      relationCard.createEl("strong", { text: "\u4E0A\u7EA7\u4EFB\u52A1" });
      const parentSelect = relationCard.createEl("select");
      parentSelect.createEl("option", { value: "", text: "\u6302\u5230\u9879\u76EE\u6839\u8282\u70B9" });
      const descendants = collectTaskDescendantIds(tasks, node.task.id);
      tasks.filter((task) => task.id !== node.task.id && !descendants.has(task.id)).forEach((task) => parentSelect.createEl("option", { value: task.id, text: task.title }));
      parentSelect.value = node.task.viewState.mindmap.parentTaskId ?? "";
      parentSelect.addEventListener("change", async () => {
        await this.plugin.store.patchTask(node.task.id, {
          viewState: {
            mindmap: {
              ...node.task.viewState.mindmap,
              parentTaskId: parentSelect.value || null,
              childOrder: Date.now()
            }
          }
        });
      });
      const dependencyCard = container.createDiv({ cls: "pm-input-card" });
      dependencyCard.createEl("strong", { text: "\u4F9D\u8D56\u6307\u5411" });
      dependencyCard.createDiv({ cls: "pm-muted", text: "\u70B9\u51FB\u5207\u6362\u963B\u585E\u4F9D\u8D56\uFF0C\u7528\u4E8E\u770B\u677F\u63D0\u793A\u548C\u7518\u7279\u56FE\u8BF4\u660E\u3002" });
      const chips = dependencyCard.createDiv({ cls: "pm-anchor-chip-list" });
      tasks.filter((task) => task.id !== node.task.id).forEach((task) => {
        const chip = chips.createEl("button", {
          text: task.title,
          cls: `pm-anchor-chip ${node.task.viewState.gantt.dependencyIds.includes(task.id) ? "is-active" : ""}`
        });
        chip.addEventListener("click", async () => {
          const current = new Set(node.task.viewState.gantt.dependencyIds);
          if (current.has(task.id)) {
            current.delete(task.id);
          } else {
            current.add(task.id);
          }
          await this.plugin.store.patchTask(node.task.id, {
            viewState: {
              gantt: {
                ...node.task.viewState.gantt,
                dependencyIds: [...current]
              }
            }
          });
        });
      });
      return;
    }
    if (node.comment) {
      container.createDiv({ cls: "pm-muted", text: "\u8BC4\u8BED\u8282\u70B9\u53EA\u4FDD\u7559\u5BFC\u56FE\u6240\u9700\u5185\u5BB9\uFF0C\u4E0D\u5C55\u793A\u65E0\u5173\u72B6\u6001\u4FE1\u606F\u3002" });
      container.createEl("strong", { text: truncateText2(node.comment.content, 96) });
      const actions = container.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "\u6539\u5199\u8BC4\u8BED", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
        void this.editMindmapComment(node.comment);
      });
      actions.createEl("button", { text: "\u65B0\u589E\u5B50\u8BC4\u8BED", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
        void this.addMindmapComment(node.comment.taskId, node.comment.id);
      });
      actions.createEl("button", { text: "\u5220\u9664", cls: "pm-button pm-button-danger" }).addEventListener("click", () => {
        void this.deleteMindmapComment(node.comment);
      });
      const relationCard = container.createDiv({ cls: "pm-input-card" });
      relationCard.createEl("strong", { text: "\u6302\u8F7D\u5230" });
      const parentSelect = relationCard.createEl("select");
      parentSelect.createEl("option", { value: "", text: "\u6240\u5C5E\u4EFB\u52A1\u8282\u70B9" });
      const task = tasks.find((item) => item.id === node.comment.taskId);
      const descendants = collectCommentDescendantIds(task?.mindmapComments ?? [], node.comment.id);
      (task?.mindmapComments ?? []).filter((comment) => comment.id !== node.comment.id && !descendants.has(comment.id)).forEach((comment) => parentSelect.createEl("option", { value: comment.id, text: truncateText2(comment.content, 24) }));
      parentSelect.value = node.comment.parentCommentId ?? "";
      parentSelect.addEventListener("change", async () => {
        await this.plugin.store.updateTaskMindmapComment(node.comment.taskId, node.comment.id, {
          parentCommentId: parentSelect.value || null,
          childOrder: Date.now()
        });
      });
    }
  }
  buildMindmapNodes(project, tasks) {
    const rootId = `project:${project.id}`;
    const nodes = [
      {
        id: rootId,
        type: "project",
        label: project.name,
        x: MINDMAP_ROOT_X,
        y: 0,
        width: MINDMAP_NODE_WIDTH,
        height: MINDMAP_NODE_HEIGHT
      }
    ];
    const nodeById = /* @__PURE__ */ new Map([[rootId, nodes[0]]]);
    const childIdsByParent = /* @__PURE__ */ new Map();
    const tasksByParent = /* @__PURE__ */ new Map();
    tasks.forEach((task) => {
      const parent = task.viewState.mindmap.parentTaskId ?? null;
      tasksByParent.set(parent, [...tasksByParent.get(parent) ?? [], task]);
    });
    tasksByParent.forEach((items) => items.sort((a, b) => a.viewState.mindmap.childOrder - b.viewState.mindmap.childOrder || compareSeriesTasks2(a, b)));
    tasks.forEach((task) => {
      const taskNode = {
        id: `task:${task.id}`,
        parentId: task.viewState.mindmap.parentTaskId ? `task:${task.viewState.mindmap.parentTaskId}` : rootId,
        type: "task",
        label: task.title,
        summary: buildTaskMindmapSummary(task),
        task,
        x: task.viewState.mindmap.x ?? 0,
        y: task.viewState.mindmap.y ?? 0,
        width: MINDMAP_NODE_WIDTH,
        height: task.description?.trim() ? MINDMAP_NODE_HEIGHT + 34 : MINDMAP_NODE_HEIGHT,
        storedX: task.viewState.mindmap.x,
        storedY: task.viewState.mindmap.y
      };
      nodes.push(taskNode);
      nodeById.set(taskNode.id, taskNode);
      task.mindmapComments.forEach((comment) => {
        const commentNode = {
          id: `comment:${comment.id}`,
          parentId: comment.parentCommentId ? `comment:${comment.parentCommentId}` : taskNode.id,
          type: "comment",
          label: comment.content,
          task,
          comment,
          x: comment.x ?? 0,
          y: comment.y ?? 0,
          width: MINDMAP_NODE_WIDTH,
          height: MINDMAP_NODE_HEIGHT,
          storedX: comment.x,
          storedY: comment.y
        };
        nodes.push(commentNode);
        nodeById.set(commentNode.id, commentNode);
      });
    });
    childIdsByParent.set(rootId, (tasksByParent.get(null) ?? []).map((task) => `task:${task.id}`));
    tasks.forEach((task) => {
      const childIds = [
        ...task.mindmapComments.filter((comment) => (comment.parentCommentId ?? null) === null).sort((a, b) => a.childOrder - b.childOrder).map((comment) => `comment:${comment.id}`),
        ...(tasksByParent.get(task.id) ?? []).map((childTask) => `task:${childTask.id}`)
      ];
      childIdsByParent.set(`task:${task.id}`, childIds);
      task.mindmapComments.forEach((comment) => {
        const commentChildren = task.mindmapComments.filter((item) => (item.parentCommentId ?? null) === comment.id).sort((a, b) => a.childOrder - b.childOrder).map((item) => `comment:${item.id}`);
        childIdsByParent.set(`comment:${comment.id}`, commentChildren);
      });
    });
    let leafIndex = 0;
    const layoutBranch = (nodeId, depth) => {
      const node = nodeById.get(nodeId);
      if (!node) {
        return 0;
      }
      const childIds = childIdsByParent.get(nodeId) ?? [];
      if (childIds.length === 0) {
        const fallbackY2 = leafIndex * MINDMAP_SIBLING_GAP;
        leafIndex += 1;
        node.x = node.type === "project" ? MINDMAP_ROOT_X : node.storedX ?? MINDMAP_ROOT_X + depth * MINDMAP_LEVEL_GAP;
        node.y = node.type === "project" ? fallbackY2 : node.storedY ?? fallbackY2;
        return node.y + node.height / 2;
      }
      const childCenters = childIds.map((childId) => layoutBranch(childId, depth + 1));
      const fallbackY = childCenters.length === 1 ? childCenters[0] - node.height / 2 : (childCenters[0] + childCenters[childCenters.length - 1]) / 2 - node.height / 2;
      node.x = node.type === "project" ? MINDMAP_ROOT_X : node.storedX ?? MINDMAP_ROOT_X + depth * MINDMAP_LEVEL_GAP;
      node.y = node.type === "project" ? fallbackY : node.storedY ?? fallbackY;
      return node.y + node.height / 2;
    };
    layoutBranch(rootId, 0);
    return nodes;
  }
  makeMindmapNodeDraggable(element, node, onPositionChange) {
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let moved = false;
    element.addEventListener("pointerdown", (event) => {
      if (node.type === "project") {
        return;
      }
      if (event.target.closest("button, select, input, textarea")) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      element.setPointerCapture(event.pointerId);
      startX = event.clientX;
      startY = event.clientY;
      originX = node.x;
      originY = node.y;
      moved = false;
      element.addClass("is-dragging");
    });
    element.addEventListener("pointermove", (event) => {
      if (!element.hasPointerCapture(event.pointerId)) {
        return;
      }
      const deltaX = (event.clientX - startX) / this.mindmapZoom;
      const deltaY = (event.clientY - startY) / this.mindmapZoom;
      moved = moved || Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1;
      const nextX = Math.max(0, originX + deltaX);
      const nextY = Math.max(0, originY + deltaY);
      element.style.left = `${nextX}px`;
      element.style.top = `${nextY}px`;
      node.x = nextX;
      node.y = nextY;
      onPositionChange();
    });
    element.addEventListener("pointerup", async (event) => {
      if (!element.hasPointerCapture(event.pointerId)) {
        return;
      }
      element.releasePointerCapture(event.pointerId);
      element.removeClass("is-dragging");
      if (!moved) {
        return;
      }
      if (node.task && node.type === "task") {
        await this.plugin.store.patchTask(node.task.id, {
          viewState: { mindmap: { ...node.task.viewState.mindmap, x: node.x, y: node.y } }
        });
      }
      if (node.comment) {
        await this.plugin.store.updateTaskMindmapComment(node.comment.taskId, node.comment.id, { x: node.x, y: node.y });
      }
    });
  }
  attachMindmapViewport(viewport, content) {
    this.mindmapViewport = viewport;
    this.mindmapContent = content;
    this.applyMindmapTransform();
    const initialSizeChanged = this.updateMindmapViewportSize(viewport);
    let startX = 0;
    let startY = 0;
    let originPanX = 0;
    let originPanY = 0;
    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      if (event.target.closest(".pm-mindmap-node, .tm-mindmap-node")) {
        return;
      }
      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      viewport.addClass("is-panning");
      startX = event.clientX;
      startY = event.clientY;
      originPanX = this.mindmapPan.x;
      originPanY = this.mindmapPan.y;
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!viewport.hasPointerCapture(event.pointerId)) {
        return;
      }
      this.mindmapPan = {
        x: originPanX + event.clientX - startX,
        y: originPanY + event.clientY - startY
      };
      this.applyMindmapTransform();
    });
    const stopPanning = (event) => {
      if (!viewport.hasPointerCapture(event.pointerId)) {
        return;
      }
      viewport.releasePointerCapture(event.pointerId);
      viewport.removeClass("is-panning");
    };
    viewport.addEventListener("pointerup", stopPanning);
    viewport.addEventListener("pointercancel", stopPanning);
    viewport.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.metaKey) {
          return;
        }
        event.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const nextZoom = clamp(
          roundMindmapZoom(this.mindmapZoom + (event.deltaY < 0 ? this.mindmapZoomStep : -this.mindmapZoomStep)),
          this.mindmapMinZoom,
          this.mindmapMaxZoom
        );
        this.zoomMindmapToPoint(event.clientX - rect.left, event.clientY - rect.top, nextZoom);
      },
      { passive: false }
    );
    this.mindmapResizeObserver = new ResizeObserver(() => {
      if (this.updateMindmapViewportSize(viewport)) {
        this.scheduleMindmapFit();
      }
    });
    this.mindmapResizeObserver.observe(viewport);
    if (this.mindmapNeedsAutoFit || initialSizeChanged) {
      window.requestAnimationFrame(() => {
        if (this.mindmapViewport === viewport) {
          this.fitMindmapView();
        }
      });
    }
  }
  stepMindmapZoom(direction) {
    if (!this.mindmapViewport) {
      return;
    }
    const nextZoom = clamp(roundMindmapZoom(this.mindmapZoom + direction * this.mindmapZoomStep), this.mindmapMinZoom, this.mindmapMaxZoom);
    const pointX = this.mindmapViewport.clientWidth / 2;
    const pointY = this.mindmapViewport.clientHeight / 2;
    this.zoomMindmapToPoint(pointX, pointY, nextZoom);
  }
  zoomMindmapToPoint(pointX, pointY, nextZoom) {
    if (!this.mindmapViewport || !this.mindmapContent || nextZoom === this.mindmapZoom) {
      return;
    }
    const contentX = (pointX - this.mindmapPan.x) / this.mindmapZoom;
    const contentY = (pointY - this.mindmapPan.y) / this.mindmapZoom;
    this.mindmapZoom = nextZoom;
    this.mindmapPan = {
      x: pointX - contentX * nextZoom,
      y: pointY - contentY * nextZoom
    };
    this.applyMindmapTransform();
  }
  resetMindmapView() {
    this.mindmapZoom = 1;
    this.mindmapPan = { x: 0, y: 0 };
    this.mindmapNeedsAutoFit = false;
    this.applyMindmapTransform();
  }
  fitMindmapView() {
    if (!this.mindmapViewport || this.mindmapNodes.length === 0) {
      return;
    }
    const bounds = measureMindmapBounds(this.mindmapNodes);
    const viewportWidth = this.mindmapViewport.clientWidth;
    const viewportHeight = this.mindmapViewport.clientHeight;
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      return;
    }
    const contentWidth = Math.max(bounds.width, 1);
    const contentHeight = Math.max(bounds.height, 1);
    const scaleX = (viewportWidth - MINDMAP_VIEW_PADDING * 2) / contentWidth;
    const scaleY = (viewportHeight - MINDMAP_VIEW_PADDING * 2) / contentHeight;
    const nextZoom = clamp(roundMindmapZoom(Math.min(scaleX, scaleY)), this.mindmapMinZoom, this.mindmapMaxZoom);
    this.mindmapZoom = nextZoom;
    this.mindmapPan = {
      x: (viewportWidth - contentWidth * nextZoom) / 2 - bounds.minX * nextZoom,
      y: (viewportHeight - contentHeight * nextZoom) / 2 - bounds.minY * nextZoom
    };
    this.mindmapNeedsAutoFit = false;
    this.applyMindmapTransform();
  }
  scheduleMindmapFit() {
    if (this.mindmapFitTimer !== null) {
      window.clearTimeout(this.mindmapFitTimer);
    }
    this.mindmapFitTimer = window.setTimeout(() => {
      this.mindmapFitTimer = null;
      this.fitMindmapView();
    }, 120);
  }
  applyMindmapTransform() {
    if (!this.mindmapContent) {
      return;
    }
    this.mindmapContent.style.transform = `translate(${this.mindmapPan.x}px, ${this.mindmapPan.y}px) scale(${this.mindmapZoom})`;
    this.mindmapZoomLabel?.setText(`${Math.round(this.mindmapZoom * 100)}%`);
  }
  updateMindmapViewportSize(viewport) {
    const width = Math.round(viewport.clientWidth);
    const height = Math.round(viewport.clientHeight);
    if (width <= 0 || height <= 0) {
      return false;
    }
    const changed = width !== this.mindmapViewportWidth || height !== this.mindmapViewportHeight;
    this.mindmapViewportWidth = width;
    this.mindmapViewportHeight = height;
    return changed;
  }
  destroyMindmapViewport() {
    this.mindmapResizeObserver?.disconnect();
    this.mindmapResizeObserver = null;
    if (this.mindmapFitTimer !== null) {
      window.clearTimeout(this.mindmapFitTimer);
      this.mindmapFitTimer = null;
    }
    this.mindmapViewport = null;
    this.mindmapContent = null;
    this.mindmapZoomLabel = null;
    this.mindmapNodes = [];
  }
  openSeriesTaskMenu(event, task) {
    event.preventDefault();
    event.stopPropagation();
    const menu = new import_obsidian11.Menu();
    menu.addItem(
      (item) => item.setTitle("\u8BE6\u7EC6\u7F16\u8F91").setIcon("square-pen").onClick(() => {
        this.openEditTaskModal(task);
      })
    );
    [
      ["todo", "\u79FB\u52A8\u5230\u5F85\u529E"],
      ["doing", "\u79FB\u52A8\u5230\u8FDB\u884C\u4E2D"],
      ["blocked", "\u79FB\u52A8\u5230\u963B\u585E"],
      ["done", "\u79FB\u52A8\u5230\u5DF2\u5B8C\u6210"]
    ].forEach(([status, label]) => {
      if (task.status === status) {
        return;
      }
      menu.addItem(
        (item) => item.setTitle(label).setIcon("arrow-right-left").onClick(async () => {
          await this.moveTaskToStatus(task, status);
        })
      );
    });
    menu.addItem(
      (item) => item.setTitle("\u5220\u9664").setIcon("trash-2").onClick(async () => {
        await this.plugin.store.deleteTask(task.id, "series");
      })
    );
    menu.showAtMouseEvent(event);
  }
  async moveTaskToStatus(task, status) {
    await this.plugin.store.patchTask(task.id, {
      status,
      viewState: {
        board: {
          columnId: status,
          order: Date.now()
        }
      }
    });
  }
  async addMindmapComment(taskId, parentCommentId) {
    new TextEntryModal(this.app, {
      title: "\u65B0\u589E\u8BC4\u8BED",
      description: "\u8FD9\u91CC\u4F1A\u521B\u5EFA\u771F\u5B9E\u7684\u5BFC\u56FE\u8BC4\u8BED\u8282\u70B9\uFF0C\u800C\u4E0D\u662F\u5360\u4F4D\u6587\u6848\u3002",
      placeholder: "\u8F93\u5165\u8BC4\u8BED\u5185\u5BB9",
      onSubmit: async (value) => {
        await this.plugin.store.addTaskMindmapComment(taskId, value, parentCommentId ?? null);
      }
    }).open();
  }
  async editMindmapComment(comment) {
    new TextEntryModal(this.app, {
      title: "\u6539\u5199\u8BC4\u8BED",
      initialValue: comment.content,
      placeholder: "\u8F93\u5165\u65B0\u7684\u8BC4\u8BED\u5185\u5BB9",
      onSubmit: async (value) => {
        await this.plugin.store.updateTaskMindmapComment(comment.taskId, comment.id, { content: value });
      }
    }).open();
  }
  async deleteMindmapComment(comment) {
    if (!window.confirm("\u5220\u9664\u8BE5\u8BC4\u8BED\u53CA\u5176\u5206\u652F\uFF1F")) {
      return;
    }
    await this.plugin.store.deleteTaskMindmapComment(comment.taskId, comment.id);
  }
  openCreateTaskModal(title, projects, initial) {
    new TaskModal(this.app, {
      title,
      projects,
      initial,
      onSubmit: async (input) => {
        await this.plugin.store.createTask(input);
      }
    }).open();
  }
  openEditTaskModal(task) {
    new TaskModal(this.app, {
      title: "\u7F16\u8F91\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      existingTask: task,
      initial: {
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        status: task.status,
        priority: task.priority,
        tags: task.tags,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        recurrence: task.recurrence,
        recurrenceCount: task.recurrenceCount ?? null,
        recurrenceUntil: task.recurrenceUntil ?? null,
        kind: task.kind,
        subtasks: task.subtasks,
        completed: isTaskSeriesCompleted(task)
      },
      onSubmit: async (input) => {
        await this.plugin.store.updateTask(task.id, input, "series");
      },
      onDelete: async (scope) => {
        await this.plugin.store.deleteTask(task.id, scope);
      },
      onCompleteSeries: async () => {
        await this.plugin.store.completeTaskSeries(task.id);
      },
      allowSingleDelete: false
    }).open();
  }
  openEditOccurrenceModal(task) {
    const seriesTask = this.plugin.store.getTask(task.taskId);
    if (!seriesTask) {
      return;
    }
    new TaskModal(this.app, {
      title: "\u7F16\u8F91\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      existingTask: seriesTask,
      occurrenceContext: task,
      initial: {
        title: seriesTask.title,
        description: seriesTask.description,
        projectId: seriesTask.projectId,
        status: seriesTask.status,
        priority: seriesTask.priority,
        tags: seriesTask.tags,
        date: seriesTask.date,
        startTime: seriesTask.startTime,
        endTime: seriesTask.endTime,
        recurrence: seriesTask.recurrence,
        recurrenceCount: seriesTask.recurrenceCount ?? null,
        recurrenceUntil: seriesTask.recurrenceUntil ?? null,
        kind: seriesTask.kind,
        subtasks: seriesTask.subtasks,
        completed: isTaskSeriesCompleted(seriesTask)
      },
      onSubmit: async (input, scope) => {
        if (scope === "occurrence") {
          await this.plugin.store.updateTaskOccurrenceWindow(seriesTask.id, task.date, input.startTime, input.endTime);
          return;
        }
        await this.plugin.store.updateTask(seriesTask.id, input, "series");
      },
      onDelete: async (scope) => {
        if (scope === "single") {
          await this.plugin.store.deleteTaskOccurrence(seriesTask.id, task.date);
          return;
        }
        await this.plugin.store.deleteTask(seriesTask.id, "series");
      },
      onCompleteSeries: async () => {
        await this.plugin.store.completeTaskSeries(seriesTask.id, task.date);
      },
      allowSingleDelete: true
    }).open();
  }
};
var MINDMAP_ROOT_X = 80;
var MINDMAP_LEVEL_GAP = 280;
var MINDMAP_SIBLING_GAP = 132;
var MINDMAP_NODE_WIDTH = 220;
var MINDMAP_NODE_HEIGHT = 84;
var MINDMAP_VIEW_PADDING = 48;
var MINDMAP_MIN_ZOOM = 0.35;
var MINDMAP_MAX_ZOOM = 1.6;
var MINDMAP_ZOOM_STEP = 0.1;
var GANTT_ROW_HEIGHT = 72;
var GANTT_HEADER_HEIGHT = 64;
var GANTT_LEFT_WIDTH = 420;
var GANTT_MIN_ZOOM = 0.4;
var GANTT_MAX_ZOOM = 2;
var GANTT_ZOOM_STEP = 0.1;
function buildMindmapPath(parent, node) {
  const startX = parent.x + parent.width;
  const startY = parent.y + parent.height / 2;
  const endX = node.x;
  const endY = node.y + node.height / 2;
  const midX = startX + Math.max(80, (endX - startX) / 2);
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}
function buildMindmapLayoutSignature(nodes) {
  return nodes.map((node) => `${node.id}:${node.parentId ?? ""}:${node.type}`).join("|");
}
function measureMindmapBounds(nodes) {
  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...nodes.map((node) => node.y + node.height));
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function roundMindmapZoom(value) {
  return Math.round(value * 100) / 100;
}
function buildTaskMindmapSummary(task) {
  const summary = task.description?.replace(/\s+/g, " ").trim() ?? "";
  return summary ? truncateText2(summary, 72) : "";
}
function appendBadge(container, label, tone) {
  container.createSpan({ text: label, cls: `pm-badge pm-badge-${tone}` });
}
function priorityTone(priority) {
  if (priority === "urgent" || priority === "high") {
    return "priority-high";
  }
  if (priority === "medium") {
    return "priority-medium";
  }
  return "priority-low";
}
function buildGanttDataSignature(projectId, items) {
  return `${projectId}:${items.map(
    (item) => `${item.task.id}:${item.task.revision}:${item.startDate}:${item.endDate}:${item.task.status}:${item.task.priority ?? ""}:${item.task.viewState.gantt.locked ? 1 : 0}:${item.task.viewState.gantt.milestone ? 1 : 0}`
  ).join("|")}`;
}
function fitGanttTimeline(items, viewportWidth) {
  const spanDays = diffDateKeys(
    items.reduce((earliest, item) => compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest, items[0].startDate),
    items.reduce((latest, item) => compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest, items[0].endDate)
  ) + 1;
  const scale = recommendedGanttScale(spanDays);
  const { rangeStart, rangeEnd } = buildTimelineRange(
    items.reduce((earliest, item) => compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest, items[0].startDate),
    items.reduce((latest, item) => compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest, items[0].endDate),
    scale
  );
  const units = countTimelineUnits(rangeStart, rangeEnd, scale);
  const baseWidth = ganttBaseUnitWidth(scale);
  const zoom = clamp(roundTimelineZoom(Math.max(viewportWidth, 320) / Math.max(units * baseWidth, 1) * 0.98), GANTT_MIN_ZOOM, GANTT_MAX_ZOOM);
  return { scale, zoom };
}
function recommendedGanttScale(spanDays) {
  if (spanDays <= 14) {
    return "day";
  }
  if (spanDays <= 90) {
    return "week";
  }
  return "month";
}
function buildGanttGeometry(items, scale, zoom) {
  const minDate = items.reduce((earliest, item) => compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest, items[0].startDate);
  const maxDate = items.reduce((latest, item) => compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest, items[0].endDate);
  const { rangeStart, rangeEnd } = buildTimelineRange(minDate, maxDate, scale);
  const unitWidth = ganttBaseUnitWidth(scale) * zoom;
  const contentWidth = timelineWidth(rangeStart, rangeEnd, scale, unitWidth);
  const today = toDateKey(now());
  return {
    scale,
    rangeStart,
    rangeEnd,
    unitWidth,
    contentWidth,
    todayX: compareDateKeys(today, rangeStart) >= 0 && compareDateKeys(today, rangeEnd) <= 0 ? dateToTimelineX(today, rangeStart, scale, unitWidth) : null,
    majorCells: buildGanttMajorCells(rangeStart, rangeEnd, scale, unitWidth),
    minorCells: buildGanttMinorCells(rangeStart, rangeEnd, scale, unitWidth)
  };
}
function buildTimelineRange(minDate, maxDate, scale) {
  if (scale === "day") {
    return {
      rangeStart: toDateKey(addDays(parseDateKey(minDate), -2)),
      rangeEnd: toDateKey(addDays(parseDateKey(maxDate), 2))
    };
  }
  if (scale === "week") {
    return {
      rangeStart: toDateKey(startOfWeek(addDays(parseDateKey(minDate), -7))),
      rangeEnd: toDateKey(addDays(startOfWeek(addDays(parseDateKey(maxDate), 7)), 6))
    };
  }
  const monthStart = firstDayOfMonth(addMonthsDate(parseDateKey(minDate), -1));
  const monthEnd = lastDayOfMonth(addMonthsDate(parseDateKey(maxDate), 1));
  return {
    rangeStart: toDateKey(monthStart),
    rangeEnd: toDateKey(monthEnd)
  };
}
function ganttBaseUnitWidth(scale) {
  if (scale === "day") {
    return 48;
  }
  if (scale === "week") {
    return 160;
  }
  return 220;
}
function countTimelineUnits(rangeStart, rangeEnd, scale) {
  if (scale === "day") {
    return diffDateKeys(rangeStart, rangeEnd) + 1;
  }
  if (scale === "week") {
    return Math.ceil((diffDateKeys(rangeStart, rangeEnd) + 1) / 7);
  }
  return diffMonthStarts(rangeStart, rangeEnd) + 1;
}
function timelineWidth(rangeStart, rangeEnd, scale, unitWidth) {
  if (scale === "month") {
    const endBoundary2 = toDateKey(firstDayOfMonth(addMonthsDate(parseDateKey(rangeEnd), 1)));
    return Math.max(dateToTimelineX(endBoundary2, rangeStart, scale, unitWidth), unitWidth);
  }
  const endBoundary = toDateKey(addDays(parseDateKey(rangeEnd), 1));
  return Math.max(dateToTimelineX(endBoundary, rangeStart, scale, unitWidth), unitWidth);
}
function buildGanttMajorCells(rangeStart, rangeEnd, scale, unitWidth) {
  if (scale === "day") {
    return iterateDateKeys(rangeStart, rangeEnd).map((date) => ({
      left: dateToTimelineX(date, rangeStart, scale, unitWidth),
      width: unitWidth,
      label: date.slice(5),
      tone: isToday(date) ? "current" : void 0
    }));
  }
  if (scale === "week") {
    const cells2 = [];
    for (let cursor = parseDateKey(rangeStart); compareDateKeys(toDateKey(cursor), rangeEnd) <= 0; cursor = addDays(cursor, 7)) {
      const start = toDateKey(cursor);
      const end = toDateKey(addDays(cursor, 6));
      cells2.push({
        left: dateToTimelineX(start, rangeStart, scale, unitWidth),
        width: unitWidth,
        label: `${start.slice(5)} ~ ${end.slice(5)}`
      });
    }
    return cells2;
  }
  const cells = [];
  for (let cursor = firstDayOfMonth(parseDateKey(rangeStart)); compareDateKeys(toDateKey(cursor), rangeEnd) <= 0; cursor = addMonthsDate(cursor, 1)) {
    const start = toDateKey(cursor);
    const next = toDateKey(firstDayOfMonth(addMonthsDate(cursor, 1)));
    cells.push({
      left: dateToTimelineX(start, rangeStart, scale, unitWidth),
      width: dateToTimelineX(next, rangeStart, scale, unitWidth) - dateToTimelineX(start, rangeStart, scale, unitWidth),
      label: `${cursor.getFullYear()}\u5E74${cursor.getMonth() + 1}\u6708`,
      tone: toMonthKey(cursor) === toMonthKey(now()) ? "current" : void 0
    });
  }
  return cells;
}
function buildGanttMinorCells(rangeStart, rangeEnd, scale, unitWidth) {
  if (scale === "month") {
    const cells = [];
    for (let cursor = parseDateKey(rangeStart); compareDateKeys(toDateKey(cursor), rangeEnd) <= 0; cursor = addDays(cursor, 7)) {
      const date = toDateKey(cursor);
      const next = toDateKey(addDays(cursor, 7));
      cells.push({
        left: dateToTimelineX(date, rangeStart, scale, unitWidth),
        width: Math.max(14, dateToTimelineX(next, rangeStart, scale, unitWidth) - dateToTimelineX(date, rangeStart, scale, unitWidth)),
        label: date.slice(5),
        weekend: isWeekend(cursor),
        isToday: isToday(date)
      });
    }
    return cells;
  }
  const weekdayLabels = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u65E5"];
  return iterateDateKeys(rangeStart, rangeEnd).map((date) => {
    const current = parseDateKey(date);
    return {
      left: dateToTimelineX(date, rangeStart, scale, unitWidth),
      width: scale === "day" ? unitWidth : unitWidth / 7,
      label: scale === "day" ? getChineseWeekday(current).replace("\u5468", "") : weekdayLabels[(current.getDay() + 6) % 7],
      weekend: isWeekend(current),
      isToday: isToday(date)
    };
  });
}
function dateToTimelineX(date, rangeStart, scale, unitWidth) {
  if (scale === "day") {
    return diffDateKeys(rangeStart, date) * unitWidth;
  }
  if (scale === "week") {
    return diffDateKeys(rangeStart, date) / 7 * unitWidth;
  }
  return diffMonthPosition(rangeStart, date) * unitWidth;
}
function scrollTimelineToDate(viewport, geometry, date, alignRatio) {
  const x = compareDateKeys(date, geometry.rangeStart) < 0 || compareDateKeys(date, geometry.rangeEnd) > 0 ? 0 : dateToTimelineX(date, geometry.rangeStart, geometry.scale, geometry.unitWidth);
  viewport.scrollLeft = clamp(x - viewport.clientWidth * alignRatio, 0, Math.max(geometry.contentWidth - viewport.clientWidth, 0));
}
function captureTimelineAnchor(viewport, contentWidth, offset) {
  return {
    ratio: (viewport.scrollLeft + offset) / Math.max(contentWidth, 1),
    offset
  };
}
function roundTimelineZoom(value) {
  return Math.round(value * 100) / 100;
}
function iterateDateKeys(start, end) {
  const dates = [];
  for (let cursor = parseDateKey(start); compareDateKeys(toDateKey(cursor), end) <= 0; cursor = addDays(cursor, 1)) {
    dates.push(toDateKey(cursor));
  }
  return dates;
}
function diffDateKeys(start, end) {
  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / (24 * 60 * 60 * 1e3));
}
function addMonthsDate(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}
function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}
function diffMonthStarts(start, end) {
  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}
function diffMonthPosition(start, target) {
  const startDate = parseDateKey(start);
  const targetDate = parseDateKey(target);
  const monthDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
  const dayFraction = (targetDate.getDate() - 1) / Math.max(daysInMonth(targetDate), 1);
  return monthDiff + dayFraction;
}
function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}
function collectTaskDescendantIds(tasks, taskId) {
  const descendants = /* @__PURE__ */ new Set();
  const queue = [taskId];
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
function collectCommentDescendantIds(comments, commentId) {
  const descendants = /* @__PURE__ */ new Set();
  const queue = [commentId];
  while (queue.length > 0) {
    const current = queue.shift();
    comments.forEach((comment) => {
      if ((comment.parentCommentId ?? null) === current && !descendants.has(comment.id)) {
        descendants.add(comment.id);
        queue.push(comment.id);
      }
    });
  }
  return descendants;
}
function truncateText2(value, limit) {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...`;
}
function buildHeatmapWeeks(days) {
  if (days.length === 0) {
    return [];
  }
  const first = startOfWeek(days[0]);
  const last = days[days.length - 1];
  const weeks = [];
  let cursor = first;
  while (cursor <= last) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}
function buildMonthLabels(weeks) {
  const labels = [];
  for (let index = 0; index < weeks.length; index += 1) {
    const firstDay = weeks[index][0];
    const prev = labels[labels.length - 1];
    if (!prev || prev.label !== formatShortMonth(firstDay)) {
      labels.push({ label: formatShortMonth(firstDay), column: index + 1, span: 1 });
    } else {
      prev.span += 1;
    }
  }
  return labels;
}
function buildYAxisValues(max) {
  const steps = 4;
  const interval = Math.max(1, Math.ceil(max / steps));
  return Array.from({ length: steps + 1 }, (_, index) => interval * (steps - index));
}
function heatLevel(count) {
  if (count <= 0) {
    return 0;
  }
  if (count === 1) {
    return 1;
  }
  if (count <= 3) {
    return 2;
  }
  if (count <= 5) {
    return 3;
  }
  return 4;
}
function recurrenceLabel2(recurrence) {
  if (recurrence === "daily") {
    return "\u6BCF\u65E5\u91CD\u590D";
  }
  if (recurrence === "weekly") {
    return "\u6BCF\u5468\u6B64\u65F6\u91CD\u590D";
  }
  if (recurrence === "custom") {
    return "\u81EA\u5B9A\u4E49\u91CD\u590D";
  }
  return "\u5355\u6B21\u4EFB\u52A1";
}
function statusLabel(status) {
  const labels = {
    todo: "\u5F85\u529E",
    doing: "\u8FDB\u884C\u4E2D",
    blocked: "\u963B\u585E",
    done: "\u5DF2\u5B8C\u6210"
  };
  return labels[status] ?? "\u5F85\u529E";
}
function priorityLabel(priority) {
  if (priority === "urgent") {
    return "\u7D27\u6025";
  }
  if (priority === "high") {
    return "\u9AD8";
  }
  if (priority === "medium") {
    return "\u4E2D";
  }
  if (priority === "low") {
    return "\u4F4E";
  }
  return "\u65E0";
}
function compareWeekTasks(a, b) {
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
  return startA - startB;
}
function compareSeriesTasks2(a, b) {
  const dateCompare = a.date.localeCompare(b.date);
  if (dateCompare !== 0) {
    return dateCompare;
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
function toChartPoint(index, value, max) {
  const { x, y } = toChartCoordinates(index, value, max);
  return `${x},${y}`;
}
function toChartCoordinates(index, value, max) {
  const x = 20 + index * (860 / 29);
  const y = valueToChartY(value, max);
  return { x, y };
}
function valueToChartY(value, max) {
  return 210 - value / max * 170;
}
function defaultCompletionDate(task) {
  return task.recurrenceUntil ?? task.occurrenceDates[task.occurrenceDates.length - 1] ?? task.date;
}
function completionSummary(task) {
  const totalSteps = task.kind === "composite" ? task.occurrenceDates.length * task.subtasks.length : task.occurrenceDates.length;
  const completedSteps = task.kind === "composite" ? task.occurrenceStates.reduce((sum, state) => sum + (state.completedSubtaskIds?.length ?? 0), 0) : task.occurrenceStates.length;
  const ratio = totalSteps === 0 ? 0 : Math.round(completedSteps / totalSteps * 100);
  const label = task.kind === "composite" ? "\u5B50\u4EFB\u52A1" : "\u6B21";
  return `${completedSteps}/${totalSteps} ${label} \xB7 ${ratio}%`;
}
function seriesProgress(task) {
  const totalSteps = task.kind === "composite" ? task.occurrenceDates.length * task.subtasks.length : task.occurrenceDates.length;
  const completedSteps = task.kind === "composite" ? task.occurrenceStates.reduce((sum, state) => sum + (state.completedSubtaskIds?.length ?? 0), 0) : task.occurrenceStates.length;
  return totalSteps === 0 ? 0 : completedSteps / totalSteps;
}
function isTaskSeriesCompleted(task) {
  if (task.occurrenceDates.length === 0) {
    return false;
  }
  return task.occurrenceDates.every((date) => {
    const state = task.occurrenceStates.find((item) => item.date === date);
    if (task.kind === "simple") {
      return Boolean(state);
    }
    const completedIds = new Set(state?.completedSubtaskIds ?? []);
    return task.subtasks.every((subtask) => completedIds.has(subtask.id));
  });
}

// src/views/todayView.ts
var import_obsidian12 = require("obsidian");
var TODAY_VIEW_TYPE = "project-management-today-view";
var TodayTasksView = class extends BaseProjectView {
  constructor(leaf, plugin) {
    super(leaf, plugin);
  }
  getViewType() {
    return TODAY_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u4ECA\u65E5\u4EFB\u52A1";
  }
  getIcon() {
    return "check-square";
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("pm-view", "pm-today-view");
    const today = toDateKey(now());
    const tasks = this.plugin.store.getTasksForDate(today);
    const projects = this.plugin.store.getProjects();
    const totalSteps = tasks.reduce((sum, task) => sum + task.totalSteps, 0);
    const completedSteps = tasks.reduce((sum, task) => sum + task.completedSteps, 0);
    const progress = totalSteps === 0 ? 0 : Math.round(completedSteps / totalSteps * 100);
    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "\u4ECA\u65E5\u4EFB\u52A1" });
    title.createDiv({ text: today, cls: "pm-muted" });
    const actions = header.createDiv({ cls: "pm-inline-actions" });
    const exportButton = actions.createEl("button", { text: "\u5BFC\u51FA\u4ECA\u65E5\u4EFB\u52A1", cls: "pm-button pm-button-secondary" });
    exportButton.addEventListener("click", async () => this.copyIncompleteTasks(incomplete));
    const addButton = actions.createEl("button", { text: "+ \u65B0\u589E\u4EFB\u52A1", cls: "pm-button pm-button-primary" });
    addButton.addEventListener("click", () => {
      const suggested = this.plugin.store.getSuggestedTaskWindow(today);
      new TaskModal(this.app, {
        title: "\u65B0\u589E\u4ECA\u65E5\u4EFB\u52A1",
        projects,
        initial: {
          title: "",
          description: "",
          date: today,
          status: "todo",
          tags: [],
          recurrence: "once",
          completed: false,
          ...suggested
        },
        onSubmit: async (input) => {
          await this.plugin.store.createTask(input);
        }
      }).open();
    });
    const progressCard = container.createDiv({ cls: "pm-today-progress-card" });
    const progressLeft = progressCard.createDiv({ cls: "pm-today-progress-ring-wrap" });
    renderProgressRing(progressLeft, progress);
    const progressBody = progressCard.createDiv({ cls: "pm-today-progress-copy" });
    progressBody.createDiv({ cls: "pm-muted", text: "\u4ECA\u65E5\u8FDB\u5EA6" });
    progressBody.createEl("strong", { text: `${completedSteps} / ${totalSteps} \u6B65` });
    progressBody.createDiv({ cls: "pm-muted", text: tasks.length === 0 ? "\u4ECA\u5929\u8FD8\u6CA1\u6709\u4EFB\u52A1\uFF0C\u5148\u65B0\u589E\u4E00\u6761\u5F00\u59CB\u5427\u3002" : `${tasks.length} \u4E2A\u4EFB\u52A1\uFF0C\u5B8C\u6210\u7387 ${progress}%` });
    const progressBar = progressBody.createDiv({ cls: "pm-progress-bar" });
    progressBar.createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${progress}%` }
    });
    const incomplete = tasks.filter((task) => !task.completed);
    const complete = tasks.filter((task) => task.completed);
    this.renderTaskSection(container, "\u672A\u5B8C\u6210", incomplete, {
      emptyTitle: "\u4ECA\u5929\u6682\u65F6\u6CA1\u6709\u672A\u5B8C\u6210\u4EFB\u52A1",
      emptyBody: "\u5DF2\u7ECF\u6E05\u7A7A\u5F85\u529E\u65F6\uFF0C\u8FD9\u91CC\u4F1A\u4FDD\u6301\u4E13\u6CE8\u800C\u5B89\u9759\u3002"
    });
    this.renderTaskSection(container, "\u5DF2\u5B8C\u6210", complete, {
      emptyTitle: "\u5B8C\u6210\u4EFB\u52A1\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC",
      emptyBody: "\u5B8C\u6210\u7684\u4EFB\u52A1\u4F1A\u81EA\u52A8\u6C47\u603B\u5230\u8FD9\u4E00\u680F\uFF0C\u65B9\u4FBF\u4F60\u5FEB\u901F\u56DE\u987E\u3002"
    });
    const tipCard = container.createDiv({ cls: "pm-tip-card" });
    const icon = tipCard.createDiv({ cls: "pm-tip-icon" });
    (0, import_obsidian12.setIcon)(icon, "sparkles");
    const copy = tipCard.createDiv();
    copy.createEl("strong", { text: "\u5C0F\u8D34\u58EB" });
    copy.createDiv({ cls: "pm-muted", text: "\u5BFC\u51FA\u6309\u94AE\u4F1A\u76F4\u63A5\u590D\u5236\u4ECA\u5929\u4ECD\u672A\u5B8C\u6210\u7684\u4EFB\u52A1\uFF0C\u65B9\u4FBF\u56DE\u8D34\u6216\u4E8C\u6B21\u6574\u7406\u3002" });
  }
  async copyIncompleteTasks(tasks) {
    if (tasks.length === 0) {
      new import_obsidian12.Notice("\u4ECA\u5929\u6CA1\u6709\u672A\u5B8C\u6210\u4EFB\u52A1\u53EF\u5BFC\u51FA");
      return;
    }
    const text = this.plugin.store.exportTasksAsFormattedText(tasks, "current");
    await copyTextToClipboard(text);
    new import_obsidian12.Notice("\u5DF2\u590D\u5236\u4ECA\u65E5\u672A\u5B8C\u6210\u4EFB\u52A1");
  }
  renderTaskSection(container, title, tasks, emptyState) {
    const section = container.createDiv({ cls: "pm-section pm-task-section" });
    const header = section.createDiv({ cls: "pm-section-header" });
    header.createEl("h3", { text: `${title} (${tasks.length})` });
    if (tasks.length === 0) {
      const empty = section.createDiv({ cls: "pm-empty-state-card" });
      const icon = empty.createDiv({ cls: "pm-empty-state-icon" });
      (0, import_obsidian12.setIcon)(icon, "badge-check");
      empty.createEl("strong", { text: emptyState.emptyTitle });
      empty.createDiv({ cls: "pm-muted", text: emptyState.emptyBody });
      return;
    }
    const list = section.createDiv({ cls: "pm-task-list" });
    tasks.forEach((task) => {
      const row = list.createDiv({ cls: `pm-task-card ${task.completed ? "is-complete" : ""}` });
      const main = row.createDiv({ cls: "pm-task-card-main" });
      const checkbox = main.createEl("input", { type: "checkbox", cls: "pm-task-checkbox" });
      checkbox.checked = task.completed;
      checkbox.addEventListener("change", async () => {
        try {
          await this.plugin.store.updateTaskOccurrenceCompletion(task.taskId, task.date, checkbox.checked);
        } catch (error) {
          checkbox.checked = !checkbox.checked;
          new import_obsidian12.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
      const copy = main.createDiv({ cls: "pm-task-copy" });
      copy.createEl("div", { text: task.title, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = copy.createDiv({ cls: "pm-task-meta" });
      appendBadge2(meta, task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "\u672A\u6392\u671F", "muted");
      appendBadge2(meta, recurrenceLabel3(task), "repeat");
      appendBadge2(meta, statusLabel2(task.status), `status-${task.status}`);
      appendBadge2(meta, this.plugin.store.getProject(task.projectId)?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE", "tag");
      if (task.kind === "composite") {
        appendBadge2(meta, `${task.completedSteps}/${task.totalSteps} \u5B50\u9879`, "priority-medium");
        this.renderSubtasks(copy, task);
      }
      const actions = row.createDiv({ cls: "pm-task-card-actions" });
      const moreButton = actions.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "\u66F4\u591A\u64CD\u4F5C" } });
      (0, import_obsidian12.setIcon)(moreButton, "ellipsis");
      moreButton.addEventListener("click", (event) => this.openTaskMenu(event, task));
    });
  }
  openTaskMenu(event, task) {
    event.preventDefault();
    event.stopPropagation();
    const menu = new import_obsidian12.Menu();
    menu.addItem(
      (item) => item.setTitle("\u7F16\u8F91\u4EFB\u52A1").setIcon("square-pen").onClick(() => {
        this.openEditor(task);
      })
    );
    if (task.recurrence !== "once") {
      menu.addItem(
        (item) => item.setTitle("\u63D0\u524D\u7ED3\u675F\u7CFB\u5217").setIcon("calendar-x").onClick(async () => {
          await this.plugin.store.completeTaskSeries(task.taskId, task.date);
        })
      );
    }
    menu.addItem(
      (item) => item.setTitle("\u5220\u9664").setIcon("trash-2").onClick(async () => {
        await this.plugin.store.deleteTaskOccurrence(task.taskId, task.date);
      })
    );
    menu.showAtMouseEvent(event);
  }
  openEditor(task) {
    const seriesTask = this.plugin.store.getTask(task.taskId);
    if (!seriesTask) {
      return;
    }
    new TaskModal(this.app, {
      title: "\u7F16\u8F91\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      existingTask: seriesTask,
      occurrenceContext: task,
      initial: {
        title: seriesTask.title,
        description: seriesTask.description,
        projectId: seriesTask.projectId,
        status: seriesTask.status,
        priority: seriesTask.priority,
        tags: seriesTask.tags,
        date: seriesTask.date,
        startTime: seriesTask.startTime,
        endTime: seriesTask.endTime,
        recurrence: seriesTask.recurrence,
        recurrenceCount: seriesTask.recurrenceCount ?? null,
        recurrenceUntil: seriesTask.recurrenceUntil ?? null,
        kind: seriesTask.kind,
        subtasks: seriesTask.subtasks,
        completed: isTaskSeriesCompleted2(seriesTask)
      },
      onSubmit: async (input, scope) => {
        if (scope === "occurrence") {
          await this.plugin.store.updateTaskOccurrenceWindow(seriesTask.id, task.date, input.startTime, input.endTime);
          return;
        }
        await this.plugin.store.updateTask(seriesTask.id, input, "series");
      },
      onDelete: async (scope) => {
        if (scope === "single") {
          await this.plugin.store.deleteTaskOccurrence(seriesTask.id, task.date);
          return;
        }
        await this.plugin.store.deleteTask(seriesTask.id, "series");
      },
      onCompleteSeries: async () => {
        await this.plugin.store.completeTaskSeries(seriesTask.id, task.date);
      },
      allowSingleDelete: true
    }).open();
  }
  renderSubtasks(container, task) {
    if (task.kind !== "composite") {
      return;
    }
    const grid = container.createDiv({ cls: "pm-subtask-grid" });
    task.subtasks.forEach((subtask) => {
      const item = grid.createEl("button", {
        text: subtask.title,
        cls: `pm-subtask-chip ${task.completedSubtaskIds.includes(subtask.id) ? "is-complete" : ""}`
      });
      item.addEventListener("click", async () => {
        const completed = !task.completedSubtaskIds.includes(subtask.id);
        try {
          await this.plugin.store.updateTaskOccurrenceSubtaskCompletion(task.taskId, task.date, subtask.id, completed);
        } catch (error) {
          new import_obsidian12.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
    });
  }
};
function renderProgressRing(container, progress) {
  const ring = container.createDiv({ cls: "pm-progress-ring" });
  ring.style.setProperty("--pm-progress", String(progress));
  ring.createDiv({ cls: "pm-progress-ring-inner", text: `${progress}%` });
}
function appendBadge2(container, label, tone) {
  container.createSpan({ text: label, cls: `pm-badge pm-badge-${tone}` });
}
function recurrenceLabel3(task) {
  if (task.recurrence === "daily") {
    return "\u6BCF\u65E5\u91CD\u590D";
  }
  if (task.recurrence === "weekly") {
    return "\u6BCF\u5468\u6B64\u65F6\u91CD\u590D";
  }
  if (task.recurrence === "custom") {
    return "\u81EA\u5B9A\u4E49\u91CD\u590D";
  }
  return "\u5355\u6B21\u4EFB\u52A1";
}
function statusLabel2(status) {
  if (status === "doing") {
    return "\u8FDB\u884C\u4E2D";
  }
  if (status === "blocked") {
    return "\u963B\u585E";
  }
  if (status === "done") {
    return "\u5DF2\u5B8C\u6210";
  }
  return "\u5F85\u529E";
}
function isTaskSeriesCompleted2(task) {
  if (task.occurrenceDates.length === 0) {
    return false;
  }
  return task.occurrenceDates.every((date) => {
    const state = task.occurrenceStates.find((item) => item.date === date);
    if (task.kind === "simple") {
      return Boolean(state);
    }
    const completedIds = new Set(state?.completedSubtaskIds ?? []);
    return task.subtasks.every((subtask) => completedIds.has(subtask.id));
  });
}
async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) {
    throw new Error("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u7CFB\u7EDF\u526A\u8D34\u677F\u6743\u9650");
  }
}

// src/main.ts
var ProjectManagementPlugin = class extends import_obsidian13.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...DEFAULT_CONFIG };
    this.pendingSettings = {};
  }
  async onload() {
    await this.loadPluginSettings();
    this.store = new ProjectManagementStore(this.app, this.settings);
    try {
      await this.store.initialize();
      this.settings = this.store.getConfig();
      await this.savePluginSettings();
    } catch (error) {
      console.error(error);
      new import_obsidian13.Notice(error instanceof Error ? error.message : "\u63D2\u4EF6\u521D\u59CB\u5316\u5931\u8D25");
    }
    this.app.workspace.onLayoutReady(() => {
      void this.refreshStoreFromDisk(false);
      void this.scanNoteTasksInBackground();
    });
    this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new OverviewView(leaf, this));
    this.registerView(TODAY_VIEW_TYPE, (leaf) => new TodayTasksView(leaf, this));
    this.registerView(DIALOG_VIEW_TYPE, (leaf) => new QuickDialogView(leaf, this));
    this.addRibbonIcon("layout-dashboard", "\u6253\u5F00\u9879\u76EE\u603B\u89C8", async () => {
      await this.activateOverviewView();
    });
    this.addRibbonIcon("check-square", "\u6253\u5F00\u4ECA\u65E5\u4EFB\u52A1", async () => {
      await this.activateTodayView();
    });
    this.addRibbonIcon("message-square-plus", "\u6253\u5F00\u5FEB\u901F\u8BB0\u5F55", async () => {
      await this.activateDialogView();
    });
    this.addCommand({
      id: "open-project-overview",
      name: "\u6253\u5F00\u9879\u76EE\u603B\u89C8",
      callback: async () => this.activateOverviewView()
    });
    this.addCommand({
      id: "open-today-tasks",
      name: "\u6253\u5F00\u4ECA\u65E5\u4EFB\u52A1",
      callback: async () => this.activateTodayView()
    });
    this.addCommand({
      id: "open-quick-dialog",
      name: "\u6253\u5F00\u5FEB\u901F\u8BB0\u5F55",
      callback: async () => this.activateDialogView()
    });
    this.addCommand({
      id: "scan-note-tasks",
      name: "\u626B\u63CF\u5168\u5E93\u9879\u76EE\u4EFB\u52A1\u5757",
      callback: async () => this.scanNoteTasksInBackground(true)
    });
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof import_obsidian13.TFile && file.extension === "md") {
          window.setTimeout(() => {
            void this.store.syncNoteFile(file).catch((error) => console.error("Failed to sync note tasks", error));
          }, 600);
        }
      })
    );
    this.addSettingTab(new ProjectManagementSettingTab(this.app, this));
  }
  async onunload() {
    try {
      await this.store?.flushPendingWrites();
    } catch (error) {
      console.error("Failed to flush project management data before unload", error);
    }
    await this.app.workspace.detachLeavesOfType(OVERVIEW_VIEW_TYPE);
    await this.app.workspace.detachLeavesOfType(TODAY_VIEW_TYPE);
    await this.app.workspace.detachLeavesOfType(DIALOG_VIEW_TYPE);
  }
  async updateSettings(patch) {
    const previousSettings = { ...this.settings };
    const nextSettings = { ...this.settings, ...patch };
    this.pendingSettings = {};
    await this.store.setConfig(nextSettings);
    this.settings = this.store.getConfig();
    try {
      await this.savePluginSettings();
    } catch (error) {
      this.settings = previousSettings;
      throw error;
    }
  }
  async loadPluginSettings() {
    const loaded = await this.loadData();
    this.settings = { ...DEFAULT_CONFIG, ...loaded ?? {} };
  }
  async savePluginSettings() {
    await this.saveData(this.settings);
  }
  async activateOverviewView() {
    await this.activateInMainArea(OVERVIEW_VIEW_TYPE);
    void this.refreshStoreFromDisk();
  }
  async activateTodayView() {
    await this.activateInRightSidebar(TODAY_VIEW_TYPE);
    void this.refreshStoreFromDisk();
  }
  async activateDialogView() {
    await this.activateInRightSidebar(DIALOG_VIEW_TYPE);
    void this.refreshStoreFromDisk();
  }
  async activateInMainArea(type) {
    const leaves = this.app.workspace.getLeavesOfType(type);
    const misplacedLeaves = leaves.filter((leaf2) => leaf2.getRoot() === this.app.workspace.rightSplit);
    await Promise.all(misplacedLeaves.map((leaf2) => leaf2.detach()));
    const existingLeaf = leaves.find((leaf2) => leaf2.getRoot() !== this.app.workspace.rightSplit);
    const leaf = existingLeaf ?? this.app.workspace.getLeaf(true);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async activateInRightSidebar(type) {
    const leaves = this.app.workspace.getLeavesOfType(type);
    const misplacedLeaves = leaves.filter((leaf2) => leaf2.getRoot() !== this.app.workspace.rightSplit);
    await Promise.all(misplacedLeaves.map((leaf2) => leaf2.detach()));
    const existingLeaf = leaves.find((leaf2) => leaf2.getRoot() === this.app.workspace.rightSplit);
    const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async refreshStoreFromDisk(notifyOnError = true) {
    if (!this.store) {
      return;
    }
    try {
      await this.store.refreshFromDisk();
      this.settings = this.store.getConfig();
    } catch (error) {
      console.error("Failed to refresh project management data from disk", error);
      if (notifyOnError) {
        new import_obsidian13.Notice(error instanceof Error ? error.message : "\u5237\u65B0\u6570\u636E\u5931\u8D25");
      }
    }
  }
  async scanNoteTasksInBackground(notify = false) {
    if (!this.store) {
      return;
    }
    try {
      const count = await this.store.syncAllNoteTasks();
      if (notify) {
        new import_obsidian13.Notice(`\u5DF2\u540C\u6B65 ${count} \u4E2A\u7B14\u8BB0\u4EFB\u52A1`);
      }
    } catch (error) {
      console.error("Failed to scan note tasks", error);
      if (notify) {
        new import_obsidian13.Notice(error instanceof Error ? error.message : "\u626B\u63CF\u7B14\u8BB0\u4EFB\u52A1\u5931\u8D25");
      }
    }
  }
};
