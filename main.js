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
var import_obsidian8 = require("obsidian");

// src/storage/store.ts
var import_obsidian = require("obsidian");

// src/utils/date.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
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
function formatHumanDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
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
  version: "0.1.0",
  dataFolder: "project-manager-data",
  overviewTab1Name: "\u6D3B\u8DC3\u5EA6",
  overviewTab2Name: "\u9879\u76EE\u8FDB\u5EA6",
  weekStartsOn: "monday",
  timeSlotMinutes: 15,
  heatmapRange: "12months",
  showCompletedTasks: true,
  defaultTaskDurationMinutes: 30
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
      tasks: this.getAllTasks()
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
    return [...this.tasks.values()].flat().map((task) => ({ ...task }));
  }
  getTasksForDate(date) {
    return this.getAllTasks().filter((task) => task.date === date).sort(compareTasks);
  }
  getTasksForProject(projectId) {
    return this.getAllTasks().filter((task) => task.projectId === projectId).sort(compareTasks);
  }
  getProject(projectId) {
    if (!projectId) {
      return void 0;
    }
    return this.projects.find((project) => project.id === projectId);
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
    const validated = this.validateTaskInput(input);
    const timestamp = toIsoLocal(now());
    const task = {
      id: crypto.randomUUID(),
      title: validated.title,
      description: validated.description,
      projectId: validated.projectId,
      date: validated.date,
      startTime: validated.startTime,
      endTime: validated.endTime,
      completed: validated.completed ?? false,
      completedAt: validated.completed ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.insertTask(task);
    await this.persistTask(task);
    this.trigger("changed");
    return { ...task };
  }
  async updateTask(taskId, patch) {
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const merged = {
      title: patch.title ?? original.title,
      description: patch.description ?? original.description,
      projectId: patch.projectId === void 0 ? original.projectId : patch.projectId,
      date: patch.date ?? original.date,
      startTime: patch.startTime === void 0 ? original.startTime : patch.startTime,
      endTime: patch.endTime === void 0 ? original.endTime : patch.endTime,
      completed: patch.completed ?? original.completed
    };
    const validated = this.validateTaskInput(merged, taskId);
    const completed = patch.completed ?? original.completed;
    const becameCompleted = completed && !original.completed;
    const becameUncompleted = !completed && original.completed;
    const next = {
      ...original,
      title: validated.title,
      description: validated.description,
      projectId: validated.projectId,
      date: validated.date,
      startTime: validated.startTime,
      endTime: validated.endTime,
      completed,
      completedAt: becameCompleted ? toIsoLocal(now()) : becameUncompleted ? null : original.completedAt,
      updatedAt: toIsoLocal(now())
    };
    this.removeTask(original.id, false);
    this.insertTask(next);
    await this.persistTask(next, original);
    this.trigger("changed");
    return { ...next };
  }
  async deleteTask(taskId) {
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    this.removeTask(taskId, true);
    await this.flushMonth(toMonthKeyFromTask(task));
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
      columnOrder: ["title", "completed", "date", "startTime", "endTime", "description"],
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
    const affectedTasks = this.getTasksForProject(projectId);
    for (const task of affectedTasks) {
      const found = this.findTask(task.id);
      if (found) {
        found.projectId = void 0;
        found.updatedAt = toIsoLocal(now());
      }
    }
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
    const tasks = this.getTasksForProject(projectId);
    if (tasks.length === 0) {
      return 0;
    }
    const done = tasks.filter((task) => task.completed).length;
    return Math.round(done / tasks.length * 100);
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
      this.tasks.set(month, data?.tasks ?? []);
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
  validateTaskInput(input, updatingId) {
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
      const conflicts = this.getTasksForDate(date).filter((task) => task.id !== updatingId && task.startTime && task.endTime);
      const overlapped = conflicts.some((task) => {
        const otherStart = parseTimeToMinutes(task.startTime);
        const otherEnd = parseTimeToMinutes(task.endTime);
        return otherStart !== null && otherEnd !== null && start < otherEnd && end > otherStart;
      });
      if (overlapped) {
        throw new Error("\u8BE5\u65F6\u95F4\u6BB5\u5DF2\u6709\u4EFB\u52A1");
      }
    }
    return {
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || void 0,
      date,
      startTime,
      endTime,
      completed: input.completed ?? false
    };
  }
  insertTask(task) {
    const month = toMonthKeyFromTask(task);
    const existing = this.tasks.get(month) ?? [];
    existing.push(task);
    existing.sort(compareTasks);
    this.tasks.set(month, existing);
  }
  removeTask(taskId, removeEmptyMonth) {
    for (const [month, tasks] of this.tasks.entries()) {
      const index = tasks.findIndex((task) => task.id === taskId);
      if (index >= 0) {
        const [removed] = tasks.splice(index, 1);
        if (tasks.length === 0 && removeEmptyMonth) {
          this.tasks.delete(month);
        } else {
          this.tasks.set(month, tasks);
        }
        return removed;
      }
    }
    return void 0;
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
  async persistTask(task, original) {
    await this.enqueueWrite(async () => {
      const newMonth = toMonthKeyFromTask(task);
      await this.flushMonth(newMonth);
      if (original) {
        const oldMonth = toMonthKeyFromTask(original);
        if (oldMonth !== newMonth) {
          await this.flushMonth(oldMonth);
        }
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
function compareTasks(a, b) {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
  }
  if (!!a.completed !== !!b.completed) {
    return a.completed ? 1 : -1;
  }
  const startA = parseTimeToMinutes(a.startTime);
  const startB = parseTimeToMinutes(b.startTime);
  if (startA === null && startB === null) {
    return a.createdAt.localeCompare(b.createdAt);
  }
  if (startA === null) {
    return 1;
  }
  if (startB === null) {
    return -1;
  }
  return startA - startB;
}
function randomColor() {
  const palette = ["#4f8cff", "#ef6c57", "#3aa675", "#c79a17", "#6e59cf", "#1987a3"];
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
    new import_obsidian2.Setting(containerEl).setName("\u663E\u793A\u5DF2\u5B8C\u6210\u4EFB\u52A1").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showCompletedTasks).onChange(async (value) => {
        await this.plugin.updateSettings({ showCompletedTasks: value });
      })
    );
  }
};

// src/views/overviewView.ts
var import_obsidian6 = require("obsidian");

// src/components/projectModal.ts
var import_obsidian3 = require("obsidian");
var ProjectModal = class extends import_obsidian3.Modal {
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
    new import_obsidian3.Setting(contentEl).setName("\u9879\u76EE\u540D\u79F0").addText(
      (text) => text.setValue(state.name ?? "").onChange((value) => {
        state.name = value;
      })
    );
    new import_obsidian3.Setting(contentEl).setName("\u9879\u76EE\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    new import_obsidian3.Setting(contentEl).setName("\u9879\u76EE\u989C\u8272").addText(
      (text) => text.setPlaceholder("#4f8cff").setValue(state.color ?? "").onChange((value) => {
        state.color = value;
      })
    );
    new import_obsidian3.Setting(contentEl).setName("\u9879\u76EE\u72B6\u6001").addDropdown((dropdown) => {
      const statuses = ["active", "paused", "completed", "archived"];
      statuses.forEach((status) => dropdown.addOption(status, status));
      dropdown.setValue(state.status ?? "active");
      dropdown.onChange((value) => {
        state.status = value;
      });
    });
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian3.ButtonComponent(footer).setButtonText("\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(state);
        this.close();
      } catch (error) {
        new import_obsidian3.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    if (this.options.onDelete) {
      new import_obsidian3.ButtonComponent(footer).setButtonText("\u5220\u9664\u9879\u76EE").setWarning().onClick(async () => {
        await this.options.onDelete?.();
        this.close();
      });
    }
  }
};

// src/components/taskModal.ts
var import_obsidian4 = require("obsidian");
var TaskModal = class extends import_obsidian4.Modal {
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
    new import_obsidian4.Setting(contentEl).setName("\u6807\u9898").addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u4EFB\u52A1\u6807\u9898").setValue(state.title).onChange((value) => {
        state.title = value;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u65E5\u671F").addText(
      (text) => text.setPlaceholder("YYYY-MM-DD").setValue(state.date).onChange((value) => {
        state.date = value;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u5F00\u59CB\u65F6\u95F4").addText(
      (text) => text.setPlaceholder("09:00").setValue(state.startTime ?? "").onChange((value) => {
        state.startTime = value || void 0;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u7ED3\u675F\u65F6\u95F4").addText(
      (text) => text.setPlaceholder("09:30").setValue(state.endTime ?? "").onChange((value) => {
        state.endTime = value || void 0;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("\u6240\u5C5E\u9879\u76EE").addDropdown((dropdown) => {
      dropdown.addOption("", "\u672A\u5F52\u5C5E\u9879\u76EE");
      this.options.projects.forEach((project) => dropdown.addOption(project.id, project.name));
      dropdown.setValue(state.projectId ?? "");
      dropdown.onChange((value) => {
        state.projectId = value || void 0;
      });
    });
    new import_obsidian4.Setting(contentEl).setName("\u5B8C\u6210\u72B6\u6001").addToggle(
      (toggle) => toggle.setValue(Boolean(state.completed)).onChange((value) => {
        state.completed = value;
      })
    );
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
      new import_obsidian4.ButtonComponent(footer).setWarning().setButtonText("\u5220\u9664").onClick(async () => {
        await this.options.onDelete?.();
        this.close();
      });
    }
  }
};

// src/views/base.ts
var import_obsidian5 = require("obsidian");
var BaseProjectView = class extends import_obsidian5.ItemView {
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
    return "\u9879\u76EE\u603B\u89C8";
  }
  getIcon() {
    return "layout-dashboard";
  }
  async render() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("pm-view");
    const snapshot = this.plugin.store.getSnapshot();
    if (!this.selectedProjectId && snapshot.progressPages.length > 0) {
      this.selectedProjectId = snapshot.progressPages[0].projectId;
    }
    if (this.selectedProjectId && !snapshot.projects.some((project) => project.id === this.selectedProjectId)) {
      this.selectedProjectId = snapshot.progressPages[0]?.projectId ?? null;
    }
    const header = container.createDiv({ cls: "pm-page-header" });
    header.createEl("h2", { text: "\u9879\u76EE\u603B\u89C8" });
    const tabBar = header.createDiv({ cls: "pm-tab-bar" });
    this.createPrimaryTab(tabBar, this.plugin.settings.overviewTab1Name, "activity");
    this.createPrimaryTab(tabBar, this.plugin.settings.overviewTab2Name, "projects");
    if (this.activePrimaryTab === "activity") {
      this.renderActivityTab(container, snapshot.tasks, snapshot.projects);
    } else {
      this.renderProjectsTab(container, snapshot.progressPages, snapshot.projects);
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
    const section = container.createDiv({ cls: "pm-section" });
    section.createEl("h3", { text: "\u70ED\u5EA6\u56FE" });
    this.renderHeatmap(section, tasks);
    const weekSection = container.createDiv({ cls: "pm-section" });
    const top = weekSection.createDiv({ cls: "pm-week-header" });
    top.createEl("h3", { text: "\u5468\u4EFB\u52A1\u56FE" });
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
    const grid = container.createDiv({ cls: "pm-heatmap" });
    allDays.forEach((date) => {
      const key = toDateKey(date);
      const count = counts.get(key) ?? 0;
      const cell = grid.createDiv({ cls: `pm-heatmap-cell level-${heatLevel(count)}` });
      cell.setAttribute("aria-label", `${key}: ${count} \u4E2A\u5B8C\u6210\u4EFB\u52A1`);
      cell.title = `${key}: ${count} \u4E2A\u5B8C\u6210\u4EFB\u52A1`;
      cell.addEventListener("click", () => {
        const dayTasks = tasks.filter((task) => task.completedAt?.slice(0, 10) === key || task.date === key);
        const lines = dayTasks.length === 0 ? "\u65E0\u76F8\u5173\u4EFB\u52A1" : dayTasks.map((task) => `${task.completed ? "\u2713" : "\u25CB"} ${task.title}`).join("\n");
        new import_obsidian6.Notice(`${key}
${lines}`, 6e3);
      });
    });
  }
  renderWeekBoard(container, tasks, projects) {
    const weekDates = getWeekDates(this.weekAnchor);
    const board = container.createDiv({ cls: "pm-week-board" });
    weekDates.forEach((date) => {
      const key = toDateKey(date);
      const column = board.createDiv({ cls: "pm-week-day" });
      const title = column.createDiv({ cls: "pm-week-day-title" });
      title.createSpan({ text: formatHumanDate(date) });
      title.createSpan({ text: key === toDateKey(now()) ? "\u4ECA\u5929" : key });
      column.createEl("button", { text: "\u65B0\u589E" }).addEventListener("click", () => {
        new TaskModal(this.app, {
          title: "\u65B0\u589E\u4EFB\u52A1",
          projects,
          initial: {
            title: "",
            description: "",
            date: key,
            startTime: "09:00",
            endTime: addMinutes("09:00", this.plugin.settings.defaultTaskDurationMinutes),
            completed: false
          },
          onSubmit: async (input) => {
            await this.plugin.store.createTask(input);
          }
        }).open();
      });
      const dayTasks = tasks.filter((task) => task.date === key).sort((a, b) => {
        const timeA = parseTimeToMinutes(a.startTime);
        const timeB = parseTimeToMinutes(b.startTime);
        if (timeA === null && timeB === null) {
          return a.title.localeCompare(b.title);
        }
        if (timeA === null) {
          return 1;
        }
        if (timeB === null) {
          return -1;
        }
        return timeA - timeB;
      });
      const scheduled = column.createDiv({ cls: "pm-week-slot-group" });
      scheduled.createEl("h4", { text: "\u5DF2\u6392\u671F" });
      const scheduledTasks = dayTasks.filter((task) => task.startTime && task.endTime);
      if (scheduledTasks.length === 0) {
        scheduled.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u5DF2\u6392\u671F\u4EFB\u52A1" });
      } else {
        scheduledTasks.forEach((task) => this.renderWeekTaskCard(scheduled, task));
      }
      const unscheduled = column.createDiv({ cls: "pm-week-slot-group" });
      unscheduled.createEl("h4", { text: "\u672A\u6392\u671F\u4EFB\u52A1" });
      const unscheduledTasks = dayTasks.filter((task) => !task.startTime || !task.endTime);
      if (unscheduledTasks.length === 0) {
        unscheduled.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u672A\u6392\u671F\u4EFB\u52A1" });
      } else {
        unscheduledTasks.forEach((task) => this.renderWeekTaskCard(unscheduled, task));
      }
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
        await this.plugin.store.updateTask(task.id, { completed: checkbox.checked });
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        new import_obsidian6.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
      }
    });
    top.createSpan({ text: task.title, cls: "pm-task-title" });
    const meta = card.createDiv({ cls: "pm-task-meta" });
    meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F" });
    meta.createSpan({ text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
    const actions = card.createDiv({ cls: "pm-task-actions" });
    actions.createEl("button", { text: "\u7F16\u8F91" }).addEventListener("click", () => {
      new TaskModal(this.app, {
        title: "\u7F16\u8F91\u4EFB\u52A1",
        projects: this.plugin.store.getProjects(),
        initial: {
          title: task.title,
          description: task.description,
          projectId: task.projectId,
          date: task.date,
          startTime: task.startTime,
          endTime: task.endTime,
          completed: task.completed
        },
        onSubmit: async (input) => {
          await this.plugin.store.updateTask(task.id, input);
        },
        onDelete: async () => {
          await this.plugin.store.deleteTask(task.id);
        }
      }).open();
    });
  }
  renderProjectsTab(container, pages, projects) {
    const header = container.createDiv({ cls: "pm-page-header" });
    header.createEl("h3", { text: "\u9879\u76EE\u8FDB\u5EA6" });
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
    top.createEl("h3", { text: project.name });
    top.createEl("button", { text: "\u65B0\u589E\u4EFB\u52A1", cls: "mod-cta" }).addEventListener("click", () => {
      new TaskModal(this.app, {
        title: "\u65B0\u589E\u9879\u76EE\u4EFB\u52A1",
        projects,
        initial: {
          title: "",
          description: "",
          projectId: project.id,
          date: toDateKey(now()),
          completed: false
        },
        onSubmit: async (input) => {
          await this.plugin.store.createTask(input);
        }
      }).open();
    });
    body.createDiv({ cls: "pm-progress-bar" }).createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${this.plugin.store.getProjectProgress(project.id)}%` }
    });
    body.createDiv({ cls: "pm-muted", text: `\u8FDB\u5EA6 ${this.plugin.store.getProjectProgress(project.id)}%` });
    const table = body.createEl("table", { cls: "pm-table" });
    const head = table.createEl("thead");
    const headRow = head.createEl("tr");
    ["\u4EFB\u52A1\u540D\u79F0", "\u5B8C\u6210", "\u65E5\u671F", "\u5F00\u59CB\u65F6\u95F4", "\u7ED3\u675F\u65F6\u95F4", "\u63CF\u8FF0", "\u64CD\u4F5C"].forEach((label) => headRow.createEl("th", { text: label }));
    const bodyEl = table.createEl("tbody");
    const tasks = this.plugin.store.getTasksForProject(project.id);
    if (tasks.length === 0) {
      const row = bodyEl.createEl("tr");
      const cell = row.createEl("td", { text: "\u6682\u65E0\u4EFB\u52A1" });
      cell.colSpan = 7;
      return;
    }
    tasks.forEach((task) => {
      const row = bodyEl.createEl("tr");
      createEditableCell(row, task.title, async (value) => {
        await this.plugin.store.updateTask(task.id, { title: value });
      });
      createToggleCell(row, task.completed, async (value) => {
        await this.plugin.store.updateTask(task.id, { completed: value });
      });
      createEditableCell(row, task.date, async (value) => {
        await this.plugin.store.updateTask(task.id, { date: value });
      });
      createEditableCell(row, task.startTime ?? "", async (value) => {
        await this.plugin.store.updateTask(task.id, { startTime: value || void 0 });
      });
      createEditableCell(row, task.endTime ?? "", async (value) => {
        await this.plugin.store.updateTask(task.id, { endTime: value || void 0 });
      });
      createEditableCell(row, task.description ?? "", async (value) => {
        await this.plugin.store.updateTask(task.id, { description: value });
      });
      const actionCell = row.createEl("td");
      actionCell.createEl("button", { text: "\u8BE6\u7EC6\u7F16\u8F91" }).addEventListener("click", () => {
        new TaskModal(this.app, {
          title: "\u7F16\u8F91\u4EFB\u52A1",
          projects: this.plugin.store.getProjects(),
          initial: {
            title: task.title,
            description: task.description,
            projectId: task.projectId,
            date: task.date,
            startTime: task.startTime,
            endTime: task.endTime,
            completed: task.completed
          },
          onSubmit: async (input) => {
            await this.plugin.store.updateTask(task.id, input);
          },
          onDelete: async () => {
            await this.plugin.store.deleteTask(task.id);
          }
        }).open();
      });
    });
  }
};
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
function createEditableCell(row, value, onSave) {
  const cell = row.createEl("td");
  const input = cell.createEl("input", { value });
  input.addEventListener("change", async () => {
    try {
      await onSave(input.value);
    } catch (error) {
      new import_obsidian6.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
    }
  });
}
function createToggleCell(row, value, onSave) {
  const cell = row.createEl("td");
  const input = cell.createEl("input", { type: "checkbox" });
  input.checked = value;
  input.addEventListener("change", async () => {
    try {
      await onSave(input.checked);
    } catch (error) {
      input.checked = !input.checked;
      new import_obsidian6.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
    }
  });
}

// src/views/todayView.ts
var import_obsidian7 = require("obsidian");
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
    container.addClass("pm-view");
    const today = toDateKey(now());
    const tasks = this.plugin.store.getTasksForDate(today);
    const projects = this.plugin.store.getProjects();
    const visibleTasks = this.plugin.settings.showCompletedTasks ? tasks : tasks.filter((task) => !task.completed);
    const header = container.createDiv({ cls: "pm-page-header" });
    header.createEl("h2", { text: "\u4ECA\u65E5\u4EFB\u52A1" });
    header.createEl("div", { text: today, cls: "pm-muted" });
    const addButton = header.createEl("button", { text: "\u65B0\u589E\u4EFB\u52A1", cls: "mod-cta" });
    addButton.addEventListener("click", () => {
      new TaskModal(this.app, {
        title: "\u65B0\u589E\u4ECA\u65E5\u4EFB\u52A1",
        projects,
        initial: {
          title: "",
          description: "",
          date: today,
          completed: false
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
          await this.plugin.store.updateTask(task.id, { completed: checkbox.checked });
        } catch (error) {
          checkbox.checked = !checkbox.checked;
          new import_obsidian7.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
      const info = left.createDiv({ cls: "pm-task-copy" });
      info.createEl("div", { text: task.title, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = info.createDiv({ cls: "pm-task-meta" });
      if (task.startTime && task.endTime) {
        meta.createSpan({ text: `${task.startTime} - ${task.endTime}` });
      } else {
        meta.createSpan({ text: "\u672A\u6392\u671F" });
      }
      const project = this.plugin.store.getProject(task.projectId);
      meta.createSpan({ text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
      const actions = row.createDiv({ cls: "pm-task-actions" });
      actions.createEl("button", { text: "\u7F16\u8F91" }).addEventListener("click", () => this.openEditor(task));
      actions.createEl("button", { text: "\u5220\u9664", cls: "mod-warning" }).addEventListener("click", async () => {
        await this.plugin.store.deleteTask(task.id);
      });
    });
  }
  openEditor(task) {
    new TaskModal(this.app, {
      title: "\u7F16\u8F91\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      initial: {
        title: task.title,
        description: task.description,
        projectId: task.projectId,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        completed: task.completed
      },
      onSubmit: async (input) => {
        await this.plugin.store.updateTask(task.id, input);
      },
      onDelete: async () => {
        await this.plugin.store.deleteTask(task.id);
      }
    }).open();
  }
};

// src/main.ts
var ProjectManagementPlugin = class extends import_obsidian8.Plugin {
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
      new import_obsidian8.Notice(error instanceof Error ? error.message : "\u63D2\u4EF6\u521D\u59CB\u5316\u5931\u8D25");
    }
    this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new OverviewView(leaf, this));
    this.registerView(TODAY_VIEW_TYPE, (leaf) => new TodayTasksView(leaf, this));
    this.addRibbonIcon("layout-dashboard", "\u6253\u5F00\u9879\u76EE\u603B\u89C8", async () => {
      await this.activateView(OVERVIEW_VIEW_TYPE);
    });
    this.addRibbonIcon("check-square", "\u6253\u5F00\u4ECA\u65E5\u4EFB\u52A1", async () => {
      await this.activateView(TODAY_VIEW_TYPE);
    });
    this.addCommand({
      id: "open-project-overview",
      name: "\u6253\u5F00\u9879\u76EE\u603B\u89C8",
      callback: async () => this.activateView(OVERVIEW_VIEW_TYPE)
    });
    this.addCommand({
      id: "open-today-tasks",
      name: "\u6253\u5F00\u4ECA\u65E5\u4EFB\u52A1",
      callback: async () => this.activateView(TODAY_VIEW_TYPE)
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
  async activateView(type) {
    const leaves = this.app.workspace.getLeavesOfType(type);
    if (leaves.length > 0) {
      await this.app.workspace.revealLeaf(leaves[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
};
