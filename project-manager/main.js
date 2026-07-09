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
var import_obsidian14 = require("obsidian");

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
function formatDateTimePattern(date, pattern) {
  return pattern.replace(/YYYY/g, String(date.getFullYear())).replace(/MM/g, pad(date.getMonth() + 1)).replace(/DD/g, pad(date.getDate())).replace(/HH/g, pad(date.getHours())).replace(/mm/g, pad(date.getMinutes())).replace(/ss/g, pad(date.getSeconds()));
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
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
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

// src/domain/taskRules.ts
var SINGLE_TASK_RECURRENCE_COUNT = 1;
var PERMANENT_RECURRENCE_COUNT = 2147483647;
var MAX_GENERATED_OCCURRENCES = 366;
var TASK_STATUS_LABELS = {
  todo: "\u5F85\u529E",
  doing: "\u8FDB\u884C\u4E2D",
  blocked: "\u963B\u585E",
  done: "\u5DF2\u5B8C\u6210"
};
var TASK_RECURRENCE_LABELS = {
  daily: "\u6BCF\u65E5\u6B64\u65F6\u91CD\u590D",
  weekly: "\u6BCF\u5468\u6B64\u65F6\u91CD\u590D",
  monthly: "\u6BCF\u6708\u6B64\u65F6\u91CD\u590D"
};
function recurrenceLabel(recurrence) {
  return TASK_RECURRENCE_LABELS[recurrence] ?? TASK_RECURRENCE_LABELS.daily;
}
function statusLabel(status) {
  return TASK_STATUS_LABELS[status] ?? TASK_STATUS_LABELS.todo;
}
function isCompositeKind(kind) {
  return kind === "composite";
}
function isExecutableTask(task) {
  return task.kind === "simple";
}
function isAttentionStatus(status) {
  return status === "todo" || status === "blocked";
}
function isActionableStatus(status) {
  return status === "doing";
}
function isActionableOccurrence(task) {
  return isExecutableTask(task) && isActionableStatus(task.status) && !task.completed;
}
function isAttentionOccurrence(task) {
  return isExecutableTask(task) && isAttentionStatus(task.status) && !task.completed;
}
function shouldConsumeOccurrence(task) {
  if (task.completed) {
    return true;
  }
  if (task.consumeRequiresCompletion) {
    return false;
  }
  return !isAttentionStatus(task.status);
}
function normalizeTaskRecurrence(value) {
  if (value === "weekly" || value === "monthly") {
    return value;
  }
  return "daily";
}
function advanceRecurrenceDate(date, recurrence, anchorDay) {
  if (recurrence === "weekly") {
    return addDays(date, 7);
  }
  if (recurrence === "monthly") {
    return addMonthsKeepingAnchorDay(date, 1, anchorDay);
  }
  return addDays(date, 1);
}
function addMonthsKeepingAnchorDay(date, months, anchorDay) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(anchorDay, lastDay));
  return target;
}
function detectRecurrenceFromDates(dates) {
  if (dates.length <= 1) {
    return "daily";
  }
  const first = parseDateKey(dates[0]);
  const second = parseDateKey(dates[1]);
  const diffDays = Math.round((second.getTime() - first.getTime()) / (24 * 60 * 60 * 1e3));
  if (diffDays === 7) {
    return "weekly";
  }
  if (isNextMonthlyDate(dates[0], dates[1])) {
    return "monthly";
  }
  return "daily";
}
function isNextMonthlyDate(left, right) {
  const leftDate = parseDateKey(left);
  const expected = addMonthsKeepingAnchorDay(leftDate, 1, leftDate.getDate());
  return toDateKey(expected) === right;
}

