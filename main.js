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
var import_obsidian9 = require("obsidian");

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
  version: "0.2.0",
  dataFolder: "project-manager-data",
  overviewTab1Name: "\u4EFB\u52A1\u603B\u89C8",
  overviewTab2Name: "\u9879\u76EE\u8FDB\u5EA6",
  weekStartsOn: "monday",
  timeSlotMinutes: 15,
  heatmapRange: "12months",
  showCompletedTasks: true,
  defaultTaskDurationMinutes: 30,
  defaultTaskStartTime: "07:00"
};
var PROJECTS_FILE = "projects.json";
var PROGRESS_FILE = "progress-pages.json";
var CONFIG_FILE = "config.json";
var TASKS_DIR = "tasks";
var ProjectManagementStore = class extends import_obsidian.Events {
  constructor(app, config) {
    super();
    this.projects = [];
    this.progressPages = [];
    this.tasks = /* @__PURE__ */ new Map();
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
      occurrences: this.getAllTaskOccurrences()
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
    await this.flushAll();
  }
  async refreshFromDisk(options = {}) {
    const { triggerChange = true } = options;
    const failedPaths = await this.loadCurrentFolderData();
    if (failedPaths.length > 0) {
      this.readOnlyReason = `\u68C0\u6D4B\u5230\u6570\u636E\u6587\u4EF6\u8BFB\u53D6\u5931\u8D25\uFF0C\u5DF2\u8FDB\u5165\u53EA\u8BFB\u4FDD\u62A4\uFF1A${failedPaths.join("\u3001")}`;
      throw new Error(this.readOnlyReason);
    }
    this.readOnlyReason = null;
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
    if (!abstract) {
      return { ok: true };
    }
    if (!(abstract instanceof import_obsidian.TFolder)) {
      return { ok: false, message: "\u6570\u636E\u76EE\u5F55\u8DEF\u5F84\u5DF2\u88AB\u6587\u4EF6\u5360\u7528" };
    }
    const allowed = /* @__PURE__ */ new Set([CONFIG_FILE, PROJECTS_FILE, PROGRESS_FILE, TASKS_DIR]);
    const invalid = abstract.children.some((child) => !allowed.has(child.name));
    if (invalid) {
      return { ok: false, message: "\u76EE\u5F55\u4E2D\u5B58\u5728\u975E\u63D2\u4EF6\u6587\u4EF6\uFF0C\u62D2\u7EDD\u4F7F\u7528" };
    }
    const invalidTasksPath = abstract.children.some((child) => child.name === TASKS_DIR && !(child instanceof import_obsidian.TFolder));
    if (invalidTasksPath) {
      return { ok: false, message: "tasks \u8DEF\u5F84\u5DF2\u88AB\u6587\u4EF6\u5360\u7528" };
    }
    return { ok: true };
  }
  async createTask(input) {
    this.assertWritable();
    const normalized = this.normalizeTaskInput(input);
    const created = this.buildSeriesTask(normalized);
    this.assertNoConflicts([created], /* @__PURE__ */ new Set());
    this.insertTask(created);
    await this.persistMonths(monthsForTasks([created]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
    return cloneTask(this.findTask(created.id) ?? created);
  }
  async updateTask(taskId, patch, _scope = "series") {
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
      date: patch.date ?? original.date,
      startTime: patch.startTime === void 0 ? original.startTime : patch.startTime,
      endTime: patch.endTime === void 0 ? original.endTime : patch.endTime,
      recurrence: patch.recurrence ?? original.recurrence,
      recurrenceCount: patch.recurrenceCount ?? original.recurrenceCount ?? void 0,
      recurrenceUntil: patch.recurrenceUntil ?? original.recurrenceUntil ?? void 0,
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
      columnOrder: ["title", "recurrence", "schedule", "completion", "description", "actions"],
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
    const slot = this.config.timeSlotMinutes;
    const start = parseTimeToMinutes(startTime);
    const end = parseTimeToMinutes(endTime);
    if (startTime && !endTime || !startTime && endTime) {
      throw new Error("\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u540C\u65F6\u586B\u5199");
    }
    if (start !== null && end !== null) {
      if (start >= end) {
        throw new Error("\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4");
      }
      if (start % slot !== 0 || end % slot !== 0) {
        throw new Error(`\u65F6\u95F4\u5FC5\u987B\u5BF9\u9F50\u5230 ${slot} \u5206\u949F\u7C92\u5EA6`);
      }
    }
    const recurrence = input.recurrence ?? "once";
    const kind = input.kind ?? "simple";
    const recurrenceCount = recurrence === "once" ? null : normalizePositiveInteger(input.recurrenceCount);
    const recurrenceUntil = recurrence === "once" ? null : normalizeDateOrUndefined(input.recurrenceUntil);
    const subtasks = normalizeSubtaskInputs(input.subtasks, kind);
    if (recurrence !== "once" && !recurrenceCount && !recurrenceUntil) {
      throw new Error("\u91CD\u590D\u4EFB\u52A1\u5FC5\u987B\u586B\u5199\u91CD\u590D\u6B21\u6570\u6216\u7ED3\u675F\u65E5\u671F");
    }
    if (recurrenceUntil && compareDateKeys(recurrenceUntil, date) < 0) {
      throw new Error("\u91CD\u590D\u7ED3\u675F\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u9996\u4E2A\u4EFB\u52A1\u65E5\u671F");
    }
    return {
      kind,
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || void 0,
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
  buildSeriesTask(input, original, completedPatch) {
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
  async loadTasks() {
    const tasksFolder = this.pathFor(TASKS_DIR);
    const folder = this.app.vault.getAbstractFileByPath(tasksFolder);
    if (!(folder instanceof import_obsidian.TFolder)) {
      this.tasks.clear();
      return { failedPaths: [] };
    }
    this.tasks.clear();
    const failedPaths = [];
    for (const child of folder.children) {
      if (child instanceof import_obsidian.TFolder || !child.name.endsWith(".json")) {
        continue;
      }
      const data = await this.readJson(child.path, isTasksFile);
      const month = child.name.replace(/\.json$/, "");
      if (!data.ok) {
        failedPaths.push(child.path);
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
    return [...configResult.failedPaths, ...projectResult.failedPaths, ...progressResult.failedPaths, ...taskResult.failedPaths].filter(
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
    try {
      await this.app.vault.createFolder(normalized);
    } catch (error) {
      const current = this.app.vault.getAbstractFileByPath(normalized);
      if (current instanceof import_obsidian.TFolder && isFolderAlreadyExistsError(error)) {
        return;
      }
      throw error;
    }
  }
  async readJson(path, validate, notifyOnError = true) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      return { ok: true, value: null };
    }
    try {
      const raw = await this.app.vault.cachedRead(file);
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
      await this.app.vault.create(normalized, payload);
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
      ...collectMonthFiles(this.app, this.pathFor(TASKS_DIR))
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
      tasks: new Map([...this.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)]))
    };
  }
  restoreDataState(state) {
    this.projects = state.projects.map((project) => ({ ...project }));
    this.progressPages = state.progressPages.map((page) => ({ ...page, columnOrder: [...page.columnOrder] }));
    this.tasks = new Map([...state.tasks.entries()].map(([month, tasks]) => [month, tasks.map(cloneTask)]));
  }
  async inspectDataFolder(folder) {
    const normalized = (0, import_obsidian.normalizePath)(sanitizeFolder(folder));
    const abstract = this.app.vault.getAbstractFileByPath(normalized);
    if (!abstract || !(abstract instanceof import_obsidian.TFolder)) {
      return { hasData: false, invalidPaths: [] };
    }
    const invalidPaths = [];
    let hasData = false;
    const check = async (path, validate) => {
      if (!this.app.vault.getAbstractFileByPath(path)) {
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
    const tasksPath = this.pathInFolder(folder, TASKS_DIR);
    const tasksFolder = this.app.vault.getAbstractFileByPath(tasksPath);
    if (tasksFolder && !(tasksFolder instanceof import_obsidian.TFolder)) {
      hasData = true;
      invalidPaths.push(tasksPath);
    } else if (tasksFolder instanceof import_obsidian.TFolder) {
      for (const child of tasksFolder.children) {
        if (child instanceof import_obsidian.TFolder || !child.name.endsWith(".json")) {
          continue;
        }
        hasData = true;
        const result = await this.readJson(child.path, isTasksFile, false);
        if (!result.ok) {
          invalidPaths.push(child.path);
        }
      }
    }
    return { hasData, invalidPaths };
  }
};
function normalizeStoredTask(task) {
  const kind = task.kind ?? ((task.subtasks?.length ?? 0) > 0 ? "composite" : "simple");
  const subtasks = (task.subtasks ?? []).map((item) => ({ id: item.id, title: item.title }));
  const legacyStates = (task.completedOccurrences ?? []).map(
    (item) => buildNormalizedOccurrenceState(item.date, kind, subtasks, subtasks.map((subtask) => subtask.id), item.completedAt)
  );
  const occurrenceStates = (task.occurrenceStates ?? legacyStates).map(
    (item) => buildNormalizedOccurrenceState(item.date, kind, subtasks, item.completedSubtaskIds ?? subtasks.map((subtask) => subtask.id), item.completedAt ?? null)
  );
  return {
    ...task,
    kind,
    subtasks,
    occurrenceStates
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
    }))
  };
}
function expandTask(task) {
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
function buildOccurrenceDates(input) {
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
  const normalized = (subtasks ?? []).map((item) => ({ id: item.id, title: item.title.trim() })).filter((item) => item.title.length > 0);
  if (normalized.length === 0) {
    throw new Error("\u7EC4\u5408\u4EFB\u52A1\u81F3\u5C11\u9700\u8981\u4E00\u4E2A\u5B50\u4EFB\u52A1");
  }
  return normalized;
}
function resolveTaskSubtasks(inputSubtasks, kind, originalSubtasks) {
  if (kind === "simple") {
    return [];
  }
  return (inputSubtasks ?? []).map((item) => {
    const original = item.id ? originalSubtasks.find((entry) => entry.id === item.id) : void 0;
    return {
      id: original?.id ?? item.id ?? crypto.randomUUID(),
      title: item.title.trim()
    };
  });
}
function getOccurrenceState(task, date) {
  return task?.occurrenceStates.find((item) => item.date === date);
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
function collectMonthFiles(app, tasksFolder) {
  const folder = app.vault.getAbstractFileByPath(tasksFolder);
  if (!(folder instanceof import_obsidian.TFolder)) {
    return [];
  }
  return folder.children.filter((child) => !(child instanceof import_obsidian.TFolder) && child.name.endsWith(".json")).map((child) => child.name.replace(/\.json$/, ""));
}
function sanitizeFolder(value) {
  return value.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}
function isFolderAlreadyExistsError(error) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message.toLowerCase();
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
function randomColor() {
  const palette = ["#3d8bfd", "#0f9d58", "#ff8c42", "#d64550", "#8a5cf6", "#188fa7"];
  return palette[Math.floor(Math.random() * palette.length)];
}

// src/settings.ts
var import_obsidian2 = require("obsidian");
var ProjectManagementSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "\u9879\u76EE\u7BA1\u7406\u63D2\u4EF6\u8BBE\u7F6E" });
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

// src/views/overviewView.ts
var import_obsidian7 = require("obsidian");

// src/components/dayTasksModal.ts
var import_obsidian3 = require("obsidian");
var DayTasksModal = class extends import_obsidian3.Modal {
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

// src/components/projectModal.ts
var import_obsidian4 = require("obsidian");
var ProjectModal = class extends import_obsidian4.Modal {
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
    new import_obsidian4.Setting(contentEl).setName("\u9879\u76EE\u540D\u79F0").addText(
      (text) => text.setValue(state.name ?? "").onChange((value) => {
        state.name = value;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u9879\u76EE\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u9879\u76EE\u989C\u8272").addText(
      (text) => text.setPlaceholder("#4f8cff").setValue(state.color ?? "").onChange((value) => {
        state.color = value;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u9879\u76EE\u72B6\u6001").addDropdown((dropdown) => {
      const statuses = ["active", "paused", "completed", "archived"];
      statuses.forEach((status) => dropdown.addOption(status, status));
      dropdown.setValue(state.status ?? "active");
      dropdown.onChange((value) => {
        state.status = value;
      });
    });
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian4.ButtonComponent(footer).setButtonText("\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(state);
        this.close();
      } catch (error) {
        new import_obsidian4.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    if (this.options.onDelete) {
      new import_obsidian4.ButtonComponent(footer).setButtonText("\u5220\u9664\u9879\u76EE").setWarning().onClick(async () => {
        await this.options.onDelete?.();
        this.close();
      });
    }
  }
};

// src/components/taskModal.ts
var import_obsidian5 = require("obsidian");
var TaskModal = class extends import_obsidian5.Modal {
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
    const saveScope = "series";
    if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      contentEl.createDiv({
        cls: "pm-muted",
        text: this.options.occurrenceContext ? `\u5F53\u524D\u6B63\u5728\u67E5\u770B ${this.options.occurrenceContext.occurrenceDate} \u8FD9\u6B21\u53D1\u751F\uFF0C\u4F46\u4FDD\u5B58\u4F1A\u66F4\u65B0\u6574\u6761\u91CD\u590D\u4EFB\u52A1\u3002` : "\u5F53\u524D\u7F16\u8F91\u7684\u662F\u6574\u6761\u91CD\u590D\u4EFB\u52A1\uFF0C\u4E0B\u9762\u7684\u65E5\u671F\u4E0E\u91CD\u590D\u89C4\u5219\u4F1A\u4E00\u8D77\u66F4\u65B0\u5168\u90E8\u53D1\u751F\u65F6\u95F4\u3002"
      });
    }
    new import_obsidian5.Setting(contentEl).setName("\u6807\u9898").addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u4EFB\u52A1\u6807\u9898").setValue(state.title).onChange((value) => {
        state.title = value;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("\u4EFB\u52A1\u7C7B\u578B").setDesc("\u666E\u901A\u4EFB\u52A1\u76F4\u63A5\u52FE\u9009\u5B8C\u6210\uFF1B\u7EC4\u5408\u4EFB\u52A1\u53EF\u62C6\u6210\u591A\u4E2A\u5B50\u4EFB\u52A1\u5206\u522B\u5B8C\u6210").addDropdown((dropdown) => {
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
    new import_obsidian5.Setting(contentEl).setName("\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("\u65E5\u671F").addText(
      (text) => text.setPlaceholder("YYYY-MM-DD").setValue(state.date).onChange((value) => {
        state.date = value;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("\u5F00\u59CB\u65F6\u95F4").addText(
      (text) => text.setPlaceholder("07:00").setValue(state.startTime ?? "").onChange((value) => {
        state.startTime = value || void 0;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("\u7ED3\u675F\u65F6\u95F4").addText(
      (text) => text.setPlaceholder("07:30").setValue(state.endTime ?? "").onChange((value) => {
        state.endTime = value || void 0;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("\u6240\u5C5E\u9879\u76EE").addDropdown((dropdown) => {
      dropdown.addOption("", "\u672A\u5F52\u5C5E\u9879\u76EE");
      this.options.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.setValue(state.projectId ?? "");
      dropdown.onChange((value) => {
        state.projectId = value || void 0;
      });
    });
    new import_obsidian5.Setting(contentEl).setName("\u91CD\u590D\u7C7B\u578B").setDesc("\u5355\u6B21\u3001\u6BCF\u65E5\u91CD\u590D\u3001\u6BCF\u5468\u6B64\u65F6\u91CD\u590D").addDropdown((dropdown) => {
      const labels = {
        once: "\u5355\u6B21\u4EFB\u52A1",
        daily: "\u6BCF\u65E5\u91CD\u590D",
        weekly: "\u6BCF\u5468\u6B64\u65F6\u91CD\u590D"
      };
      Object.keys(labels).forEach((key) => dropdown.addOption(key, labels[key]));
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
      new import_obsidian5.Setting(recurrenceFields).setName("\u91CD\u590D\u6B21\u6570").setDesc("\u91CD\u590D\u4EFB\u52A1\u81F3\u5C11\u586B\u5199\u6B21\u6570\u6216\u7ED3\u675F\u65E5\u671F\u4E4B\u4E00").addText(
        (text) => text.setPlaceholder("\u4F8B\u5982 10").setValue(state.recurrenceCount ? String(state.recurrenceCount) : "").onChange((value) => {
          state.recurrenceCount = value.trim() ? Number(value) : null;
        })
      );
      new import_obsidian5.Setting(recurrenceFields).setName("\u91CD\u590D\u7ED3\u675F\u65E5\u671F").addText(
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
    new import_obsidian5.ButtonComponent(footer).setButtonText("\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(state, saveScope);
        this.close();
      } catch (error) {
        new import_obsidian5.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    if (this.options.onDelete) {
      if (this.options.allowSingleDelete) {
        new import_obsidian5.ButtonComponent(footer).setButtonText("\u5220\u9664\u672C\u6B21\u5B9E\u4F8B").setWarning().onClick(async () => {
          await this.options.onDelete?.("single");
          this.close();
        });
      }
      if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
        new import_obsidian5.ButtonComponent(footer).setButtonText("\u5220\u9664\u6574\u4E2A\u7CFB\u5217").setWarning().onClick(async () => {
          await this.options.onDelete?.("series");
          this.close();
        });
      }
    }
    if (this.options.onCompleteSeries && this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      new import_obsidian5.ButtonComponent(footer).setButtonText("\u5230\u672C\u6B21\u4E3A\u6B62\u7ED3\u675F\u91CD\u590D").onClick(async () => {
        await this.options.onCompleteSeries?.();
        this.close();
      });
    }
  }
};

// src/views/base.ts
var import_obsidian6 = require("obsidian");
var BaseProjectView = class extends import_obsidian6.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  async onOpen() {
    this.registerEvent(this.plugin.store.on("changed", () => this.render()));
    await this.render();
  }
};

// src/views/overviewView.ts
var OVERVIEW_VIEW_TYPE = "project-management-overview-view";
var OverviewView = class extends BaseProjectView {
  constructor(leaf, plugin) {
    super(leaf, plugin);
    this.activePrimaryTab = "activity";
    this.selectedProjectId = null;
    this.weekAnchor = now();
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
  async render() {
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
          new import_obsidian7.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
    }
    top.createSpan({ text: task.title, cls: "pm-task-title" });
    top.createSpan({ text: recurrenceLabel2(task.recurrence), cls: "pm-tag" });
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
    const actions = card.createDiv({ cls: "pm-task-actions" });
    actions.createEl("button", { text: "\u7F16\u8F91" }).addEventListener("click", () => this.openEditOccurrenceModal(task));
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
          new import_obsidian7.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
    });
  }
  renderProjectsTab(container, pages, projects, allTasks) {
    const header = container.createDiv({ cls: "pm-page-header" });
    const headerCopy = header.createDiv();
    headerCopy.createEl("h3", { text: "\u9879\u76EE\u8FDB\u5EA6\u9875" });
    headerCopy.createDiv({ cls: "pm-muted", text: "\u91CD\u590D\u4EFB\u52A1\u5728\u8FD9\u91CC\u6309\u7CFB\u5217\u663E\u793A\u4E3A\u5355\u884C\uFF0C\u53D1\u751F\u6B21\u6570\u4E0E\u5B8C\u6210\u8FDB\u5EA6\u96C6\u4E2D\u5C55\u793A\u3002" });
    header.createEl("button", { text: "\u65B0\u589E\u9879\u76EE", cls: "mod-cta" }).addEventListener("click", () => {
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
        }
      }).open();
    });
    const tabs = container.createDiv({ cls: "pm-secondary-tabs" });
    pages.forEach((page) => {
      const button = tabs.createDiv({ cls: `pm-secondary-tab ${this.selectedProjectId === page.projectId ? "is-active" : ""}` });
      button.createSpan({ text: page.name });
      const actions = button.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "\u2191" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, -1);
      });
      actions.createEl("button", { text: "\u2193" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, 1);
      });
      actions.createEl("button", { text: "\u7F16\u8F91" }).addEventListener("click", (event) => {
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
    const body = container.createDiv({ cls: "pm-section" });
    const top = body.createDiv({ cls: "pm-page-header" });
    const title = top.createDiv();
    title.createEl("h3", { text: project.name });
    title.createDiv({ cls: "pm-muted", text: project.description || "\u9879\u76EE\u7EA7\u4EFB\u52A1\u96C6\u4E2D\u7BA1\u7406\u89C6\u56FE\uFF0C\u53EF\u76F4\u63A5\u7EF4\u62A4\u91CD\u590D\u4EFB\u52A1\u7CFB\u5217\u3002" });
    top.createEl("button", { text: "\u65B0\u589E\u4EFB\u52A1", cls: "mod-cta" }).addEventListener("click", () => {
      this.openCreateTaskModal("\u65B0\u589E\u9879\u76EE\u4EFB\u52A1", projects, {
        title: "",
        description: "",
        projectId: project.id,
        date: toDateKey(now()),
        recurrence: "once",
        completed: false,
        ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
      });
    });
    body.createDiv({ cls: "pm-progress-bar" }).createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${this.plugin.store.getProjectProgress(project.id)}%` }
    });
    body.createDiv({ cls: "pm-muted", text: `\u8FDB\u5EA6 ${this.plugin.store.getProjectProgress(project.id)}%` });
    const table = body.createEl("table", { cls: "pm-table" });
    const head = table.createEl("thead");
    const headRow = head.createEl("tr");
    ["\u4EFB\u52A1\u540D\u79F0", "\u91CD\u590D", "\u8BA1\u5212", "\u5B8C\u6210", "\u63CF\u8FF0", "\u64CD\u4F5C"].forEach((label) => headRow.createEl("th", { text: label }));
    const bodyEl = table.createEl("tbody");
    const tasks = allTasks.filter((task) => task.projectId === project.id).sort(compareSeriesTasks2);
    if (tasks.length === 0) {
      const row = bodyEl.createEl("tr");
      const cell = row.createEl("td", { text: "\u6682\u65E0\u4EFB\u52A1" });
      cell.colSpan = 6;
      return;
    }
    tasks.forEach((task) => {
      const row = bodyEl.createEl("tr");
      row.createEl("td", { text: task.title });
      row.createEl("td", { text: recurrenceLabel2(task.recurrence) });
      row.createEl("td", { text: scheduleSummary(task) });
      row.createEl("td", { text: completionSummary(task) });
      row.createEl("td", { text: task.description || "-" });
      const actionCell = row.createEl("td");
      actionCell.createEl("button", { text: "\u8BE6\u7EC6\u7F16\u8F91" }).addEventListener("click", () => this.openEditTaskModal(task));
    });
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
      onSubmit: async (input) => {
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
  return "\u5355\u6B21\u4EFB\u52A1";
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
function scheduleSummary(task) {
  const total = task.occurrenceDates.length;
  const range = total > 1 ? `${task.occurrenceDates[0]} -> ${task.occurrenceDates[total - 1]}` : task.date;
  const time = task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F";
  return `${range} | ${time} | \u5171 ${total} \u6B21`;
}
function completionSummary(task) {
  const totalSteps = task.kind === "composite" ? task.occurrenceDates.length * task.subtasks.length : task.occurrenceDates.length;
  const completedSteps = task.kind === "composite" ? task.occurrenceStates.reduce((sum, state) => sum + (state.completedSubtaskIds?.length ?? 0), 0) : task.occurrenceStates.length;
  const ratio = totalSteps === 0 ? 0 : Math.round(completedSteps / totalSteps * 100);
  const label = task.kind === "composite" ? "\u5B50\u4EFB\u52A1" : "\u6B21";
  return `${completedSteps}/${totalSteps} ${label} \xB7 ${ratio}%`;
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
var import_obsidian8 = require("obsidian");
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
    const visibleTasks = this.plugin.settings.showCompletedTasks ? tasks : tasks.filter((task) => !task.completed);
    const totalSteps = tasks.reduce((sum, task) => sum + task.totalSteps, 0);
    const completedSteps = tasks.reduce((sum, task) => sum + task.completedSteps, 0);
    const progress = totalSteps === 0 ? 0 : Math.round(completedSteps / totalSteps * 100);
    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "\u4ECA\u65E5\u4EFB\u52A1" });
    title.createDiv({ text: today, cls: "pm-muted" });
    const addButton = header.createEl("button", { text: "\u65B0\u589E\u4EFB\u52A1", cls: "mod-cta" });
    addButton.addEventListener("click", () => {
      const suggested = this.plugin.store.getSuggestedTaskWindow(today);
      new TaskModal(this.app, {
        title: "\u65B0\u589E\u4ECA\u65E5\u4EFB\u52A1",
        projects,
        initial: {
          title: "",
          description: "",
          date: today,
          recurrence: "once",
          completed: false,
          ...suggested
        },
        onSubmit: async (input) => {
          await this.plugin.store.createTask(input);
        }
      }).open();
    });
    const progressSection = container.createDiv({ cls: "pm-section" });
    progressSection.createEl("h3", { text: "\u4ECA\u65E5\u8FDB\u5EA6" });
    if (tasks.length === 0) {
      progressSection.createDiv({ cls: "pm-empty", text: "\u4ECA\u5929\u8FD8\u6CA1\u6709\u4EFB\u52A1\uFF0C\u5148\u65B0\u589E\u4E00\u6761\u5F00\u59CB\u5427\u3002" });
    } else {
      progressSection.createDiv({ cls: "pm-muted", text: `${completedSteps} / ${totalSteps} \u6B65 \xB7 ${progress}%` });
      progressSection.createDiv({ cls: "pm-progress-bar" }).createDiv({
        cls: "pm-progress-bar-fill",
        attr: { style: `width: ${progress}%` }
      });
    }
    const incomplete = visibleTasks.filter((task) => !task.completed);
    const complete = visibleTasks.filter((task) => task.completed);
    this.renderTaskSection(container, "\u672A\u5B8C\u6210", incomplete);
    this.renderTaskSection(container, "\u5DF2\u5B8C\u6210", complete);
  }
  renderTaskSection(container, title, tasks) {
    const section = container.createDiv({ cls: "pm-section" });
    section.createEl("h3", { text: `${title} (${tasks.length})` });
    if (tasks.length === 0) {
      section.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u4EFB\u52A1" });
      return;
    }
    const list = section.createDiv({ cls: "pm-task-list" });
    tasks.forEach((task) => {
      const row = list.createDiv({ cls: `pm-task-row ${task.kind === "composite" ? "is-composite" : ""}` });
      const left = row.createDiv({ cls: "pm-task-main" });
      if (task.kind === "simple") {
        const checkbox = left.createEl("input", { type: "checkbox" });
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", async () => {
          try {
            await this.plugin.store.updateTaskOccurrenceCompletion(task.taskId, task.date, checkbox.checked);
          } catch (error) {
            checkbox.checked = !checkbox.checked;
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
          }
        });
      }
      const info = left.createDiv({ cls: "pm-task-copy" });
      info.createEl("div", { text: task.title, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = info.createDiv({ cls: "pm-task-meta" });
      meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F" });
      meta.createSpan({ text: recurrenceLabel3(task) });
      const project = this.plugin.store.getProject(task.projectId);
      meta.createSpan({ text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
      if (task.kind === "composite") {
        meta.createSpan({ text: `${task.completedSteps}/${task.totalSteps} \u5B50\u4EFB\u52A1` });
      }
      this.renderSubtasks(info, task);
      const actions = row.createDiv({ cls: "pm-task-actions" });
      actions.createEl("button", { text: "\u7F16\u8F91" }).addEventListener("click", () => this.openEditor(task));
      actions.createEl("button", { text: "\u5220\u9664", cls: "mod-warning" }).addEventListener("click", async () => {
        await this.plugin.store.deleteTaskOccurrence(task.taskId, task.date);
      });
      if (task.recurrence !== "once") {
        actions.createEl("button", { text: "\u63D0\u524D\u7ED3\u675F\u7CFB\u5217" }).addEventListener("click", async () => {
          await this.plugin.store.completeTaskSeries(task.taskId, task.date);
        });
      }
    });
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
      onSubmit: async (input) => {
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
          new import_obsidian8.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
    });
  }
};
function recurrenceLabel3(task) {
  if (task.recurrence === "daily") {
    return "\u6BCF\u65E5\u91CD\u590D";
  }
  if (task.recurrence === "weekly") {
    return "\u6BCF\u5468\u6B64\u65F6\u91CD\u590D";
  }
  return "\u5355\u6B21\u4EFB\u52A1";
}
function isTaskSeriesCompleted2(task) {
  if (task.occurrenceDates.length === 0) {
    return false;
  }
  const allSubtaskIds = new Set(task.subtasks.map((item) => item.id));
  return task.occurrenceDates.every((date) => {
    const state = task.occurrenceStates.find((item) => item.date === date);
    if (task.kind === "simple") {
      return Boolean(state);
    }
    const completedIds = new Set(state?.completedSubtaskIds ?? []);
    return task.subtasks.every((subtask) => completedIds.has(subtask.id)) && completedIds.size === allSubtaskIds.size;
  });
}

// src/main.ts
var ProjectManagementPlugin = class extends import_obsidian9.Plugin {
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
      new import_obsidian9.Notice(error instanceof Error ? error.message : "\u63D2\u4EF6\u521D\u59CB\u5316\u5931\u8D25");
    }
    this.app.workspace.onLayoutReady(() => {
      void this.refreshStoreFromDisk(false);
    });
    this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new OverviewView(leaf, this));
    this.registerView(TODAY_VIEW_TYPE, (leaf) => new TodayTasksView(leaf, this));
    this.addRibbonIcon("layout-dashboard", "\u6253\u5F00\u9879\u76EE\u603B\u89C8", async () => {
      await this.activateOverviewView();
    });
    this.addRibbonIcon("check-square", "\u6253\u5F00\u4ECA\u65E5\u4EFB\u52A1", async () => {
      await this.activateTodayView();
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
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u5237\u65B0\u6570\u636E\u5931\u8D25");
      }
    }
  }
};
