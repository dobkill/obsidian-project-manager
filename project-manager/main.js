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
function formatWeekColumnTitle(date) {
  return `${getChineseWeekday(date)} ${toDateKey(date)}`;
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
    this.config = structuredClone(next);
    await this.ensureDataFolder();
    await this.enqueueWrite(() => this.writeJson(this.pathFor(CONFIG_FILE), this.config));
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
    this.config = await this.loadConfigFile();
    await this.ensureDataFolder();
    await this.loadProjects();
    await this.loadProgressPages();
    await this.loadTasks();
    await this.flushAll();
  }
  async validateDataFolder(path) {
    const cleaned = sanitizeFolder(path);
    if (!cleaned) {
      return { ok: false, message: "\u6570\u636E\u76EE\u5F55\u4E0D\u80FD\u4E3A\u7A7A" };
    }
    if (cleaned.startsWith("/") || cleaned.includes("..")) {
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
    return { ok: true };
  }
  async createTask(input) {
    const normalized = this.normalizeTaskInput(input);
    const created = this.buildSeriesTask(normalized);
    this.assertNoConflicts([created], /* @__PURE__ */ new Set());
    this.insertTask(created);
    await this.persistMonths(monthsForTasks([created]));
    this.trigger("changed");
    return cloneTask(created);
  }
  async updateTask(taskId, patch, _scope = "series") {
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const merged = this.normalizeTaskInput({
      title: patch.title ?? original.title,
      description: patch.description ?? original.description,
      projectId: patch.projectId === void 0 ? original.projectId : patch.projectId,
      date: patch.date ?? original.date,
      startTime: patch.startTime === void 0 ? original.startTime : patch.startTime,
      endTime: patch.endTime === void 0 ? original.endTime : patch.endTime,
      recurrence: patch.recurrence ?? original.recurrence,
      recurrenceCount: patch.recurrenceCount ?? original.recurrenceCount ?? void 0,
      recurrenceUntil: patch.recurrenceUntil ?? original.recurrenceUntil ?? void 0,
      completed: patch.completed ?? isTaskFullyCompleted(original)
    });
    const next = this.buildSeriesTask(merged, original, patch.completed);
    this.assertNoConflicts([next], occurrenceKeysForTask(original));
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    this.trigger("changed");
    return cloneTask(next);
  }
  async updateTaskOccurrenceCompletion(taskId, date, completed) {
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    if (!original.occurrenceDates.includes(date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const next = cloneTask(original);
    next.completedOccurrences = completed ? upsertCompletionRecord(original.completedOccurrences, date, toIsoLocal(now())) : original.completedOccurrences.filter((item) => item.date !== date);
    next.updatedAt = toIsoLocal(now());
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    this.trigger("changed");
  }
  async deleteTask(taskId, scope = "series") {
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
  async deleteTaskOccurrence(taskId, date) {
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
  async completeTaskSeries(taskId, throughDate) {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    const effectiveDate = throughDate ?? task.occurrenceDates[task.occurrenceDates.length - 1];
    const next = cloneTask(task);
    const remainingDates = task.occurrenceDates.filter((date) => compareDateKeys(date, effectiveDate) <= 0);
    const stamp = toIsoLocal(now());
    next.occurrenceDates = remainingDates;
    next.completedOccurrences = remainingDates.reduce((records, date) => {
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
  async createProject(input) {
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
    this.trigger("changed");
    return { ...project };
  }
  async updateProject(projectId, patch) {
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
    this.trigger("changed");
  }
  async deleteProject(projectId) {
    this.projects = this.projects.filter((project) => project.id !== projectId);
    this.progressPages = this.progressPages.filter((page) => page.projectId !== projectId);
    const timestamp = toIsoLocal(now());
    const tasks = this.getTasksForProject(projectId).map((task) => ({
      ...task,
      projectId: void 0,
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
  async reorderProgressPage(projectId, direction) {
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
  getProjectProgress(projectId) {
    const tasks = this.getOccurrencesForProject(projectId);
    if (tasks.length === 0) {
      return 0;
    }
    const done = tasks.filter((task) => task.completed).length;
    return Math.round(done / tasks.length * 100);
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
    const recurrenceCount = recurrence === "once" ? null : normalizePositiveInteger(input.recurrenceCount);
    const recurrenceUntil = recurrence === "once" ? null : normalizeDateOrUndefined(input.recurrenceUntil);
    if (recurrence !== "once" && !recurrenceCount && !recurrenceUntil) {
      throw new Error("\u91CD\u590D\u4EFB\u52A1\u5FC5\u987B\u586B\u5199\u91CD\u590D\u6B21\u6570\u6216\u7ED3\u675F\u65E5\u671F");
    }
    if (recurrenceUntil && compareDateKeys(recurrenceUntil, date) < 0) {
      throw new Error("\u91CD\u590D\u7ED3\u675F\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u9996\u4E2A\u4EFB\u52A1\u65E5\u671F");
    }
    return {
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || void 0,
      date,
      startTime,
      endTime,
      recurrence,
      recurrenceCount,
      recurrenceUntil,
      completed: input.completed ?? false
    };
  }
  buildSeriesTask(input, original, completedPatch) {
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
    const existing = await this.readJson(path);
    return { ...DEFAULT_CONFIG, ...existing };
  }
  async loadProjects() {
    const data = await this.readJson(this.pathFor(PROJECTS_FILE));
    this.projects = data?.projects ?? [];
  }
  async loadProgressPages() {
    const data = await this.readJson(this.pathFor(PROGRESS_FILE));
    this.progressPages = data?.pages ?? [];
  }
  async loadTasks() {
    const tasksFolder = this.pathFor(TASKS_DIR);
    const folder = this.app.vault.getAbstractFileByPath(tasksFolder);
    if (!(folder instanceof import_obsidian.TFolder)) {
      this.tasks.clear();
      return;
    }
    this.tasks.clear();
    for (const child of folder.children) {
      if (child instanceof import_obsidian.TFolder || !child.name.endsWith(".json")) {
        continue;
      }
      const data = await this.readJson(child.path);
      const month = child.name.replace(/\.json$/, "");
      this.tasks.set(month, (data?.tasks ?? []).map(cloneTask));
    }
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
    return (0, import_obsidian.normalizePath)(`${sanitizeFolder(this.config.dataFolder)}/${child}`);
  }
  async ensureFolder(path) {
    const normalized = (0, import_obsidian.normalizePath)(path);
    if (!this.app.vault.getAbstractFileByPath(normalized)) {
      await this.app.vault.createFolder(normalized);
    }
  }
  async readJson(path) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file) {
      return null;
    }
    try {
      const raw = await this.app.vault.cachedRead(file);
      return JSON.parse(raw);
    } catch (error) {
      console.error("Failed to read JSON file", path, error);
      new import_obsidian.Notice(`\u8BFB\u53D6\u6570\u636E\u5931\u8D25: ${path}`);
      return null;
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
    this.writeQueue = this.writeQueue.then(job);
    return this.writeQueue;
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
};
function cloneTask(task) {
  return {
    ...task,
    occurrenceDates: [...task.occurrenceDates],
    completedOccurrences: task.completedOccurrences.map((item) => ({ ...item }))
  };
}
function expandTask(task) {
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
function resolveCompletedOccurrences(params) {
  const { input, original, occurrenceDates, timestamp, completedPatch } = params;
  if (completedPatch === true || original === void 0 && input.completed) {
    return occurrenceDates.map((date) => ({ date, completedAt: timestamp }));
  }
  if (completedPatch === false) {
    return [];
  }
  const existing = new Map((original?.completedOccurrences ?? []).map((item) => [item.date, item.completedAt]));
  return occurrenceDates.filter((date) => existing.has(date)).map((date) => ({ date, completedAt: existing.get(date) }));
}
function upsertCompletionRecord(records, date, completedAt) {
  const existing = records.find((item) => item.date === date);
  if (existing) {
    return records.map((item) => item.date === date ? { ...item, completedAt } : { ...item });
  }
  return [...records.map((item) => ({ ...item })), { date, completedAt }];
}
function buildOccurrenceKey(taskId, date) {
  return `${taskId}::${date}`;
}
function occurrenceKeysForTask(task) {
  return new Set(task.occurrenceDates.map((date) => buildOccurrenceKey(task.id, date)));
}
function isTaskFullyCompleted(task) {
  return task.occurrenceDates.length > 0 && task.completedOccurrences.length === task.occurrenceDates.length;
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
    new import_obsidian2.Setting(containerEl).setName("\u6570\u636E\u76EE\u5F55\u8DEF\u5F84").setDesc("\u5FC5\u987B\u662F\u5F53\u524D Vault \u5185\u76F8\u5BF9\u8DEF\u5F84\u3002\u76EE\u5F55\u4E0D\u5B58\u5728\u4F1A\u81EA\u52A8\u521B\u5EFA\uFF0C\u76EE\u5F55\u5185\u5B58\u5728\u975E\u63D2\u4EF6\u6587\u4EF6\u4F1A\u62D2\u7EDD\u4F7F\u7528\u3002").addText(
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
      });
    });
    new import_obsidian5.Setting(contentEl).setName("\u91CD\u590D\u6B21\u6570").setDesc("\u91CD\u590D\u4EFB\u52A1\u81F3\u5C11\u586B\u5199\u6B21\u6570\u6216\u7ED3\u675F\u65E5\u671F\u4E4B\u4E00").addText(
      (text) => text.setPlaceholder("\u4F8B\u5982 10").setValue(state.recurrenceCount ? String(state.recurrenceCount) : "").onChange((value) => {
        state.recurrenceCount = value.trim() ? Number(value) : null;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("\u91CD\u590D\u7ED3\u675F\u65E5\u671F").addText(
      (text) => text.setPlaceholder("YYYY-MM-DD").setValue(state.recurrenceUntil ?? "").onChange((value) => {
        state.recurrenceUntil = value.trim() || null;
      })
    );
    new import_obsidian5.Setting(contentEl).setName("\u5B8C\u6210\u72B6\u6001").addToggle(
      (toggle) => toggle.setValue(Boolean(state.completed)).onChange((value) => {
        state.completed = value;
      })
    );
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
      new import_obsidian5.ButtonComponent(footer).setButtonText("\u5220\u9664\u672C\u6B21").setWarning().onClick(async () => {
        await this.options.onDelete?.("single");
        this.close();
      });
      if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
        new import_obsidian5.ButtonComponent(footer).setButtonText(this.options.occurrenceContext ? "\u5220\u9664\u6574\u4E2A\u4EFB\u52A1" : "\u5220\u9664\u6574\u4E2A\u4EFB\u52A1").setWarning().onClick(async () => {
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
    left.createEl("h3", { text: "\u5468\u4EFB\u52A1\u56FE" });
    left.createDiv({ cls: "pm-muted", text: `${formatWeekColumnTitle(getWeekDates(this.weekAnchor)[0])} \u5F00\u59CB` });
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
    const chart = container.createDiv({ cls: "pm-line-chart" });
    const svg = chart.createSvg("svg", {
      attr: {
        viewBox: "0 0 900 240",
        preserveAspectRatio: "none",
        "aria-label": "\u6700\u8FD1 30 \u5929\u4EFB\u52A1\u8D8B\u52BF\u56FE"
      }
    });
    svg.createSvg("polyline", { attr: { points: dailyTotals.map((item, index) => toChartPoint(index, item.total, max)).join(" "), class: "pm-line-chart-total" } });
    svg.createSvg("polyline", { attr: { points: dailyTotals.map((item, index) => toChartPoint(index, item.completed, max)).join(" "), class: "pm-line-chart-completed" } });
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
      const title = column.createDiv({ cls: "pm-week-day-title" });
      title.createSpan({ text: formatWeekColumnTitle(date) });
      if (isToday(key)) {
        title.createSpan({ text: "\u4ECA\u5929", cls: "pm-tag pm-tag-today" });
      }
      column.createEl("button", { text: "\u65B0\u589E\u4EFB\u52A1", cls: "mod-cta" }).addEventListener("click", () => {
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
        column.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u4EFB\u52A1" });
        return;
      }
      const list = column.createDiv({ cls: "pm-week-day-list" });
      dayTasks.forEach((task) => this.renderWeekTaskCard(list, task));
    });
  }
  renderWeekTaskCard(container, task) {
    const project = this.plugin.store.getProject(task.projectId);
    const card = container.createDiv({ cls: `pm-week-task ${task.completed ? "is-complete" : ""}` });
    if (project?.color) {
      card.style.borderLeftColor = project.color;
    }
    const top = card.createDiv({ cls: "pm-week-task-top" });
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
    top.createSpan({ text: task.title, cls: "pm-task-title" });
    top.createSpan({ text: recurrenceLabel2(task.recurrence), cls: "pm-tag" });
    const meta = card.createDiv({ cls: "pm-task-meta" });
    meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F" });
    meta.createSpan({ text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
    if (task.recurrence !== "once") {
      meta.createSpan({ text: `\u7B2C ${task.occurrenceNumber} \u6B21` });
    }
    const actions = card.createDiv({ cls: "pm-task-actions" });
    actions.createEl("button", { text: "\u7F16\u8F91" }).addEventListener("click", () => this.openEditOccurrenceModal(task));
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
        completed: task.occurrenceDates.length > 0 && task.completedOccurrences.length === task.occurrenceDates.length
      },
      onSubmit: async (input) => {
        await this.plugin.store.updateTask(task.id, input, "series");
      },
      onDelete: async (scope) => {
        await this.plugin.store.deleteTask(task.id, scope);
      },
      onCompleteSeries: async () => {
        await this.plugin.store.completeTaskSeries(task.id);
      }
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
        completed: seriesTask.occurrenceDates.length > 0 && seriesTask.completedOccurrences.length === seriesTask.occurrenceDates.length
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
      }
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
  const x = 20 + index * (860 / 29);
  const y = 210 - value / max * 170;
  return `${x},${y}`;
}
function scheduleSummary(task) {
  const total = task.occurrenceDates.length;
  const range = total > 1 ? `${task.occurrenceDates[0]} -> ${task.occurrenceDates[total - 1]}` : task.date;
  const time = task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F";
  return `${range} | ${time} | \u5171 ${total} \u6B21`;
}
function completionSummary(task) {
  return `${task.completedOccurrences.length}/${task.occurrenceDates.length}`;
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
      const row = list.createDiv({ cls: "pm-task-row" });
      const left = row.createDiv({ cls: "pm-task-main" });
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
      const info = left.createDiv({ cls: "pm-task-copy" });
      info.createEl("div", { text: task.title, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = info.createDiv({ cls: "pm-task-meta" });
      meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F" });
      meta.createSpan({ text: recurrenceLabel3(task) });
      const project = this.plugin.store.getProject(task.projectId);
      meta.createSpan({ text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
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
        completed: seriesTask.occurrenceDates.length > 0 && seriesTask.completedOccurrences.length === seriesTask.occurrenceDates.length
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
      }
    }).open();
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
    await this.app.workspace.detachLeavesOfType(OVERVIEW_VIEW_TYPE);
    await this.app.workspace.detachLeavesOfType(TODAY_VIEW_TYPE);
  }
  async updateSettings(patch) {
    this.settings = { ...this.settings, ...patch };
    this.pendingSettings = {};
    await this.savePluginSettings();
    await this.store.setConfig(this.settings);
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
  }
  async activateTodayView() {
    await this.activateInRightSidebar(TODAY_VIEW_TYPE);
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
};