// src/importExport/formattedTasks.ts
var UNASSIGNED_PROJECT_LABEL = "\u672A\u5F52\u5C5E\u9879\u76EE";
function parseFormattedTaskText(text, options) {
  const tasks = [];
  const issues = [];
  const lines = text.split(/\r?\n/);
  let currentProjectId = options.projectId;
  let currentProjectName = options.projectId ? options.projects.find((project) => project.id === options.projectId)?.name : void 0;
  let currentTask = null;
  let currentCompositeParentTitle;
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
      const projectName = projectMatch[1].trim() || UNASSIGNED_PROJECT_LABEL;
      const strictProject = options.strictProjectId ? options.projects.find((project) => project.id === options.strictProjectId) : void 0;
      if (strictProject && projectName !== strictProject.name && projectName !== strictProject.id) {
        issues.push({
          line: index + 1,
          raw,
          blocking: true,
          message: `\u5BFC\u5165\u9879\u76EE\u540D\u5FC5\u987B\u662F\u300C${strictProject.name}\u300D`
        });
        currentProjectId = strictProject.id;
        currentProjectName = strictProject.name;
        currentCompositeParentTitle = void 0;
        return;
      }
      if (projectName === UNASSIGNED_PROJECT_LABEL) {
        currentProjectId = strictProject?.id;
        currentProjectName = strictProject?.name ?? UNASSIGNED_PROJECT_LABEL;
        currentCompositeParentTitle = void 0;
        return;
      }
      const existingProject = options.projects.find((project) => project.name === projectName || project.id === projectName);
      currentProjectId = strictProject?.id ?? existingProject?.id;
      currentProjectName = strictProject?.name ?? existingProject?.name ?? projectName;
      currentCompositeParentTitle = void 0;
      return;
    }
    const plannedTaskMatch = /^(\s*)\+\s*(任务|task|组合|composite)[:：]\s*(.+)$/.exec(line);
    if (plannedTaskMatch && plannedTaskMatch[1].length === 0) {
      flushCurrent();
      try {
        const prefix = plannedTaskMatch[2].toLowerCase();
        const parsed = parseTaskLine(plannedTaskMatch[3], {
          completed: false,
          forcedKind: prefix === "\u7EC4\u5408" || prefix === "composite" ? "composite" : "simple",
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
          parentTitle: parsed.parentTitle,
          dependencyTitles: parsed.dependencyTitles,
          completionMode: parsed.completionMode,
          syntax: "planned",
          createReady: parsed.hasExplicitDate,
          hasTimeRange: parsed.hasTimeRange
        };
        currentCompositeParentTitle = currentTask.input.kind === "composite" ? currentTask.input.title : void 0;
      } catch (error) {
        issues.push({ line: index + 1, message: error instanceof Error ? error.message : "\u4EFB\u52A1\u89E3\u6790\u5931\u8D25", raw });
      }
      return;
    }
    const childTaskMatch = /^(\s{2,})\+\s*(子任务|child)[:：]\s*(.+)$/.exec(line);
    if (childTaskMatch) {
      if (!currentCompositeParentTitle) {
        issues.push({ line: index + 1, message: "\u5B50\u4EFB\u52A1\u5FC5\u987B\u5199\u5728\u7EC4\u5408\u4EFB\u52A1\u4E0B\u65B9", raw, blocking: true });
        return;
      }
      flushCurrent();
      try {
        const parsed = parseTaskLine(childTaskMatch[3], {
          completed: false,
          forcedKind: "simple",
          parentTitle: currentCompositeParentTitle,
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
          parentTitle: parsed.parentTitle,
          dependencyTitles: parsed.dependencyTitles,
          completionMode: parsed.completionMode,
          syntax: "planned",
          createReady: parsed.hasExplicitDate,
          hasTimeRange: parsed.hasTimeRange
        };
      } catch (error) {
        issues.push({ line: index + 1, message: error instanceof Error ? error.message : "\u4EFB\u52A1\u89E3\u6790\u5931\u8D25", raw });
      }
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
          parentTitle: parsed.parentTitle,
          dependencyTitles: parsed.dependencyTitles,
          completionMode: parsed.completionMode,
          syntax: "minimal",
          createReady: false,
          hasTimeRange: parsed.hasTimeRange
        };
        currentCompositeParentTitle = void 0;
      } catch (error) {
        issues.push({ line: index + 1, message: error instanceof Error ? error.message : "\u4EFB\u52A1\u89E3\u6790\u5931\u8D25", raw });
      }
      return;
    }
    const subtaskMatch = /^\s{2,}-\s+(.+)$/.exec(line);
    if (subtaskMatch && currentTask) {
      issues.push({ line: index + 1, message: "\u7EC4\u5408\u4EFB\u52A1\u4E0D\u518D\u652F\u6301\u8F7B\u91CF\u9879\uFF0C\u8BF7\u6539\u7528\u300C  + \u5B50\u4EFB\u52A1\uFF1A...\u300D", raw, blocking: true });
      return;
    }
    const descriptionMatch = /^\s{2,}>\s?(.*)$/.exec(line);
    if (descriptionMatch && currentTask) {
      currentTask.input.description = [currentTask.input.description, descriptionMatch[1]].filter(Boolean).join("\n");
      return;
    }
    if (line.trim()) {
      issues.push({ line: index + 1, message: "\u65E0\u6CD5\u8BC6\u522B\u7684\u884C", raw });
    }
  });
  flushCurrent();
  return { tasks, issues };
}
function renderTaskSeriesForExport(task, options = {}) {
  const parts = buildFormattedTaskParts(task, {
    includeKind: false,
    dependencyTitleForId: options.dependencyTitleForId
  });
  const prefix = options.child ? "  + \u5B50\u4EFB\u52A1" : task.kind === "composite" ? "+ \u7EC4\u5408" : "+ \u4EFB\u52A1";
  return `${prefix}\uFF1A${parts.join(" ")}`.trimEnd();
}
function renderDescriptionForExport(description) {
  const trimmed = description?.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed.split(/\r?\n/).map((line) => `  > ${line}`);
}
function extractProjectTaskBlocks(text) {
  const blocks = [...text.matchAll(/<!--\s*pm:start\s*-->([\s\S]*?)<!--\s*pm:end\s*-->/g)].map((match) => match[1].trim());
  return blocks.length > 0 ? blocks.join("\n") : "";
}
function parseTaskLine(rawTitle, context) {
  let title = rawTitle.trim();
  const dateMatch = /@(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2})-(\d{2}:\d{2}))?/.exec(title);
  const kindMatch = /\b(?:kind|type):(simple|composite)\b/.exec(title);
  const repeatMatch = /\brepeat:(daily|weekly|monthly)\b/.exec(title);
  const countMatch = /\bcount:(\d+)\b/.exec(title);
  const untilMatch = /\buntil:(\d{4}-\d{2}-\d{2})\b/.exec(title);
  const datesMatch = /\bdates:((?:\d{4}-\d{2}-\d{2})(?:,\d{4}-\d{2}-\d{2})*)\b/.exec(title);
  const statusMatch = /\bstatus:(todo|doing|blocked|done)\b/.exec(title);
  const finishMatch = /\bfinish:(today|series)\b/.exec(title);
  const priorityMatch = /!(low|medium|high|urgent)\b/.exec(title);
  const boardMatch = /\bboard:(todo|doing|blocked|done)(?::(-?\d+))?\b/.exec(title);
  const ganttMatch = /\bgantt:([^\s]+)/.exec(title);
  const mindmapMatch = /\bmindmap:([^\s]+)/.exec(title);
  const parentMatch = /\bparent:([^\s]+)/.exec(title);
  const depsMatch = /\bdeps:([^\s]+)/.exec(title);
  const tags = [];
  const customDates = datesMatch?.[1].split(",").filter(Boolean) ?? [];
  const viewState = buildViewStatePatchFromTokens({
    status: statusMatch?.[1] ?? (context.completed ? "done" : "todo"),
    board: boardMatch?.[1],
    boardOrder: boardMatch?.[2] ? Number(boardMatch[2]) : void 0,
    gantt: ganttMatch?.[1],
    mindmap: mindmapMatch?.[1]
  });
  const parentTitle = context.parentTitle ?? (parentMatch ? decodeReferenceToken(parentMatch[1]) : void 0);
  const dependencyTitles = depsMatch ? depsMatch[1].split("|").map(decodeReferenceToken).filter(Boolean) : [];
  title = title.replace(/@\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2}-\d{2}:\d{2})?/g, "").replace(/\b(?:kind|type):(simple|composite)\b/g, "").replace(/\brepeat:(daily|weekly|monthly)\b/g, "").replace(/\bcount:\d+\b/g, "").replace(/\buntil:\d{4}-\d{2}-\d{2}\b/g, "").replace(/\bdates:(?:\d{4}-\d{2}-\d{2})(?:,\d{4}-\d{2}-\d{2})*\b/g, "").replace(/\bstatus:(todo|doing|blocked|done)\b/g, "").replace(/\bfinish:(today|series)\b/g, "").replace(/\bboard:(todo|doing|blocked|done)(?::[-]?\d+)?\b/g, "").replace(/\bgantt:[^\s]+/g, "").replace(/\bmindmap:[^\s]+/g, "").replace(/\bparent:[^\s]+/g, "").replace(/\bdeps:[^\s]+/g, "").replace(/!(low|medium|high|urgent)\b/g, "").replace(/#[^\s#]+/g, "").trim();
  if (!title) {
    throw new Error("\u4EFB\u52A1\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
  }
  return {
    input: {
      kind: kindMatch?.[1] ?? context.forcedKind ?? "simple",
      title,
      projectId: context.projectId,
      date: dateMatch?.[1] ?? customDates[0] ?? context.defaultDate,
      startTime: dateMatch?.[2],
      endTime: dateMatch?.[3],
      recurrence: repeatMatch?.[1] ?? "daily",
      recurrenceCount: countMatch ? Number(countMatch[1]) : SINGLE_TASK_RECURRENCE_COUNT,
      recurrenceUntil: untilMatch?.[1] ?? null,
      occurrenceDates: customDates.length > 0 ? customDates : void 0,
      status: statusMatch?.[1] ?? (context.completed ? "done" : "todo"),
      priority: priorityMatch?.[1],
      tags,
      viewState,
      sourceLinks: context.source ? [context.source] : [],
      completed: context.completed
    },
    projectName: context.projectName,
    parentTitle,
    dependencyTitles,
    completionMode: context.completed ? finishMatch?.[1] ?? "today" : "pending",
    hasExplicitDate: Boolean(dateMatch?.[1]),
    hasTimeRange: Boolean(dateMatch?.[2] && dateMatch?.[3])
  };
}
function buildFormattedTaskParts(task, options = {}) {
  const parts = [task.title];
  if (options.includeKind !== false) {
    parts.push(`kind:${task.kind}`);
  }
  parts.push(`@${task.date}${task.startTime && task.endTime ? ` ${task.startTime}-${task.endTime}` : ""}`);
  if (task.priority) {
    parts.push(`!${task.priority}`);
  }
  if (task.kind !== "composite") {
    parts.push(`status:${task.status}`);
  }
  if (task.kind !== "composite" && !(task.recurrence === "daily" && task.recurrenceCount === SINGLE_TASK_RECURRENCE_COUNT && !task.recurrenceUntil)) {
    parts.push(`repeat:${task.recurrence}`);
  }
  if (task.kind !== "composite" && task.recurrenceCount && task.recurrenceCount !== SINGLE_TASK_RECURRENCE_COUNT) {
    parts.push(`count:${task.recurrenceCount}`);
  }
  if (task.kind !== "composite" && task.recurrenceUntil) {
    parts.push(`until:${task.recurrenceUntil}`);
  }
  if (task.viewState) {
    parts.push(`board:${task.viewState.board.columnId}:${task.viewState.board.order}`);
    const ganttParts = [`order=${task.viewState.gantt.rowOrder}`];
    if (task.viewState.gantt.locked) {
      ganttParts.push("locked");
    }
    if (task.viewState.gantt.milestone) {
      ganttParts.push("milestone");
    }
    parts.push(`gantt:${ganttParts.join(",")}`);
    const dependencyTitles = task.viewState.gantt.dependencyIds.map((id) => options.dependencyTitleForId?.(id)).filter((title) => Boolean(title));
    if (dependencyTitles.length > 0) {
      parts.push(`deps:${dependencyTitles.map(encodeReferenceToken).join("|")}`);
    }
    const mindmapParts = [
      `order=${task.viewState.mindmap.childOrder}`,
      task.viewState.mindmap.expanded ? "expanded" : "collapsed"
    ];
    if (Number.isFinite(task.viewState.mindmap.x)) {
      mindmapParts.push(`x=${task.viewState.mindmap.x}`);
    }
    if (Number.isFinite(task.viewState.mindmap.y)) {
      mindmapParts.push(`y=${task.viewState.mindmap.y}`);
    }
    parts.push(`mindmap:${mindmapParts.join(",")}`);
  }
  return parts;
}
function buildViewStatePatchFromTokens(input) {
  const viewState = {
    board: {
      columnId: input.board ?? input.status,
      order: Number.isFinite(input.boardOrder) ? input.boardOrder : 0
    }
  };
  if (input.gantt) {
    const parts = input.gantt.split(",").map((part) => part.trim()).filter(Boolean);
    const orderPart = parts.find((part) => part.startsWith("order="));
    viewState.gantt = {
      rowOrder: orderPart ? Number(orderPart.slice("order=".length)) || 0 : 0,
      dependencyIds: [],
      locked: parts.includes("locked"),
      milestone: parts.includes("milestone")
    };
  }
  if (input.mindmap) {
    const parts = input.mindmap.split(",").map((part) => part.trim()).filter(Boolean);
    const orderPart = parts.find((part) => part.startsWith("order="));
    const xPart = parts.find((part) => part.startsWith("x="));
    const yPart = parts.find((part) => part.startsWith("y="));
    const x = xPart ? Number(xPart.slice("x=".length)) : void 0;
    const y = yPart ? Number(yPart.slice("y=".length)) : void 0;
    viewState.mindmap = {
      parentTaskId: null,
      childOrder: orderPart ? Number(orderPart.slice("order=".length)) || 0 : 0,
      expanded: !parts.includes("collapsed"),
      x: Number.isFinite(x) ? x : void 0,
      y: Number.isFinite(y) ? y : void 0
    };
  }
  return viewState;
}
function encodeReferenceToken(value) {
  return encodeURIComponent(value.trim());
}
function decodeReferenceToken(value) {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
}

// src/importExport/dataMigration.ts
var DATA_MIGRATION_SCHEMA = "obsidian-project-management/data-migration";
var DATA_MIGRATION_VERSION = 2;
var DATA_MIGRATION_FENCE = "pm-data-migration-json";
function buildDataMigrationJson(input) {
  const payload = {
    schema: DATA_MIGRATION_SCHEMA,
    version: DATA_MIGRATION_VERSION,
    exportedAt: input.exportedAt,
    projects: input.projects,
    progressPages: input.progressPages,
    tasks: input.tasks.map(taskToDataMigrationRecord)
  };
  return JSON.stringify(payload, null, 2);
}
function parseDataMigrationText(text) {
  const match = findDataMigrationJson(text);
  if (!match) {
    if (text.includes(DATA_MIGRATION_SCHEMA) || text.includes(DATA_MIGRATION_FENCE)) {
      return {
        kind: "invalid",
        issues: [{ line: 1, raw: firstNonEmptyLine(text), message: "\u6570\u636E\u8FC1\u79FB JSON \u683C\u5F0F\u4E0D\u5B8C\u6574\u6216\u4EE3\u7801\u5757\u6807\u8BB0\u9519\u8BEF", blocking: true }]
      };
    }
    return { kind: "none" };
  }
  try {
    const parsed = JSON.parse(match.content);
    if (!isDataMigrationPackage(parsed)) {
      throw new Error("JSON \u7ED3\u6784\u4E0D\u7B26\u5408\u6570\u636E\u8FC1\u79FB\u683C\u5F0F");
    }
    if (parsed.schema !== DATA_MIGRATION_SCHEMA) {
      throw new Error("\u6570\u636E\u8FC1\u79FB schema \u4E0D\u5339\u914D");
    }
    if (parsed.version !== DATA_MIGRATION_VERSION) {
      throw new Error(`\u4E0D\u652F\u6301\u7684\u6570\u636E\u8FC1\u79FB\u7248\u672C\uFF1A${parsed.version}`);
    }
    return { kind: "package", package: parsed };
  } catch (error) {
    return {
      kind: "invalid",
      issues: [
        {
          line: match.line,
          raw: firstNonEmptyLine(match.content),
          message: error instanceof Error ? error.message : "\u6570\u636E\u8FC1\u79FB JSON \u89E3\u6790\u5931\u8D25",
          blocking: true
        }
      ]
    };
  }
}
function summarizeDataMigrationPackage(records) {
  const tasks = records.tasks.map(dataMigrationRecordToTask);
  return {
    version: records.version,
    exportedAt: records.exportedAt,
    projects: records.projects.length,
    progressPages: records.progressPages.length,
    tasks: records.tasks.length,
    occurrences: tasks.reduce((count, task) => count + task.occurrenceDates.length, 0),
    compositeTasks: tasks.filter((task) => task.kind === "composite").length,
    mindmapLinks: tasks.filter((task) => Boolean(task.viewState?.mindmap?.parentTaskId)).length,
    ganttDependencies: tasks.reduce((count, task) => count + (task.viewState?.gantt?.dependencyIds?.length ?? 0), 0),
    mindmapComments: tasks.reduce((count, task) => count + task.mindmapComments.length, 0),
    taskNotes: tasks.reduce((count, task) => count + task.notes.length, 0),
    sourceLinks: tasks.reduce((count, task) => count + task.sourceLinks.length, 0),
    occurrenceStates: tasks.reduce((count, task) => count + task.occurrenceStates.length, 0),
    occurrenceOverrides: tasks.reduce((count, task) => count + task.occurrenceOverrides.length, 0)
  };
}
function dataMigrationPackageToTasks(records) {
  return records.tasks.map(dataMigrationRecordToTask);
}
function buildDataMigrationProjectPlan(projects, existingProjects) {
  const projectIdBySourceId = /* @__PURE__ */ new Map();
  const newProjectNames = [];
  const projectByTargetId = /* @__PURE__ */ new Map();
  projects.forEach((project) => {
    const existing = existingProjects.find((candidate) => candidate.id === project.id) ?? existingProjects.find((candidate) => candidate.name === project.name);
    const targetId = existing?.id ?? project.id;
    projectIdBySourceId.set(project.id, targetId);
    if (!existing) {
      newProjectNames.push(project.name);
    }
    projectByTargetId.set(targetId, { ...project, id: targetId });
  });
  return {
    projectIdBySourceId,
    projects: [...projectByTargetId.values()],
    newProjectNames
  };
}
function buildDataMigrationTaskPlan(tasks, existingTasks, projectIdBySourceId) {
  const taskIdBySourceId = /* @__PURE__ */ new Map();
  const matchedTargetIds = /* @__PURE__ */ new Set();
  const replacedTaskIds = [];
  let createCount = 0;
  let overwriteCount = 0;
  tasks.forEach((task) => {
    const projectId = task.projectId ? projectIdBySourceId.get(task.projectId) ?? task.projectId : void 0;
    const existingById = existingTasks.find((candidate) => candidate.id === task.id);
    const existingByIdentity = existingById ? void 0 : findTaskByMigrationIdentity(existingTasks, task.title, projectId, task.date);
    const existing = existingById ?? existingByIdentity;
    const targetId = existing && !matchedTargetIds.has(existing.id) ? existing.id : task.id;
    taskIdBySourceId.set(task.id, targetId);
    if (existing && targetId === existing.id) {
      matchedTargetIds.add(existing.id);
      replacedTaskIds.push(existing.id);
      overwriteCount += 1;
    } else {
      createCount += 1;
    }
  });
  return {
    taskIdBySourceId,
    tasks,
    replacedTaskIds,
    createCount,
    overwriteCount
  };
}
function findTaskByMigrationIdentity(tasks, title, projectId, date) {
  return tasks.filter((task) => normalizeImportIdentity(task.title) === normalizeImportIdentity(title) && (task.projectId ?? void 0) === projectId).find((task) => task.occurrenceDates.includes(date));
}
function taskToDataMigrationImportInput(task, projectId) {
  return {
    kind: task.kind,
    title: task.title,
    description: task.description,
    projectId,
    status: task.status,
    priority: task.priority,
    tags: [...task.tags],
    date: task.date,
    startTime: task.startTime,
    endTime: task.endTime,
    recurrence: task.recurrence,
    recurrenceCount: task.recurrenceCount ?? null,
    recurrenceUntil: task.recurrenceUntil ?? null,
    consumeRequiresCompletion: task.consumeRequiresCompletion,
    occurrenceDates: [...task.occurrenceDates],
    completedOccurrenceDates: task.occurrenceStates.filter((state) => Boolean(state.completedAt)).map((state) => state.date),
    occurrenceOverrides: task.occurrenceOverrides.map((override) => ({ ...override })),
    subtasks: [],
    viewState: cloneViewState(task.viewState),
    sourceLinks: task.sourceLinks.map((source) => ({ ...source })),
    notes: task.notes.map((note) => ({ ...note })),
    mindmapComments: task.mindmapComments.map((comment) => ({ ...comment })),
    completed: isTaskFullyCompleted(task)
  };
}
function remapDataMigrationProgressPages(pages, projectIdBySourceId, existingPages) {
  const pageByTargetId = /* @__PURE__ */ new Map();
  pages.forEach((page) => {
    const projectId = projectIdBySourceId.get(page.projectId) ?? page.projectId;
    const existing = existingPages.find((candidate) => candidate.id === page.id) ?? existingPages.find((candidate) => candidate.projectId === projectId);
    const id = existing?.id ?? page.id;
    pageByTargetId.set(id, {
      ...page,
      id,
      projectId,
      columnOrder: [...page.columnOrder]
    });
  });
  return [...pageByTargetId.values()];
}
function remapDataMigrationTask(task, taskIdBySourceId, projectIdBySourceId) {
  const id = taskIdBySourceId.get(task.id) ?? task.id;
  const projectId = task.projectId ? projectIdBySourceId.get(task.projectId) ?? task.projectId : void 0;
  return {
    ...task,
    id,
    projectId,
    tags: [...task.tags],
    subtasks: [],
    occurrenceDates: [...task.occurrenceDates],
    occurrenceStates: task.occurrenceStates.map((state) => ({
      ...state,
      completedSubtaskIds: [...state.completedSubtaskIds ?? []]
    })),
    occurrenceOverrides: task.occurrenceOverrides.map((override) => ({ ...override })),
    viewState: remapDataMigrationViewState(task.viewState, taskIdBySourceId),
    sourceLinks: task.sourceLinks.map((source) => ({ ...source })),
    notes: task.notes.map((note) => ({ ...note })),
    mindmapComments: task.mindmapComments.map((comment) => ({ ...comment, taskId: id }))
  };
}
function taskToDataMigrationRecord(task) {
  const status = task.status ?? "todo";
  const recurrence = task.recurrence ?? "daily";
  const record = {
    id: task.id,
    title: task.title,
    date: task.date,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    revision: task.revision
  };
  if (task.kind !== "simple") {
    record.kind = task.kind;
  }
  if (task.description?.trim()) {
    record.description = task.description;
  }
  if (task.projectId) {
    record.projectId = task.projectId;
  }
  if (status !== "todo") {
    record.status = status;
  }
  if (task.priority) {
    record.priority = task.priority;
  }
  if (task.tags.length > 0) {
    record.tags = [...task.tags];
  }
  if (task.startTime) {
    record.startTime = task.startTime;
  }
  if (task.endTime) {
    record.endTime = task.endTime;
  }
  if (task.kind !== "composite" && !(recurrence === "daily" && task.recurrenceCount === SINGLE_TASK_RECURRENCE_COUNT && !task.recurrenceUntil)) {
    record.recurrence = recurrence;
  }
  if (task.kind !== "composite" && task.recurrenceCount !== null && task.recurrenceCount !== void 0) {
    record.recurrenceCount = task.recurrenceCount;
  }
  if (task.kind !== "composite" && task.recurrenceUntil) {
    record.recurrenceUntil = task.recurrenceUntil;
  }
  if (task.kind !== "composite" && task.consumeRequiresCompletion) {
    record.consumeRequiresCompletion = true;
  }
  const occurrencePlan = buildOccurrencePlan(task);
  if (occurrencePlan) {
    record.occurrencePlan = occurrencePlan;
  }
  if (task.occurrenceStates.length > 0) {
    record.occurrenceStates = task.occurrenceStates.map((state) => ({
      ...state,
      completedSubtaskIds: [...state.completedSubtaskIds ?? []]
    }));
  }
  if (task.occurrenceOverrides.length > 0) {
    record.occurrenceOverrides = task.occurrenceOverrides.map((override) => ({ ...override }));
  }
  if (!isDefaultViewState(task.viewState, status)) {
    record.viewState = cloneViewState(task.viewState);
  }
  if (task.sourceLinks.length > 0) {
    record.sourceLinks = task.sourceLinks.map((source) => ({ ...source }));
  }
  if (task.notes.length > 0) {
    record.notes = task.notes.map((note) => ({ ...note }));
  }
  if (task.mindmapComments.length > 0) {
    record.mindmapComments = task.mindmapComments.map((comment) => ({ ...comment }));
  }
  return record;
}
function dataMigrationRecordToTask(record) {
  const kind = record.kind === "composite" ? "composite" : "simple";
  const status = normalizeTaskStatus(record.status);
  const recurrence = normalizeTaskRecurrence2(record.recurrence, record.occurrencePlan);
  const occurrenceDates = buildOccurrenceDatesFromRecord(record, recurrence);
  const date = occurrenceDates[0] ?? record.date;
  return {
    id: record.id,
    kind,
    title: record.title,
    description: record.description ?? "",
    projectId: record.projectId,
    status: kind === "composite" ? "todo" : status,
    priority: kind === "composite" ? void 0 : normalizeTaskPriority(record.priority),
    tags: kind === "composite" ? [] : [...record.tags ?? []],
    date,
    startTime: record.startTime,
    endTime: record.endTime,
    recurrence,
    recurrenceCount: kind === "composite" ? SINGLE_TASK_RECURRENCE_COUNT : record.recurrenceCount ?? null,
    recurrenceUntil: kind === "composite" ? null : record.recurrenceUntil ?? null,
    consumeRequiresCompletion: kind === "composite" ? false : Boolean(record.consumeRequiresCompletion),
    subtasks: [],
    occurrenceDates,
    occurrenceStates: (record.occurrenceStates ?? []).map((state) => ({
      ...state,
      completedSubtaskIds: [...state.completedSubtaskIds ?? []]
    })),
    occurrenceOverrides: (record.occurrenceOverrides ?? []).map((override) => ({ ...override })),
    viewState: mergeViewState(record.viewState, kind === "composite" ? "todo" : status),
    sourceLinks: (record.sourceLinks ?? []).map((source) => ({ ...source })),
    notes: (record.notes ?? []).map((note) => ({ ...note })),
    mindmapComments: (record.mindmapComments ?? []).map((comment) => ({ ...comment })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    revision: record.revision ?? 1
  };
}
function buildOccurrencePlan(task) {
  const actualDates = normalizeDateList(task.occurrenceDates);
  const generatedDates = generateRecurrenceDates({
    date: task.date,
    recurrence: task.recurrence,
    recurrenceCount: task.recurrenceCount ?? null,
    recurrenceUntil: task.recurrenceUntil ?? null
  });
  if (sameDateList(actualDates, generatedDates)) {
    return void 0;
  }
  const actual = new Set(actualDates);
  const generated = new Set(generatedDates);
  const exclude = generatedDates.filter((date) => !actual.has(date));
  const include = actualDates.filter((date) => !generated.has(date));
  const plan = { source: "recurrence" };
  if (exclude.length > 0) {
    plan.exclude = packDateSet(exclude);
  }
  if (include.length > 0) {
    plan.include = packDateSet(include);
  }
  return plan.exclude || plan.include ? plan : void 0;
}
function buildOccurrenceDatesFromRecord(record, recurrence) {
  const plan = record.occurrencePlan;
  if (plan?.source === "dates") {
    return expandDateSet(plan);
  }
  const generated = generateRecurrenceDates({
    date: record.date,
    recurrence,
    recurrenceCount: record.recurrenceCount ?? null,
    recurrenceUntil: record.recurrenceUntil ?? null
  });
  if (plan?.source !== "recurrence") {
    return generated;
  }
  const exclude = new Set(plan.exclude ? expandDateSet(plan.exclude) : []);
  const include = plan.include ? expandDateSet(plan.include) : [];
  return normalizeDateList([...generated.filter((date) => !exclude.has(date)), ...include]);
}
function generateRecurrenceDates(input) {
  const recurrence = normalizeTaskRecurrence(input.recurrence);
  const countLimit = Math.min(input.recurrenceCount ?? MAX_GENERATED_OCCURRENCES, MAX_GENERATED_OCCURRENCES);
  const until = input.recurrenceUntil ?? null;
  const dates = [];
  let cursor = parseDateKey(input.date);
  const anchorDay = cursor.getDate();
  let createdCount = 0;
  while (true) {
    const dateKey = toDateKey(cursor);
    if (until && compareDateKeys(dateKey, until) > 0) {
      break;
    }
    if (createdCount >= countLimit) {
      break;
    }
    dates.push(dateKey);
    createdCount += 1;
    cursor = advanceRecurrenceDate(cursor, recurrence, anchorDay);
  }
  return dates.length > 0 ? dates : [input.date];
}
function packDateSet(dates) {
  const normalized = normalizeDateList(dates);
  const singles = [];
  const ranges = [];
  let index = 0;
  while (index < normalized.length) {
    const dailyRun = collectDateRun(normalized, index, 1);
    if (dailyRun.length >= 3) {
      ranges.push({ from: dailyRun[0], to: dailyRun[dailyRun.length - 1], every: "day" });
      index += dailyRun.length;
      continue;
    }
    const weeklyRun = collectDateRun(normalized, index, 7);
    if (weeklyRun.length >= 3) {
      ranges.push({ from: weeklyRun[0], to: weeklyRun[weeklyRun.length - 1], every: "week" });
      index += weeklyRun.length;
      continue;
    }
    singles.push(normalized[index]);
    index += 1;
  }
  return {
    ...singles.length > 0 ? { dates: singles } : {},
    ...ranges.length > 0 ? { ranges } : {}
  };
}
function collectDateRun(dates, startIndex, stepDays) {
  const run = [dates[startIndex]];
  let cursor = parseDateKey(dates[startIndex]);
  for (let index = startIndex + 1; index < dates.length; index += 1) {
    cursor = addDays(cursor, stepDays);
    const expected = toDateKey(cursor);
    if (dates[index] !== expected) {
      break;
    }
    run.push(dates[index]);
  }
  return run;
}
function expandDateSet(set) {
  const dates = [...set.dates ?? []];
  (set.ranges ?? []).forEach((range) => {
    let cursor = parseDateKey(range.from);
    const step = range.every === "week" ? 7 : 1;
    while (compareDateKeys(toDateKey(cursor), range.to) <= 0) {
      dates.push(toDateKey(cursor));
      cursor = addDays(cursor, step);
    }
  });
  return normalizeDateList(dates);
}
function normalizeDateList(dates) {
  return [...new Set(dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort(compareDateKeys);
}
function sameDateList(left, right) {
  return left.length === right.length && left.every((date, index) => date === right[index]);
}
function normalizeTaskRecurrence2(value, occurrencePlan) {
  return normalizeTaskRecurrence(value);
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
function mergeViewState(patch, status) {
  const base = defaultTaskViewState(status);
  return {
    board: {
      columnId: patch?.board?.columnId ?? base.board.columnId,
      order: patch?.board?.order ?? base.board.order
    },
    gantt: {
      rowOrder: patch?.gantt?.rowOrder ?? base.gantt.rowOrder,
      dependencyIds: [...patch?.gantt?.dependencyIds ?? base.gantt.dependencyIds],
      locked: patch?.gantt?.locked ?? base.gantt.locked,
      milestone: patch?.gantt?.milestone ?? base.gantt.milestone
    },
    mindmap: {
      parentTaskId: patch?.mindmap?.parentTaskId === void 0 ? base.mindmap.parentTaskId : patch.mindmap.parentTaskId,
      childOrder: patch?.mindmap?.childOrder ?? base.mindmap.childOrder,
      expanded: patch?.mindmap?.expanded ?? base.mindmap.expanded,
      x: patch?.mindmap?.x,
      y: patch?.mindmap?.y
    }
  };
}
function isDefaultViewState(viewState, status) {
  const base = defaultTaskViewState(status);
  return viewState.board.columnId === base.board.columnId && viewState.board.order === base.board.order && viewState.gantt.rowOrder === base.gantt.rowOrder && viewState.gantt.dependencyIds.length === 0 && viewState.gantt.locked === base.gantt.locked && viewState.gantt.milestone === base.gantt.milestone && (viewState.mindmap.parentTaskId ?? null) === base.mindmap.parentTaskId && viewState.mindmap.childOrder === base.mindmap.childOrder && viewState.mindmap.expanded === base.mindmap.expanded && viewState.mindmap.x === void 0 && viewState.mindmap.y === void 0;
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
function remapDataMigrationViewState(viewState, taskIdBySourceId) {
  const parentTaskId = viewState.mindmap.parentTaskId ?? null;
  return {
    board: {
      ...viewState.board
    },
    gantt: {
      ...viewState.gantt,
      dependencyIds: viewState.gantt.dependencyIds.map((id) => taskIdBySourceId.get(id) ?? id)
    },
    mindmap: {
      ...viewState.mindmap,
      parentTaskId: parentTaskId ? taskIdBySourceId.get(parentTaskId) ?? parentTaskId : parentTaskId
    }
  };
}
function isTaskFullyCompleted(task) {
  return task.occurrenceDates.every((date) => isOccurrenceCompleted(task, date));
}
function isOccurrenceCompleted(task, date) {
  const state = task.occurrenceStates.find((item) => item.date === date);
  if (task.kind === "simple") {
    return Boolean(state);
  }
  if (task.subtasks.length === 0) {
    return Boolean(state?.completedAt);
  }
  const completedIds = new Set(state?.completedSubtaskIds ?? []);
  return task.subtasks.every((subtask) => completedIds.has(subtask.id));
}
function normalizeImportIdentity(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-Hans-CN");
}
function findDataMigrationJson(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return { content: trimmed, line: 1 };
  }
  const fence = new RegExp("```\\s*" + DATA_MIGRATION_FENCE + "\\s*\\r?\\n([\\s\\S]*?)```", "i");
  const match = fence.exec(text);
  if (!match) {
    return null;
  }
  const before = text.slice(0, match.index);
  return {
    content: match[1].trim(),
    line: before.split(/\r?\n/).length
  };
}
function firstNonEmptyLine(text) {
  return text.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "";
}
function isDataMigrationPackage(value) {
  return isRecord(value) && value.schema === DATA_MIGRATION_SCHEMA && value.version === DATA_MIGRATION_VERSION && typeof value.exportedAt === "string" && Array.isArray(value.projects) && value.projects.every(isProjectRecord) && Array.isArray(value.progressPages) && value.progressPages.every(isProgressPageRecord) && Array.isArray(value.tasks) && value.tasks.every(isDataMigrationTaskRecord);
}
function isProjectRecord(value) {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.status === "string" && typeof value.createdAt === "string" && typeof value.updatedAt === "string";
}
function isProgressPageRecord(value) {
  return isRecord(value) && typeof value.id === "string" && typeof value.projectId === "string" && typeof value.name === "string" && Array.isArray(value.columnOrder) && value.columnOrder.every((item) => typeof item === "string");
}
function isDataMigrationTaskRecord(value) {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === "string" && typeof value.title === "string" && typeof value.date === "string" && typeof value.createdAt === "string" && typeof value.updatedAt === "string" && (value.kind === void 0 || value.kind === "simple" || value.kind === "composite") && (value.status === void 0 || ["todo", "doing", "blocked", "done"].includes(String(value.status))) && (value.recurrence === void 0 || ["daily", "weekly", "monthly"].includes(String(value.recurrence))) && (value.tags === void 0 || Array.isArray(value.tags) && value.tags.every((tag) => typeof tag === "string")) && (value.subtasks === void 0 || Array.isArray(value.subtasks) && value.subtasks.every(isTaskSubtaskRecord)) && (value.occurrenceStates === void 0 || Array.isArray(value.occurrenceStates) && value.occurrenceStates.every(isOccurrenceStateRecord)) && (value.occurrenceOverrides === void 0 || Array.isArray(value.occurrenceOverrides) && value.occurrenceOverrides.every(isOccurrenceOverrideRecord)) && (value.mindmapComments === void 0 || Array.isArray(value.mindmapComments) && value.mindmapComments.every(isMindmapCommentRecord)) && (value.sourceLinks === void 0 || Array.isArray(value.sourceLinks)) && (value.notes === void 0 || Array.isArray(value.notes)) && (value.viewState === void 0 || isRecord(value.viewState)) && (value.occurrencePlan === void 0 || isOccurrencePlanRecord(value.occurrencePlan));
}
function isTaskSubtaskRecord(value) {
  return isRecord(value) && typeof value.id === "string" && typeof value.title === "string";
}
function isOccurrenceStateRecord(value) {
  return isRecord(value) && typeof value.date === "string";
}
function isOccurrenceOverrideRecord(value) {
  return isRecord(value) && typeof value.date === "string";
}
function isMindmapCommentRecord(value) {
  return isRecord(value) && typeof value.id === "string" && typeof value.taskId === "string" && typeof value.content === "string";
}
function isOccurrencePlanRecord(value) {
  if (!isRecord(value)) {
    return false;
  }
  if (value.source === "dates") {
    return isDateSetRecord(value);
  }
  if (value.source === "recurrence") {
    return (value.exclude === void 0 || isDateSetRecord(value.exclude)) && (value.include === void 0 || isDateSetRecord(value.include));
  }
  return false;
}
function isDateSetRecord(value) {
  return isRecord(value) && (value.dates === void 0 || Array.isArray(value.dates) && value.dates.every((date) => typeof date === "string")) && (value.ranges === void 0 || Array.isArray(value.ranges) && value.ranges.every(isDateRangeRecord));
}
function isDateRangeRecord(value) {
  return isRecord(value) && typeof value.from === "string" && typeof value.to === "string" && (value.every === "day" || value.every === "week");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// docs/markdown——type.md
var markdown_type_default = '# \u5FEB\u901F\u8BB0\u5F55\u683C\u5F0F\u89C4\u8303\n\n\u5F53\u524D\u5FEB\u901F\u8BB0\u5F55-\u521B\u5EFA\u4EFB\u52A1\u652F\u6301\u4E09\u7C7B\u8F93\u5165\u683C\u5F0F\u3002\n\n1. \u6570\u636E\u8FC1\u79FB JSON\uFF1A\u7528\u4E8E\u77E5\u8BC6\u5E93\u8FC1\u79FB\u548C\u5B8C\u6574\u6062\u590D\u3002\n2. \u4ECA\u65E5\u5B8C\u6210\u6781\u7B80 Markdown\uFF1A\u7528\u4E8E\u5B8C\u6210\u4ECA\u5929\u5DF2\u6709\u4EFB\u52A1\u3002\n3. \u65B0\u4EFB\u52A1\u8BA1\u5212\u590D\u6742 Markdown\uFF1A\u7528\u4E8E\u521B\u5EFA\u6216\u8986\u76D6\u4EFB\u52A1\u8BA1\u5212\u3002\n\n## \u6570\u636E\u8FC1\u79FB JSON\n\n\u201C\u5BFC\u51FA\u5168\u90E8\u8BB0\u5F55\u201D\u590D\u5236\u7684\u6570\u636E\u5C31\u662F\u6570\u636E\u8FC1\u79FB JSON\u3002\n\n```json\n{\n  "schema": "obsidian-project-management/data-migration",\n  "version": 2,\n  "exportedAt": "2026-05-26T12:00:00+08:00",\n  "projects": [],\n  "progressPages": [],\n  "tasks": []\n}\n```\n\n\u4EFB\u52A1\u7D27\u51D1\u89C4\u5219\uFF1A\n\n1. `daily`\u3001`weekly`\u3001`monthly` \u53EF\u7531 `date + recurrence + recurrenceCount/recurrenceUntil` \u63A8\u5BFC\u65F6\uFF0C\u4E0D\u5BFC\u51FA\u5B8C\u6574\u65E5\u671F\u6570\u7EC4\u3002\n2. \u5220\u9664\u6216\u8865\u5145\u8FC7\u7684\u5B9E\u4F8B\u5199\u5165 `occurrencePlan.include` \u548C `occurrencePlan.exclude`\u3002\n3. \u7A7A\u5B57\u6BB5\u548C\u9ED8\u8BA4\u89C6\u56FE\u72B6\u6001\u4E0D\u5BFC\u51FA\u3002\n4. `consumeRequiresCompletion`\u3001`occurrenceStates`\u3001`occurrenceOverrides`\u3001`viewState`\u3001`mindmapComments`\u3001`notes`\u3001`sourceLinks` \u4FDD\u7559\u5B8C\u6574\u4E1A\u52A1\u72B6\u6001\u3002\n\n## \u4ECA\u65E5\u5B8C\u6210\u6781\u7B80 Markdown\n\n\u4ECA\u65E5\u4EFB\u52A1\u9875\u5BFC\u51FA\u6B64\u683C\u5F0F\uFF1A\n\n```md\n#\u9879\u76EE\uFF1A\u82F1\u8BED\u56DB\u7EA7\u51B2\u523A\n- [ ] \u6BCF\u65E5\u80CC\u8BCD\n- [ ] \u542C\u529B\u7CBE\u542C\n```\n\n\u628A\u5B8C\u6210\u7684\u4EFB\u52A1\u6539\u6210 `[x]` \u540E\u7C98\u56DE\u5FEB\u901F\u8BB0\u5F55\uFF1A\n\n```md\n#\u9879\u76EE\uFF1A\u82F1\u8BED\u56DB\u7EA7\u51B2\u523A\n- [x] \u6BCF\u65E5\u80CC\u8BCD\n- [ ] \u542C\u529B\u7CBE\u542C\n```\n\n\u89C4\u5219\uFF1A\n\n1. `- [x] \u6807\u9898` \u53EA\u5339\u914D\u540C\u9879\u76EE\u3001\u540C\u6807\u9898\u3001\u4ECA\u5929\u53D1\u751F\u7684\u4EFB\u52A1\u5E76\u5B8C\u6210\u5F53\u5929\u5B9E\u4F8B\u3002\n2. `- [ ] \u6807\u9898` \u4E0D\u521B\u5EFA\u4EFB\u52A1\uFF0C\u4E5F\u4E0D\u8986\u76D6\u4EFB\u52A1\u5B57\u6BB5\u3002\n3. \u627E\u4E0D\u5230\u4ECA\u65E5\u5DF2\u6709\u4EFB\u52A1\u65F6\u4F1A\u963B\u6B62\u5BFC\u5165\u3002\n\n## \u65B0\u4EFB\u52A1\u8BA1\u5212\u590D\u6742 Markdown\n\n\u590D\u6742 Markdown \u4F7F\u7528 `+ \u4EFB\u52A1\uFF1A`\u3001`+ \u7EC4\u5408\uFF1A` \u548C\u7F29\u8FDB\u7684 `+ \u5B50\u4EFB\u52A1\uFF1A`\u3002\n\n```md\n#\u9879\u76EE\uFF1A\u82F1\u8BED\u56DB\u7EA7\u51B2\u523A\n+ \u4EFB\u52A1\uFF1A\u642D\u5EFA\u590D\u4E60\u770B\u677F @2026-05-27 09:00-10:30 !high status:doing\n+ \u4EFB\u52A1\uFF1A\u6574\u7406\u9519\u9898\u7D22\u5F15 @2026-05-28 status:todo\n+ \u7EC4\u5408\uFF1A\u62C6\u89E3\u6BCF\u65E5\u80CC\u8BCD @2026-05-27 12:00-12:40 board:todo:0 gantt:order=20 mindmap:order=20,expanded\n  + \u5B50\u4EFB\u52A1\uFF1A\u590D\u4E60\u6628\u5929\u9519\u8BCD @2026-05-27 12:00-12:10 status:todo repeat:daily count:5\n  + \u5B50\u4EFB\u52A1\uFF1A\u65B0\u589E 30 \u4E2A\u9AD8\u9891\u8BCD @2026-05-27 12:10-12:30 status:doing repeat:monthly count:5\n  > \u6BCF\u5929\u5B8C\u6210\u540E\u53EF\u5728\u4ECA\u65E5\u4EFB\u52A1\u9875\u52FE\u9009\u3002\n```\n\n\u89C4\u5219\uFF1A\n\n1. `+ \u4EFB\u52A1\uFF1A` \u8868\u793A\u666E\u901A\u4EFB\u52A1\uFF1B\u5FC5\u987B\u5199\u663E\u5F0F\u65E5\u671F `@YYYY-MM-DD`\u3002\u53EF\u4EE5\u5199\u5B8C\u6574 `@YYYY-MM-DD HH:mm-HH:mm`\uFF0C\u4E5F\u53EF\u4EE5\u53EA\u5199\u65E5\u671F\u8868\u793A\u672A\u6392\u671F\u4EFB\u52A1\u3002\n2. `+ \u7EC4\u5408\uFF1A` \u8868\u793A\u5BB9\u5668\uFF1B\u5BB9\u5668\u4E0D\u652F\u6301\u72B6\u6001\u548C\u91CD\u590D\u89C4\u5219\u3002\n3. \u7F29\u8FDB\u4E24\u4E2A\u6216\u66F4\u591A\u7A7A\u683C\u7684 `+ \u5B50\u4EFB\u52A1\uFF1A` \u5FC5\u987B\u5199\u5728\u67D0\u4E2A `+ \u7EC4\u5408\uFF1A` \u4E0B\u65B9\uFF1B\u5B50\u4EFB\u52A1\u662F\u72EC\u7ACB\u666E\u901A\u4EFB\u52A1\u3002\n4. \u65F6\u95F4\u8303\u56F4\u4E3A `00:00` \u81F3 `23:59`\uFF0C\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4\u3002\n5. `#\u9879\u76EE\uFF1A\u9879\u76EE\u540D` \u8868\u793A\u540E\u7EED\u4EFB\u52A1\u5F52\u5165\u8BE5\u9879\u76EE\uFF1B\u9879\u76EE\u4E0D\u5B58\u5728\u65F6\u81EA\u52A8\u521B\u5EFA\u3002\n6. `#\u9879\u76EE\uFF1A` \u6216 `#\u9879\u76EE\uFF1A\u672A\u5F52\u5C5E\u9879\u76EE` \u8868\u793A\u672A\u5F52\u5C5E\u4EFB\u52A1\u3002\n7. \u9879\u76EE\u9875\u6279\u91CF\u5BFC\u5165\u65F6\uFF0C`#\u9879\u76EE\uFF1A` \u5FC5\u987B\u7B49\u4E8E\u5F53\u524D\u9879\u76EE\uFF1B\u540C\u9879\u76EE\u540C\u540D\u4EFB\u52A1\u4F1A\u88AB\u8986\u76D6\u8BA1\u5212\u5B57\u6BB5\u5E76\u4FDD\u7559\u65E2\u6709\u5B8C\u6210\u8BB0\u5F55\uFF0C\u5426\u5219\u521B\u5EFA\u65B0\u4EFB\u52A1\u3002\n8. \u65F6\u95F4\u51B2\u7A81\u4F1A\u81EA\u52A8\u8C03\u6574\u5230\u540C\u65E5 1 \u5206\u949F\u7A7A\u6863\u3002\n9. \u7F29\u8FDB\u4E24\u4E2A\u6216\u66F4\u591A\u7A7A\u683C\u7684 `>` \u884C\u662F\u4EFB\u52A1\u63CF\u8FF0\uFF0C\u5F52\u5165\u5B83\u524D\u9762\u6700\u8FD1\u7684\u4EFB\u52A1\u6216\u5B50\u4EFB\u52A1\uFF1B\u591A\u884C\u63CF\u8FF0\u4F1A\u7528\u6362\u884C\u8FDE\u63A5\u3002\n10. \u53C2\u6570\u7528\u7A7A\u683C\u5206\u9694\uFF1B\u4EFB\u52A1\u6807\u9898\u662F\u79FB\u9664 `@\u65E5\u671F`\u3001`!\u4F18\u5148\u7EA7`\u3001`status`\u3001`repeat` \u7B49\u53C2\u6570\u540E\u5269\u4E0B\u7684\u6587\u672C\u3002\n\n## \u590D\u6742 Markdown \u53C2\u6570\n\n| \u53C2\u6570 | \u793A\u4F8B | \u4F5C\u7528 |\n| --- | --- | --- |\n| `!\u4F18\u5148\u7EA7` | `!low`\u3001`!medium`\u3001`!high`\u3001`!urgent` | \u5199\u5165\u4EFB\u52A1\u4F18\u5148\u7EA7\u3002 |\n| `status` | `status:todo`\u3001`status:doing`\u3001`status:blocked`\u3001`status:done` | \u5199\u5165\u666E\u901A\u4EFB\u52A1\u6216\u5B50\u4EFB\u52A1\u72B6\u6001\u3002 |\n| `repeat` | `repeat:daily`\u3001`repeat:weekly`\u3001`repeat:monthly` | \u91CD\u590D\u89C4\u5219\u3002 |\n| `count` | `count:5` | \u91CD\u590D\u6B21\u6570\uFF1B\u5355\u6B21\u4EFB\u52A1\u4F7F\u7528 `count:1`\u3002 |\n| `until` | `until:2026-06-30` | \u91CD\u590D\u7ED3\u675F\u65E5\u671F\u3002 |\n| `board` | `board:doing:10` | \u770B\u677F\u5217\u4E0E\u6392\u5E8F\u3002 |\n| `gantt` | `gantt:order=10,locked,milestone` | \u7518\u7279\u56FE\u6392\u5E8F\u3001\u9501\u5B9A\u548C\u91CC\u7A0B\u7891\u3002 |\n| `deps` | `deps:%E4%BB%BB%E5%8A%A1A|%E4%BB%BB%E5%8A%A1B` | \u7518\u7279\u4F9D\u8D56\uFF0C\u4EFB\u52A1\u6807\u9898\u4F7F\u7528 URL \u7F16\u7801\u3002 |\n| `parent` | `parent:%E7%BB%84%E5%90%88%E4%BB%BB%E5%8A%A1A` | \u6302\u5165\u540C\u9879\u76EE\u4E0B\u6307\u5B9A\u7EC4\u5408\u4EFB\u52A1\u3002 |\n| `mindmap` | `mindmap:order=20,expanded,x=280,y=120` | \u601D\u7EF4\u5BFC\u56FE\u6392\u5E8F\u3001\u5C55\u5F00\u72B6\u6001\u548C\u5750\u6807\u3002 |\n\n## \u91CD\u590D\u89C4\u5219\u8865\u5145\n\n1. \u4E0D\u5199 `repeat` \u65F6\u9ED8\u8BA4\u4E3A\u5355\u6B21\u4EFB\u52A1\uFF0C\u5373 `daily + count:1`\u3002\n2. \u6C38\u4E45\u91CD\u590D\u5728\u5F39\u7A97\u4E2D\u4F5C\u4E3A\u5FEB\u6377\u9009\u62E9\u4FDD\u5B58\u4E3A `daily + count:2147483647`\u3002\n3. `consumeRequiresCompletion` \u53EA\u901A\u8FC7\u5F39\u7A97\u548C\u6570\u636E\u8FC1\u79FB JSON \u4FDD\u5B58\uFF0C\u590D\u6742 Markdown \u4E0D\u5199\u6B64\u5B57\u6BB5\u3002\n\n## \u7B14\u8BB0\u540C\u6B65\u5757\n\n\u5168\u5E93 Markdown \u626B\u63CF\u53EA\u8BFB\u53D6 `pm:start` \u4E0E `pm:end` \u4E4B\u95F4\u7684\u590D\u6742 Markdown\uFF1A\n\n```md\n<!-- pm:start -->\n#\u9879\u76EE\uFF1A\u82F1\u8BED\u56DB\u7EA7\u51B2\u523A\n+ \u4EFB\u52A1\uFF1A\u542C\u529B\u7CBE\u542C @2026-05-27 20:00-20:30 status:todo\n<!-- pm:end -->\n```\n';

// src/utils/markdownGuide.ts
var MARKDOWN_FORMAT_GUIDE = markdown_type_default.trimEnd();

// src/domain/occurrenceSchedule.ts
function isCompletionGatedTask(task) {
  return isExecutableTask(task) && task.consumeRequiresCompletion;
}
function getEffectiveOccurrenceDates(task, referenceDate) {
  if (!isCompletionGatedTask(task)) {
    return [...task.occurrenceDates];
  }
  const completedDates = getCompletedOccurrenceDates(task);
  const activeDate = getCompletionGatedActiveDate(task, referenceDate);
  return uniqueDateKeys(activeDate ? [...completedDates, activeDate] : completedDates);
}
function getCompletionGatedActiveDate(task, referenceDate) {
  if (!isCompletionGatedTask(task)) {
    return null;
  }
  const progress = getTaskExecutionProgress(task);
  if (progress.completedSeries) {
    return null;
  }
  const completedDates = getCompletedOccurrenceDates(task);
  const dueDate = completedDates.length === 0 ? task.date : toDateKey(nextRecurrenceDateAfter(parseDateKey(completedDates[completedDates.length - 1]), task));
  const activeDate = compareDateKeys(dueDate, referenceDate) < 0 ? referenceDate : dueDate;
  if (task.recurrenceUntil && compareDateKeys(activeDate, task.recurrenceUntil) > 0) {
    return null;
  }
  return activeDate;
}
function isOccurrenceDateAvailable(task, date, referenceDate) {
  if (task.occurrenceDates.includes(date)) {
    return true;
  }
  return getEffectiveOccurrenceDates(task, referenceDate).includes(date);
}
function getTaskExecutionProgress(task) {
  if (!isExecutableTask(task)) {
    return { total: 0, completed: 0, remaining: 0, completedSeries: false };
  }
  const completed = getCompletedOccurrenceCount(task);
  if (task.consumeRequiresCompletion) {
    const total2 = getExecutionTargetCount(task);
    return {
      total: total2,
      completed,
      remaining: Math.max(0, total2 - completed),
      completedSeries: total2 > 0 && completed >= total2
    };
  }
  const total = task.occurrenceDates.filter((date) => {
    if (task.occurrenceStates.some((state) => state.date === date)) {
      return true;
    }
    return !isAttentionStatus(task.status);
  }).length;
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    completedSeries: total > 0 && completed >= total
  };
}
function appendOccurrenceDate(task, date) {
  if (task.occurrenceDates.includes(date)) {
    return task;
  }
  task.occurrenceDates = uniqueDateKeys([...task.occurrenceDates, date]);
  return task;
}
function occurrenceExecutionLabel(occurrence) {
  if (!occurrence.consumeRequiresCompletion || !occurrence.recurrenceCount || occurrence.recurrenceCount <= 1) {
    return null;
  }
  const consumed = occurrence.completed ? occurrence.occurrenceNumber : Math.max(0, occurrence.occurrenceNumber - 1);
  const remaining = Math.max(0, occurrence.recurrenceCount - consumed);
  return `\u5269\u4F59 ${remaining} \u6B21`;
}
function getExecutionTargetCount(task) {
  return Math.max(1, task.recurrenceCount ?? task.occurrenceDates.length);
}
function getCompletedOccurrenceCount(task) {
  return getCompletedOccurrenceDates(task).length;
}
function getCompletedOccurrenceDates(task) {
  return uniqueDateKeys(task.occurrenceStates.filter((state) => Boolean(state.completedAt)).map((state) => state.date));
}
function nextRecurrenceDateAfter(reference, task) {
  if (task.recurrence === "weekly") {
    const anchorWeekday = parseDateKey(task.date).getDay();
    const dayOffset = (anchorWeekday - reference.getDay() + 7) % 7 || 7;
    return addDays(reference, dayOffset);
  }
  if (task.recurrence === "monthly") {
    const anchorDay = parseDateKey(task.date).getDate();
    const sameMonth = addMonthsKeepingAnchorDay(new Date(reference.getFullYear(), reference.getMonth(), 1), 0, anchorDay);
    if (sameMonth.getTime() > reference.getTime()) {
      return sameMonth;
    }
    return addMonthsKeepingAnchorDay(reference, 1, anchorDay);
  }
  return addDays(reference, 1);
}
function uniqueDateKeys(dates) {
  return [...new Set(dates)].sort(compareDateKeys);
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
  showCompletedTasks: true,
  defaultTaskDurationMinutes: 30,
  defaultTaskStartTime: "07:00",
  dailyNoteFolder: "\u65E5\u8BB0",
  dailyNoteDateFormat: "YYYY-MM-DD",
  dailyNoteMode: "per-day",
  dailyNoteSingleFilePath: "\u65E5\u8BB0/\u5FEB\u901F\u8BB0\u5F55.md",
  taskNoteRecentLimit: 8,
  defaultDialogTarget: "daily-note",
  noteAppendHeader: {
    enabled: true,
    headingLevel: 2,
    includeTime: true,
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm:ss",
    separator: " ",
    prefix: "",
    suffix: ""
  },
  dailyNoteHeader: {
    enabled: true,
    headingLevel: 2,
    includeTime: true,
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH:mm:ss",
    separator: " ",
    prefix: "",
    suffix: ""
  }
};
var PROJECTS_FILE = "projects.json";
var PROGRESS_FILE = "project-pages.json";
var CONFIG_FILE = "config.json";
var NOTE_TASK_INDEX_FILE = "note-task-index.json";
var WRITE_HISTORY_FILE = "write-history.json";
var TASKS_DIR = "tasks";
var MARKDOWN_GUIDE_FILE = "markdown-format-guide.md";
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
  getWriteHistory() {
    return this.writeHistory.map((record) => ({ ...record, taskIds: [...record.taskIds] }));
  }
  getRecentDialogFilePaths(limit = 10) {
    const unique = /* @__PURE__ */ new Set();
    for (const record of this.writeHistory) {
      if (record.type !== "dialog") {
        continue;
      }
      const path = typeof record.after === "object" && record.after && "path" in record.after && typeof record.after.path === "string" ? record.after.path : void 0;
      if (!path || unique.has(path)) {
        continue;
      }
      unique.add(path);
      if (unique.size >= limit) {
        break;
      }
    }
    return [...unique];
  }
  async recordDialogWrite(path, summary) {
    await this.recordWriteHistory({
      type: "dialog",
      summary,
      taskIds: [],
      after: { path }
    });
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
    const referenceDate = toDateKey(now());
    return this.getAllTasks().flatMap((task) => expandTask(task, referenceDate)).sort(compareOccurrences);
  }
  getTasksForDate(date) {
    return this.getAllTasks().flatMap((task) => expandTask(task, date)).filter((task) => task.date === date).sort(compareOccurrences);
  }
  getTasksForProject(projectId) {
    return this.getAllTasks().filter((task) => task.projectId === projectId).sort(compareSeriesTasks);
  }
  getCompositeTasks(projectId) {
    return this.getAllTasks().filter((task) => task.kind === "composite" && (projectId === void 0 || task.projectId === projectId)).sort(compareSeriesTasks);
  }
  getChildTasks(parentTaskId) {
    return this.getAllTasks().filter((task) => (task.viewState.mindmap.parentTaskId ?? null) === parentTaskId).sort((left, right) => left.viewState.mindmap.childOrder - right.viewState.mindmap.childOrder || compareSeriesTasks(left, right));
  }
  getOccurrencesForProject(projectId) {
    return this.getAllTaskOccurrences().filter((task) => task.projectId === projectId).sort(compareOccurrences);
  }
  getOccurrencesForTask(taskId) {
    const task = this.findTask(taskId);
    return task ? expandTask(task, toDateKey(now())).sort(compareOccurrences) : [];
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
    const allowed = /* @__PURE__ */ new Set([CONFIG_FILE, PROJECTS_FILE, PROGRESS_FILE, NOTE_TASK_INDEX_FILE, WRITE_HISTORY_FILE, MARKDOWN_GUIDE_FILE, TASKS_DIR]);
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
    this.assertCompositeTaskConsistency([created], /* @__PURE__ */ new Set());
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
      recurrenceCount: patch.recurrenceCount === void 0 ? original.recurrenceCount ?? void 0 : patch.recurrenceCount,
      recurrenceUntil: patch.recurrenceUntil === void 0 ? original.recurrenceUntil ?? void 0 : patch.recurrenceUntil,
      consumeRequiresCompletion: patch.consumeRequiresCompletion === void 0 ? original.consumeRequiresCompletion : patch.consumeRequiresCompletion,
      occurrenceDates: patch.occurrenceDates ?? original.occurrenceDates,
      occurrenceOverrides: patch.occurrenceOverrides ?? original.occurrenceOverrides,
      subtasks: patch.subtasks ?? original.subtasks,
      viewState: patch.viewState ?? original.viewState,
      sourceLinks: patch.sourceLinks ?? original.sourceLinks,
      notes: patch.notes ?? original.notes,
      mindmapComments: patch.mindmapComments ?? original.mindmapComments,
      completed: patch.completed ?? isTaskFullyCompleted2(original)
    });
    const built = this.buildSeriesTask(merged, original, patch.completed);
    const [next] = options.autoResolveConflicts ? this.autoResolveTaskConflicts([built], occurrenceKeysForTask(original)) : [built];
    if (!next) {
      throw new Error("\u4EFB\u52A1\u66F4\u65B0\u5931\u8D25");
    }
    assertValidTaskMindmapParent(next, this.getAllTasks().filter((task) => task.id !== original.id));
    this.assertCompositeTaskConsistency([next], /* @__PURE__ */ new Set([original.id]));
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
    if (!isOccurrenceDateAvailable(original, date, date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const next = cloneTask(original);
    appendOccurrenceDate(next, date);
    next.occurrenceStates = completed ? upsertOccurrenceState(original, date, {
      completedSubtaskIds: getAllSubtaskIds(original),
      completedAt: toIsoLocal(now())
    }) : next.occurrenceStates.filter((item) => item.date !== date);
    next.updatedAt = toIsoLocal(now());
    next.revision = (next.revision ?? 0) + 1;
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
    next.revision = (next.revision ?? 0) + 1;
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }
  async updateTaskOccurrenceDetails(taskId, date, patch) {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    if (!isOccurrenceDateAvailable(original, date, date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const source = cloneTask(original);
    appendOccurrenceDate(source, date);
    if (source.occurrenceDates.length === 1) {
      await this.updateTask(
        taskId,
        {
          title: patch.title ?? source.title,
          description: patch.description ?? source.description,
          startTime: patch.startTime ?? source.startTime,
          endTime: patch.endTime ?? source.endTime
        },
        "series"
      );
      return;
    }
    const occurrence = expandTask(source, date).find((item) => item.date === date);
    if (!occurrence) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const title = (patch.title ?? occurrence.title).trim();
    if (!title) {
      throw new Error("\u4EFB\u52A1\u6807\u9898\u4E0D\u80FD\u4E3A\u7A7A");
    }
    const description = patch.description === void 0 ? occurrence.description ?? "" : patch.description.trim();
    const start = patch.startTime === void 0 ? occurrence.startTime ?? "" : normalizeClockTime(patch.startTime, "\u5F00\u59CB\u65F6\u95F4") ?? "";
    const end = patch.endTime === void 0 ? occurrence.endTime ?? "" : normalizeClockTime(patch.endTime, "\u7ED3\u675F\u65F6\u95F4") ?? "";
    if (start && !end || !start && end) {
      throw new Error("\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u540C\u65F6\u586B\u5199");
    }
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    if (startMinutes !== null && endMinutes !== null && startMinutes >= endMinutes) {
      throw new Error("\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4");
    }
    const next = cloneTask(source);
    next.occurrenceOverrides = replaceOccurrenceOverride(
      next,
      date,
      buildOccurrenceDetailsOverride(source, date, {
        title,
        description,
        startTime: start || void 0,
        endTime: end || void 0
      })
    );
    next.updatedAt = toIsoLocal(now());
    next.revision = (next.revision ?? 0) + 1;
    this.assertCompositeTaskConsistency([next], /* @__PURE__ */ new Set([original.id]));
    this.assertNoConflicts([next], occurrenceKeysForTask(original));
    this.replaceTasks([original.id], [next]);
    await this.persistMonths(monthsForTasks([original, next]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }
  async updateTaskOccurrenceWindow(taskId, date, startTime, endTime) {
    await this.updateTaskOccurrenceDetails(taskId, date, { startTime, endTime });
  }
  async patchTask(taskId, patch) {
    this.assertWritable();
    const original = this.findTask(taskId);
    if (!original) {
      throw new Error("\u4EFB\u52A1\u4E0D\u5B58\u5728");
    }
    const next = cloneTask(original);
    if (patch.status && next.kind !== "composite") {
      next.status = normalizeTaskStatus2(patch.status);
      next.viewState = mergeViewState2(next.viewState, { board: { ...next.viewState.board, columnId: next.status } }, next.status);
    }
    if (patch.priority !== void 0 && next.kind !== "composite") {
      next.priority = normalizeTaskPriority2(patch.priority);
    }
    next.tags = [];
    if (patch.viewState) {
      next.viewState = mergeViewState2(next.viewState, patch.viewState, next.status);
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
    this.assertCompositeTaskConsistency([next], /* @__PURE__ */ new Set([original.id]));
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
    const migration = parseDataMigrationText(text);
    if (migration.kind === "invalid") {
      return {
        ...createEmptyTaskImportPreview(),
        sourceFormat: "data-migration",
        issues: migration.issues
      };
    }
    if (migration.kind === "package") {
      return this.buildDataMigrationImportPreview(migration.package);
    }
    const parsed = parseFormattedTaskText(text, {
      projects: this.projects,
      projectId: options.projectId,
      strictProjectId: options.strictProjectId,
      defaultDate: options.defaultDate ?? toDateKey(now()),
      source: options.source
    });
    return this.buildTaskImportPreview(parsed.tasks, parsed.issues);
  }
  async importFormattedTasks(text, options = {}) {
    this.assertWritable();
    const migration = parseDataMigrationText(text);
    if (migration.kind === "invalid") {
      const issue = migration.issues[0];
      throw new Error(issue ? `\u7B2C ${issue.line} \u884C\uFF1A${issue.message}` : "\u6570\u636E\u8FC1\u79FB JSON \u89E3\u6790\u5931\u8D25");
    }
    if (migration.kind === "package") {
      return this.importDataMigrationPackage(migration.package, options.historySummary);
    }
    const preview = this.previewFormattedTasks(text, options);
    const blockingIssue = preview.issues.find((issue) => issue.blocking);
    if (blockingIssue) {
      throw new Error(`\u7B2C ${blockingIssue.line} \u884C\uFF1A${blockingIssue.message}`);
    }
    if (preview.tasks.length === 0) {
      throw new Error(preview.issues[0]?.message ?? "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u4EFB\u52A1");
    }
    const changed = [];
    const applied = [];
    for (const entry of preview.tasks) {
      const task = await this.applyImportTask(entry);
      changed.push(task);
      applied.push({ entry, task });
    }
    for (const item of applied) {
      if (!item.entry.dependencyTitles?.length) {
        continue;
      }
      const current = this.getTask(item.task.id);
      if (!current) {
        continue;
      }
      const dependencyIds = item.entry.dependencyTitles.map((title) => this.findTaskByTitle(title, current.projectId)?.id).filter((id) => Boolean(id));
      await this.patchTask(current.id, {
        viewState: {
          gantt: {
            ...current.viewState.gantt,
            dependencyIds
          }
        }
      });
    }
    await this.recordWriteHistory({
      type: options.source?.type === "note" ? "note-sync" : "import",
      summary: options.historySummary ?? `\u6279\u91CF\u5BFC\u5165 ${preview.summary.total} \u6761\uFF1A\u65B0\u589E ${preview.summary.createCount}\uFF0C\u8986\u76D6 ${preview.summary.overwriteCount}\uFF0C\u5B8C\u6210\u4ECA\u65E5 ${preview.summary.completeTodayCount}\uFF0C\u63D0\u524D\u7ED3\u675F ${preview.summary.completeSeriesCount}`,
      taskIds: [...new Set(changed.map((task) => task.id))]
    });
    return changed;
  }
  exportTasksAsMinimalCompletionText(tasks) {
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
        sections.push(`- [${task.completed ? "x" : " "}] ${task.title}`);
      });
    });
    return sections.join("\n").trim();
  }
  exportProjectAsFormattedText(projectId) {
    const project = this.getProject(projectId);
    if (!project) {
      throw new Error("\u9879\u76EE\u4E0D\u5B58\u5728");
    }
    const tasks = this.getTasksForProject(projectId);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const childrenByParent = /* @__PURE__ */ new Map();
    const childTaskIds = /* @__PURE__ */ new Set();
    tasks.forEach((task) => {
      const parentId = task.viewState.mindmap.parentTaskId ?? null;
      const parent = parentId ? taskById.get(parentId) : void 0;
      if (parent?.kind !== "composite") {
        return;
      }
      childTaskIds.add(task.id);
      childrenByParent.set(parent.id, [...childrenByParent.get(parent.id) ?? [], task]);
    });
    childrenByParent.forEach((children, parentId) => childrenByParent.set(parentId, children.slice().sort(compareSeriesTasks)));
    const topLevelTasks = tasks.filter((task) => !childTaskIds.has(task.id)).sort(compareSeriesTasks);
    const dependencyTitleForId = (taskId) => tasks.find((task) => task.id === taskId)?.title;
    const lines = [`#\u9879\u76EE\uFF1A${project.name}`];
    topLevelTasks.forEach((task) => {
      lines.push(renderTaskSeriesForExport(task, { dependencyTitleForId }));
      renderDescriptionForExport(task.description).forEach((line) => {
        lines.push(line);
      });
      (childrenByParent.get(task.id) ?? []).forEach((child) => {
        lines.push(renderTaskSeriesForExport(child, { child: true, dependencyTitleForId }));
        renderDescriptionForExport(child.description).forEach((line) => {
          lines.push(`  ${line}`);
        });
      });
    });
    return lines.join("\n").trim();
  }
  exportAllRecordsAsDataMigrationJson() {
    return buildDataMigrationJson({
      projects: this.getProjects(),
      progressPages: this.getProgressPages(),
      tasks: this.getAllTasks().sort(compareSeriesTasks),
      exportedAt: toIsoLocal(now())
    });
  }
  async exportMarkdownGuide() {
    this.assertWritable();
    const path = this.pathFor(MARKDOWN_GUIDE_FILE);
    await this.enqueueWrite(() => this.writeText(path, MARKDOWN_FORMAT_GUIDE));
    return path;
  }
  async autoArrangeDate(date, options = {}) {
    this.assertWritable();
    assertMutableOccurrenceDate(date);
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
        const isPastInput = compareDateKeys(input.date, toDateKey(now())) < 0;
        const saved = existingTask ? await this.updateTask(existingTask.id, { ...input, completed: false }, "series", { autoResolveConflicts: true }) : await this.createTask({ ...input, completed: input.completed && (parsedTask.completionMode === "pending" || isPastInput) }, { autoResolveConflicts: true });
        if (isPastInput) {
          createdIds.push(saved.id);
          continue;
        }
        if (input.completed && parsedTask.completionMode === "today") {
          await this.updateTaskOccurrenceCompletion(saved.id, input.date, true);
        } else if (input.completed && parsedTask.completionMode === "series") {
          await this.completeTaskSeries(saved.id);
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
    const timestamp = toIsoLocal(now());
    const childrenToReparent = this.getAllTasks().filter((candidate) => (candidate.viewState.mindmap.parentTaskId ?? null) === taskId);
    const childMutations = childrenToReparent.map((child, index) => {
      const next = cloneTask(child);
      next.viewState = mergeViewState2(next.viewState, {
        mindmap: {
          ...next.viewState.mindmap,
          parentTaskId: task.viewState.mindmap.parentTaskId ?? null,
          childOrder: Date.now() + index
        }
      }, next.status);
      next.updatedAt = timestamp;
      next.revision = (next.revision ?? 0) + 1;
      return next;
    });
    const childIds = new Set(childrenToReparent.map((child) => child.id));
    const removed = this.replaceTasks([taskId, ...childIds], childMutations);
    await this.persistMonths(monthsForTasks([...removed, ...childMutations]));
    await this.reloadCurrentFolderData();
    this.trigger("changed");
  }
  async deleteTaskOccurrence(taskId, date) {
    this.assertWritable();
    const task = this.findTask(taskId);
    if (!task) {
      return;
    }
    if (!isOccurrenceDateAvailable(task, date, date)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const source = cloneTask(task);
    appendOccurrenceDate(source, date);
    const executionProgress = getTaskExecutionProgress(source);
    if (source.occurrenceDates.length === 1 || isCompletionGatedTask(source) && executionProgress.total <= 1) {
      const removed = this.replaceTasks([task.id], []);
      await this.persistMonths(monthsForTasks(removed));
      await this.reloadCurrentFolderData();
      this.trigger("changed");
      return;
    }
    if (isCompletionGatedTask(source)) {
      const next2 = cloneTask(source);
      next2.occurrenceDates = source.occurrenceDates.filter((entry) => entry !== date);
      next2.occurrenceStates = source.occurrenceStates.filter((entry) => entry.date !== date);
      next2.occurrenceOverrides = replaceOccurrenceOverride(next2, date, { date, skipped: true, reason: "deleted" });
      next2.recurrenceCount = Math.max(1, executionProgress.total - 1);
      next2.updatedAt = toIsoLocal(now());
      next2.revision = (next2.revision ?? 0) + 1;
      this.assertCompositeTaskConsistency([next2], /* @__PURE__ */ new Set([task.id]));
      this.replaceTasks([task.id], [next2]);
      await this.persistMonths(monthsForTasks([task, next2]));
      await this.reloadCurrentFolderData();
      this.trigger("changed");
      return;
    }
    const next = cloneTask(source);
    next.occurrenceDates = source.occurrenceDates.filter((entry) => entry !== date);
    next.occurrenceStates = source.occurrenceStates.filter((entry) => entry.date !== date);
    next.occurrenceOverrides = source.occurrenceOverrides.filter((entry) => entry.date !== date);
    if (next.occurrenceDates.length > 0) {
      next.date = next.occurrenceDates[0];
      next.recurrence = detectRecurrenceFromDates(next.occurrenceDates);
      next.recurrenceCount = next.occurrenceDates.length;
      next.recurrenceUntil = next.occurrenceDates.length > 1 ? next.occurrenceDates[next.occurrenceDates.length - 1] : null;
    }
    next.updatedAt = toIsoLocal(now());
    next.revision = (next.revision ?? 0) + 1;
    this.assertCompositeTaskConsistency([next], /* @__PURE__ */ new Set([task.id]));
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
    if (!isOccurrenceDateAvailable(task, effectiveDate, effectiveDate)) {
      throw new Error("\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u4E0D\u5B58\u5728");
    }
    const source = cloneTask(task);
    appendOccurrenceDate(source, effectiveDate);
    const next = cloneTask(source);
    const effectiveDates = isCompletionGatedTask(source) ? getEffectiveOccurrenceDates(source, effectiveDate) : source.occurrenceDates;
    const datesToComplete = effectiveDates.filter((date) => compareDateKeys(date, effectiveDate) <= 0);
    if (datesToComplete.length === 0) {
      throw new Error("\u6CA1\u6709\u53EF\u4FDD\u7559\u7684\u4EFB\u52A1\u53D1\u751F\u65E5\u671F");
    }
    const stamp = toIsoLocal(now());
    next.occurrenceDates = datesToComplete;
    next.occurrenceOverrides = source.occurrenceOverrides.filter((entry) => datesToComplete.includes(entry.date));
    next.occurrenceStates = datesToComplete.reduce((records, date) => {
      const existing = getOccurrenceState(source, date);
      records.push(
        buildNormalizedOccurrenceState(date, source.kind, source.subtasks, getAllSubtaskIds(source), existing?.completedAt ?? stamp)
      );
      return records;
    }, []);
    next.date = next.occurrenceDates[0];
    if (isCompletionGatedTask(next)) {
      next.recurrenceCount = next.occurrenceDates.length;
      next.recurrenceUntil = null;
    } else {
      next.recurrence = detectRecurrenceFromDates(next.occurrenceDates);
      next.recurrenceCount = next.occurrenceDates.length;
      next.recurrenceUntil = next.occurrenceDates.length > 1 ? next.occurrenceDates[next.occurrenceDates.length - 1] : null;
    }
    next.updatedAt = stamp;
    next.revision = (next.revision ?? 0) + 1;
    this.assertCompositeTaskConsistency([next], /* @__PURE__ */ new Set([task.id]));
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
    const progress = summarizeOccurrencesProgress(this.getOccurrencesForProject(projectId).filter((occurrence) => occurrence.kind === "simple"));
    if (progress.totalSteps === 0) {
      return 0;
    }
    return Math.round(progress.completedSteps / progress.totalSteps * 100);
  }
  buildTaskImportPreview(tasks, issues) {
    const newProjectNames = /* @__PURE__ */ new Set();
    const previewTasks = [];
    tasks.forEach((entry) => {
      const projectResolution = this.resolveImportProject(entry);
      const isCompletionInput = entry.input.completed === true;
      const isPlannedInput = entry.syntax === "planned";
      const matched = isCompletionInput ? this.findTaskByCompletionIdentity(entry.input.title, projectResolution.projectId, entry.input.date) : this.findTaskByImportIdentity(entry.input.title, projectResolution.projectId, entry.input.date);
      if (!matched && !entry.createReady) {
        issues.push({
          line: entry.line,
          raw: entry.raw,
          blocking: true,
          message: isCompletionInput ? `\u6CA1\u6709\u627E\u5230\u4ECA\u65E5\u5DF2\u6709\u4EFB\u52A1\u300C${entry.input.title}\u300D\uFF0C\u6781\u7B80\u5B8C\u6210\u8F93\u5165\u4E0D\u4F1A\u521B\u5EFA\u65B0\u4EFB\u52A1` : isPlannedInput ? "\u521B\u5EFA\u4EFB\u52A1\u5FC5\u987B\u63D0\u4F9B\u65E5\u671F\uFF0C\u4F8B\u5982 @2026-05-25\uFF1B\u666E\u901A\u4EFB\u52A1\u7684\u65F6\u95F4\u6BB5\u53EF\u7701\u7565" : "\u6781\u7B80\u672A\u5B8C\u6210\u884C\u4E0D\u4F1A\u521B\u5EFA\u4EFB\u52A1\uFF1B\u521B\u5EFA\u4EFB\u52A1\u8BF7\u4F7F\u7528\u300C+ \u4EFB\u52A1\uFF1A\u300D\u8BA1\u5212\u8BED\u6CD5"
        });
        return;
      }
      if (matched && !isCompletionInput && !entry.createReady) {
        issues.push({
          line: entry.line,
          raw: entry.raw,
          blocking: true,
          message: isPlannedInput ? "\u8986\u76D6\u4EFB\u52A1\u5FC5\u987B\u63D0\u4F9B\u65E5\u671F\uFF0C\u4F8B\u5982 @2026-05-25\uFF1B\u666E\u901A\u4EFB\u52A1\u7684\u65F6\u95F4\u6BB5\u53EF\u7701\u7565" : "\u6781\u7B80\u672A\u5B8C\u6210\u884C\u4E0D\u4F1A\u521B\u5EFA\u6216\u8986\u76D6\u4EFB\u52A1\uFF1B\u8986\u76D6\u4EFB\u52A1\u8BF7\u4F7F\u7528\u300C+ \u4EFB\u52A1\uFF1A\u300D\u8BA1\u5212\u8BED\u6CD5"
        });
        return;
      }
      if (isPlannedInput && entry.input.kind === "composite" && !entry.hasTimeRange) {
        issues.push({
          line: entry.line,
          raw: entry.raw,
          blocking: true,
          message: "\u7EC4\u5408\u4EFB\u52A1\u5FC5\u987B\u63D0\u4F9B\u5B8C\u6574\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\uFF0C\u4F8B\u5982 @2026-05-25 09:00-09:30"
        });
        return;
      }
      if (isPlannedInput && entry.parentTitle && !entry.hasTimeRange) {
        issues.push({
          line: entry.line,
          raw: entry.raw,
          blocking: true,
          message: "\u7EC4\u5408\u4EFB\u52A1\u7684\u5B50\u4EFB\u52A1\u5FC5\u987B\u63D0\u4F9B\u5B8C\u6574\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\uFF0C\u4F8B\u5982 @2026-05-25 09:00-09:30"
        });
        return;
      }
      if (projectResolution.newProjectName) {
        newProjectNames.add(projectResolution.newProjectName);
      }
      previewTasks.push({
        line: entry.line,
        raw: entry.raw,
        input: {
          ...entry.input,
          projectId: projectResolution.projectId,
          viewState: applyMarkdownReferencePreview(entry.input.viewState, entry.parentTitle)
        },
        projectId: projectResolution.projectId,
        projectName: projectResolution.projectName,
        parentTitle: entry.parentTitle,
        dependencyTitles: entry.dependencyTitles,
        matchedTaskId: matched?.id,
        matchedTaskTitle: matched?.title,
        action: resolveTaskImportAction(Boolean(matched), entry.completionMode, isCompletionInput),
        completionMode: entry.completionMode
      });
    });
    const isPlannedMarkdown = tasks.length > 0 && tasks.every((task) => task.syntax === "planned" && task.input.completed !== true);
    return {
      sourceFormat: isPlannedMarkdown ? "markdown-planned" : "markdown-minimal",
      tasks: previewTasks,
      issues,
      summary: {
        total: previewTasks.length,
        completed: previewTasks.filter((task) => task.input.completed || (task.input.completedOccurrenceDates?.length ?? 0) > 0).length,
        composite: previewTasks.filter((task) => task.input.kind === "composite").length,
        createCount: previewTasks.filter((task) => task.action === "create").length,
        overwriteCount: previewTasks.filter((task) => task.action === "overwrite").length,
        completeTodayCount: previewTasks.filter((task) => task.action === "complete-today").length,
        completeSeriesCount: previewTasks.filter((task) => task.action === "complete-series").length,
        newProjectNames: [...newProjectNames]
      }
    };
  }
  buildDataMigrationImportPreview(records) {
    const importedTasks = dataMigrationPackageToTasks(records);
    const projectPlan = buildDataMigrationProjectPlan(records.projects, this.projects);
    const taskPlan = buildDataMigrationTaskPlan(importedTasks, this.getAllTasks(), projectPlan.projectIdBySourceId);
    const dataMigration = summarizeDataMigrationPackage(records);
    const previewTasks = importedTasks.map((task) => {
      const targetTaskId = taskPlan.taskIdBySourceId.get(task.id) ?? task.id;
      const targetProjectId = task.projectId ? projectPlan.projectIdBySourceId.get(task.projectId) ?? task.projectId : void 0;
      const matched = this.findTask(targetTaskId) ?? findTaskByMigrationIdentity(this.getAllTasks(), task.title, targetProjectId, task.date);
      return {
        line: 0,
        raw: task.title,
        input: taskToDataMigrationImportInput(task, targetProjectId),
        projectId: targetProjectId,
        projectName: targetProjectId ? this.getProject(targetProjectId)?.name ?? records.projects.find((project) => project.id === task.projectId)?.name : UNASSIGNED_PROJECT_LABEL,
        matchedTaskId: matched?.id,
        matchedTaskTitle: matched?.title,
        action: matched ? "overwrite" : "create",
        completionMode: "pending"
      };
    });
    return {
      sourceFormat: "data-migration",
      tasks: previewTasks,
      issues: [],
      dataMigration,
      summary: {
        total: records.tasks.length,
        completed: importedTasks.filter(isTaskFullyCompleted2).length,
        composite: dataMigration.compositeTasks,
        createCount: taskPlan.createCount,
        overwriteCount: taskPlan.overwriteCount,
        completeTodayCount: 0,
        completeSeriesCount: 0,
        newProjectNames: projectPlan.newProjectNames
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
      (task) => normalizeImportIdentity2(task.title) === normalizeImportIdentity2(title) && (task.projectId ?? void 0) === projectId
    );
    const sameDate = sameProject.find((task) => isOccurrenceDateAvailable(task, date, date));
    if (sameDate) {
      return sameDate;
    }
    return sameProject.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }
  findTaskByCompletionIdentity(title, projectId, date) {
    return this.getAllTasks().find(
      (task) => normalizeImportIdentity2(task.title) === normalizeImportIdentity2(title) && (task.projectId ?? void 0) === projectId && isOccurrenceDateAvailable(task, date, date)
    );
  }
  findTaskByTitle(title, projectId) {
    return this.getAllTasks().filter((task) => normalizeImportIdentity2(task.title) === normalizeImportIdentity2(title) && (task.projectId ?? void 0) === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }
  findCompositeTaskByTitle(title, projectId) {
    return this.getAllTasks().filter((task) => task.kind === "composite").filter((task) => normalizeImportIdentity2(task.title) === normalizeImportIdentity2(title) && (task.projectId ?? void 0) === projectId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];
  }
  resolveMarkdownViewState(viewState, parentTaskId, dependencyTitles, projectId) {
    const dependencyIds = dependencyTitles.map((title) => this.findTaskByTitle(title, projectId)?.id).filter((id) => Boolean(id));
    return {
      ...viewState ?? {},
      gantt: {
        ...viewState?.gantt ?? {},
        rowOrder: viewState?.gantt?.rowOrder ?? 0,
        dependencyIds,
        locked: viewState?.gantt?.locked ?? false,
        milestone: viewState?.gantt?.milestone ?? false
      },
      mindmap: {
        ...viewState?.mindmap ?? {},
        parentTaskId,
        childOrder: viewState?.mindmap?.childOrder ?? Date.now(),
        expanded: viewState?.mindmap?.expanded ?? true
      }
    };
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
    const parent = entry.parentTitle ? this.findCompositeTaskByTitle(entry.parentTitle, projectId) : void 0;
    if (entry.parentTitle && !parent) {
      throw new Error(`\u672A\u627E\u5230\u7EC4\u5408\u4EFB\u52A1\u300C${entry.parentTitle}\u300D\uFF0C\u65E0\u6CD5\u6302\u5165\u5B50\u4EFB\u52A1`);
    }
    const input = {
      ...entry.input,
      projectId,
      kind: parent ? "simple" : entry.input.kind,
      subtasks: [],
      viewState: this.resolveMarkdownViewState(entry.input.viewState, parent?.id ?? null, entry.dependencyTitles ?? [], projectId)
    };
    const existing = entry.action === "complete-today" || entry.action === "complete-series" ? this.findTaskByCompletionIdentity(input.title, projectId, input.date) : this.findTaskByImportIdentity(input.title, projectId, input.date);
    if (existing) {
      if (entry.action === "complete-today") {
        await this.updateTaskOccurrenceCompletion(existing.id, input.date, true);
        return this.getTask(existing.id) ?? existing;
      }
      if (entry.action === "complete-series") {
        await this.completeTaskSeries(existing.id, input.date);
        return this.getTask(existing.id) ?? existing;
      }
      const normalizedPatch = {
        ...input,
        completed: false
      };
      const updated = await this.updateTask(existing.id, normalizedPatch, "series", { autoResolveConflicts: true });
      return updated;
    }
    const created = await this.createTask(
      {
        ...input,
        completed: input.completed && (entry.completionMode === "pending" || compareDateKeys(input.date, toDateKey(now())) < 0)
      },
      { autoResolveConflicts: true }
    );
    if (compareDateKeys(input.date, toDateKey(now())) < 0) {
      return this.getTask(created.id) ?? created;
    }
    if (input.completed && entry.completionMode === "today") {
      await this.updateTaskOccurrenceCompletion(created.id, input.date, true);
      return this.getTask(created.id) ?? created;
    }
    if (input.completed && entry.completionMode === "series") {
      await this.completeTaskSeries(created.id);
      return this.getTask(created.id) ?? created;
    }
    return created;
  }
  async importDataMigrationPackage(records, historySummary) {
    this.assertWritable();
    const importedTasks = dataMigrationPackageToTasks(records);
    const projectPlan = buildDataMigrationProjectPlan(records.projects, this.projects);
    const progressPages = remapDataMigrationProgressPages(records.progressPages, projectPlan.projectIdBySourceId, this.progressPages);
    const taskPlan = buildDataMigrationTaskPlan(importedTasks, this.getAllTasks(), projectPlan.projectIdBySourceId);
    const nextTasks = taskPlan.tasks.map((task) => normalizeStoredTask(remapDataMigrationTask(task, taskPlan.taskIdBySourceId, projectPlan.projectIdBySourceId)));
    const replacedIds = new Set(taskPlan.replacedTaskIds);
    const existingTasks = this.getAllTasks();
    const existingAfterReplace = existingTasks.filter((task) => !replacedIds.has(task.id));
    const allTasksAfterImport = [...existingAfterReplace, ...nextTasks];
    nextTasks.forEach((task) => {
      assertValidTaskMindmapParent(task, allTasksAfterImport.filter((candidate) => candidate.id !== task.id));
    });
    this.assertCompositeTaskConsistency(nextTasks, replacedIds);
    this.assertNoConflicts(
      nextTasks,
      new Set(existingTasks.filter((task) => replacedIds.has(task.id)).flatMap((task) => [...occurrenceKeysForTask(task)]))
    );
    const importedProjectIds = new Set(projectPlan.projects.map((project) => project.id));
    const importedPageIds = new Set(progressPages.map((page) => page.id));
    const importedPageProjectIds = new Set(progressPages.map((page) => page.projectId));
    this.projects = [
      ...this.projects.filter((project) => !importedProjectIds.has(project.id)),
      ...projectPlan.projects
    ];
    this.progressPages = [
      ...this.progressPages.filter((page) => !importedPageIds.has(page.id) && !importedPageProjectIds.has(page.projectId)),
      ...progressPages
    ];
    const removedTasks = this.replaceTasks([...replacedIds], nextTasks);
    const affectedMonths = monthsForTasks([...removedTasks, ...nextTasks]);
    await this.enqueueWrite(async () => {
      await this.writeJson(this.pathFor(PROJECTS_FILE), { projects: this.projects });
      await this.writeJson(this.pathFor(PROGRESS_FILE), { pages: this.progressPages });
      for (const month of affectedMonths) {
        await this.flushMonth(month);
      }
    });
    await this.reloadCurrentFolderData();
    const changed = nextTasks.map((task) => this.getTask(task.id) ?? task);
    await this.recordWriteHistory({
      type: "import",
      summary: historySummary ?? `\u5BFC\u5165\u6570\u636E\u8FC1\u79FB JSON\uFF1A\u9879\u76EE ${records.projects.length} \u4E2A\uFF0C\u4EFB\u52A1 ${records.tasks.length} \u4E2A\uFF0C\u65B0\u589E ${taskPlan.createCount}\uFF0C\u8986\u76D6 ${taskPlan.overwriteCount}`,
      taskIds: changed.map((task) => task.id)
    });
    this.trigger("changed");
    return changed;
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
    const startTime = normalizeClockTime(input.startTime, "\u5F00\u59CB\u65F6\u95F4");
    const endTime = normalizeClockTime(input.endTime, "\u7ED3\u675F\u65F6\u95F4");
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
    const kind = input.kind ?? "simple";
    const recurrence = isCompositeKind(kind) ? "daily" : normalizeTaskRecurrence(input.recurrence);
    const recurrenceUntil = isCompositeKind(kind) ? null : normalizeDateOrUndefined(input.recurrenceUntil);
    const normalizedRecurrenceCount = normalizePositiveInteger(input.recurrenceCount);
    const recurrenceCount = isCompositeKind(kind) ? SINGLE_TASK_RECURRENCE_COUNT : normalizedRecurrenceCount ?? (recurrenceUntil ? null : SINGLE_TASK_RECURRENCE_COUNT);
    const subtasks = normalizeSubtaskInputs(input.subtasks, kind);
    if (recurrenceUntil && compareDateKeys(recurrenceUntil, date) < 0) {
      throw new Error("\u91CD\u590D\u7ED3\u675F\u65E5\u671F\u4E0D\u80FD\u65E9\u4E8E\u9996\u4E2A\u4EFB\u52A1\u65E5\u671F");
    }
    return {
      kind,
      title,
      description: input.description?.trim() || "",
      projectId: input.projectId || void 0,
      status: normalizeTaskStatus2(input.status),
      priority: normalizeTaskPriority2(input.priority),
      tags: [],
      date,
      startTime,
      endTime,
      recurrence,
      recurrenceCount,
      recurrenceUntil,
      consumeRequiresCompletion: isCompositeKind(kind) ? false : Boolean(input.consumeRequiresCompletion),
      occurrenceDates: normalizeOccurrenceDates(input.occurrenceDates),
      completedOccurrenceDates: normalizeOccurrenceDates(input.completedOccurrenceDates),
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
      status: input.kind === "composite" ? "todo" : input.status ?? original?.status ?? "todo",
      priority: input.kind === "composite" ? void 0 : input.priority ?? original?.priority,
      tags: [],
      date: occurrenceDates[0],
      startTime: input.startTime,
      endTime: input.endTime,
      recurrence: input.kind === "composite" ? "daily" : input.recurrence,
      recurrenceCount: input.kind === "composite" ? SINGLE_TASK_RECURRENCE_COUNT : input.recurrenceCount ?? null,
      recurrenceUntil: input.kind === "composite" ? null : input.recurrenceUntil ?? null,
      consumeRequiresCompletion: input.kind === "composite" ? false : Boolean(input.consumeRequiresCompletion),
      subtasks,
      occurrenceDates,
      occurrenceStates,
      occurrenceOverrides: (input.occurrenceOverrides ?? original?.occurrenceOverrides ?? []).filter((override) => occurrenceDates.includes(override.date)),
      viewState: mergeViewState2(original?.viewState, input.viewState, input.kind === "composite" ? "todo" : input.status ?? original?.status ?? "todo"),
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
    const taskById = new Map([...this.getAllTasks(), ...candidates].map((task) => [task.id, task]));
    for (const task of candidateOccurrences) {
      this.assertTaskWindowValid(task, existing, taskById);
    }
    for (let index = 0; index < candidateOccurrences.length; index += 1) {
      this.assertTaskWindowValid(
        candidateOccurrences[index],
        candidateOccurrences.filter((_, innerIndex) => innerIndex !== index),
        taskById
      );
    }
  }
  assertTaskWindowValid(task, against, taskById) {
    const start = parseTimeToMinutes(task.startTime);
    const end = parseTimeToMinutes(task.endTime);
    if (start === null || end === null) {
      return;
    }
    const overlapped = against.some((item) => {
      if (item.date !== task.date) {
        return false;
      }
      if (shareCompositeSchedulingContainer(task.taskId, item.taskId, taskById)) {
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
    const taskById = new Map([...this.getAllTasks(), ...adjusted].map((task) => [task.id, task]));
    const occupied = buildOccupiedOccurrenceMap(this.getAllTaskOccurrences().filter((task) => !excludedOccurrenceKeys.has(task.id)));
    adjusted.forEach((task) => {
      expandTask(task).sort(compareOccurrences).forEach((occurrence) => {
        const start = parseTimeToMinutes(occurrence.startTime);
        const end = parseTimeToMinutes(occurrence.endTime);
        if (start === null || end === null) {
          return;
        }
        const dateOccupied = occupied.get(occurrence.date) ?? [];
        const blockingIntervals = dateOccupied.filter((interval) => !shareCompositeSchedulingContainer(occurrence.taskId, interval.taskId, taskById));
        if (!hasTimeOverlap(blockingIntervals, start, end)) {
          dateOccupied.push({ taskId: occurrence.taskId, start, end });
          occupied.set(occurrence.date, sortOccupiedMinutes(dateOccupied));
          return;
        }
        const resolved = findAvailableOneMinuteWindow(blockingIntervals, start);
        applyOccurrenceWindow(task, occurrence.date, resolved.startTime, resolved.endTime);
        dateOccupied.push({ taskId: occurrence.taskId, start: resolved.start, end: resolved.end });
        occupied.set(occurrence.date, sortOccupiedMinutes(dateOccupied));
      });
    });
    return adjusted;
  }
  assertCompositeTaskConsistency(candidates, excludedTaskIds) {
    const taskById = new Map(this.getAllTasks().filter((task) => !excludedTaskIds.has(task.id)).map((task) => [task.id, task]));
    candidates.forEach((task) => taskById.set(task.id, task));
    const validateTaskAndChildren = (task) => {
      assertCompositeDefinitionValid(task);
      const parentId = task.viewState.mindmap.parentTaskId ?? null;
      if (parentId) {
        const parent = taskById.get(parentId);
        if (parent?.kind === "composite") {
          assertChildTaskWithinComposite(task, parent);
        }
      }
      if (task.kind === "composite") {
        [...taskById.values()].filter((candidate) => (candidate.viewState.mindmap.parentTaskId ?? null) === task.id).forEach((child) => assertChildTaskWithinComposite(child, task));
      }
    };
    candidates.forEach(validateTaskAndChildren);
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
      recurrence: "daily",
      recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
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
      description: "\u7EC4\u5408\u4EFB\u52A1\u53EF\u4EE5\u6302\u8F7D\u5355\u6B21\u3001\u6BCF\u65E5\u548C\u6BCF\u5468\u5B50\u4EFB\u52A1\uFF0C\u8FDB\u5EA6\u4F1A\u540C\u6B65\u5230\u603B\u89C8\u3002",
      projectId,
      status: "todo",
      priority: "medium",
      tags: ["\u793A\u4F8B"],
      date: today,
      startTime: "10:30",
      endTime: "11:30",
      recurrence: "daily",
      recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
      kind: "composite",
      viewState: {
        board: { columnId: "todo", order: 20 },
        mindmap: { parentTaskId: planTask.id, childOrder: 20, expanded: true, x: 540, y: 270 }
      }
    });
    const createProjectTask = this.buildSeriesTask({
      title: "\u521B\u5EFA\u9879\u76EE",
      projectId,
      status: "todo",
      priority: "medium",
      tags: ["\u793A\u4F8B"],
      date: today,
      startTime: "10:35",
      endTime: "10:50",
      recurrence: "daily",
      recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
      viewState: {
        board: { columnId: "todo", order: 21 },
        mindmap: { parentTaskId: buildTask.id, childOrder: 10, expanded: true, x: 800, y: 210 }
      }
    });
    const dailyDialogTask = this.buildSeriesTask({
      title: "\u5199\u5165\u65E5\u8BB0",
      projectId,
      status: "todo",
      priority: "medium",
      tags: ["\u793A\u4F8B"],
      date: today,
      startTime: "10:50",
      endTime: "11:05",
      recurrence: "daily",
      recurrenceCount: 5,
      viewState: {
        board: { columnId: "todo", order: 22 },
        mindmap: { parentTaskId: buildTask.id, childOrder: 20, expanded: true, x: 800, y: 290 }
      }
    });
    const weeklyReviewTask = this.buildSeriesTask({
      title: "\u5468\u590D\u76D8",
      projectId,
      status: "todo",
      priority: "low",
      tags: ["\u793A\u4F8B", "\u590D\u76D8"],
      date: today,
      startTime: "11:05",
      endTime: "11:20",
      recurrence: "weekly",
      recurrenceCount: 4,
      viewState: {
        board: { columnId: "todo", order: 23 },
        mindmap: { parentTaskId: buildTask.id, childOrder: 30, expanded: true, x: 800, y: 370 }
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
      recurrence: "daily",
      recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
      completed: true,
      viewState: {
        board: { columnId: "done", order: 30 },
        mindmap: { parentTaskId: null, childOrder: 30, expanded: true, x: 280, y: 390 }
      }
    });
    [planTask, buildTask, createProjectTask, dailyDialogTask, weeklyReviewTask, reviewTask].forEach((task) => this.insertTask(task));
    this.writeHistory = [
      {
        id: crypto.randomUUID(),
        type: "import",
        summary: "\u521D\u59CB\u5316\u9ED8\u8BA4\u6F14\u793A\u6570\u636E",
        taskIds: [planTask.id, buildTask.id, createProjectTask.id, dailyDialogTask.id, weeklyReviewTask.id, reviewTask.id],
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
      try {
        this.tasks.set(month, (data.value?.tasks ?? []).map(normalizeStoredTask));
      } catch (error) {
        console.error("Failed to normalize task file", childPath, error);
        new import_obsidian.Notice(`\u8BFB\u53D6\u6570\u636E\u5931\u8D25\uFF0C\u5DF2\u505C\u6B62\u81EA\u52A8\u5199\u56DE: ${childPath}`, 0);
        failedPaths.push(childPath);
        this.tasks.set(month, []);
      }
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
  async writeText(path, payload) {
    const normalized = (0, import_obsidian.normalizePath)(path);
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
  const kind = task.kind ?? "simple";
  const status = kind === "composite" ? "todo" : normalizeTaskStatus2(task.status);
  const recurrence = kind === "composite" ? "daily" : normalizeTaskRecurrence(task.recurrence);
  const startTime = normalizeClockTime(task.startTime, "\u5F00\u59CB\u65F6\u95F4");
  const endTime = normalizeClockTime(task.endTime, "\u7ED3\u675F\u65F6\u95F4");
  if (startTime && !endTime || !startTime && endTime) {
    throw new Error("\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u540C\u65F6\u586B\u5199");
  }
  const start = parseTimeToMinutes(startTime);
  const end = parseTimeToMinutes(endTime);
  if (start !== null && end !== null && start >= end) {
    throw new Error("\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4");
  }
  const subtasks = [];
  const occurrenceStates = (task.occurrenceStates ?? []).map(
    (item) => buildNormalizedOccurrenceState(item.date, kind, subtasks, item.completedSubtaskIds ?? subtasks.map((subtask) => subtask.id), item.completedAt ?? null)
  );
  return {
    ...task,
    kind,
    status,
    priority: kind === "composite" ? void 0 : normalizeTaskPriority2(task.priority),
    tags: [],
    recurrence,
    recurrenceCount: kind === "composite" ? SINGLE_TASK_RECURRENCE_COUNT : normalizePositiveInteger(task.recurrenceCount),
    recurrenceUntil: kind === "composite" ? null : normalizeDateOrUndefined(task.recurrenceUntil),
    consumeRequiresCompletion: kind === "composite" ? false : Boolean(task.consumeRequiresCompletion),
    startTime,
    endTime,
    subtasks,
    occurrenceStates,
    occurrenceOverrides: normalizeOccurrenceOverrides(task.occurrenceOverrides),
    viewState: mergeViewState2(void 0, task.viewState, status),
    sourceLinks: normalizeSourceLinks(task.sourceLinks),
    notes: normalizeTaskNotes(task.notes),
    mindmapComments: normalizeMindmapComments(task.mindmapComments, task.id),
    revision: task.revision ?? 1
  };
}
function isPartialPluginConfig(value) {
  return isRecord2(value);
}
function isProjectsFile(value) {
  return isRecord2(value) && Array.isArray(value.projects) && value.projects.every(isRecord2);
}
function isProgressPagesFile(value) {
  return isRecord2(value) && Array.isArray(value.pages) && value.pages.every(isRecord2);
}
function isNoteTaskIndexFile(value) {
  return isRecord2(value) && Array.isArray(value.files) && value.files.every(isRecord2);
}
function isWriteHistoryFile(value) {
  return isRecord2(value) && Array.isArray(value.records) && value.records.every(isRecord2);
}
function isTasksFile(value) {
  return isRecord2(value) && typeof value.month === "string" && Array.isArray(value.tasks) && value.tasks.every(isStoredTaskRecord);
}
function isRecord2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isStoredTaskRecord(value) {
  if (!isRecord2(value)) {
    return false;
  }
  const subtasks = value.subtasks;
  const occurrenceStates = value.occurrenceStates;
  return typeof value.id === "string" && typeof value.title === "string" && typeof value.date === "string" && typeof value.recurrence === "string" && Array.isArray(value.occurrenceDates) && value.occurrenceDates.every((date) => typeof date === "string") && (subtasks === void 0 || Array.isArray(subtasks) && subtasks.every(isTaskSubtaskRecord2)) && (occurrenceStates === void 0 || Array.isArray(occurrenceStates) && occurrenceStates.every(isOccurrenceStateRecord2));
}
function isTaskSubtaskRecord2(value) {
  return isRecord2(value) && typeof value.id === "string" && typeof value.title === "string";
}
function isOccurrenceStateRecord2(value) {
  return isRecord2(value) && typeof value.date === "string";
}
function createEmptyTaskImportPreview() {
  return {
    sourceFormat: "markdown-planned",
    tasks: [],
    issues: [],
    summary: {
      total: 0,
      completed: 0,
      composite: 0,
      createCount: 0,
      overwriteCount: 0,
      completeTodayCount: 0,
      completeSeriesCount: 0,
      newProjectNames: []
    }
  };
}
function applyMarkdownReferencePreview(viewState, parentTitle) {
  if (!parentTitle) {
    return viewState;
  }
  return {
    ...viewState ?? {},
    mindmap: {
      ...viewState?.mindmap ?? {},
      parentTaskId: null,
      childOrder: viewState?.mindmap?.childOrder ?? Date.now(),
      expanded: viewState?.mindmap?.expanded ?? true
    }
  };
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
    viewState: cloneViewState2(task.viewState),
    sourceLinks: task.sourceLinks.map((item) => ({ ...item })),
    notes: task.notes.map((item) => ({ ...item })),
    mindmapComments: task.mindmapComments.map((item) => ({ ...item }))
  };
}
function expandTask(task, referenceDate = toDateKey(now())) {
  return getEffectiveOccurrenceDates(task, referenceDate).flatMap((date, index) => {
    const override = getOccurrenceOverride(task, date);
    if (override?.skipped) {
      return [];
    }
    const state = getOccurrenceState(task, date);
    const progress = getOccurrenceProgress(task, date);
    return [{
      id: buildOccurrenceKey(task.id, date),
      taskId: task.id,
      parentTaskId: task.viewState.mindmap.parentTaskId ?? null,
      occurrenceDate: date,
      occurrenceNumber: index + 1,
      kind: task.kind,
      title: override?.title ?? task.title,
      description: resolveOccurrenceDescription(task, override),
      projectId: task.projectId,
      status: task.status,
      priority: task.priority,
      tags: [...task.tags],
      date,
      startTime: resolveOccurrenceTimeField(task.startTime, override, "startTime"),
      endTime: resolveOccurrenceTimeField(task.endTime, override, "endTime"),
      recurrence: task.recurrence,
      recurrenceCount: task.recurrenceCount ?? null,
      recurrenceUntil: task.recurrenceUntil ?? null,
      consumeRequiresCompletion: task.consumeRequiresCompletion,
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
  const recurrence = normalizeTaskRecurrence(input.recurrence);
  const countLimit = Math.min(input.recurrenceCount ?? MAX_GENERATED_OCCURRENCES, MAX_GENERATED_OCCURRENCES);
  const until = input.recurrenceUntil ?? null;
  const dates = [];
  let cursor = parseDateKey(input.date);
  const anchorDay = cursor.getDate();
  let createdCount = 0;
  while (true) {
    const dateKey = toDateKey(cursor);
    if (until && compareDateKeys(dateKey, until) > 0) {
      break;
    }
    if (createdCount >= countLimit) {
      break;
    }
    dates.push(dateKey);
    createdCount += 1;
    cursor = advanceRecurrenceDate(cursor, recurrence, anchorDay);
  }
  if (dates.length === 0) {
    throw new Error("\u672A\u751F\u6210\u4EFB\u4F55\u4EFB\u52A1\uFF0C\u8BF7\u68C0\u67E5\u91CD\u590D\u7ED3\u675F\u65E5\u671F");
  }
  return dates;
}
function resolveOccurrenceStates(params) {
  const { input, original, subtasks, occurrenceDates, timestamp, completedPatch } = params;
  if (input.completedOccurrenceDates?.length) {
    const completedDates = [...new Set(input.completedOccurrenceDates)].sort(compareDateKeys);
    const invalidDates = completedDates.filter((date) => !occurrenceDates.includes(date));
    if (invalidDates.length > 0) {
      throw new Error(`\u5B8C\u6210\u65E5\u671F\u4E0D\u5728\u4EFB\u52A1\u53D1\u751F\u65E5\u671F\u5185\uFF1A${invalidDates.join("\u3001")}`);
    }
    return completedDates.map(
      (date) => buildNormalizedOccurrenceState(date, input.kind ?? "simple", subtasks, subtasks.map((item) => item.id), timestamp)
    );
  }
  if (completedPatch === true || original === void 0 && input.completed) {
    return occurrenceDates.map((date) => buildNormalizedOccurrenceState(date, input.kind ?? "simple", subtasks, subtasks.map((item) => item.id), timestamp));
  }
  if (completedPatch === false) {
    return [];
  }
  return (original?.occurrenceStates ?? []).map(
    (existing) => buildNormalizedOccurrenceState(
      existing.date,
      input.kind ?? "simple",
      subtasks,
      existing.completedSubtaskIds ?? (original ? getAllSubtaskIds(original) : []),
      existing.completedAt ?? null
    )
  );
}
function normalizeSubtaskInputs(subtasks, kind) {
  return [];
}
function resolveTaskSubtasks(inputSubtasks, kind, originalSubtasks) {
  return [];
}
function getOccurrenceState(task, date) {
  return task?.occurrenceStates.find((item) => item.date === date);
}
function getOccurrenceOverride(task, date) {
  return task?.occurrenceOverrides.find((item) => item.date === date);
}
function resolveOccurrenceDescription(task, override) {
  if (override && isOverrideFieldSet(override, "description")) {
    return override.description ?? void 0;
  }
  return task.description;
}
function resolveOccurrenceTimeField(baseValue, override, key) {
  if (override && isOverrideFieldSet(override, key)) {
    return override[key] ?? void 0;
  }
  return baseValue;
}
function getAllSubtaskIds(task) {
  if (task.kind === "composite") {
    return task.subtasks.map((item) => item.id);
  }
  return [];
}
function assertCompositeDefinitionValid(task) {
  return;
}
function assertChildTaskWithinComposite(child, parent) {
  if (child.kind === "composite") {
    throw new Error(`\u5B50\u4EFB\u52A1\u300C${child.title}\u300D\u4E0D\u80FD\u662F\u7EC4\u5408\u4EFB\u52A1`);
  }
}
function buildNormalizedOccurrenceState(date, kind, subtasks, completedSubtaskIds, completedAt) {
  if (kind === "simple") {
    return {
      date,
      completedAt: completedAt ?? toIsoLocal(now())
    };
  }
  if (subtasks.length === 0) {
    return {
      date,
      completedSubtaskIds: [],
      completedAt
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
  if (task.subtasks.length === 0) {
    const state = getOccurrenceState(task, date);
    return {
      completed: Boolean(state?.completedAt),
      progress: state?.completedAt ? 1 : 0,
      totalSteps: 0,
      completedSteps: 0,
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
      if (!shouldConsumeOccurrence(occurrence)) {
        return summary;
      }
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
  return new Set(getEffectiveOccurrenceDates(task, toDateKey(now())).map((date) => buildOccurrenceKey(task.id, date)));
}
function assertMutableOccurrenceDate(date) {
  if (compareDateKeys(date, toDateKey(now())) < 0) {
    throw new Error("\u4E0D\u80FD\u4FEE\u6539\u8FC7\u53BB\u65E5\u671F\u7684\u4EFB\u52A1\u8BB0\u5F55");
  }
}
function isTaskFullyCompleted2(task) {
  if (isCompletionGatedTask(task)) {
    return getTaskExecutionProgress(task).completedSeries;
  }
  return task.occurrenceDates.length > 0 && task.occurrenceDates.every((date) => getOccurrenceProgress(task, date).completed);
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
function normalizeClockTime(value, label) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return void 0;
  }
  if (parseTimeToMinutes(trimmed) === null) {
    throw new Error(`${label}\u5FC5\u987B\u4F7F\u7528 HH:mm \u683C\u5F0F\uFF0C\u8303\u56F4 00:00-23:59`);
  }
  return trimmed;
}
function normalizeTaskStatus2(value) {
  return value === "doing" || value === "blocked" || value === "done" ? value : "todo";
}
function normalizeTaskPriority2(value) {
  if (value === "low" || value === "medium" || value === "high" || value === "urgent") {
    return value;
  }
  return void 0;
}
function normalizeOccurrenceDates(dates) {
  if (!dates) {
    return void 0;
  }
  return [...new Set(dates.map((date) => date.trim()).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort(compareDateKeys);
}
function isOverrideFieldSet(override, key) {
  return Object.prototype.hasOwnProperty.call(override, key);
}
function normalizeOccurrenceOverrideTimeValue(value) {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}
function isMeaningfulOccurrenceOverride(override) {
  return override.title !== void 0 || isOverrideFieldSet(override, "description") || isOverrideFieldSet(override, "startTime") || isOverrideFieldSet(override, "endTime") || override.skipped === true || override.reason !== void 0;
}
function normalizeOccurrenceOverrides(overrides) {
  return (overrides ?? []).filter((override) => /^\d{4}-\d{2}-\d{2}$/.test(override.date)).map((override) => {
    const normalized = {
      date: override.date
    };
    const title = override.title?.trim();
    if (title) {
      normalized.title = title;
    }
    if (isOverrideFieldSet(override, "description")) {
      normalized.description = override.description?.trim() || null;
    }
    if (isOverrideFieldSet(override, "startTime")) {
      normalized.startTime = normalizeOccurrenceOverrideTimeValue(override.startTime);
    }
    if (isOverrideFieldSet(override, "endTime")) {
      normalized.endTime = normalizeOccurrenceOverrideTimeValue(override.endTime);
    }
    if (normalized.startTime !== void 0 || normalized.endTime !== void 0) {
      const start = normalized.startTime ?? null;
      const end = normalized.endTime ?? null;
      if (start === null !== (end === null)) {
        throw new Error("\u5355\u6B21\u5B9E\u4F8B\u7684\u5F00\u59CB\u65F6\u95F4\u548C\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u540C\u65F6\u4FEE\u6539");
      }
      if (start !== null && end !== null) {
        const startMinutes = parseTimeToMinutes(start);
        const endMinutes = parseTimeToMinutes(end);
        if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
          throw new Error("\u5355\u6B21\u5B9E\u4F8B\u7ED3\u675F\u65F6\u95F4\u5FC5\u987B\u665A\u4E8E\u5F00\u59CB\u65F6\u95F4");
        }
      }
    }
    if (override.skipped) {
      normalized.skipped = true;
    }
    const reason = override.reason?.trim();
    if (reason) {
      normalized.reason = reason;
    }
    return isMeaningfulOccurrenceOverride(normalized) ? normalized : null;
  }).filter((override) => Boolean(override));
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
  const parent = tasks.find((item) => item.id === parentTaskId);
  if (!parent) {
    throw new Error("\u7236\u7EA7\u4EFB\u52A1\u4E0D\u5B58\u5728");
  }
  if (parent.kind !== "composite") {
    throw new Error("\u5B50\u4EFB\u52A1\u53EA\u80FD\u6302\u5165\u7EC4\u5408\u4EFB\u52A1");
  }
  if (task.kind === "composite") {
    throw new Error("\u5B50\u4EFB\u52A1\u4E0D\u80FD\u662F\u7EC4\u5408\u4EFB\u52A1");
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
function shareCompositeSchedulingContainer(leftTaskId, rightTaskId, taskById) {
  if (leftTaskId === rightTaskId) {
    return false;
  }
  const leftContainerId = findCompositeSchedulingContainerId(leftTaskId, taskById);
  const rightContainerId = findCompositeSchedulingContainerId(rightTaskId, taskById);
  return Boolean(leftContainerId && rightContainerId && leftContainerId === rightContainerId);
}
function findCompositeSchedulingContainerId(taskId, taskById) {
  let current = taskById.get(taskId);
  const visited = /* @__PURE__ */ new Set();
  while (current) {
    if (current.kind === "composite") {
      return current.id;
    }
    const parentId = current.viewState.mindmap.parentTaskId ?? null;
    if (!parentId) {
      return null;
    }
    if (visited.has(parentId)) {
      return null;
    }
    visited.add(parentId);
    current = taskById.get(parentId);
  }
  return null;
}
function mergeViewState2(current, patch, status) {
  const base = current ?? defaultTaskViewState2(status);
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
function defaultTaskViewState2(status) {
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
function cloneViewState2(viewState) {
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
function replaceOccurrenceOverride(task, date, override) {
  const existing = task.occurrenceOverrides.filter((item) => item.date !== date);
  const normalized = override ? normalizeOccurrenceOverrides([override])[0] : void 0;
  return normalized ? [...existing, normalized].sort((a, b) => a.date.localeCompare(b.date)) : existing;
}
function upsertOccurrenceOverride(task, override) {
  return replaceOccurrenceOverride(task, override.date, override);
}
function buildOccurrenceDetailsOverride(task, date, values) {
  const override = { date };
  if (values.title !== task.title) {
    override.title = values.title;
  }
  const baseDescription = task.description?.trim() || "";
  if (values.description !== baseDescription) {
    override.description = values.description || null;
  }
  const baseStart = task.startTime ?? "";
  const baseEnd = task.endTime ?? "";
  const nextStart = values.startTime ?? "";
  const nextEnd = values.endTime ?? "";
  if (nextStart !== baseStart || nextEnd !== baseEnd) {
    override.startTime = nextStart || null;
    override.endTime = nextEnd || null;
  }
  return isMeaningfulOccurrenceOverride(override) ? override : null;
}
function snapMinutes(value, slot) {
  return Math.ceil(value / slot) * slot;
}
function applyOccurrenceWindow(task, date, startTime, endTime) {
  if (task.occurrenceDates.length === 1 && task.date === date) {
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
function buildOccupiedOccurrenceMap(occurrences) {
  const occupied = /* @__PURE__ */ new Map();
  occurrences.forEach((occurrence) => {
    const start = parseTimeToMinutes(occurrence.startTime);
    const end = parseTimeToMinutes(occurrence.endTime);
    if (start === null || end === null) {
      return;
    }
    const dateOccupied = occupied.get(occurrence.date) ?? [];
    dateOccupied.push({ taskId: occurrence.taskId, start, end });
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
function resolveTaskImportAction(matched, completionMode, completed) {
  if (!matched) {
    return "create";
  }
  if (completed && completionMode === "series") {
    return "complete-series";
  }
  if (completed && completionMode === "today") {
    return "complete-today";
  }
  return "overwrite";
}
function normalizeImportIdentity2(value) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-Hans-CN");
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

// src/utils/clipboard.ts
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

// src/settings.ts
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
    doc.createEl("h3", { text: "\u5FEB\u901F\u8BB0\u5F55\u683C\u5F0F\u89C4\u8303" });
    doc.createDiv({
      cls: "pm-muted",
      text: "\u5185\u5BB9\u4E0E docs/markdown\u2014\u2014type.md \u548C\u5BFC\u51FA\u8BF4\u660E\u6587\u4EF6\u4FDD\u6301\u4E00\u81F4\u3002"
    });
    this.renderMarkdownFormatGuide(doc);
    new import_obsidian2.Setting(containerEl).setName("\u5BFC\u51FA Markdown \u8BED\u6CD5\u8BF4\u660E").setDesc("\u751F\u6210\u4E00\u4EFD\u5F53\u524D\u63D2\u4EF6\u652F\u6301\u7684\u5FEB\u901F\u8BB0\u5F55\u683C\u5F0F\u8BF4\u660E\uFF0C\u5305\u542B\u6570\u636E\u8FC1\u79FB JSON \u4E0E\u4E24\u7C7B Markdown\u3002").addButton(
      (button) => button.setButtonText("\u5BFC\u51FA\u8BF4\u660E\u6587\u4EF6").setCta().onClick(async () => {
        const path = await this.plugin.store.exportMarkdownGuide();
        new import_obsidian2.Notice(`\u5DF2\u5BFC\u51FA\u5230 ${path}`);
      })
    );
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
    new import_obsidian2.Setting(containerEl).setName("\u65E5\u8BB0\u6587\u4EF6\u540D\u65E5\u671F\u683C\u5F0F").setDesc("\u652F\u6301 YYYY\u3001MM\u3001DD\u3001HH\u3001mm\u3001ss\uFF0C\u4F8B\u5982 YYYY-MM-DD\u3002").addText(
      (text) => text.setValue(this.plugin.settings.dailyNoteDateFormat).onChange(async (value) => {
        await this.plugin.updateSettings({ dailyNoteDateFormat: value.trim() || "YYYY-MM-DD" });
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
    this.renderAppendHeaderSettings(containerEl, "\u7B14\u8BB0\u8FFD\u52A0\u5934", "\u7528\u4E8E\u5FEB\u901F\u8BB0\u5F55-\u8FFD\u52A0\u7B14\u8BB0\u5199\u5165\u4EFB\u610F Markdown \u6587\u4EF6\u3002", "noteAppendHeader");
    this.renderAppendHeaderSettings(containerEl, "\u65E5\u8BB0\u63D2\u5165\u5934", "\u7528\u4E8E\u5FEB\u901F\u8BB0\u5F55-\u5199\u65E5\u8BB0\u5199\u5165\u6BCF\u65E5\u6587\u4EF6\u6216\u6C47\u603B\u6587\u4EF6\u3002", "dailyNoteHeader");
    new import_obsidian2.Setting(containerEl).setName("\u6700\u8FD1\u7B14\u8BB0\u6570\u91CF").setDesc("\u5F53\u6700\u8FD1\u64CD\u4F5C\u8BB0\u5F55\u4E0D\u8DB3\u65F6\uFF0C\u7528\u4E8E\u8865\u5145\u6700\u8FD1\u4FEE\u6539\u6587\u4EF6\u5019\u9009\uFF1B\u5FEB\u6377\u533A\u56FA\u5B9A\u5C55\u793A\u6700\u8FD1 10 \u4E2A\u64CD\u4F5C\u6587\u4EF6\u3002").addText(
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
  renderMarkdownFormatGuide(containerEl) {
    const wrapper = containerEl.createDiv({ cls: "pm-settings-format-section" });
    const header = wrapper.createDiv({ cls: "pm-settings-format-header" });
    const copy = header.createDiv();
    copy.createEl("h4", { text: "\u5B8C\u6574 Markdown \u8BF4\u660E" });
    copy.createDiv({ cls: "pm-muted", text: "\u53EF\u6EDA\u52A8\u67E5\u770B\u6240\u6709\u683C\u5F0F\u89C4\u5219\u3001\u53C2\u6570\u8868\u548C\u793A\u4F8B\u3002" });
    const button = header.createEl("button", { text: "\u590D\u5236\u5B8C\u6574\u8BF4\u660E", cls: "pm-button pm-button-secondary" });
    const textarea = wrapper.createEl("textarea", {
      cls: "pm-settings-format-textarea pm-settings-format-guide-textarea",
      attr: { "aria-label": "\u5FEB\u901F\u8BB0\u5F55\u683C\u5F0F\u5B8C\u6574\u8BF4\u660E", readonly: "true" }
    });
    textarea.value = MARKDOWN_FORMAT_GUIDE;
    button.addEventListener("click", async () => {
      await copyTextToClipboard(textarea.value);
      new import_obsidian2.Notice("\u5DF2\u590D\u5236\u5B8C\u6574\u683C\u5F0F\u8BF4\u660E");
    });
  }
  renderAppendHeaderSettings(containerEl, title, description, key) {
    const wrapper = containerEl.createDiv({ cls: "pm-settings-group" });
    wrapper.createEl("h3", { text: title });
    wrapper.createDiv({ cls: "pm-muted", text: description });
    const current = this.plugin.settings[key];
    const update = async (patch) => {
      const next = { ...this.plugin.settings[key], ...patch };
      await this.plugin.updateSettings({ [key]: next });
    };
    new import_obsidian2.Setting(wrapper).setName("\u542F\u7528\u63D2\u5165\u5934").addToggle((toggle) => toggle.setValue(current.enabled).onChange(async (value) => update({ enabled: value })));
    new import_obsidian2.Setting(wrapper).setName("\u5305\u542B\u65F6\u95F4").addToggle((toggle) => toggle.setValue(current.includeTime).onChange(async (value) => update({ includeTime: value })));
    new import_obsidian2.Setting(wrapper).setName("\u6807\u9898\u7EA7\u522B").setDesc("1 \u5230 6\uFF0C\u5BF9\u5E94 Markdown \u6807\u9898\u5C42\u7EA7\u3002").addText(
      (text) => text.setValue(String(current.headingLevel)).onChange(async (value) => {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) {
          await update({ headingLevel: Math.min(6, Math.max(1, Math.floor(parsed))) });
        }
      })
    );
    new import_obsidian2.Setting(wrapper).setName("\u65E5\u671F\u683C\u5F0F").setDesc("\u652F\u6301 YYYY\u3001MM\u3001DD\u3002").addText((text) => text.setValue(current.dateFormat).onChange(async (value) => update({ dateFormat: value.trim() || "YYYY-MM-DD" })));
    new import_obsidian2.Setting(wrapper).setName("\u65F6\u95F4\u683C\u5F0F").setDesc("\u652F\u6301 HH\u3001mm\u3001ss\u3002").addText((text) => text.setValue(current.timeFormat).onChange(async (value) => update({ timeFormat: value.trim() || "HH:mm:ss" })));
    new import_obsidian2.Setting(wrapper).setName("\u65E5\u671F\u65F6\u95F4\u5206\u9694\u7B26").addText((text) => text.setValue(current.separator).onChange(async (value) => update({ separator: value })));
    new import_obsidian2.Setting(wrapper).setName("\u524D\u7F00\u7279\u6B8A\u6587\u5B57").addText((text) => text.setValue(current.prefix).onChange(async (value) => update({ prefix: value })));
    new import_obsidian2.Setting(wrapper).setName("\u540E\u7F00\u7279\u6B8A\u6587\u5B57").addText((text) => text.setValue(current.suffix).onChange(async (value) => update({ suffix: value })));
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
    const allNoteFiles = this.getAllMarkdownFiles();
    const recentNoteFiles = this.getRecentNoteFiles(allNoteFiles);
    const mindmapProjects = buildMindmapProjectOptions(tasks, (task) => this.projectNameForTask(task));
    this.ensureDialogSelections(tasks, allNoteFiles, recentNoteFiles, mindmapProjects);
    const projectTasks = this.selectedMindmapProjectId ? tasks.filter((task) => mindmapProjectKey(task) === this.selectedMindmapProjectId) : [];
    const projectNodeOptions = buildMindmapAnchorOptions(projectTasks);
    const selectedNode = this.ensureMindmapNodeSelection(projectNodeOptions);
    const recentNodeOptions = this.resolveRecentMindmapTargets(buildMindmapAnchorOptions(tasks));
    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "\u5FEB\u901F\u8BB0\u5F55" });
    title.createDiv({ cls: "pm-muted", text: "\u5FEB\u901F\u8BB0\u5F55\u3001\u5199\u65E5\u8BB0\u3001\u8FFD\u52A0\u4EFB\u610F\u7B14\u8BB0\uFF0C\u6216\u7ED9\u601D\u7EF4\u5BFC\u56FE\u8865\u5145\u8BC4\u8BED\u3002" });
    const targetCards = container.createDiv({ cls: "pm-dialog-tabs pm-segmented-control" });
    getTargetCards().forEach((item) => {
      const card = targetCards.createEl("button", {
        cls: `pm-dialog-tab pm-segmented-item ${this.target === item.value ? "is-active" : ""}`
      });
      card.dataset.target = item.value;
      const icon = card.createSpan({ cls: "pm-dialog-tab-icon" });
      (0, import_obsidian5.setIcon)(icon, item.icon);
      card.createSpan({ cls: "pm-dialog-tab-title", text: item.label });
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
      this.renderTaskNoteControls(container, allNoteFiles, recentNoteFiles);
    }
    if (this.target === "mindmap") {
      this.renderMindmapControls(container, mindmapProjects, projectNodeOptions, recentNodeOptions, selectedNode);
    }
    if (this.target === "quick-task") {
      const importHint = container.createDiv({ cls: "pm-input-card" });
      const hintHeader = importHint.createDiv({ cls: "pm-input-card-header" });
      hintHeader.createEl("strong", { text: "\u521B\u5EFA\u4EFB\u52A1\u683C\u5F0F" });
      hintHeader.createDiv({ cls: "pm-muted", text: "\u6570\u636E\u8FC1\u79FB JSON\u3001\u4ECA\u65E5\u5B8C\u6210\u6781\u7B80 Markdown\u3001\u65B0\u4EFB\u52A1\u8BA1\u5212\u590D\u6742 Markdown \u4F1A\u81EA\u52A8\u5206\u6D41\u3002" });
      [
        "\u652F\u6301\u7C98\u8D34\u201C\u5BFC\u51FA\u5168\u90E8\u8BB0\u5F55\u201D\u7684\u6570\u636E\u8FC1\u79FB JSON\uFF1B\u63D0\u4EA4\u540E\u4F1A\u6062\u590D\u9879\u76EE\u3001\u9879\u76EE\u9875\u3001\u4EFB\u52A1\u89C6\u56FE\u72B6\u6001\u548C\u5BFC\u56FE\u5173\u7CFB\u3002",
        "\u65B0\u4EFB\u52A1\u8BA1\u5212\u4F7F\u7528 + \u4EFB\u52A1\uFF1A\u6216 + \u7EC4\u5408\uFF1A\u5F00\u5934\uFF0C\u5FC5\u987B\u5199\u5B8C\u6574\u65E5\u671F\u548C\u65F6\u95F4\u6BB5\u3002",
        "\u4ECA\u65E5\u5B8C\u6210\u53EA\u4F7F\u7528\u6781\u7B80 - [x] \u6807\u9898\uFF1B\u627E\u4E0D\u5230\u4ECA\u65E5\u5DF2\u6709\u4EFB\u52A1\u4F1A\u62A5\u9519\uFF0C\u4E0D\u4F1A\u521B\u5EFA\u65B0\u4EFB\u52A1\u3002",
        "\u7EC4\u5408\u8BA1\u5212\u53EF\u5728\u4E0B\u65B9\u7F29\u8FDB\u5199 + \u5B50\u4EFB\u52A1\uFF1A\uFF0C\u5B50\u4EFB\u52A1\u4F1A\u4F5C\u4E3A\u72EC\u7ACB\u666E\u901A\u4EFB\u52A1\u6302\u5165\u7EC4\u5408\u4EFB\u52A1\u3002",
        "\u4EFB\u52A1\u884C\u4E0B\u7F29\u8FDB > \u63CF\u8FF0 \u53EF\u5199\u5165\u4EFB\u52A1\u63CF\u8FF0\uFF0C\u591A\u884C\u63CF\u8FF0\u4F1A\u6309\u6362\u884C\u5408\u5E76\u3002",
        "\u652F\u6301\u6BCF\u65E5\u3001\u6BCF\u5468\u3001\u6BCF\u6708\u6B64\u65F6\uFF1Arepeat:daily / weekly / monthly\uFF1B\u5355\u6B21\u4EFB\u52A1\u4F7F\u7528 count:1\u3002",
        "\u8BA1\u5212\u6587\u672C\u652F\u6301 board\u3001gantt\u3001deps\u3001mindmap \u89C6\u56FE\u72B6\u6001\uFF1B\u5B8C\u6210\u8BB0\u5F55\u8BF7\u4F7F\u7528\u6570\u636E\u8FC1\u79FB JSON\u3002"
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
    const updateEditorCount = () => {
      this.draftContent = textarea.value;
      const counter = editorCard.querySelector(".pm-editor-count");
      if (counter instanceof HTMLElement) {
        counter.setText(`\u5B57\u6570\uFF1A${this.draftContent.length}`);
      }
    };
    textarea.addEventListener("input", updateEditorCount);
    textarea.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        submitButton.click();
      }
    });
    const toolbar = editorCard.createDiv({ cls: "pm-editor-toolbar" });
    if (this.target === "quick-task") {
      toolbar.addClass("is-task-toolbar");
      buildQuickTaskShortcuts().forEach((item) => {
        const button = toolbar.createEl("button", { text: item.label, cls: "pm-button pm-button-secondary pm-editor-tool" });
        button.title = item.hint;
        button.addEventListener("click", () => {
          insertQuickTaskSnippet(textarea, item.snippet);
          updateEditorCount();
        });
      });
    } else {
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
          updateEditorCount();
        });
      });
    }
    if (this.target === "quick-task") {
      this.renderQuickTaskPreview(editorCard, textarea);
    }
    const footer = editorCard.createDiv({ cls: "pm-editor-footer" });
    footer.createDiv({ cls: "pm-editor-count pm-muted", text: `\u5B57\u6570\uFF1A${this.draftContent.length}` });
    const submitButton = footer.createEl("button", { text: "\u63D0\u4EA4\u5185\u5BB9", cls: "pm-button pm-button-primary" });
    submitButton.setAttribute("aria-keyshortcuts", "Ctrl+Enter Meta+Enter");
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
  renderTaskNoteControls(container, allFiles, recentFiles) {
    const pathCard = this.renderPathCard(container, {
      icon: "file-text",
      title: "\u76EE\u6807\u6587\u4EF6",
      path: this.selectedNotePath || "\u8BF7\u9009\u62E9 Markdown \u6587\u4EF6",
      muted: "\u652F\u6301\u5168\u5E93\u6309\u6587\u4EF6\u540D\u76F8\u4F3C\u5EA6\u68C0\u7D22\uFF0C\u5E76\u4FDD\u7559\u6700\u8FD1 10 \u4E2A\u64CD\u4F5C\u6587\u4EF6\u5FEB\u6377\u8FFD\u52A0\u3002"
    });
    pathCard.querySelector(".pm-path-value")?.setAttribute("title", this.selectedNotePath || "\u8BF7\u9009\u62E9 Markdown \u6587\u4EF6");
    const actions = pathCard.createDiv({ cls: "pm-path-actions" });
    const pickerButton = actions.createEl("button", { cls: "pm-button pm-button-secondary pm-path-button" });
    (0, import_obsidian5.setIcon)(pickerButton, "folder-open");
    pickerButton.title = "\u9009\u62E9\u6587\u4EF6";
    pickerButton.addEventListener("click", () => {
      new EntitySuggestModal(this.app, {
        items: allFiles,
        placeholder: "\u6309\u6587\u4EF6\u540D\u641C\u7D22\u6574\u4E2A Vault",
        emptyStateText: "\u6CA1\u6709\u53EF\u9009\u7684 Markdown \u6587\u4EF6",
        getItemText: (file) => file.basename,
        getItemNote: (file) => file.path,
        onChoose: (file) => {
          this.selectedNotePath = file.path;
          this.render();
        }
      }).open();
    });
    const recentCard = container.createDiv({ cls: "pm-input-card" });
    const recentHeader = recentCard.createDiv({ cls: "pm-input-card-header" });
    recentHeader.createEl("strong", { text: "\u6700\u8FD1 10 \u4E2A\u64CD\u4F5C\u6587\u4EF6" });
    recentHeader.createDiv({ cls: "pm-muted", text: "\u70B9\u51FB\u5373\u53EF\u5207\u6362\u4E3A\u5F53\u524D\u8FFD\u52A0\u76EE\u6807\u3002" });
    const recentList = recentCard.createDiv({ cls: "pm-anchor-chip-list pm-anchor-shortcut-list" });
    if (recentFiles.length === 0) {
      recentList.createDiv({ cls: "pm-muted", text: "\u8FD8\u6CA1\u6709\u6700\u8FD1\u64CD\u4F5C\u8BB0\u5F55\uFF0C\u9996\u6B21\u8FFD\u52A0\u540E\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC\u3002" });
      return;
    }
    recentFiles.slice(0, 10).forEach((file) => {
      const chip = recentList.createEl("button", {
        cls: `pm-anchor-chip pm-anchor-shortcut ${file.path === this.selectedNotePath ? "is-active" : ""}`
      });
      chip.title = file.path;
      chip.createSpan({ cls: "pm-anchor-shortcut-task", text: file.basename });
      chip.createSpan({ cls: "pm-anchor-shortcut-label", text: file.path });
      chip.addEventListener("click", () => {
        this.selectedNotePath = file.path;
        this.render();
      });
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
  renderQuickTaskPreview(container, textarea) {
    const previewCard = container.createDiv({ cls: "pm-input-card pm-dialog-task-preview" });
    const header = previewCard.createDiv({ cls: "pm-input-card-header" });
    header.createEl("strong", { text: "\u5B9E\u65F6\u4EFB\u52A1\u9884\u89C8" });
    header.createDiv({ cls: "pm-muted", text: "\u652F\u6301\u6570\u636E\u8FC1\u79FB JSON\u3001\u4ECA\u65E5\u5B8C\u6210\u6781\u7B80 Markdown \u548C\u65B0\u4EFB\u52A1\u8BA1\u5212\u590D\u6742 Markdown\u3002" });
    const body = previewCard.createDiv({ cls: "pm-dialog-task-preview-body" });
    const renderPreview = () => {
      body.empty();
      const preview = this.plugin.store.previewFormattedTasks(textarea.value, {
        defaultDate: toDateKey(now())
      });
      const summaryGrid = body.createDiv({ cls: "pm-import-summary-grid" });
      const summaryItems = preview.sourceFormat === "data-migration" && preview.dataMigration ? [
        ["\u8BB0\u5F55\u7C7B\u578B", "\u6570\u636E\u8FC1\u79FB JSON"],
        ["\u9879\u76EE / \u4EFB\u52A1", `${preview.dataMigration.projects} / ${preview.dataMigration.tasks}`],
        ["\u5B9E\u4F8B / \u5BFC\u56FE\u5173\u7CFB", `${preview.dataMigration.occurrences} / ${preview.dataMigration.mindmapLinks}`],
        ["\u65B0\u589E / \u8986\u76D6", `${preview.summary.createCount} / ${preview.summary.overwriteCount}`]
      ] : [
        ["\u4EFB\u52A1\u603B\u6570", String(preview.summary.total)],
        ["\u666E\u901A / \u7EC4\u5408", `${preview.tasks.filter((task) => task.input.kind !== "composite").length} / ${preview.summary.composite}`],
        ["\u6BCF\u65E5 / \u6BCF\u5468 / \u6BCF\u6708", `${preview.tasks.filter((task) => task.input.recurrence === "daily").length} / ${preview.tasks.filter((task) => task.input.recurrence === "weekly").length} / ${preview.tasks.filter((task) => task.input.recurrence === "monthly").length}`],
        ["\u65B0\u589E / \u8986\u76D6", `${preview.summary.createCount} / ${preview.summary.overwriteCount}`]
      ];
      summaryItems.forEach(([label, value]) => {
        const card = summaryGrid.createDiv({ cls: "pm-import-summary-card" });
        card.createDiv({ cls: "pm-muted", text: label });
        card.createEl("strong", { text: value });
      });
      const rows = body.createDiv({ cls: "pm-dialog-task-preview-list" });
      if (preview.tasks.length === 0) {
        rows.createDiv({ cls: "pm-muted", text: "\u8F93\u5165\u6570\u636E\u8FC1\u79FB JSON\u3001\u4ECA\u65E5\u5B8C\u6210\u6216\u4EFB\u52A1\u8BA1\u5212\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u5BFC\u5165\u52A8\u4F5C\u3002" });
      } else {
        preview.tasks.slice(0, 8).forEach((task) => {
          const row = rows.createDiv({ cls: "pm-dialog-task-preview-item" });
          row.createEl("strong", { text: task.input.title });
          row.createDiv({
            cls: "pm-muted",
            text: [
              task.input.kind === "composite" ? "\u7EC4\u5408\u4EFB\u52A1" : "\u666E\u901A\u4EFB\u52A1",
              recurrenceText(task.input.recurrence),
              task.projectName ?? "\u672A\u5F52\u5C5E\u9879\u76EE",
              task.input.date,
              task.input.startTime && task.input.endTime ? `${task.input.startTime}-${task.input.endTime}` : "\u672A\u6392\u671F",
              importActionText(task.action)
            ].join(" \xB7 ")
          });
        });
      }
      if (preview.issues.length > 0) {
        const issueList = body.createEl("ul", { cls: "pm-import-issues" });
        preview.issues.slice(0, 6).forEach((issue) => {
          issueList.createEl("li", { text: `\u7B2C ${issue.line} \u884C\uFF1A${issue.message}${issue.blocking ? "\uFF08\u963B\u6B62\u5BFC\u5165\uFF09" : ""}` });
        });
      }
    };
    renderPreview();
    textarea.addEventListener("input", renderPreview);
  }
  ensureDialogSelections(tasks, allFiles, recentFiles, projects) {
    if ((!this.selectedTaskId || !tasks.some((task) => task.id === this.selectedTaskId)) && tasks.length > 0) {
      this.selectedTaskId = tasks[0].id;
      this.selectedCommentId = "";
    }
    const noteFiles = recentFiles.length > 0 ? recentFiles : allFiles;
    if ((!this.selectedNotePath || !allFiles.some((file) => file.path === this.selectedNotePath)) && noteFiles.length > 0) {
      this.selectedNotePath = noteFiles[0].path;
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
      return [
        "#\u9879\u76EE\uFF1A\u65B0\u7684\u5B66\u4E60\u8BA1\u5212",
        "+ \u4EFB\u52A1\uFF1A\u666E\u901A\u4EFB\u52A1 @2026-05-18 09:00-10:00 !high status:doing",
        "+ \u7EC4\u5408\uFF1A\u7EC4\u5408\u4EFB\u52A1 @2026-05-18 14:00-15:00",
        "  + \u5B50\u4EFB\u52A1\uFF1A\u5B50\u4EFB\u52A1\u4E00 @2026-05-18 14:05-14:25 status:todo",
        "  + \u5B50\u4EFB\u52A1\uFF1A\u5B50\u4EFB\u52A1\u4E8C @2026-05-18 14:25-14:45 status:todo",
        "+ \u4EFB\u52A1\uFF1A\u6BCF\u65E5\u590D\u4E60 @2026-05-18 20:00-20:30 repeat:daily count:5",
        "+ \u4EFB\u52A1\uFF1A\u6BCF\u6708\u56DE\u987E @2026-05-18 21:00-21:30 status:todo repeat:monthly count:4"
      ].join("\n");
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
      this.plugin.settings = this.plugin.store.getConfig();
      return;
    }
    if (this.target === "task-note") {
      await this.appendMarkdownNote(this.selectedNotePath, trimmed, this.plugin.settings.noteAppendHeader);
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
    const fileName = formatDateTimePattern(now(), this.plugin.settings.dailyNoteDateFormat || "YYYY-MM-DD");
    return this.plugin.settings.dailyNoteMode === "single-file" ? (0, import_obsidian5.normalizePath)(this.plugin.settings.dailyNoteSingleFilePath) : (0, import_obsidian5.normalizePath)(`${this.plugin.settings.dailyNoteFolder}/${fileName}.md`);
  }
  async appendDailyNote(content) {
    await this.appendMarkdownNote(this.resolveDailyNotePath(), content, this.plugin.settings.dailyNoteHeader);
  }
  async appendMarkdownNote(path, content, headerConfig) {
    const filePath = (0, import_obsidian5.normalizePath)(path.trim());
    if (!filePath || filePath.endsWith("/")) {
      throw new Error("\u8BF7\u9009\u62E9\u6709\u6548\u7684 Markdown \u6587\u4EF6");
    }
    await this.ensureParentFolder(filePath);
    const existing = await this.app.vault.adapter.read(filePath).catch(() => "");
    const header = buildAppendHeader(headerConfig, now());
    const blocks = [existing.trimEnd(), header, content].filter((part) => part.trim().length > 0);
    const next = `${blocks.join("\n\n")}
`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.app.vault.modify(file, next);
    } else {
      await this.app.vault.adapter.write(filePath, next);
    }
    await this.plugin.store.recordDialogWrite(filePath, `\u5FEB\u901F\u8BB0\u5F55\u5199\u5165 ${filePath}`);
  }
  async ensureParentFolder(filePath) {
    const parts = filePath.split("/");
    parts.pop();
    const folder = (0, import_obsidian5.normalizePath)(parts.join("/"));
    if (folder) {
      await this.ensureFolder(folder);
    }
  }
  getAllMarkdownFiles() {
    return this.app.vault.getMarkdownFiles().sort((left, right) => {
      const basenameCompare = left.basename.localeCompare(right.basename, "zh-Hans-CN");
      if (basenameCompare !== 0) {
        return basenameCompare;
      }
      return left.path.localeCompare(right.path, "zh-Hans-CN");
    });
  }
  getRecentNoteFiles(allFiles) {
    const byPath = new Map(allFiles.map((file) => [file.path, file]));
    const operated = this.plugin.store.getRecentDialogFilePaths(10).map((path) => byPath.get(path)).filter((file) => Boolean(file));
    if (operated.length >= 10) {
      return operated.slice(0, 10);
    }
    const used = new Set(operated.map((file) => file.path));
    const fallback = [...allFiles].sort((left, right) => right.stat.mtime - left.stat.mtime).filter((file) => !used.has(file.path)).slice(0, Math.max(0, 10 - operated.length));
    return [...operated, ...fallback];
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
function buildAppendHeader(config, date) {
  if (!config.enabled) {
    return "";
  }
  const headingLevel = Math.min(6, Math.max(1, Math.floor(config.headingLevel || 2)));
  const dateText = formatDateTimePattern(date, config.dateFormat || "YYYY-MM-DD");
  const timeText = config.includeTime ? formatDateTimePattern(date, config.timeFormat || "HH:mm:ss") : "";
  const stamp = [dateText, timeText].filter(Boolean).join(config.separator ?? " ");
  const text = `${config.prefix ?? ""}${stamp}${config.suffix ?? ""}`.trim();
  return text ? `${"#".repeat(headingLevel)} ${text}` : "";
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
    return "\u6570\u636E\u8FC1\u79FB JSON \u7528\u4E8E\u6062\u590D\u6570\u636E\uFF1B+ \u4EFB\u52A1 / + \u7EC4\u5408\u7528\u4E8E\u8BA1\u5212\uFF1B\u6781\u7B80\u52FE\u9009\u53EA\u7528\u4E8E\u5B8C\u6210\u4ECA\u65E5\u5DF2\u6709\u4EFB\u52A1\u3002";
  }
  return "\u7F16\u8F91\u533A\u5DF2\u5305\u88F9\u6210\u72EC\u7ACB\u5361\u7247\uFF0C\u4FBF\u4E8E\u4E13\u6CE8\u8F93\u5165\u3002";
}
function buildQuickTaskShortcuts() {
  const today = toDateKey(now());
  return [
    {
      label: "\u666E\u901A\u4EFB\u52A1",
      hint: "\u63D2\u5165\u666E\u901A\u4EFB\u52A1\u6A21\u677F",
      snippet: `+ \u4EFB\u52A1\uFF1A\u666E\u901A\u4EFB\u52A1 @${today} 09:00-09:30 status:todo`
    },
    {
      label: "\u7EC4\u5408\u4EFB\u52A1",
      hint: "\u63D2\u5165\u7EC4\u5408\u4EFB\u52A1\u6A21\u677F\u548C\u4E24\u4E2A\u5B50\u4EFB\u52A1",
      snippet: `+ \u7EC4\u5408\uFF1A\u7EC4\u5408\u4EFB\u52A1 @${today} 10:00-11:00
  + \u5B50\u4EFB\u52A1\uFF1A\u5B50\u4EFB\u52A1\u4E00 @${today} 10:05-10:25 status:todo
  + \u5B50\u4EFB\u52A1\uFF1A\u5B50\u4EFB\u52A1\u4E8C @${today} 10:25-10:45 status:todo`
    },
    {
      label: "\u5355\u6B21",
      hint: "\u63D2\u5165\u5355\u6B21\u4EFB\u52A1\u6A21\u677F",
      snippet: `+ \u4EFB\u52A1\uFF1A\u5355\u6B21\u4EFB\u52A1 @${today} 14:00-14:30 count:1 status:todo`
    },
    {
      label: "\u6BCF\u65E5",
      hint: "\u63D2\u5165\u6BCF\u65E5\u4EFB\u52A1\u6A21\u677F",
      snippet: `+ \u4EFB\u52A1\uFF1A\u6BCF\u65E5\u4EFB\u52A1 @${today} 20:00-20:20 repeat:daily count:7 status:todo`
    },
    {
      label: "\u6BCF\u5468\u6B64\u65F6",
      hint: "\u63D2\u5165\u6BCF\u5468\u91CD\u590D\u6A21\u677F",
      snippet: `+ \u4EFB\u52A1\uFF1A\u6BCF\u5468\u4EFB\u52A1 @${today} 21:00-21:30 repeat:weekly count:4 status:todo`
    },
    {
      label: "\u6BCF\u6708\u6B64\u65F6",
      hint: "\u63D2\u5165\u6BCF\u6708\u91CD\u590D\u6A21\u677F",
      snippet: `+ \u4EFB\u52A1\uFF1A\u6BCF\u6708\u4EFB\u52A1 @${today} 21:00-21:30 repeat:monthly count:6 status:todo`
    },
    {
      label: "\u672A\u5F52\u5C5E\u9879\u76EE",
      hint: "\u63D2\u5165\u672A\u5F52\u5C5E\u9879\u76EE\u5206\u7EC4",
      snippet: "#\u9879\u76EE\uFF1A"
    }
  ];
}
function insertQuickTaskSnippet(textarea, snippet) {
  const value = textarea.value.trimEnd();
  const next = value ? `${value}
${snippet}` : snippet;
  textarea.value = next;
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
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
function recurrenceText(recurrence) {
  return recurrenceLabel(recurrence);
}
function importActionText(action) {
  if (action === "complete-series") {
    return "\u5B8C\u6210\u5E76\u7ED3\u675F\u6574\u4E2A\u7CFB\u5217";
  }
  if (action === "complete-today") {
    return "\u5B8C\u6210\u5F53\u5929";
  }
  if (action === "overwrite") {
    return "\u8986\u76D6\u5DF2\u6709\u4EFB\u52A1";
  }
  return "\u65B0\u589E\u4EFB\u52A1";
}
function truncateText(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 1))}\u2026` : value;
}

// src/views/overviewView.ts
var import_obsidian12 = require("obsidian");

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
      meta.createSpan({ text: recurrenceLabel(task.recurrence) });
      meta.createSpan({ text: this.options.getProject(task.projectId)?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
    });
  }
};

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
    const guideText = this.options.allowedFormats?.length === 1 && this.options.allowedFormats[0] === "markdown-planned" ? `\u5F53\u524D\u5904\u4E8E\u9879\u76EE\u5BFC\u5165\u6A21\u5F0F\uFF1A\u4EC5\u652F\u6301\u300C\u65B0\u4EFB\u52A1\u8BA1\u5212\u590D\u6742 Markdown\u300D\u683C\u5F0F\u3002\u8BF7\u4F7F\u7528\u300C+ \u4EFB\u52A1\uFF1A\u300D\u6216\u300C+ \u7EC4\u5408\uFF1A\u300D\u8BED\u6CD5\u3002` : this.options.projectId ? `\u5F53\u524D\u5904\u4E8E\u9879\u76EE\u5BFC\u5165\u6A21\u5F0F\uFF1A\u672A\u663E\u5F0F\u5207\u6362\u9879\u76EE\u65F6\uFF0C\u4EFB\u52A1\u4F1A\u6309\u300C${projectName}\u300D\u5904\u7406\u3002\u4E5F\u53EF\u7C98\u8D34\u300C\u5BFC\u51FA\u5168\u90E8\u8BB0\u5F55\u300D\u7684\u6570\u636E\u8FC1\u79FB JSON\u3002` : `\u652F\u6301 #\u9879\u76EE\uFF1A\u65B0\u9879\u76EE\u540D \u81EA\u52A8\u5EFA\u9879\u76EE\uFF0C\u4E5F\u652F\u6301\u672A\u5F52\u5C5E\u4EFB\u52A1\uFF1B\u4E5F\u53EF\u7C98\u8D34\u300C\u5BFC\u51FA\u5168\u90E8\u8BB0\u5F55\u300D\u7684\u6570\u636E\u8FC1\u79FB JSON\u3002`;
    contentEl.createDiv({
      cls: "pm-import-guide",
      text: guideText
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
      placeholder: "#\u9879\u76EE\uFF1A\u63D2\u4EF6\u4F53\u9A8C\u793A\u4F8B\n+ \u7EC4\u5408\uFF1A\u5F00\u53D1\u4EFB\u52A1\u89E3\u6790\u5668 @2026-05-18 09:00-10:30\n  + \u5B50\u4EFB\u52A1\uFF1A\u89E3\u6790\u6807\u9898 @2026-05-18 09:05-09:30 status:todo\n  + \u5B50\u4EFB\u52A1\uFF1A\u89E3\u6790\u65E5\u671F @2026-05-18 09:30-10:00 status:todo\n+ \u4EFB\u52A1\uFF1A\u6BCF\u65E5\u56DE\u987E\u8F93\u5165\u6D41\u7A0B @2026-05-18 20:00-20:20 status:todo repeat:daily count:5\n+ \u4EFB\u52A1\uFF1A\u6708\u5EA6\u590D\u76D8\u5BFC\u5165\u6D41\u7A0B @2026-05-18 20:30-21:00 status:todo repeat:monthly count:4"
    });
    input.addEventListener("input", () => {
      state.text = input.value;
      renderPreview();
    });
    let currentFormatBlocked = false;
    const previewEl = contentEl.createDiv({ cls: "pm-import-preview" });
    const renderPreview = () => {
      previewEl.empty();
      const preview = this.options.store.previewFormattedTasks(state.text, {
        projectId: this.options.projectId,
        strictProjectId: this.isProjectMarkdownOnlyMode() ? this.options.projectId : void 0,
        defaultDate: state.defaultDate
      });
      currentFormatBlocked = this.isFormatBlocked(preview.sourceFormat);
      if (currentFormatBlocked) {
        previewEl.createDiv({
          cls: "pm-import-format-warning",
          text: this.getFormatBlockedMessage()
        });
      }
      previewEl.createDiv({
        cls: "pm-muted",
        text: `\u89E3\u6790 ${preview.summary.total} \u6761\uFF0C\u95EE\u9898 ${preview.issues.length} \u6761`
      });
      const summaryGrid = previewEl.createDiv({ cls: "pm-import-summary-grid" });
      const summaryItems = preview.sourceFormat === "data-migration" && preview.dataMigration ? [
        ["\u8BB0\u5F55\u7C7B\u578B", "\u6570\u636E\u8FC1\u79FB JSON"],
        ["\u9879\u76EE", String(preview.dataMigration.projects)],
        ["\u9879\u76EE\u9875", String(preview.dataMigration.progressPages)],
        ["\u4EFB\u52A1 / \u5B9E\u4F8B", `${preview.dataMigration.tasks} / ${preview.dataMigration.occurrences}`],
        ["\u5BFC\u56FE\u5173\u7CFB", String(preview.dataMigration.mindmapLinks)],
        ["\u65B0\u589E / \u8986\u76D6", `${preview.summary.createCount} / ${preview.summary.overwriteCount}`]
      ] : [
        ["\u65B0\u589E\u4EFB\u52A1", String(preview.summary.createCount)],
        ["\u8986\u76D6\u4EFB\u52A1", String(preview.summary.overwriteCount)],
        ["\u5B8C\u6210\u4ECA\u65E5", String(preview.summary.completeTodayCount)],
        ["\u63D0\u524D\u7ED3\u675F", String(preview.summary.completeSeriesCount)],
        ["\u7EC4\u5408\u4EFB\u52A1", String(preview.summary.composite)],
        ["\u5DF2\u52FE\u9009\u5B8C\u6210", String(preview.summary.completed)]
      ];
      summaryItems.forEach(([label, value]) => {
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
            importActionText2(task.action),
            task.input.kind === "composite" ? "\u7EC4\u5408\u4EFB\u52A1" : "\u666E\u901A\u4EFB\u52A1",
            recurrenceLabel(task.input.recurrence),
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
          issueList.createEl("li", { text: `\u7B2C ${issue.line} \u884C\uFF1A${issue.message}${issue.blocking ? "\uFF08\u963B\u6B62\u5BFC\u5165\uFF09" : ""}` });
        });
      }
      importButton.setDisabled(currentFormatBlocked);
    };
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    const importButton = new import_obsidian7.ButtonComponent(footer).setButtonText("\u5BFC\u5165").setCta().onClick(async () => {
      try {
        if (currentFormatBlocked) {
          new import_obsidian7.Notice(this.getFormatBlockedMessage());
          return;
        }
        const created = await this.options.store.importFormattedTasks(state.text, {
          projectId: this.options.projectId,
          strictProjectId: this.isProjectMarkdownOnlyMode() ? this.options.projectId : void 0,
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
  isFormatBlocked(sourceFormat) {
    if (!this.options.allowedFormats) {
      return false;
    }
    return !this.options.allowedFormats.includes(sourceFormat);
  }
  isProjectMarkdownOnlyMode() {
    return this.options.allowedFormats?.length === 1 && this.options.allowedFormats[0] === "markdown-planned" && Boolean(this.options.projectId);
  }
  getFormatBlockedMessage() {
    if (this.options.allowedFormats?.length === 1 && this.options.allowedFormats[0] === "markdown-planned") {
      return "\u5F53\u524D\u4EC5\u652F\u6301\u300C\u65B0\u4EFB\u52A1\u8BA1\u5212\u590D\u6742 Markdown\u300D\u683C\u5F0F\uFF0C\u8BF7\u4F7F\u7528 + \u4EFB\u52A1\uFF1A\u6216 + \u7EC4\u5408\uFF1A\u8BED\u6CD5";
    }
    return "\u5F53\u524D\u4E0D\u652F\u6301\u6B64\u5BFC\u5165\u683C\u5F0F";
  }
};
function importActionText2(action) {
  if (action === "complete-series") {
    return "\u5B8C\u6210\u5E76\u7ED3\u675F\u7CFB\u5217";
  }
  if (action === "complete-today") {
    return "\u5B8C\u6210\u4ECA\u65E5";
  }
  if (action === "overwrite") {
    return "\u8986\u76D6";
  }
  return "\u65B0\u589E";
}

// src/components/compositeTaskCards.ts
var import_obsidian8 = require("obsidian");
function renderCompositeOccurrenceCards(container, options) {
  if (options.childOccurrences.length === 0) {
    return;
  }
  const grid = container.createDiv({ cls: `pm-subtask-grid pm-subtask-card-grid ${options.compact ? "is-compact" : ""}` });
  options.childOccurrences.forEach((child) => {
    const card = grid.createDiv({
      cls: `pm-subtask-card pm-subtask-task is-interactive ${options.compact ? "is-compact" : ""} ${child.completed ? "is-complete" : ""}`
    });
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.title = child.title;
    bindActivation(card, () => options.onToggleChildOccurrence(child));
    renderSubtaskCardBody(card, child.title, options.compact ? [] : [formatTaskRecurrenceLabel(child.recurrence), formatOptionalTimeRange(child)]);
    if (options.compact) {
      return;
    }
    const actions = card.createDiv({ cls: "pm-subtask-actions" });
    appendIconAction(actions, "square-pen", "\u7F16\u8F91", "", () => options.onEditChildOccurrence(child));
    appendIconAction(actions, "trash-2", "\u5220\u9664", "mod-warning", () => options.onDeleteChildTask(child));
  });
}
function renderAttachedCompositeTaskCards(container, options) {
  options.tasks.forEach((task) => {
    const card = container.createDiv({ cls: `pm-subtask-card pm-subtask-task is-${task.status}` });
    renderSubtaskCardBody(card, task.title, [formatTaskRecurrenceLabel(task.recurrence), formatTaskStatusLabel(task.status), formatOptionalTimeRange(task)]);
    if (!options.onEditTask) {
      return;
    }
    const actions = card.createDiv({ cls: "pm-subtask-actions" });
    appendIconAction(actions, "square-pen", "\u7F16\u8F91", "", () => options.onEditTask?.(task));
  });
}
function formatOptionalTimeRange(item) {
  return item.startTime && item.endTime ? `${item.startTime}-${item.endTime}` : "";
}
function formatTaskRecurrenceLabel(recurrence) {
  return recurrenceLabel(recurrence);
}
function formatTaskStatusLabel(status) {
  return statusLabel(status);
}
function renderSubtaskCardBody(container, title, metaParts) {
  container.createDiv({ cls: "pm-subtask-title", text: title });
  const meta = metaParts.map((part) => part.trim()).filter(Boolean).join(" \xB7 ");
  if (meta) {
    container.createDiv({ cls: "pm-subtask-meta", text: meta });
  }
}
function bindActivation(element, handler) {
  element.addEventListener("click", () => {
    void handler();
  });
  element.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    void handler();
  });
}
function appendIconAction(container, icon, label, extraClass, handler) {
  const button = container.createEl("button", {
    cls: `pm-subtask-action pm-subtask-icon-action ${extraClass}`.trim(),
    attr: {
      type: "button",
      "aria-label": label,
      title: label
    }
  });
  (0, import_obsidian8.setIcon)(button, icon);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void handler();
  });
}

// src/components/projectModal.ts
var import_obsidian9 = require("obsidian");
var ProjectModal = class extends import_obsidian9.Modal {
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
    new import_obsidian9.Setting(contentEl).setName("\u9879\u76EE\u540D\u79F0").addText(
      (text) => text.setValue(state.name ?? "").onChange((value) => {
        state.name = value;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u9879\u76EE\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u9879\u76EE\u989C\u8272").addText(
      (text) => text.setPlaceholder("#4f8cff").setValue(state.color ?? "").onChange((value) => {
        state.color = value;
      })
    );
    new import_obsidian9.Setting(contentEl).setName("\u9879\u76EE\u72B6\u6001").addDropdown((dropdown) => {
      const statuses = ["active", "paused", "completed", "archived"];
      statuses.forEach((status) => dropdown.addOption(status, status));
      dropdown.setValue(state.status ?? "active");
      dropdown.onChange((value) => {
        state.status = value;
      });
    });
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian9.ButtonComponent(footer).setButtonText("\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(state);
        this.close();
      } catch (error) {
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    if (this.options.onDelete) {
      new import_obsidian9.ButtonComponent(footer).setButtonText("\u5220\u9664\u9879\u76EE").setWarning().onClick(async () => {
        await this.options.onDelete?.();
        this.close();
      });
    }
  }
};

// src/components/taskModal.ts
var import_obsidian10 = require("obsidian");
var TaskModal = class extends import_obsidian10.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal", "pm-task-modal");
    contentEl.createEl("h2", { text: this.options.title });
    const state = { ...this.options.initial };
    state.kind = state.kind ?? "simple";
    state.recurrence = state.recurrence ?? "daily";
    state.recurrenceCount = state.recurrenceCount ?? SINGLE_TASK_RECURRENCE_COUNT;
    state.consumeRequiresCompletion = Boolean(state.consumeRequiresCompletion);
    state.subtasks = [];
    state.viewState = cloneTaskInputViewState(state.viewState);
    const isOccurrenceEditor = Boolean(this.options.occurrenceContext);
    const form = contentEl.createDiv({ cls: "pm-task-modal-form" });
    const basicSection = createTaskModalSection(form, "\u57FA\u7840\u4FE1\u606F");
    const scheduleSection = createTaskModalSection(form, "\u65F6\u95F4\u5B89\u6392");
    const relationSection = isOccurrenceEditor ? null : createTaskModalSection(form, "\u5F52\u5C5E\u4E0E\u72B6\u6001");
    const recurrenceSection = isOccurrenceEditor ? null : createTaskModalSection(form, "\u91CD\u590D\u89C4\u5219");
    const subtaskSection = isOccurrenceEditor ? null : createTaskModalSection(form, "\u5B50\u4EFB\u52A1");
    if (this.options.occurrenceContext) {
      basicSection.createDiv({
        cls: "pm-muted",
        text: `\u5F53\u524D\u6B63\u5728\u7F16\u8F91 ${this.options.occurrenceContext.occurrenceDate} \u8FD9\u6B21\u53D1\u751F\u3002\u4FDD\u5B58\u672C\u6B21\u53EA\u4F1A\u66F4\u65B0\u8FD9\u4E00\u6761\u5B9E\u4F8B\uFF0C\u4E0D\u5F71\u54CD\u672A\u6765\uFF1B\u5982\u9700\u4FEE\u6539\u6574\u6761\u91CD\u590D\u4EFB\u52A1\uFF0C\u8BF7\u4F7F\u7528\u4E0B\u65B9\u201C\u7F16\u8F91\u6574\u6761\u7CFB\u5217\u201D\u3002`
      });
    } else if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      basicSection.createDiv({
        cls: "pm-muted",
        text: "\u5F53\u524D\u7F16\u8F91\u7684\u662F\u6574\u6761\u91CD\u590D\u4EFB\u52A1\uFF0C\u4E0B\u9762\u7684\u65E5\u671F\u4E0E\u91CD\u590D\u89C4\u5219\u4F1A\u4E00\u8D77\u66F4\u65B0\u5168\u90E8\u53D1\u751F\u65F6\u95F4\u3002"
      });
    }
    new import_obsidian10.Setting(basicSection).setName("\u6807\u9898").addText(
      (text) => text.setPlaceholder("\u8F93\u5165\u4EFB\u52A1\u6807\u9898").setValue(state.title).onChange((value) => {
        state.title = value;
      })
    );
    let taskTypeDropdown = null;
    if (!isOccurrenceEditor) {
      new import_obsidian10.Setting(basicSection).setName("\u4EFB\u52A1\u7C7B\u578B").setDesc("\u7EC4\u5408\u4EFB\u52A1\u53EF\u4F5C\u4E3A\u5BB9\u5668\uFF0C\u5B50\u4EFB\u52A1\u901A\u8FC7\u201C\u6302\u5165\u7EC4\u5408\u4EFB\u52A1\u201D\u521B\u5EFA").addDropdown((dropdown) => {
        taskTypeDropdown = dropdown;
        const labels = {
          simple: "\u666E\u901A\u4EFB\u52A1",
          composite: "\u7EC4\u5408\u4EFB\u52A1"
        };
        Object.keys(labels).forEach((key) => dropdown.addOption(key, labels[key]));
        dropdown.setValue(state.kind ?? "simple");
        dropdown.onChange((value) => {
          state.kind = value;
          state.subtasks = [];
          if (state.kind === "composite") {
            state.viewState = withMindmapParent(state.viewState, null);
            state.recurrence = "daily";
            state.recurrenceCount = SINGLE_TASK_RECURRENCE_COUNT;
            state.recurrenceUntil = null;
            state.consumeRequiresCompletion = false;
            renderParentField();
          }
          renderExecutionFields();
          renderRecurrenceFields();
          renderSubtaskFields();
        });
      });
    }
    new import_obsidian10.Setting(basicSection).setName("\u63CF\u8FF0").addTextArea(
      (text) => text.setValue(state.description ?? "").onChange((value) => {
        state.description = value;
      })
    );
    let dateInput = null;
    let startTimeInput = null;
    let endTimeInput = null;
    const setDateValue = (value) => {
      state.date = value;
      dateInput?.setValue(value);
    };
    const setStartTimeValue = (value) => {
      state.startTime = value || void 0;
      startTimeInput?.setValue(value ?? "");
    };
    const setEndTimeValue = (value) => {
      state.endTime = value || void 0;
      endTimeInput?.setValue(value ?? "");
    };
    const scheduleGrid = scheduleSection.createDiv({ cls: "pm-task-field-grid" });
    new import_obsidian10.Setting(scheduleGrid).setName("\u65E5\u671F").addText((text) => {
      dateInput = text;
      text.setPlaceholder("YYYY-MM-DD").setValue(state.date);
      if (isOccurrenceEditor) {
        text.inputEl.disabled = true;
        return text;
      }
      return text.onChange((value) => {
        state.date = value;
      });
    });
    new import_obsidian10.Setting(scheduleGrid).setName("\u5F00\u59CB\u65F6\u95F4").addText((text) => {
      startTimeInput = text;
      return text.setPlaceholder("07:00").setValue(state.startTime ?? "").onChange((value) => {
        state.startTime = value || void 0;
      });
    });
    new import_obsidian10.Setting(scheduleGrid).setName("\u7ED3\u675F\u65F6\u95F4").addText((text) => {
      endTimeInput = text;
      return text.setPlaceholder("07:30").setValue(state.endTime ?? "").onChange((value) => {
        state.endTime = value || void 0;
      });
    });
    let projectDropdown = null;
    let renderParentField = () => void 0;
    let clearParentIfDisallowed = () => void 0;
    let renderExecutionFields = () => void 0;
    if (!isOccurrenceEditor && relationSection && recurrenceSection && subtaskSection) {
      const relationGrid = relationSection.createDiv({ cls: "pm-task-field-grid" });
      new import_obsidian10.Setting(relationGrid).setName("\u6240\u5C5E\u9879\u76EE").addDropdown((dropdown) => {
        projectDropdown = dropdown;
        dropdown.addOption("", "\u672A\u5F52\u5C5E\u9879\u76EE");
        this.options.projects.forEach((project) => dropdown.addOption(project.id, project.name));
        dropdown.setValue(state.projectId ?? "");
        dropdown.onChange((value) => {
          state.projectId = value || void 0;
          clearParentIfDisallowed();
          renderParentField();
        });
      });
      const compositeParents = this.options.compositeParents ?? [];
      const parentField = relationSection.createDiv({ cls: "pm-task-parent-field" });
      const getSelectableParents = () => compositeParents.filter((task) => task.id !== this.options.existingTask?.id).filter((task) => !state.projectId || task.projectId === state.projectId);
      const applyParentSchedule = (parent) => {
        const nextDate = parent.occurrenceDates.includes(state.date) ? state.date : parent.date;
        setDateValue(nextDate);
        if (!parent.startTime || !parent.endTime) {
          return;
        }
        const parentStart = parseTimeToMinutes(parent.startTime);
        const parentEnd = parseTimeToMinutes(parent.endTime);
        if (parentStart === null || parentEnd === null || parentStart >= parentEnd) {
          return;
        }
        setStartTimeValue(parent.startTime);
        setEndTimeValue(parent.endTime);
      };
      clearParentIfDisallowed = () => {
        const currentParentId = state.viewState?.mindmap?.parentTaskId ?? "";
        if (!currentParentId) {
          return;
        }
        if (!getSelectableParents().some((task) => task.id === currentParentId)) {
          state.viewState = withMindmapParent(state.viewState, null);
        }
      };
      renderParentField = () => {
        parentField.empty();
        clearParentIfDisallowed();
        const currentParentId = state.viewState?.mindmap?.parentTaskId ?? "";
        const parentOptions = getSelectableParents();
        if (parentOptions.length === 0) {
          parentField.createDiv({
            cls: "pm-muted pm-task-parent-note",
            text: state.projectId ? "\u5F53\u524D\u9879\u76EE\u4E0B\u6682\u65E0\u53EF\u6302\u5165\u7684\u7EC4\u5408\u4EFB\u52A1\u3002" : "\u6682\u65E0\u53EF\u6302\u5165\u7684\u7EC4\u5408\u4EFB\u52A1\u3002"
          });
          return;
        }
        new import_obsidian10.Setting(parentField).setName("\u6302\u5165\u7EC4\u5408\u4EFB\u52A1").setDesc("\u9009\u62E9\u540E\uFF0C\u8FD9\u6761\u4EFB\u52A1\u4F1A\u4F5C\u4E3A\u8BE5\u7EC4\u5408\u4EFB\u52A1\u7684\u5B50\u4EFB\u52A1\uFF0C\u5E76\u4FDD\u7559\u81EA\u5DF1\u7684\u91CD\u590D\u89C4\u5219").addDropdown((dropdown) => {
          dropdown.addOption("", "\u4E0D\u6302\u5165\u7EC4\u5408\u4EFB\u52A1");
          parentOptions.forEach((parent) => {
            const projectName = this.options.projects.find((project) => project.id === parent.projectId)?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE";
            dropdown.addOption(parent.id, `${projectName} / ${parent.title}`);
          });
          dropdown.setValue(currentParentId);
          dropdown.onChange((value) => {
            const parentTaskId = value || null;
            state.viewState = withMindmapParent(state.viewState, parentTaskId);
            const parent = parentTaskId ? parentOptions.find((task) => task.id === parentTaskId) : void 0;
            if (parent) {
              state.kind = "simple";
              state.subtasks = [];
              taskTypeDropdown?.setValue("simple");
              state.projectId = parent.projectId;
              projectDropdown?.setValue(parent.projectId ?? "");
              applyParentSchedule(parent);
              renderSubtaskFields();
              renderParentField();
            }
          });
        });
      };
      renderParentField();
      const executionFields = relationSection.createDiv({ cls: "pm-task-nested-fields pm-task-execution-fields" });
      renderExecutionFields = () => {
        executionFields.empty();
        if (state.kind === "composite") {
          executionFields.createDiv({ cls: "pm-muted", text: "\u7EC4\u5408\u4EFB\u52A1\u662F\u5BB9\u5668\uFF0C\u4E0D\u8BBE\u7F6E\u72B6\u6001\u3001\u4F18\u5148\u7EA7\u6216\u91CD\u590D\u6267\u884C\u89C4\u5219\u3002" });
          return;
        }
        const executionGrid = executionFields.createDiv({ cls: "pm-task-field-grid" });
        new import_obsidian10.Setting(executionGrid).setName("\u72B6\u6001").addDropdown((dropdown) => {
          ["todo", "doing", "blocked", "done"].forEach((key) => dropdown.addOption(key, statusLabel(key)));
          dropdown.setValue(state.status ?? "todo");
          dropdown.onChange((value) => {
            state.status = value;
          });
        });
        new import_obsidian10.Setting(executionGrid).setName("\u4F18\u5148\u7EA7").addDropdown((dropdown) => {
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
      };
      renderExecutionFields();
      new import_obsidian10.Setting(recurrenceSection).setName("\u91CD\u590D\u7C7B\u578B").setDesc("\u5355\u6B21\u548C\u6C38\u4E45\u91CD\u590D\u662F\u5FEB\u6377\u9009\u62E9\uFF0C\u6838\u5FC3\u7C7B\u578B\u4E3A\u6BCF\u65E5/\u6BCF\u5468/\u6BCF\u6708\u6B64\u65F6\u91CD\u590D").addDropdown((dropdown) => {
        const labels = [
          ["single", "\u5355\u6B21\u4EFB\u52A1"],
          ["daily", recurrenceLabel("daily")],
          ["weekly", recurrenceLabel("weekly")],
          ["monthly", recurrenceLabel("monthly")],
          ["permanent", "\u6C38\u4E45\u91CD\u590D"]
        ];
        labels.forEach(([key, label]) => dropdown.addOption(key, label));
        dropdown.setValue(recurrencePresetForState(state));
        dropdown.onChange((value) => {
          const preset = value;
          if (preset === "single") {
            state.recurrence = "daily";
            state.recurrenceCount = SINGLE_TASK_RECURRENCE_COUNT;
            state.recurrenceUntil = null;
          } else if (preset === "permanent") {
            state.recurrence = "daily";
            state.recurrenceCount = PERMANENT_RECURRENCE_COUNT;
            state.recurrenceUntil = null;
          } else {
            state.recurrence = preset;
            state.recurrenceCount = state.recurrenceCount ?? SINGLE_TASK_RECURRENCE_COUNT;
          }
          renderRecurrenceFields();
        });
      });
    }
    const recurrenceFields = recurrenceSection?.createDiv({ cls: "pm-task-nested-fields" }) ?? null;
    const subtaskFields = subtaskSection?.createDiv({ cls: "pm-task-nested-fields" }) ?? null;
    const renderRecurrenceFields = () => {
      if (!recurrenceFields) {
        return;
      }
      recurrenceFields.empty();
      if (state.kind === "composite") {
        recurrenceSection?.addClass("is-hidden");
        return;
      }
      recurrenceSection?.removeClass("is-hidden");
      new import_obsidian10.Setting(recurrenceFields).setName("\u91CD\u590D\u6B21\u6570").setDesc("\u5355\u6B21\u4EFB\u52A1\u4E3A 1\uFF1B\u6C38\u4E45\u91CD\u590D\u4F1A\u5199\u5165\u6574\u6570\u6700\u5927\u503C").addText(
        (text) => text.setPlaceholder("\u4F8B\u5982 10").setValue(state.recurrenceCount ? String(state.recurrenceCount) : "").onChange((value) => {
          state.recurrenceCount = value.trim() ? Number(value) : null;
        })
      );
      new import_obsidian10.Setting(recurrenceFields).setName("\u91CD\u590D\u7ED3\u675F\u65E5\u671F").addText(
        (text) => text.setPlaceholder("YYYY-MM-DD").setValue(state.recurrenceUntil ?? "").onChange((value) => {
          state.recurrenceUntil = value.trim() || null;
        })
      );
      new import_obsidian10.Setting(recurrenceFields).setName("\u6267\u884C\u8DB3\u989D\u6B21\u6570").setDesc("\u5F00\u542F\u540E\uFF0C\u53EA\u6709\u5B8C\u6210\u4EFB\u52A1\u624D\u4F1A\u6D88\u8017\u5269\u4F59\u6267\u884C\u6B21\u6570").addToggle(
        (toggle) => toggle.setValue(Boolean(state.consumeRequiresCompletion)).onChange((value) => {
          state.consumeRequiresCompletion = value;
        })
      );
    };
    renderRecurrenceFields();
    const renderSubtaskFields = () => {
      if (!subtaskFields || !subtaskSection) {
        return;
      }
      subtaskFields.empty();
      if (state.kind !== "composite") {
        subtaskSection.addClass("is-hidden");
        return;
      }
      subtaskSection.removeClass("is-hidden");
      subtaskFields.addClass("pm-subtask-editor");
      subtaskFields.createDiv({
        cls: "pm-muted",
        text: "\u5B50\u4EFB\u52A1\u662F\u72EC\u7ACB\u4EFB\u52A1\uFF0C\u4F1A\u4FDD\u7559\u81EA\u5DF1\u7684\u91CD\u590D\u89C4\u5219\u3001\u5B8C\u6210\u8BB0\u5F55\u4E0E\u9879\u76EE\u89C6\u56FE\u72B6\u6001\u3002"
      });
      const actions = subtaskFields.createDiv({ cls: "pm-inline-actions" });
      const childButton = actions.createEl("button", { text: "\u6DFB\u52A0\u5B50\u4EFB\u52A1", cls: "pm-button pm-button-secondary" });
      childButton.disabled = !this.options.existingTask || !this.options.onCreateChildTask;
      childButton.addEventListener("click", () => {
        if (!this.options.existingTask || !this.options.onCreateChildTask) {
          return;
        }
        this.close();
        this.options.onCreateChildTask(this.options.existingTask);
      });
      if (!this.options.existingTask) {
        subtaskFields.createDiv({ cls: "pm-muted", text: "\u4FDD\u5B58\u7EC4\u5408\u4EFB\u52A1\u540E\u5373\u53EF\u6DFB\u52A0\u5B50\u4EFB\u52A1\u3002" });
      }
      const childTasks = this.options.childTasks ?? [];
      if (childTasks.length === 0) {
        return;
      }
      const attached = subtaskFields.createDiv({ cls: "pm-attached-task-list" });
      attached.createDiv({ cls: "pm-muted pm-attached-task-list-title", text: `\u5DF2\u6302\u5165\u4EFB\u52A1 ${childTasks.length} \u9879` });
      renderAttachedCompositeTaskCards(attached, {
        tasks: childTasks,
        onEditTask: this.options.onOpenChildTask ? (task) => {
          this.close();
          this.options.onOpenChildTask?.(task);
        } : void 0
      });
    };
    renderSubtaskFields();
    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new import_obsidian10.ButtonComponent(footer).setButtonText(isOccurrenceEditor ? "\u4FDD\u5B58\u672C\u6B21" : "\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(state, isOccurrenceEditor ? "occurrence" : "series");
        this.close();
      } catch (error) {
        new import_obsidian10.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    if (isOccurrenceEditor && this.options.onOpenSeriesEditor) {
      new import_obsidian10.ButtonComponent(footer).setButtonText("\u7F16\u8F91\u6574\u6761\u7CFB\u5217").onClick(() => {
        this.close();
        this.options.onOpenSeriesEditor?.();
      });
    }
    if (this.options.onDelete) {
      if (this.options.allowSingleDelete) {
        new import_obsidian10.ButtonComponent(footer).setButtonText("\u5220\u9664\u672C\u6B21\u5B9E\u4F8B").setWarning().onClick(async () => {
          await this.options.onDelete?.("single");
          this.close();
        });
      }
      if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
        new import_obsidian10.ButtonComponent(footer).setButtonText("\u5220\u9664\u6574\u4E2A\u7CFB\u5217").setWarning().onClick(async () => {
          await this.options.onDelete?.("series");
          this.close();
        });
      }
    }
    if (this.options.onCompleteSeries && this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      new import_obsidian10.ButtonComponent(footer).setButtonText("\u5230\u672C\u6B21\u4E3A\u6B62\u7ED3\u675F\u91CD\u590D").onClick(async () => {
        await this.options.onCompleteSeries?.();
        this.close();
      });
    }
  }
};
function cloneTaskInputViewState(viewState) {
  if (!viewState) {
    return void 0;
  }
  return {
    board: viewState.board ? { ...viewState.board } : void 0,
    gantt: viewState.gantt ? { ...viewState.gantt, dependencyIds: [...viewState.gantt.dependencyIds ?? []] } : void 0,
    mindmap: viewState.mindmap ? { ...viewState.mindmap } : void 0
  };
}
function createTaskModalSection(container, title) {
  const section = container.createDiv({ cls: "pm-task-modal-section" });
  section.createEl("h3", { text: title });
  return section;
}
function withMindmapParent(viewState, parentTaskId) {
  return {
    ...viewState ?? {},
    mindmap: {
      ...viewState?.mindmap ?? {},
      parentTaskId,
      childOrder: viewState?.mindmap?.childOrder ?? Date.now(),
      expanded: viewState?.mindmap?.expanded ?? true
    }
  };
}
function recurrencePresetForState(state) {
  if (state.recurrence === "daily" && state.recurrenceCount === SINGLE_TASK_RECURRENCE_COUNT && !state.recurrenceUntil) {
    return "single";
  }
  if (state.recurrence === "daily" && state.recurrenceCount === PERMANENT_RECURRENCE_COUNT && !state.recurrenceUntil) {
    return "permanent";
  }
  return state.recurrence ?? "daily";
}

// src/components/textEntryModal.ts
var import_obsidian11 = require("obsidian");
var TextEntryModal = class extends import_obsidian11.Modal {
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
    new import_obsidian11.ButtonComponent(footer).setButtonText(this.options.confirmText ?? "\u4FDD\u5B58").setCta().onClick(async () => {
      try {
        await this.options.onSubmit(textarea.value);
        this.close();
      } catch (error) {
        new import_obsidian11.Notice(error instanceof Error ? error.message : "\u4FDD\u5B58\u5931\u8D25");
      }
    });
    new import_obsidian11.ButtonComponent(footer).setButtonText("\u53D6\u6D88").onClick(() => this.close());
  }
};

// src/views/compositeDisplay.ts
function buildCompositeDisplayOccurrences(occurrences, seriesTasks) {
  const taskById = new Map(seriesTasks.map((task) => [task.id, task]));
  const childrenByParent = /* @__PURE__ */ new Map();
  const hiddenOccurrenceIds = /* @__PURE__ */ new Set();
  occurrences.forEach((occurrence) => {
    const parentId = getCompositeParentId(occurrence.taskId, taskById);
    if (!parentId) {
      return;
    }
    hiddenOccurrenceIds.add(occurrence.id);
    childrenByParent.set(parentId, [...childrenByParent.get(parentId) ?? [], occurrence]);
  });
  childrenByParent.forEach((children, parentId) => childrenByParent.set(parentId, children.slice().sort(compareDisplayOccurrences)));
  const display = occurrences.filter((occurrence) => !hiddenOccurrenceIds.has(occurrence.id)).map((occurrence) => ({
    occurrence,
    childOccurrences: childrenByParent.get(occurrence.taskId) ?? []
  }));
  const displayedTaskIds = new Set(display.map((item) => item.occurrence.taskId));
  childrenByParent.forEach((children, parentId) => {
    if (displayedTaskIds.has(parentId)) {
      return;
    }
    const parent = taskById.get(parentId);
    if (!parent) {
      return;
    }
    display.push({
      occurrence: buildCompositeContainerOccurrence(parent, children[0].date, children),
      childOccurrences: children
    });
  });
  return display.sort((left, right) => compareDisplayOccurrences(left.occurrence, right.occurrence));
}
function summarizeOccurrenceDisplay(occurrence, childOccurrences) {
  const childProgress = summarizeChildOccurrences(childOccurrences);
  const totalSteps = occurrence.totalSteps + childProgress.totalSteps;
  const completedSteps = occurrence.completedSteps + childProgress.completedSteps;
  return {
    totalSteps,
    completedSteps,
    completed: totalSteps > 0 ? completedSteps === totalSteps : occurrence.completed
  };
}
function isSyntheticCompositeOccurrence(occurrence) {
  return occurrence.id.endsWith("::children");
}
function getCompositeParentId(taskId, taskById) {
  const parentId = taskById.get(taskId)?.viewState.mindmap.parentTaskId ?? null;
  if (!parentId) {
    return null;
  }
  const parent = taskById.get(parentId);
  return parent?.kind === "composite" ? parent.id : null;
}
function buildCompositeContainerOccurrence(parent, date, childOccurrences) {
  const childProgress = summarizeChildOccurrences(childOccurrences);
  const window2 = summarizeChildWindow(childOccurrences);
  return {
    id: `${parent.id}::${date}::children`,
    taskId: parent.id,
    parentTaskId: parent.viewState.mindmap.parentTaskId ?? null,
    occurrenceDate: date,
    occurrenceNumber: parent.occurrenceDates.findIndex((entry) => entry === date) + 1 || 1,
    kind: parent.kind,
    title: parent.title,
    description: parent.description,
    projectId: parent.projectId,
    status: parent.status,
    priority: parent.priority,
    tags: [...parent.tags],
    date,
    startTime: window2.startTime ?? parent.startTime,
    endTime: window2.endTime ?? parent.endTime,
    recurrence: parent.recurrence,
    recurrenceCount: parent.recurrenceCount ?? null,
    recurrenceUntil: parent.recurrenceUntil ?? null,
    consumeRequiresCompletion: parent.consumeRequiresCompletion,
    subtasks: [],
    sourceLinks: parent.sourceLinks.map((source) => ({ ...source })),
    notes: parent.notes.map((note) => ({ ...note })),
    completedSubtaskIds: [],
    progress: 0,
    totalSteps: 0,
    completedSteps: 0,
    completed: childProgress.completed,
    completedAt: childProgress.completed ? childOccurrences.map((child) => child.completedAt).filter(Boolean).sort().reverse()[0] ?? null : null,
    createdAt: parent.createdAt,
    updatedAt: parent.updatedAt,
    revision: parent.revision
  };
}
function summarizeChildOccurrences(childOccurrences) {
  const totalSteps = childOccurrences.reduce((sum, child) => sum + child.totalSteps, 0);
  const completedSteps = childOccurrences.reduce((sum, child) => sum + child.completedSteps, 0);
  return {
    totalSteps,
    completedSteps,
    completed: childOccurrences.length > 0 && totalSteps > 0 && completedSteps === totalSteps
  };
}
function summarizeChildWindow(childOccurrences) {
  const timed = childOccurrences.map((child) => ({
    start: parseTimeToMinutes(child.startTime),
    end: parseTimeToMinutes(child.endTime),
    startTime: child.startTime,
    endTime: child.endTime
  })).filter((item) => item.start !== null && item.end !== null && Boolean(item.startTime && item.endTime));
  if (timed.length === 0) {
    return {};
  }
  const first = timed.reduce((best, item) => item.start < best.start ? item : best, timed[0]);
  const last = timed.reduce((best, item) => item.end > best.end ? item : best, timed[0]);
  return { startTime: first.startTime, endTime: last.endTime };
}
function compareDisplayOccurrences(a, b) {
  if (a.date !== b.date) {
    return a.date.localeCompare(b.date);
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
    this.timelineAutoScrollTimer = null;
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
    this.clearTimelineAutoScrollTimer();
    this.destroyMindmapViewport();
  }
  async render() {
    this.clearTimelineAutoScrollTimer();
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
    titleBlock.createDiv({ cls: "pm-muted", text: "\u805A\u7126\u4EFB\u52A1\u72B6\u6001\u3001\u8D8B\u52BF\u4E0E\u672C\u5468\u5B89\u6392\u3002" });
    const heroActions = hero.createDiv({ cls: "pm-overview-actions" });
    const primaryTabs = heroActions.createDiv({ cls: "pm-tab-bar" });
    this.createPrimaryTab(primaryTabs, this.plugin.settings.overviewTab1Name, "activity");
    this.createPrimaryTab(primaryTabs, this.plugin.settings.overviewTab2Name, "projects");
    if (this.activePrimaryTab === "activity") {
      this.renderActivityTab(container, snapshot.occurrences, snapshot.projects, snapshot.tasks);
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
  renderActivityTab(container, tasks, projects, seriesTasks) {
    const today = toDateKey(now());
    const todayItems = buildCompositeDisplayOccurrences(tasks.filter((task) => task.date === today), seriesTasks);
    this.renderOverviewMetrics(container, tasks, seriesTasks, todayItems);
    const insights = container.createDiv({ cls: "pm-overview-insights" });
    const trendSection = insights.createDiv({ cls: "pm-section pm-overview-panel pm-overview-trend-panel" });
    const trendHeader = trendSection.createDiv({ cls: "pm-page-header" });
    trendHeader.createEl("h3", { text: "\u8FD1 30 \u5929\u8D8B\u52BF" });
    trendHeader.createDiv({ cls: "pm-muted", text: "\u6BCF\u65E5\u4EFB\u52A1\u603B\u6570\u4E0E\u5B8C\u6210\u6570" });
    this.renderMonthlyTrend(trendSection, tasks);
    const timelineSection = insights.createDiv({ cls: "pm-section pm-overview-panel pm-overview-timeline-panel" });
    this.renderTodayTimeline(timelineSection, todayItems);
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
    this.renderWeekCompactBoard(weekSection, tasks, projects, seriesTasks);
    const heatmapSection = container.createDiv({ cls: "pm-section pm-overview-heatmap-panel" });
    const heatmapHeader = heatmapSection.createDiv({ cls: "pm-page-header" });
    const heatmapTitle = heatmapHeader.createDiv({ cls: "pm-heatmap-title" });
    const heatmapIcon = heatmapTitle.createSpan({ cls: "pm-heatmap-title-icon" });
    (0, import_obsidian12.setIcon)(heatmapIcon, "flame");
    heatmapTitle.createEl("h3", { text: "\u9879\u76EE\u70ED\u529B\u8D8B\u52BF\uFF08\u8FD1 1 \u5E74\uFF09" });
    this.renderHeatmap(heatmapSection, tasks);
  }
  renderOverviewMetrics(container, tasks, seriesTasks, todayItems) {
    const today = toDateKey(now());
    const currentMinute = getCurrentTimeMinutes();
    const weekStart = toDateKey(startOfWeek(now()));
    const weekEnd = toDateKey(addDays(startOfWeek(now()), 6));
    const todayTaskCount = tasks.filter((task) => task.date === today && isExecutableTask(task) && task.status === "doing").length;
    const overdueCount = tasks.filter((task) => isActionableOccurrence(task) && isOccurrenceOverdue(task, today, currentMinute)).length;
    const currentCount = tasks.filter((task) => isActionableOccurrence(task) && task.date === today && isOccurrenceInCurrentWindow(task, currentMinute)).length;
    const blockedCount = seriesTasks.filter((task) => isExecutableTask(task) && task.status === "blocked" && !isTaskSeriesCompleted(task)).length;
    const completedThisWeek = tasks.filter((task) => {
      const completedDate = task.completedAt?.slice(0, 10);
      return Boolean(completedDate && compareDateKeys(completedDate, weekStart) >= 0 && compareDateKeys(completedDate, weekEnd) <= 0);
    }).length;
    const metrics = [
      { label: "\u4ECA\u65E5\u4EFB\u52A1", value: String(todayTaskCount), detail: "\u4ECA\u5929\u9700\u5904\u7406", icon: "calendar-check", tone: "purple" },
      { label: "\u4ECA\u65E5\u903E\u671F", value: String(overdueCount), detail: "\u5DF2\u8D85\u65F6\u672A\u5B8C\u6210", icon: "clock", tone: "red" },
      { label: "\u5F53\u524D\u8FDB\u884C\u4E2D", value: String(currentCount), detail: "\u5F53\u524D\u65F6\u6BB5\u5185", icon: "play", tone: "green" },
      { label: "\u963B\u585E\u4EFB\u52A1", value: String(blockedCount), detail: "\u7B49\u5F85\u89E3\u9664", icon: "alert-triangle", tone: "amber" },
      { label: "\u672C\u5468\u5B8C\u6210", value: String(completedThisWeek), detail: "\u8F83\u4E0A\u5468 +20%", icon: "check-circle", tone: "blue" }
    ];
    const summary = container.createDiv({ cls: "pm-summary-strip pm-overview-metrics" });
    metrics.forEach((item) => {
      const card = summary.createDiv({ cls: `pm-summary-card pm-overview-metric is-${item.tone}` });
      const icon = card.createDiv({ cls: "pm-overview-metric-icon" });
      (0, import_obsidian12.setIcon)(icon, item.icon);
      const copy = card.createDiv({ cls: "pm-overview-metric-copy" });
      copy.createDiv({ cls: "pm-overview-metric-label", text: item.label });
      copy.createEl("strong", { text: item.value });
      copy.createDiv({ cls: "pm-muted", text: item.detail });
    });
  }
  renderHeatmap(container, tasks) {
    const today = now();
    const todayKey = toDateKey(today);
    const counts = /* @__PURE__ */ new Map();
    tasks.forEach((task) => {
      if (!task.completed || !task.completedAt) {
        return;
      }
      const key = task.completedAt.slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const startDate = startOfWeek(addDays(today, -364));
    const totalDays = Math.round((today.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1e3)) + 1;
    const weekCount = Math.ceil(totalDays / 7);
    const dailyStats = /* @__PURE__ */ new Map();
    let maxCount = 1;
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(startDate, i);
      const key = toDateKey(date);
      const count = counts.get(key) ?? 0;
      if (count > maxCount) {
        maxCount = count;
      }
      dailyStats.set(key, { date, key, count, level: 0 });
    }
    dailyStats.forEach((stat) => {
      stat.level = heatLevel(stat.count, maxCount);
    });
    const columns = [];
    for (let week = 0; week < weekCount; week++) {
      const column = [];
      for (let day = 0; day < 7; day++) {
        const date = addDays(startDate, week * 7 + day);
        const key = toDateKey(date);
        if (dailyStats.has(key)) {
          column.push({ key, date });
        } else {
          column.push(null);
        }
      }
      columns.push(column);
    }
    const monthLabels = [];
    let lastMonth = -1;
    columns.forEach((column, colIndex) => {
      for (const cell of column) {
        if (cell) {
          const month = cell.date.getMonth();
          if (month !== lastMonth) {
            monthLabels.push({ label: HEATMAP_MONTH_LABELS[month], colIndex });
            lastMonth = month;
          }
          break;
        }
      }
    });
    const heatmap = container.createDiv({
      cls: "pm-contribution-heatmap pm-project-heatmap",
      attr: { "aria-label": "\u8FD1 1 \u5E74\u9879\u76EE\u5B8C\u6210\u70ED\u529B\u8D8B\u52BF" }
    });
    const graph = heatmap.createDiv({ cls: "pm-contribution-graph" });
    graph.style.setProperty("--pm-heatmap-cols", String(weekCount));
    const dateHeader = graph.createDiv({ cls: "pm-contribution-date-header" });
    dateHeader.createDiv({ cls: "pm-contribution-corner" });
    let nextMonthIdx = 0;
    for (let col = 0; col < weekCount; col++) {
      const label = nextMonthIdx < monthLabels.length && monthLabels[nextMonthIdx].colIndex === col ? monthLabels[nextMonthIdx++].label : "";
      dateHeader.createDiv({
        cls: `pm-contribution-date-label`,
        text: label
      });
    }
    const body = graph.createDiv({ cls: "pm-contribution-body" });
    const axis = body.createDiv({ cls: "pm-contribution-weekday-axis" });
    HEATMAP_ROW_LABELS.forEach((label) => axis.createDiv({ cls: "pm-contribution-weekday-label", text: label }));
    const grid = body.createDiv({ cls: "pm-contribution-grid" });
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < weekCount; col++) {
        const cell = columns[col][row];
        if (!cell) {
          grid.createDiv({ cls: "pm-contribution-cell is-empty" });
          continue;
        }
        const stat = dailyStats.get(cell.key);
        const count = stat?.count ?? 0;
        const level = stat?.level ?? 0;
        const isTodayCell = cell.key === todayKey;
        const el = grid.createEl("button", {
          cls: `pm-contribution-cell level-${level}${isTodayCell ? " is-today" : ""}`,
          attr: {
            type: "button",
            "aria-label": `${cell.key}: ${count} \u4E2A\u5B8C\u6210\u4EFB\u52A1`
          }
        });
        el.title = `${cell.key}: ${count} \u4E2A\u5B8C\u6210\u4EFB\u52A1`;
        el.addEventListener("click", () => {
          const dayTasks = tasks.filter((task) => task.completedAt?.slice(0, 10) === cell.key || task.date === cell.key);
          new DayTasksModal(this.app, {
            date: cell.key,
            tasks: dayTasks,
            getProject: (projectId) => this.plugin.store.getProject(projectId)
          }).open();
        });
      }
    }
    const legend = heatmap.createDiv({ cls: "pm-contribution-legend" });
    legend.createSpan({ text: "\u5C11" });
    [0, 1, 2, 3, 4].forEach((level) => legend.createSpan({ cls: `pm-contribution-level-swatch level-${level}` }));
    legend.createSpan({ text: "\u591A" });
  }
  renderTodayTimeline(container, items) {
    const today = toDateKey(now());
    const currentMinute = getCurrentTimeMinutes();
    const header = container.createDiv({ cls: "pm-timeline-header" });
    const title = header.createDiv();
    title.createEl("h3", { text: "\u4ECA\u65E5\u65F6\u95F4\u7EBF" });
    const date = header.createDiv({ cls: "pm-timeline-date" });
    const calendarIcon = date.createSpan({ cls: "pm-timeline-date-icon" });
    (0, import_obsidian12.setIcon)(calendarIcon, "calendar-days");
    date.createSpan({ text: `\u4ECA\u5929 ${today}` });
    const actionableItems = items.map((item) => ({
      occurrence: item.occurrence,
      childOccurrences: item.childOccurrences.filter(isActionableOccurrence)
    })).filter((item) => isActionableOccurrence(item.occurrence) || item.childOccurrences.length > 0).sort((left, right) => compareWeekTasks(left.occurrence, right.occurrence));
    if (actionableItems.length === 0) {
      container.createDiv({ cls: "pm-empty pm-timeline-empty", text: "\u4ECA\u5929\u6682\u65E0\u5F85\u5904\u7406\u4EFB\u52A1" });
      return;
    }
    const timeline = container.createDiv({ cls: "pm-today-timeline" });
    let currentTarget = null;
    let overdueTarget = null;
    actionableItems.forEach((item) => {
      const task = item.occurrence;
      const progress = summarizeOccurrenceDisplay(task, item.childOccurrences);
      const totalSteps = Math.max(progress.totalSteps, 1);
      const percent = Math.round(progress.completedSteps / totalSteps * 100);
      const isCurrent = isOccurrenceInCurrentWindow(task, currentMinute);
      const isOverdue = isDisplayOccurrenceOverdue(item, today, currentMinute);
      const project = this.plugin.store.getProject(task.projectId);
      const row = timeline.createDiv({ cls: `pm-timeline-row ${isCurrent ? "is-current" : ""} ${isOverdue ? "is-overdue" : ""}` });
      if (isCurrent && !currentTarget) {
        currentTarget = row;
      } else if (isOverdue && !overdueTarget) {
        overdueTarget = row;
      }
      row.createDiv({ cls: "pm-timeline-time", text: task.startTime ?? "\u672A\u6392\u671F" });
      row.createDiv({ cls: "pm-timeline-marker" });
      const card = row.createDiv({ cls: "pm-timeline-card" });
      const cardTop = card.createDiv({ cls: "pm-timeline-card-top" });
      cardTop.createDiv({ cls: "pm-timeline-project", text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
      cardTop.createSpan({ cls: "pm-timeline-status", text: isCurrent ? "\u8FDB\u884C\u4E2D" : isOverdue ? "\u903E\u671F" : "\u5F85\u529E" });
      card.createDiv({ cls: "pm-timeline-title", text: task.title });
      card.createDiv({
        cls: "pm-timeline-meta",
        text: [
          recurrenceLabel2(task.recurrence, task.recurrenceCount, task.recurrenceUntil),
          formatOccurrenceWindow(task),
          occurrenceExecutionLabel(task)
        ].filter(Boolean).join(" \xB7 ")
      });
      const progressRow = card.createDiv({ cls: "pm-timeline-progress" });
      progressRow.createSpan({ text: `${progress.completedSteps}/${totalSteps} \u6B65 \xB7 ${percent}%` });
      progressRow.createDiv({ cls: "pm-timeline-progress-bar" }).createDiv({
        cls: "pm-timeline-progress-fill",
        attr: { style: `width: ${percent}%` }
      });
    });
    this.bindTimelineAutoFocus(timeline, currentTarget ?? overdueTarget);
  }
  bindTimelineAutoFocus(timeline, target) {
    if (!target) {
      return;
    }
    let suppressScrollHandler = false;
    const focusTarget = (behavior) => {
      if (!timeline.isConnected || !target.isConnected) {
        return;
      }
      suppressScrollHandler = true;
      target.scrollIntoView({ block: "center", behavior });
      window.setTimeout(() => {
        suppressScrollHandler = false;
      }, 650);
    };
    window.setTimeout(() => focusTarget("auto"), 0);
    timeline.addEventListener(
      "scroll",
      () => {
        if (suppressScrollHandler) {
          return;
        }
        this.clearTimelineAutoScrollTimer();
        this.timelineAutoScrollTimer = window.setTimeout(() => focusTarget("smooth"), 5e3);
      },
      { passive: true }
    );
  }
  clearTimelineAutoScrollTimer() {
    if (this.timelineAutoScrollTimer === null) {
      return;
    }
    window.clearTimeout(this.timelineAutoScrollTimer);
    this.timelineAutoScrollTimer = null;
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
  renderWeekCompactBoard(container, tasks, projects, seriesTasks) {
    const weekDates = getWeekDates(this.weekAnchor);
    const board = container.createDiv({ cls: "pm-week-board pm-week-compact-board" });
    weekDates.forEach((date) => {
      const { key, column } = this.createWeekDayColumn(board, date, projects);
      const dayTasks = buildCompositeDisplayOccurrences(tasks.filter((task) => task.date === key), seriesTasks);
      if (dayTasks.length === 0) {
        column.createDiv({ cls: "pm-empty pm-week-day-empty", text: "\u6682\u65E0\u4EFB\u52A1" });
        return;
      }
      const list = column.createDiv({ cls: "pm-week-compact-list" });
      dayTasks.forEach((item) => this.renderWeekTaskCard(list, item.occurrence, item.childOccurrences));
    });
  }
  createWeekDayColumn(container, date, projects) {
    const key = toDateKey(date);
    const column = container.createDiv({
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
        recurrence: "daily",
        recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
        completed: false,
        ...this.plugin.store.getSuggestedTaskWindow(key)
      });
    });
    return { key, column };
  }
  renderWeekTaskCard(container, task, childOccurrences = []) {
    const project = this.plugin.store.getProject(task.projectId);
    const displayProgress = summarizeOccurrenceDisplay(task, childOccurrences);
    const card = container.createDiv({ cls: `pm-week-task ${displayProgress.completed ? "is-complete" : ""} ${task.kind === "composite" ? "is-composite" : ""}` });
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
          new import_obsidian12.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      });
    }
    const titleLine = top.createDiv({ cls: "pm-week-task-title-line" });
    titleLine.createSpan({ text: task.title, cls: "pm-task-title" });
    titleLine.createSpan({ text: recurrenceLabel2(task.recurrence, task.recurrenceCount, task.recurrenceUntil), cls: "pm-tag pm-week-recurrence-tag" });
    const editButton = top.createEl("button", { text: "\u270E", cls: "pm-week-task-edit" });
    editButton.setAttribute("aria-label", "\u7F16\u8F91\u4EFB\u52A1");
    editButton.title = "\u7F16\u8F91\u4EFB\u52A1";
    editButton.addEventListener("click", () => {
      if (isSyntheticCompositeOccurrence(task)) {
        const seriesTask = this.plugin.store.getTask(task.taskId);
        if (seriesTask) {
          this.openEditTaskModal(seriesTask);
        }
        return;
      }
      this.openEditOccurrenceModal(task);
    });
    const meta = card.createDiv({ cls: "pm-task-meta" });
    meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F" });
    meta.createSpan({ text: project?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE" });
    if ((task.recurrenceCount ?? 1) > 1 || task.recurrenceUntil) {
      meta.createSpan({ text: `\u7B2C ${task.occurrenceNumber} \u6B21` });
    }
    const executionLabel = occurrenceExecutionLabel(task);
    if (executionLabel) {
      meta.createSpan({ text: executionLabel });
    }
    if (task.kind === "composite") {
      meta.createSpan({ text: `${displayProgress.completedSteps}/${displayProgress.totalSteps} \u5B50\u4EFB\u52A1` });
      this.renderCompositeSubtasks(card, task, childOccurrences);
    }
    return card;
  }
  renderCompositeSubtasks(container, task, childOccurrences = []) {
    renderCompositeOccurrenceCards(container, {
      parentOccurrence: task,
      childOccurrences,
      compact: true,
      onToggleChildOccurrence: async (child) => {
        try {
          await this.plugin.store.updateTaskOccurrenceCompletion(child.taskId, child.date, !child.completed);
        } catch (error) {
          new import_obsidian12.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      },
      onEditChildOccurrence: (child) => {
        this.openEditOccurrenceModal(child);
      },
      onDeleteChildTask: async (child) => {
        await this.plugin.store.deleteTask(child.taskId, "series");
      }
    });
  }
  renderChildTaskSummary(container, childTasks, variant) {
    if (childTasks.length === 0) {
      return;
    }
    const summary = container.createDiv({ cls: `pm-child-task-summary is-${variant}` });
    summary.createDiv({ cls: "pm-muted pm-child-task-summary-title", text: `\u7EC4\u5408\u5B50\u4EFB\u52A1 ${childTasks.length} \u9879` });
    const list = summary.createDiv({ cls: "pm-child-task-list" });
    childTasks.slice(0, 6).forEach((child) => {
      const item = list.createEl("button", { cls: `pm-child-task-pill is-${child.status}` });
      item.title = child.title;
      item.createSpan({ cls: "pm-child-task-name", text: child.title });
      item.createSpan({ cls: "pm-child-task-meta", text: [statusLabel2(child.status), formatOptionalTimeRange(child)].filter(Boolean).join(" \xB7 ") });
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        this.openEditTaskModal(child);
      });
    });
    if (childTasks.length > 6) {
      summary.createDiv({ cls: "pm-muted", text: `\u53E6\u6709 ${childTasks.length - 6} \u9879\u672A\u5C55\u5F00` });
    }
  }
  renderProjectsTab(container, pages, projects, allTasks) {
    const header = container.createDiv({ cls: "pm-page-header" });
    const headerCopy = header.createDiv();
    headerCopy.createEl("h3", { text: "\u9879\u76EE\u8FDB\u5EA6" });
    headerCopy.createDiv({ cls: "pm-muted", text: "\u56F4\u7ED5\u5355\u4E2A\u9879\u76EE\u7EDF\u4E00\u67E5\u770B\u8868\u683C\u3001\u770B\u677F\u3001\u7518\u7279\u56FE\u4E0E\u601D\u7EF4\u5BFC\u56FE\u3002" });
    const headerActions = header.createDiv({ cls: "pm-inline-actions" });
    headerActions.createEl("button", { text: "\u5BFC\u51FA\u5168\u90E8\u8BB0\u5F55", cls: "pm-button pm-button-secondary" }).addEventListener("click", async () => {
      await copyTextToClipboard(this.plugin.store.exportAllRecordsAsDataMigrationJson());
      new import_obsidian12.Notice("\u5DF2\u590D\u5236\u6570\u636E\u8FC1\u79FB JSON");
    });
    headerActions.createEl("button", { text: "\u65B0\u589E\u9879\u76EE", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
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
    const projectTasks = allTasks.filter((task) => task.projectId === project.id).sort(compareSeriesTasks2);
    const hierarchy = buildProjectTaskHierarchy(projectTasks);
    const tasks = hierarchy.topLevelTasks;
    const executableTasks = projectTasks.filter((task) => task.kind === "simple");
    const containerTasks = projectTasks.filter((task) => task.kind === "composite");
    const occurrences = this.plugin.store.getOccurrencesForProject(project.id);
    const progress = this.plugin.store.getProjectProgress(project.id);
    const completedCount = occurrences.filter((task) => task.kind === "simple" && task.completed).length;
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
      { label: "\u603B\u4EFB\u52A1", value: String(executableTasks.length) },
      { label: "\u5BB9\u5668", value: String(containerTasks.length) },
      { label: "\u603B\u6B21\u6570", value: String(occurrences.filter((task) => task.kind === "simple").length) },
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
        defaultDate: toDateKey(now()),
        allowedFormats: ["markdown-planned"]
      }).open();
    });
    projectActions.createEl("button", { text: "\u5BFC\u51FA Markdown", cls: "pm-button pm-button-secondary" }).addEventListener("click", async () => {
      try {
        const text = this.plugin.store.exportProjectAsFormattedText(project.id);
        if (!text.trim()) {
          new import_obsidian12.Notice("\u5F53\u524D\u9879\u76EE\u6682\u65E0\u4EFB\u52A1\u53EF\u5BFC\u51FA");
          return;
        }
        await copyTextToClipboard(text);
        new import_obsidian12.Notice(`\u5DF2\u590D\u5236\u300C${project.name}\u300D\u9879\u76EE Markdown`);
      } catch (error) {
        new import_obsidian12.Notice(error instanceof Error ? error.message : "\u5BFC\u51FA\u5931\u8D25");
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
        recurrence: "daily",
        recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
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
    if (projectTasks.length === 0) {
      body.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u4EFB\u52A1" });
      return;
    }
    if (tasks.length === 0 && this.activeProjectView !== "mindmap") {
      body.createDiv({ cls: "pm-empty", text: "\u6682\u65E0\u9876\u5C42\u4EFB\u52A1\uFF0C\u5DF2\u6302\u5165\u7EC4\u5408\u4EFB\u52A1\u7684\u5B50\u4EFB\u52A1\u4F1A\u6536\u7EB3\u5728\u7236\u4EFB\u52A1\u4E0B\u3002" });
      return;
    }
    if (this.activeProjectView === "table") {
      this.renderProjectTable(body, tasks, hierarchy.childrenByParent);
    } else if (this.activeProjectView === "board") {
      this.renderProjectBoard(body, project, executableTasks, /* @__PURE__ */ new Map());
    } else if (this.activeProjectView === "gantt") {
      this.renderProjectGantt(body, project, containerTasks, hierarchy.childrenByParent);
    } else {
      this.renderProjectMindmap(body, project, projectTasks);
    }
  }
  renderProjectTable(container, tasks, childrenByParent) {
    const totalPages = Math.max(1, Math.ceil(tasks.length / this.projectTablePageSize));
    this.projectTablePage = Math.min(this.projectTablePage, totalPages);
    const pageTasks = tasks.slice((this.projectTablePage - 1) * this.projectTablePageSize, this.projectTablePage * this.projectTablePageSize);
    const card = container.createDiv({ cls: "pm-table-card" });
    const table = card.createEl("table", { cls: "pm-table" });
    const head = table.createEl("thead");
    const headRow = head.createEl("tr");
    ["\u4EFB\u52A1\u540D\u79F0", "\u72B6\u6001", "\u4F18\u5148\u7EA7", "\u91CD\u590D", "\u8BA1\u5212", "\u5B8C\u6210", "\u63CF\u8FF0", "\u64CD\u4F5C"].forEach((label) => headRow.createEl("th", { text: label }));
    const bodyEl = table.createEl("tbody");
    pageTasks.forEach((task) => {
      const childTasks = childrenByParent.get(task.id) ?? [];
      const row = bodyEl.createEl("tr");
      const titleCell = row.createEl("td");
      titleCell.createEl("strong", { text: task.title });
      titleCell.createDiv({ cls: "pm-muted", text: `${task.date} \xB7 ${task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "\u672A\u6392\u671F"}` });
      this.renderChildTaskSummary(titleCell, childTasks, "table");
      const statusCell = row.createEl("td");
      if (task.kind === "composite") {
        appendBadge(statusCell, "\u5BB9\u5668", "tag");
      } else {
        appendBadge(statusCell, statusLabel2(task.status), `status-${task.status}`);
      }
      const priorityCell = row.createEl("td");
      appendBadge(priorityCell, priorityLabel(task.priority), priorityTone(task.priority));
      const recurrenceCell = row.createEl("td");
      appendBadge(recurrenceCell, task.kind === "composite" ? "\u5BB9\u5668" : recurrenceLabel2(task.recurrence, task.recurrenceCount, task.recurrenceUntil), "repeat");
      const scheduleCell = row.createEl("td");
      scheduleCell.createDiv({ text: task.occurrenceDates.length > 1 ? `${task.occurrenceDates[0]} -> ${task.occurrenceDates[task.occurrenceDates.length - 1]}` : task.date });
      scheduleCell.createDiv({ cls: "pm-muted", text: task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "\u672A\u6392\u671F" });
      const completionCell = row.createEl("td");
      const progress = Math.round(seriesProgressWithChildren(task, childTasks) * 100);
      completionCell.createDiv({ text: completionSummaryWithChildren(task, childTasks) });
      completionCell.createDiv({ cls: "pm-progress-bar pm-progress-bar-compact" }).createDiv({
        cls: "pm-progress-bar-fill",
        attr: { style: `width: ${progress}%` }
      });
      const descriptionCell = row.createEl("td");
      descriptionCell.createDiv({ cls: "pm-table-desc", text: task.description || "-" });
      const actionCell = row.createEl("td");
      const menuButton = actionCell.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "\u66F4\u591A\u64CD\u4F5C" } });
      (0, import_obsidian12.setIcon)(menuButton, "ellipsis");
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
  renderProjectBoard(container, project, tasks, childrenByParent) {
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
      (0, import_obsidian12.setIcon)(addButton, "plus");
      addButton.addEventListener("click", () => {
        this.openCreateTaskModal("\u65B0\u589E\u9879\u76EE\u4EFB\u52A1", this.plugin.store.getProjects(), {
          title: "",
          description: "",
          projectId: project.id,
          status,
          tags: [],
          date: toDateKey(now()),
          recurrence: "daily",
          recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
          completed: false,
          viewState: { board: { columnId: status, order: Date.now() } },
          ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
        });
      });
      const list = column.createDiv({ cls: "pm-board-list" });
      items.forEach((task) => {
        const childTasks = childrenByParent.get(task.id) ?? [];
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
        (0, import_obsidian12.setIcon)(menuButton, "ellipsis");
        menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, task));
        const badges = card.createDiv({ cls: "pm-board-badges" });
        appendBadge(badges, priorityLabel(task.priority), priorityTone(task.priority));
        if (status === "blocked") {
          appendBadge(badges, task.viewState.gantt.dependencyIds.length > 0 ? "\u4F9D\u8D56\u672A\u5B8C\u6210" : "\u7B49\u5F85\u5904\u7406", "status-blocked");
        }
        card.createDiv({ cls: "pm-board-schedule", text: task.occurrenceDates.length > 1 ? `${task.occurrenceDates[0].slice(5)} -> ${task.occurrenceDates[task.occurrenceDates.length - 1].slice(5)}` : task.date.slice(5) });
        card.createDiv({ cls: "pm-board-completion", text: completionSummaryWithChildren(task, childTasks).replace(" \xB7 ", " | ") });
        this.renderChildTaskSummary(card, childTasks, "board");
        const progress = Math.round(seriesProgressWithChildren(task, childTasks) * 100);
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
          recurrence: "daily",
          recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
          completed: false,
          viewState: { board: { columnId: status, order: Date.now() } },
          ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
        });
      });
    });
    const overdueCount = tasks.filter((task) => !isTaskSeriesCompletedWithChildren(task, childrenByParent.get(task.id) ?? []) && compareDateKeys(defaultCompletionDateWithChildren(task, childrenByParent.get(task.id) ?? []), toDateKey(now())) < 0).length;
    const stats = container.createDiv({ cls: "pm-board-stats" });
    const completedTopLevelCount = tasks.filter((task) => isTaskSeriesCompletedWithChildren(task, childrenByParent.get(task.id) ?? [])).length;
    [
      { label: "\u603B\u4EFB\u52A1", value: String(tasks.length) },
      { label: "\u8FDB\u884C\u4E2D", value: String(tasks.filter((task) => task.status === "doing").length) },
      { label: "\u5DF2\u5B8C\u6210", value: String(completedTopLevelCount) },
      { label: "\u5B8C\u6210\u7387", value: `${Math.round(completedTopLevelCount / Math.max(1, tasks.length) * 100)}%` },
      { label: "\u903E\u671F", value: String(overdueCount) }
    ].forEach((item) => {
      const stat = stats.createDiv({ cls: "pm-board-stat" });
      stat.createDiv({ cls: "pm-muted", text: item.label });
      stat.createEl("strong", { text: item.value });
    });
  }
  renderProjectGantt(container, project, tasks, childrenByParent) {
    const items = tasks.map((task) => {
      const childTasks = childrenByParent.get(task.id) ?? [];
      const range = containerDateRange(task, childTasks);
      const childProgress = aggregateTasksProgress(childTasks);
      return {
        task,
        childTasks,
        startDate: range.startDate,
        endDate: range.endDate,
        progress: childProgress.total === 0 ? 0 : Math.round(childProgress.completed / childProgress.total * 100)
      };
    }).sort(
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
    const leftHeaderMain = leftHeader.createDiv({ cls: "pm-gantt-left-heading" });
    leftHeaderMain.createDiv({ text: "\u4EFB\u52A1 / \u72B6\u6001 / \u8BA1\u5212" });
    leftHeaderMain.createDiv({ cls: "pm-muted", text: `\u5171 ${items.length} \u9879` });
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
      const titleLine = taskTop.createDiv({ cls: "pm-gantt-task-title-line" });
      const titleText = titleLine.createEl("strong", { text: item.task.title, cls: "pm-gantt-task-title" });
      titleText.title = item.task.title;
      if (item.task.viewState.gantt.locked) {
        const lockFlag = titleLine.createSpan({ cls: "pm-gantt-task-flag is-locked" });
        lockFlag.setText("\u9501\u5B9A");
        lockFlag.title = "\u5F53\u524D\u4EFB\u52A1\u5DF2\u9501\u5B9A";
      }
      if (item.task.viewState.gantt.milestone) {
        const milestoneFlag = titleLine.createSpan({ cls: "pm-gantt-task-flag is-milestone" });
        milestoneFlag.setText("\u91CC\u7A0B\u7891");
        milestoneFlag.title = "\u5F53\u524D\u4EFB\u52A1\u5DF2\u8BBE\u7F6E\u4E3A\u91CC\u7A0B\u7891";
      }
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
      (0, import_obsidian12.setIcon)(menuButton, "ellipsis");
      menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, item.task));
      const meta = taskCell.createDiv({ cls: "pm-gantt-task-meta" });
      meta.createSpan({ cls: `pm-gantt-meta-item is-status is-${item.task.status}`, text: statusLabel2(item.task.status) });
      meta.createSpan({ cls: "pm-gantt-meta-separator", text: "\xB7" });
      meta.createSpan({ cls: `pm-gantt-meta-item is-priority ${priorityTone(item.task.priority)}`, text: priorityLabel(item.task.priority) });
      meta.createSpan({ cls: "pm-gantt-meta-separator", text: "\xB7" });
      meta.createSpan({ cls: "pm-gantt-meta-item", text: formatGanttPlan(item.startDate, item.endDate, item.task.startTime, item.task.endTime) });
      if (item.childTasks.length > 0) {
        meta.createSpan({ cls: "pm-gantt-meta-separator", text: "\xB7" });
        meta.createSpan({ cls: "pm-gantt-meta-item", text: `\u5B50\u4EFB\u52A1 ${item.childTasks.length} \u9879` });
      }
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
      bar.title = [item.task.title, `${item.startDate} -> ${item.endDate}`, `\u8FDB\u5EA6 ${item.progress}%`, `\u72B6\u6001 ${statusLabel2(item.task.status)}`].join("\n");
      bar.addEventListener("click", () => this.openEditTaskModal(item.task));
      bar.createSpan({
        text: item.task.viewState.gantt.milestone ? `\u25C6 ${statusLabel2(item.task.status)} ${item.progress}%` : `${statusLabel2(item.task.status)} ${item.progress}%`
      });
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
        recurrence: "daily",
        recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
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
        appendBadge(meta, recurrenceLabel2(node.task.recurrence, node.task.recurrenceCount, node.task.recurrenceUntil), "repeat");
        if (node.task.kind === "composite") {
          appendBadge(meta, `${countDirectChildTasks(tasks, node.task.id)} \u4E2A\u5B50\u4EFB\u52A1`, "tag");
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
          recurrence: "daily",
          recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
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
      appendBadge(badges, statusLabel2(node.task.status), `status-${node.task.status}`);
      appendBadge(badges, priorityLabel(node.task.priority), priorityTone(node.task.priority));
      appendBadge(badges, recurrenceLabel2(node.task.recurrence, node.task.recurrenceCount, node.task.recurrenceUntil), "repeat");
      if (node.task.description) {
        container.createDiv({ cls: "pm-muted", text: node.task.description });
      }
      const actions = container.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "\u7F16\u8F91\u4EFB\u52A1", cls: "pm-button pm-button-primary" }).addEventListener("click", () => this.openEditTaskModal(node.task));
      if (node.task.kind === "composite") {
        actions.createEl("button", { text: "\u65B0\u589E\u5B50\u4EFB\u52A1", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
          this.openCreateChildTaskModal(node.task);
        });
      }
      actions.createEl("button", { text: "\u65B0\u589E\u8BC4\u8BED", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
        void this.addMindmapComment(node.task.id);
      });
      if (node.task.kind === "simple" && !(node.task.viewState.mindmap.parentTaskId ?? null)) {
        container.createEl("button", { text: "\u8F6C\u4E3A\u7EC4\u5408\u4EFB\u52A1", cls: "pm-button pm-button-ghost" }).addEventListener("click", async () => {
          await this.plugin.store.updateTask(node.task.id, {
            kind: "composite"
          });
          this.openEditTaskModal(this.plugin.store.getTask(node.task.id) ?? node.task);
        });
      } else {
        container.createDiv({ cls: "pm-muted", text: `\u5F53\u524D\u4E3A\u7EC4\u5408\u4EFB\u52A1\uFF0C\u5171 ${countDirectChildTasks(tasks, node.task.id)} \u4E2A\u5B50\u4EFB\u52A1\u3002` });
      }
      const relationCard = container.createDiv({ cls: "pm-input-card" });
      relationCard.createEl("strong", { text: "\u4E0A\u7EA7\u4EFB\u52A1" });
      const parentSelect = relationCard.createEl("select");
      parentSelect.createEl("option", { value: "", text: "\u6302\u5230\u9879\u76EE\u6839\u8282\u70B9" });
      parentSelect.disabled = node.task.kind === "composite";
      const descendants = collectTaskDescendantIds(tasks, node.task.id);
      tasks.filter((task) => task.kind === "composite" && task.id !== node.task.id && !descendants.has(task.id)).forEach((task) => parentSelect.createEl("option", { value: task.id, text: task.title }));
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
    const menu = new import_obsidian12.Menu();
    menu.addItem(
      (item) => item.setTitle("\u8BE6\u7EC6\u7F16\u8F91").setIcon("square-pen").onClick(() => {
        this.openEditTaskModal(task);
      })
    );
    if (task.kind === "composite") {
      menu.addItem(
        (item) => item.setTitle("\u65B0\u589E\u5B50\u4EFB\u52A1").setIcon("list-plus").onClick(() => {
          this.openCreateTaskModal("\u65B0\u589E\u7EC4\u5408\u5B50\u4EFB\u52A1", this.plugin.store.getProjects(), {
            title: "",
            description: "",
            projectId: task.projectId,
            status: "todo",
            tags: [],
            date: task.date,
            recurrence: "daily",
            recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
            completed: false,
            viewState: {
              mindmap: {
                parentTaskId: task.id,
                childOrder: Date.now(),
                expanded: true
              }
            },
            ...this.plugin.store.getSuggestedTaskWindow(task.date)
          });
        })
      );
    }
    if (task.kind !== "composite") {
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
    }
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
      compositeParents: this.plugin.store.getCompositeTasks(),
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
      compositeParents: this.plugin.store.getCompositeTasks(),
      childTasks: this.plugin.store.getChildTasks(task.id),
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
        consumeRequiresCompletion: task.consumeRequiresCompletion,
        kind: task.kind,
        subtasks: [],
        viewState: task.viewState,
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
      onOpenChildTask: (childTask) => {
        this.openEditTaskModal(childTask);
      },
      onCreateChildTask: (parent) => {
        this.openCreateChildTaskModal(parent);
      },
      allowSingleDelete: false
    }).open();
  }
  openCreateChildTaskModal(parent) {
    this.openCreateTaskModal("\u65B0\u589E\u5B50\u4EFB\u52A1", this.plugin.store.getProjects(), {
      title: "",
      description: "",
      projectId: parent.projectId,
      status: "todo",
      tags: [],
      date: parent.date,
      startTime: parent.startTime,
      endTime: parent.endTime,
      recurrence: "daily",
      recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
      kind: "simple",
      completed: false,
      viewState: {
        mindmap: {
          parentTaskId: parent.id,
          childOrder: Date.now(),
          expanded: true
        }
      }
    });
  }
  openEditOccurrenceModal(task) {
    const seriesTask = this.plugin.store.getTask(task.taskId);
    if (!seriesTask) {
      return;
    }
    new TaskModal(this.app, {
      title: "\u7F16\u8F91\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      compositeParents: this.plugin.store.getCompositeTasks(),
      existingTask: seriesTask,
      occurrenceContext: task,
      initial: {
        title: task.title,
        description: task.description,
        projectId: seriesTask.projectId,
        status: seriesTask.status,
        priority: seriesTask.priority,
        tags: seriesTask.tags,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        recurrence: seriesTask.recurrence,
        recurrenceCount: seriesTask.recurrenceCount ?? null,
        recurrenceUntil: seriesTask.recurrenceUntil ?? null,
        consumeRequiresCompletion: seriesTask.consumeRequiresCompletion,
        kind: seriesTask.kind,
        subtasks: [],
        viewState: seriesTask.viewState,
        completed: isTaskSeriesCompleted(seriesTask)
      },
      onSubmit: async (input, scope) => {
        if (scope === "occurrence") {
          await this.plugin.store.updateTaskOccurrenceDetails(seriesTask.id, task.date, {
            title: input.title,
            description: input.description,
            startTime: input.startTime,
            endTime: input.endTime
          });
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
      onOpenSeriesEditor: () => {
        this.openEditTaskModal(seriesTask);
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
var GANTT_ROW_HEIGHT = 76;
var GANTT_HEADER_HEIGHT = 64;
var GANTT_LEFT_WIDTH = 360;
var GANTT_MIN_ZOOM = 0.4;
var GANTT_MAX_ZOOM = 2;
var GANTT_ZOOM_STEP = 0.1;
var HEATMAP_ROW_LABELS = ["\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D", "\u5468\u65E5"];
var HEATMAP_MONTH_LABELS = ["1\u6708", "2\u6708", "3\u6708", "4\u6708", "5\u6708", "6\u6708", "7\u6708", "8\u6708", "9\u6708", "10\u6708", "11\u6708", "12\u6708"];
function buildProjectTaskHierarchy(tasks) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const hiddenTaskIds = /* @__PURE__ */ new Set();
  const childrenByParent = /* @__PURE__ */ new Map();
  tasks.forEach((task) => {
    const parentId = getCompositeParentTaskId(task, taskById);
    if (!parentId) {
      return;
    }
    hiddenTaskIds.add(task.id);
    childrenByParent.set(parentId, [...childrenByParent.get(parentId) ?? [], task]);
  });
  childrenByParent.forEach((children, parentId) => childrenByParent.set(parentId, children.slice().sort(compareSeriesTasks2)));
  return {
    topLevelTasks: tasks.filter((task) => !hiddenTaskIds.has(task.id)).sort(compareSeriesTasks2),
    childrenByParent
  };
}
function getCompositeParentTaskId(task, taskById) {
  const parentId = task.viewState.mindmap.parentTaskId ?? null;
  if (!parentId) {
    return null;
  }
  const parent = taskById.get(parentId);
  return parent?.kind === "composite" ? parent.id : null;
}
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
    (item) => `${item.task.id}:${item.task.revision}:${item.childTasks.map((child) => `${child.id}.${child.revision}`).join(",")}:${item.startDate}:${item.endDate}:${item.task.status}:${item.task.priority ?? ""}:${item.task.viewState.gantt.locked ? 1 : 0}:${item.task.viewState.gantt.milestone ? 1 : 0}`
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
function countDirectChildTasks(tasks, taskId) {
  return tasks.filter((task) => (task.viewState.mindmap.parentTaskId ?? null) === taskId).length;
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
function buildYAxisValues(max) {
  const steps = 4;
  const interval = Math.max(1, Math.ceil(max / steps));
  return Array.from({ length: steps + 1 }, (_, index) => interval * (steps - index));
}
function getCurrentTimeMinutes() {
  const stamp = now();
  return stamp.getHours() * 60 + stamp.getMinutes();
}
function isOccurrenceInCurrentWindow(task, currentMinute) {
  const start = parseTimeToMinutes(task.startTime);
  const end = parseTimeToMinutes(task.endTime);
  return start !== null && end !== null && start <= currentMinute && currentMinute < end;
}
function isDisplayOccurrenceOverdue(item, today, currentMinute) {
  return isOccurrenceOverdue(item.occurrence, today, currentMinute) || item.childOccurrences.some((child) => isOccurrenceOverdue(child, today, currentMinute));
}
function isOccurrenceOverdue(task, today, currentMinute) {
  if (!isExecutableTask(task) || !isActionableStatus(task.status) || task.completed) {
    return false;
  }
  if (task.date !== today) {
    return false;
  }
  const start = parseTimeToMinutes(task.startTime);
  const end = parseTimeToMinutes(task.endTime);
  return start !== null && end !== null && start <= currentMinute && end <= currentMinute;
}
function formatOccurrenceWindow(task) {
  return task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "\u672A\u6392\u671F";
}
function heatLevel(count, maxCount) {
  if (count <= 0) {
    return 0;
  }
  if (maxCount <= 1) {
    return 2;
  }
  const ratio = count / maxCount;
  if (ratio <= 0.25) {
    return 1;
  }
  if (ratio <= 0.5) {
    return 2;
  }
  if (ratio <= 0.75) {
    return 3;
  }
  return 4;
}
function recurrenceLabel2(recurrence, count, until) {
  if (recurrence === "daily" && count === SINGLE_TASK_RECURRENCE_COUNT && !until) {
    return "\u5355\u6B21\u4EFB\u52A1";
  }
  return recurrenceLabel(recurrence);
}
function statusLabel2(status) {
  return statusLabel(status);
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
function formatGanttPlan(startDate, endDate, startTime, endTime) {
  const dateLabel = startDate === endDate ? startDate.slice(5) : `${startDate.slice(5)}~${endDate.slice(5)}`;
  if (startTime && endTime) {
    return `${dateLabel} ${startTime}-${endTime}`;
  }
  return dateLabel;
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
function defaultCompletionDateWithChildren(task, childTasks) {
  return [task, ...childTasks].map(defaultCompletionDate).reduce((latest, date) => compareDateKeys(date, latest) > 0 ? date : latest, defaultCompletionDate(task));
}
function containerDateRange(task, childTasks) {
  if (childTasks.length === 0) {
    return { startDate: task.date, endDate: task.date };
  }
  const dates = childTasks.flatMap((child) => child.occurrenceDates.length > 0 ? child.occurrenceDates : [child.date]);
  return {
    startDate: dates.reduce((earliest, date) => compareDateKeys(date, earliest) < 0 ? date : earliest, dates[0]),
    endDate: childTasks.map(defaultCompletionDate).reduce((latest, date) => compareDateKeys(date, latest) > 0 ? date : latest, dates[0])
  };
}
function completionSummaryWithChildren(task, childTasks) {
  const progress = aggregateTaskProgress(task, childTasks);
  const ratio = progress.total === 0 ? 0 : Math.round(progress.completed / progress.total * 100);
  return `${progress.completed}/${progress.total} \u6B65 \xB7 ${ratio}%`;
}
function seriesProgressWithChildren(task, childTasks) {
  const progress = aggregateTaskProgress(task, childTasks);
  return progress.total === 0 ? 0 : progress.completed / progress.total;
}
function isTaskSeriesCompletedWithChildren(task, childTasks) {
  const progress = aggregateTaskProgress(task, childTasks);
  return progress.total > 0 && progress.completed === progress.total;
}
function aggregateTaskProgress(task, childTasks) {
  return [task, ...childTasks].reduce(
    (summary, item) => {
      const progress = taskProgressSteps(item);
      summary.total += progress.total;
      summary.completed += progress.completed;
      return summary;
    },
    { total: 0, completed: 0 }
  );
}
function aggregateTasksProgress(tasks) {
  return tasks.reduce(
    (summary, task) => {
      const progress = taskProgressSteps(task);
      summary.total += progress.total;
      summary.completed += progress.completed;
      return summary;
    },
    { total: 0, completed: 0 }
  );
}
function taskProgressSteps(task) {
  if (task.kind === "composite") {
    return { total: 0, completed: 0 };
  }
  const progress = getTaskExecutionProgress(task);
  return { total: progress.total, completed: progress.completed };
}
function isTaskSeriesCompleted(task) {
  if (task.kind === "simple" && task.consumeRequiresCompletion) {
    return getTaskExecutionProgress(task).completedSeries;
  }
  if (task.occurrenceDates.length === 0) {
    return false;
  }
  return task.occurrenceDates.every((date) => {
    const state = task.occurrenceStates.find((item) => item.date === date);
    if (task.kind === "simple") {
      return Boolean(state);
    }
    if (task.subtasks.length === 0) {
      return Boolean(state?.completedAt);
    }
    const completedIds = new Set(state?.completedSubtaskIds ?? []);
    return task.subtasks.every((subtask) => completedIds.has(subtask.id));
  });
}

// src/views/todayView.ts
var import_obsidian13 = require("obsidian");
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
    const displayTasks = buildCompositeDisplayOccurrences(tasks, this.plugin.store.getAllTasks());
    const projects = this.plugin.store.getProjects();
    const todayDoingTasks = tasks.filter((task) => task.kind === "simple" && task.status === "doing");
    const totalSteps = todayDoingTasks.reduce((sum, task) => sum + task.totalSteps, 0);
    const completedSteps = todayDoingTasks.reduce((sum, task) => sum + task.completedSteps, 0);
    const progress = totalSteps === 0 ? 0 : Math.round(completedSteps / totalSteps * 100);
    const rawIncomplete = tasks.filter(isActionableOccurrence);
    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "\u4ECA\u65E5\u4EFB\u52A1" });
    title.createDiv({ text: today, cls: "pm-muted" });
    const actions = header.createDiv({ cls: "pm-inline-actions" });
    const exportButton = actions.createEl("button", { text: "\u5BFC\u51FA\u4ECA\u65E5\u4EFB\u52A1", cls: "pm-button pm-button-secondary" });
    exportButton.addEventListener("click", async () => this.copyIncompleteTasks(rawIncomplete));
    const addButton = actions.createEl("button", { text: "+ \u65B0\u589E\u4EFB\u52A1", cls: "pm-button pm-button-primary" });
    addButton.addEventListener("click", () => {
      const suggested = this.plugin.store.getSuggestedTaskWindow(today);
      new TaskModal(this.app, {
        title: "\u65B0\u589E\u4ECA\u65E5\u4EFB\u52A1",
        projects,
        compositeParents: this.plugin.store.getCompositeTasks(),
        initial: {
          title: "",
          description: "",
          date: today,
          status: "todo",
          tags: [],
          recurrence: "daily",
          recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
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
    progressBody.createDiv({ cls: "pm-muted", text: todayDoingTasks.length === 0 ? "\u4ECA\u5929\u6CA1\u6709\u8FDB\u884C\u4E2D\u7684\u4EFB\u52A1\u3002" : `${todayDoingTasks.length} \u4E2A\u8FDB\u884C\u4E2D\u4EFB\u52A1\uFF0C\u5B8C\u6210\u7387 ${progress}%` });
    const progressBar = progressBody.createDiv({ cls: "pm-progress-bar" });
    progressBar.createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${progress}%` }
    });
    const incomplete = displayTasks.map((item) => ({
      occurrence: item.occurrence,
      childOccurrences: item.childOccurrences.filter(isActionableOccurrence)
    })).filter((item) => isActionableOccurrence(item.occurrence) || item.childOccurrences.length > 0);
    const attention = displayTasks.map((item) => ({
      occurrence: item.occurrence,
      childOccurrences: item.childOccurrences.filter(isAttentionOccurrence)
    })).filter((item) => isAttentionOccurrence(item.occurrence) || item.occurrence.kind === "composite" && item.childOccurrences.length === 0 || item.childOccurrences.length > 0);
    const complete = displayTasks.filter((item) => summarizeOccurrenceDisplay(item.occurrence, item.childOccurrences).completed);
    this.renderTaskSection(container, "\u672A\u5B8C\u6210", incomplete, {
      emptyTitle: "\u4ECA\u5929\u6682\u65F6\u6CA1\u6709\u672A\u5B8C\u6210\u4EFB\u52A1",
      emptyBody: "\u5DF2\u7ECF\u6E05\u7A7A\u5F85\u529E\u65F6\uFF0C\u8FD9\u91CC\u4F1A\u4FDD\u6301\u4E13\u6CE8\u800C\u5B89\u9759\u3002"
    });
    this.renderTaskSection(container, "\u7559\u610F", attention, {
      emptyTitle: "\u6CA1\u6709\u9700\u8981\u7559\u610F\u7684\u4EFB\u52A1",
      emptyBody: "\u5F85\u529E\u3001\u963B\u585E\u548C\u7A7A\u5BB9\u5668\u4F1A\u96C6\u4E2D\u5230\u8FD9\u4E00\u680F\u3002"
    });
    this.renderTaskSection(container, "\u5DF2\u5B8C\u6210", complete, {
      emptyTitle: "\u5B8C\u6210\u4EFB\u52A1\u540E\u4F1A\u663E\u793A\u5728\u8FD9\u91CC",
      emptyBody: "\u5B8C\u6210\u7684\u4EFB\u52A1\u4F1A\u81EA\u52A8\u6C47\u603B\u5230\u8FD9\u4E00\u680F\uFF0C\u65B9\u4FBF\u4F60\u5FEB\u901F\u56DE\u987E\u3002"
    });
    const tipCard = container.createDiv({ cls: "pm-tip-card" });
    const icon = tipCard.createDiv({ cls: "pm-tip-icon" });
    (0, import_obsidian13.setIcon)(icon, "sparkles");
    const copy = tipCard.createDiv();
    copy.createEl("strong", { text: "\u5C0F\u8D34\u58EB" });
    copy.createDiv({ cls: "pm-muted", text: "\u5BFC\u51FA\u6309\u94AE\u4F1A\u590D\u5236\u6781\u7B80\u4ECA\u65E5\u6E05\u5355\uFF1B\u628A\u67D0\u4E00\u884C\u6539\u6210\u5DF2\u5B8C\u6210\u540E\u7C98\u56DE\u5FEB\u901F\u8BB0\u5F55\uFF0C\u4F1A\u53EA\u5B8C\u6210\u4ECA\u5929\u5DF2\u6709\u4EFB\u52A1\u3002" });
  }
  async copyIncompleteTasks(tasks) {
    if (tasks.length === 0) {
      new import_obsidian13.Notice("\u4ECA\u5929\u6CA1\u6709\u672A\u5B8C\u6210\u4EFB\u52A1\u53EF\u5BFC\u51FA");
      return;
    }
    const text = this.plugin.store.exportTasksAsMinimalCompletionText(tasks);
    await copyTextToClipboard(text);
    new import_obsidian13.Notice("\u5DF2\u590D\u5236\u4ECA\u65E5\u672A\u5B8C\u6210\u4EFB\u52A1");
  }
  renderTaskSection(container, title, tasks, emptyState) {
    const section = container.createDiv({ cls: "pm-section pm-task-section" });
    const header = section.createDiv({ cls: "pm-section-header" });
    header.createEl("h3", { text: `${title} (${tasks.length})` });
    if (tasks.length === 0) {
      const empty = section.createDiv({ cls: "pm-empty-state-card" });
      const icon = empty.createDiv({ cls: "pm-empty-state-icon" });
      (0, import_obsidian13.setIcon)(icon, "badge-check");
      empty.createEl("strong", { text: emptyState.emptyTitle });
      empty.createDiv({ cls: "pm-muted", text: emptyState.emptyBody });
      return;
    }
    const list = section.createDiv({ cls: "pm-task-list" });
    tasks.forEach((item) => {
      const task = item.occurrence;
      const displayProgress = summarizeOccurrenceDisplay(task, item.childOccurrences);
      const row = list.createDiv({ cls: `pm-task-card ${displayProgress.completed ? "is-complete" : ""}` });
      const main = row.createDiv({ cls: "pm-task-card-main" });
      if (task.kind === "simple") {
        const checkbox = main.createEl("input", { type: "checkbox", cls: "pm-task-checkbox" });
        checkbox.checked = task.completed;
        checkbox.addEventListener("change", async () => {
          try {
            await this.plugin.store.updateTaskOccurrenceCompletion(task.taskId, task.date, checkbox.checked);
          } catch (error) {
            checkbox.checked = !checkbox.checked;
            new import_obsidian13.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
          }
        });
      }
      const copy = main.createDiv({ cls: "pm-task-copy" });
      copy.createEl("div", { text: task.title, cls: `pm-task-title ${displayProgress.completed ? "is-complete" : ""}` });
      const meta = copy.createDiv({ cls: "pm-task-meta" });
      appendBadge2(meta, task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "\u672A\u6392\u671F", "muted");
      appendBadge2(meta, recurrenceLabel3(task), "repeat");
      appendBadge2(meta, statusLabel3(task.status), `status-${task.status}`);
      const executionLabel = occurrenceExecutionLabel(task);
      if (executionLabel) {
        appendBadge2(meta, executionLabel, "repeat");
      }
      appendBadge2(meta, this.plugin.store.getProject(task.projectId)?.name ?? "\u672A\u5F52\u5C5E\u9879\u76EE", "tag");
      if (task.kind === "composite") {
        appendBadge2(meta, `${displayProgress.completedSteps}/${displayProgress.totalSteps} \u5B50\u9879`, "priority-medium");
        this.renderSubtasks(copy, task, item.childOccurrences);
      }
      const actions = row.createDiv({ cls: "pm-task-card-actions" });
      const moreButton = actions.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "\u66F4\u591A\u64CD\u4F5C" } });
      (0, import_obsidian13.setIcon)(moreButton, "ellipsis");
      moreButton.addEventListener("click", (event) => this.openTaskMenu(event, task));
    });
  }
  openTaskMenu(event, task) {
    event.preventDefault();
    event.stopPropagation();
    const menu = new import_obsidian13.Menu();
    menu.addItem(
      (item) => item.setTitle("\u7F16\u8F91\u4EFB\u52A1").setIcon("square-pen").onClick(() => {
        if (isSyntheticCompositeOccurrence(task)) {
          const seriesTask = this.plugin.store.getTask(task.taskId);
          if (seriesTask) {
            this.openSeriesEditor(seriesTask);
          }
          return;
        }
        this.openEditor(task);
      })
    );
    if (isSyntheticCompositeOccurrence(task)) {
      menu.showAtMouseEvent(event);
      return;
    }
    if ((task.recurrenceCount ?? 1) > 1 || task.recurrenceUntil) {
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
    this.openOccurrenceEditor(seriesTask, task);
  }
  openSeriesEditor(seriesTask) {
    new TaskModal(this.app, {
      title: "\u7F16\u8F91\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      compositeParents: this.plugin.store.getCompositeTasks(),
      childTasks: this.plugin.store.getChildTasks(seriesTask.id),
      existingTask: seriesTask,
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
        consumeRequiresCompletion: seriesTask.consumeRequiresCompletion,
        kind: seriesTask.kind,
        subtasks: [],
        viewState: seriesTask.viewState,
        completed: isTaskSeriesCompleted2(seriesTask)
      },
      onSubmit: async (input) => {
        await this.plugin.store.updateTask(seriesTask.id, input, "series");
      },
      onDelete: async (scope) => {
        await this.plugin.store.deleteTask(seriesTask.id, "series");
      },
      onCompleteSeries: async () => {
        await this.plugin.store.completeTaskSeries(seriesTask.id);
      },
      onOpenChildTask: (childTask) => {
        this.openSeriesEditor(childTask);
      },
      onCreateChildTask: (parent) => {
        this.openCreateChildTaskModal(parent);
      },
      allowSingleDelete: false
    }).open();
  }
  openCreateChildTaskModal(parent) {
    new TaskModal(this.app, {
      title: "\u65B0\u589E\u5B50\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      compositeParents: this.plugin.store.getCompositeTasks(),
      initial: {
        title: "",
        description: "",
        projectId: parent.projectId,
        status: "todo",
        tags: [],
        date: parent.date,
        startTime: parent.startTime,
        endTime: parent.endTime,
        recurrence: "daily",
        recurrenceCount: SINGLE_TASK_RECURRENCE_COUNT,
        kind: "simple",
        completed: false,
        viewState: {
          mindmap: {
            parentTaskId: parent.id,
            childOrder: Date.now(),
            expanded: true
          }
        }
      },
      onSubmit: async (input) => {
        await this.plugin.store.createTask(input);
      }
    }).open();
  }
  openOccurrenceEditor(seriesTask, task) {
    new TaskModal(this.app, {
      title: "\u7F16\u8F91\u4EFB\u52A1",
      projects: this.plugin.store.getProjects(),
      compositeParents: this.plugin.store.getCompositeTasks(),
      existingTask: seriesTask,
      occurrenceContext: task,
      initial: {
        title: task.title,
        description: task.description,
        projectId: seriesTask.projectId,
        status: seriesTask.status,
        priority: seriesTask.priority,
        tags: seriesTask.tags,
        date: task.date,
        startTime: task.startTime,
        endTime: task.endTime,
        recurrence: seriesTask.recurrence,
        recurrenceCount: seriesTask.recurrenceCount ?? null,
        recurrenceUntil: seriesTask.recurrenceUntil ?? null,
        consumeRequiresCompletion: seriesTask.consumeRequiresCompletion,
        kind: seriesTask.kind,
        subtasks: [],
        viewState: seriesTask.viewState,
        completed: task.completed
      },
      onSubmit: async (input, scope) => {
        if (scope === "occurrence") {
          await this.plugin.store.updateTaskOccurrenceDetails(seriesTask.id, task.date, {
            title: input.title,
            description: input.description,
            startTime: input.startTime,
            endTime: input.endTime
          });
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
      onOpenSeriesEditor: () => {
        this.openSeriesEditor(seriesTask);
      },
      allowSingleDelete: true
    }).open();
  }
  renderSubtasks(container, task, childOccurrences = []) {
    if (task.kind !== "composite") {
      return;
    }
    renderCompositeOccurrenceCards(container, {
      parentOccurrence: task,
      childOccurrences,
      onToggleChildOccurrence: async (child) => {
        try {
          await this.plugin.store.updateTaskOccurrenceCompletion(child.taskId, child.date, !child.completed);
        } catch (error) {
          new import_obsidian13.Notice(error instanceof Error ? error.message : "\u66F4\u65B0\u5931\u8D25");
        }
      },
      onEditChildOccurrence: (child) => {
        this.openEditor(child);
      },
      onDeleteChildTask: async (child) => {
        await this.plugin.store.deleteTask(child.taskId, "series");
      }
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
  if (task.recurrence === "daily" && task.recurrenceCount === SINGLE_TASK_RECURRENCE_COUNT && !task.recurrenceUntil) {
    return "\u5355\u6B21\u4EFB\u52A1";
  }
  return recurrenceLabel(task.recurrence);
}
function statusLabel3(status) {
  return statusLabel(status);
}
function isTaskSeriesCompleted2(task) {
  if (task.kind === "simple" && task.consumeRequiresCompletion) {
    return getTaskExecutionProgress(task).completedSeries;
  }
  if (task.occurrenceDates.length === 0) {
    return false;
  }
  return task.occurrenceDates.every((date) => {
    const state = task.occurrenceStates.find((item) => item.date === date);
    if (task.kind === "simple") {
      return Boolean(state);
    }
    if (task.subtasks.length === 0) {
      return Boolean(state?.completedAt);
    }
    const completedIds = new Set(state?.completedSubtaskIds ?? []);
    return task.subtasks.every((subtask) => completedIds.has(subtask.id));
  });
}

// src/main.ts
var ProjectManagementPlugin = class extends import_obsidian14.Plugin {
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
      new import_obsidian14.Notice(error instanceof Error ? error.message : "\u63D2\u4EF6\u521D\u59CB\u5316\u5931\u8D25");
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
        if (file instanceof import_obsidian14.TFile && file.extension === "md") {
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
        new import_obsidian14.Notice(error instanceof Error ? error.message : "\u5237\u65B0\u6570\u636E\u5931\u8D25");
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
        new import_obsidian14.Notice(`\u5DF2\u540C\u6B65 ${count} \u4E2A\u7B14\u8BB0\u4EFB\u52A1`);
      }
    } catch (error) {
      console.error("Failed to scan note tasks", error);
      if (notify) {
        new import_obsidian14.Notice(error instanceof Error ? error.message : "\u626B\u63CF\u7B14\u8BB0\u4EFB\u52A1\u5931\u8D25");
      }
    }
  }
};
