import { Notice, WorkspaceLeaf } from "obsidian";
import { DayTasksModal } from "../components/dayTasksModal";
import { ProjectModal } from "../components/projectModal";
import { TaskModal } from "../components/taskModal";
import type ProjectManagementPlugin from "../main";
import { ProgressPage, Project, Task, TaskInput, TaskOccurrence } from "../types";
import {
  addDays,
  compareDateKeys,
  formatShortMonth,
  formatWeekColumnTitle,
  getLastTwelveMonthsDays,
  getWeekDates,
  isPastDateKey,
  isToday,
  isWeekend,
  now,
  parseTimeToMinutes,
  startOfWeek,
  toDateKey
} from "../utils/date";
import { BaseProjectView } from "./base";

export const OVERVIEW_VIEW_TYPE = "project-management-overview-view";

export class OverviewView extends BaseProjectView {
  private activePrimaryTab: "activity" | "projects" = "activity";
  private selectedProjectId: string | null = null;
  private weekAnchor: Date = now();

  constructor(leaf: WorkspaceLeaf, plugin: ProjectManagementPlugin) {
    super(leaf, plugin);
  }

  getViewType(): string {
    return OVERVIEW_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "任务总览";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
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
    titleBlock.createEl("h1", { text: "任务总览" });
    titleBlock.createDiv({ cls: "pm-muted", text: "热度图、周任务图和近 30 天趋势统一按任务发生实例统计。" });
    const heroActions = hero.createDiv({ cls: "pm-tab-bar" });
    this.createPrimaryTab(heroActions, this.plugin.settings.overviewTab1Name, "activity");
    this.createPrimaryTab(heroActions, this.plugin.settings.overviewTab2Name, "projects");

    if (this.activePrimaryTab === "activity") {
      this.renderActivityTab(container, snapshot.occurrences, snapshot.projects);
    } else {
      this.renderProjectsTab(container, snapshot.progressPages, snapshot.projects, snapshot.tasks);
    }
  }

  private createPrimaryTab(container: HTMLElement, label: string, key: "activity" | "projects"): void {
    const button = container.createEl("button", { text: label, cls: this.activePrimaryTab === key ? "is-active" : "" });
    button.addEventListener("click", () => {
      this.activePrimaryTab = key;
      this.render();
    });
  }

  private renderActivityTab(container: HTMLElement, tasks: TaskOccurrence[], projects: Project[]): void {
    const summary = container.createDiv({ cls: "pm-summary-strip" });
    const today = toDateKey(now());
    const weekStart = toDateKey(startOfWeek(this.weekAnchor));
    const weekEnd = toDateKey(addDays(startOfWeek(this.weekAnchor), 6));
    const thisWeekTasks = tasks.filter((task) => compareDateKeys(task.date, weekStart) >= 0 && compareDateKeys(task.date, weekEnd) <= 0);
    const completedToday = tasks.filter((task) => task.completedAt?.slice(0, 10) === today).length;
    const incompleteToday = tasks.filter((task) => task.date === today && !task.completed).length;
    [
      { label: "今日待办", value: String(incompleteToday) },
      { label: "今日完成", value: String(completedToday) },
      { label: "本周任务", value: String(thisWeekTasks.length) },
      { label: "项目数", value: String(projects.length) }
    ].forEach((item) => {
      const card = summary.createDiv({ cls: "pm-summary-card" });
      card.createDiv({ cls: "pm-muted", text: item.label });
      card.createEl("strong", { text: item.value });
    });

    const heatmapSection = container.createDiv({ cls: "pm-section" });
    const heatmapHeader = heatmapSection.createDiv({ cls: "pm-page-header" });
    heatmapHeader.createEl("h3", { text: "热度图" });
    heatmapHeader.createDiv({ cls: "pm-muted", text: "最近 12 个月完成任务分布" });
    this.renderHeatmap(heatmapSection, tasks);

    const weekSection = container.createDiv({ cls: "pm-section" });
    const top = weekSection.createDiv({ cls: "pm-week-header" });
    const left = top.createDiv();
    left.createEl("h3", { text: "周任务图" });
    left.createDiv({ cls: "pm-muted", text: `${formatWeekColumnTitle(getWeekDates(this.weekAnchor)[0])} 开始` });
    const controls = top.createDiv({ cls: "pm-week-controls" });
    controls.createEl("button", { text: "上一周" }).addEventListener("click", () => {
      this.weekAnchor = addDays(this.weekAnchor, -7);
      this.render();
    });
    controls.createEl("button", { text: "本周" }).addEventListener("click", () => {
      this.weekAnchor = now();
      this.render();
    });
    controls.createEl("button", { text: "下一周" }).addEventListener("click", () => {
      this.weekAnchor = addDays(this.weekAnchor, 7);
      this.render();
    });
    this.renderWeekBoard(weekSection, tasks, projects);

    const trendSection = container.createDiv({ cls: "pm-section" });
    const trendHeader = trendSection.createDiv({ cls: "pm-page-header" });
    trendHeader.createEl("h3", { text: "最近 30 天任务趋势" });
    trendHeader.createDiv({ cls: "pm-muted", text: "折线图同时展示每日任务总量和每日完成数量" });
    this.renderMonthlyTrend(trendSection, tasks);
  }

  private renderHeatmap(container: HTMLElement, tasks: TaskOccurrence[]): void {
    const allDays = getLastTwelveMonthsDays();
    const counts = new Map<string, number>();
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
    ["周一", "周三", "周五"].forEach((label) => weekdayColumn.createDiv({ text: label }));

    const grid = body.createDiv({ cls: "pm-heatmap-grid" });
    grid.style.gridTemplateColumns = `repeat(${weeks.length}, 14px)`;
    weeks.forEach((week) => {
      week.forEach((date) => {
        const key = toDateKey(date);
        const count = counts.get(key) ?? 0;
        const cell = grid.createDiv({ cls: `pm-heatmap-cell level-${heatLevel(count)}` });
        cell.setAttribute("aria-label", `${key}: ${count} 个完成任务`);
        cell.title = `${key}: ${count} 个完成任务`;
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

  private renderMonthlyTrend(container: HTMLElement, tasks: TaskOccurrence[]): void {
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
        "aria-label": "最近 30 天任务趋势图"
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
      label.title = `${item.key}：任务 ${item.total}，完成 ${item.completed}`;
    });
  }

  private renderWeekBoard(container: HTMLElement, tasks: TaskOccurrence[], projects: Project[]): void {
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
        ]
          .filter(Boolean)
          .join(" ")
      });
      const title = column.createDiv({ cls: "pm-week-day-title" });
      title.createSpan({ text: formatWeekColumnTitle(date) });
      if (isToday(key)) {
        title.createSpan({ text: "今天", cls: "pm-tag pm-tag-today" });
      }
      column.createEl("button", { text: "新增任务", cls: "mod-cta" }).addEventListener("click", () => {
        this.openCreateTaskModal("新增任务", projects, {
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
        column.createDiv({ cls: "pm-empty", text: "暂无任务" });
        return;
      }

      const list = column.createDiv({ cls: "pm-week-day-list" });
      dayTasks.forEach((task) => this.renderWeekTaskCard(list, task));
    });
  }

  private renderWeekTaskCard(container: HTMLElement, task: TaskOccurrence): void {
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
        new Notice(error instanceof Error ? error.message : "更新失败");
      }
    });
    top.createSpan({ text: task.title, cls: "pm-task-title" });
    top.createSpan({ text: recurrenceLabel(task.recurrence), cls: "pm-tag" });

    const meta = card.createDiv({ cls: "pm-task-meta" });
    meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "未排期" });
    meta.createSpan({ text: project?.name ?? "未归属项目" });
    if (task.recurrence !== "once") {
      meta.createSpan({ text: `第 ${task.occurrenceNumber} 次` });
    }

    const actions = card.createDiv({ cls: "pm-task-actions" });
    actions.createEl("button", { text: "编辑" }).addEventListener("click", () => this.openEditOccurrenceModal(task));
  }

  private renderProjectsTab(container: HTMLElement, pages: ProgressPage[], projects: Project[], allTasks: Task[]): void {
    const header = container.createDiv({ cls: "pm-page-header" });
    const headerCopy = header.createDiv();
    headerCopy.createEl("h3", { text: "项目进度页" });
    headerCopy.createDiv({ cls: "pm-muted", text: "重复任务在这里按系列显示为单行，发生次数与完成进度集中展示。" });
    header.createEl("button", { text: "新增项目", cls: "mod-cta" }).addEventListener("click", () => {
      new ProjectModal(this.app, {
        title: "新增项目",
        initial: {
          name: "",
          description: "",
          color: "",
          status: "active"
        },
        onSubmit: async (input) => {
          const project = await this.plugin.store.createProject(input);
          this.selectedProjectId = project.id;
        }
      }).open();
    });

    const tabs = container.createDiv({ cls: "pm-secondary-tabs" });
    pages.forEach((page) => {
      const button = tabs.createDiv({ cls: `pm-secondary-tab ${this.selectedProjectId === page.projectId ? "is-active" : ""}` });
      button.createSpan({ text: page.name });
      const actions = button.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "↑" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, -1);
      });
      actions.createEl("button", { text: "↓" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, 1);
      });
      actions.createEl("button", { text: "编辑" }).addEventListener("click", (event) => {
        event.stopPropagation();
        const project = projects.find((item) => item.id === page.projectId);
        if (!project) {
          return;
        }
        new ProjectModal(this.app, {
          title: "编辑项目",
          initial: project,
          onSubmit: async (input) => {
            await this.plugin.store.updateProject(project.id, input);
          },
          onDelete: async () => {
            await this.plugin.store.deleteProject(project.id);
          }
        }).open();
      });
      button.addEventListener("click", () => {
        this.selectedProjectId = page.projectId;
        this.render();
      });
    });

    if (!this.selectedProjectId) {
      container.createDiv({ cls: "pm-empty", text: "暂无项目，请先创建项目。" });
      return;
    }

    const project = projects.find((item) => item.id === this.selectedProjectId);
    if (!project) {
      container.createDiv({ cls: "pm-empty", text: "项目不存在。" });
      return;
    }

    const body = container.createDiv({ cls: "pm-section" });
    const top = body.createDiv({ cls: "pm-page-header" });
    const title = top.createDiv();
    title.createEl("h3", { text: project.name });
    title.createDiv({ cls: "pm-muted", text: project.description || "项目级任务集中管理视图，可直接维护重复任务系列。" });
    top.createEl("button", { text: "新增任务", cls: "mod-cta" }).addEventListener("click", () => {
      this.openCreateTaskModal("新增项目任务", projects, {
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
    body.createDiv({ cls: "pm-muted", text: `进度 ${this.plugin.store.getProjectProgress(project.id)}%` });

    const table = body.createEl("table", { cls: "pm-table" });
    const head = table.createEl("thead");
    const headRow = head.createEl("tr");
    ["任务名称", "重复", "计划", "完成", "描述", "操作"].forEach((label) => headRow.createEl("th", { text: label }));

    const bodyEl = table.createEl("tbody");
    const tasks = allTasks.filter((task) => task.projectId === project.id).sort(compareSeriesTasks);
    if (tasks.length === 0) {
      const row = bodyEl.createEl("tr");
      const cell = row.createEl("td", { text: "暂无任务" });
      cell.colSpan = 6;
      return;
    }

    tasks.forEach((task) => {
      const row = bodyEl.createEl("tr");
      row.createEl("td", { text: task.title });
      row.createEl("td", { text: recurrenceLabel(task.recurrence) });
      row.createEl("td", { text: scheduleSummary(task) });
      row.createEl("td", { text: completionSummary(task) });
      row.createEl("td", { text: task.description || "-" });
      const actionCell = row.createEl("td");
      actionCell.createEl("button", { text: "详细编辑" }).addEventListener("click", () => this.openEditTaskModal(task));
    });
  }

  private openCreateTaskModal(title: string, projects: Project[], initial: TaskInput): void {
    new TaskModal(this.app, {
      title,
      projects,
      initial,
      onSubmit: async (input) => {
        await this.plugin.store.createTask(input);
      }
    }).open();
  }

  private openEditTaskModal(task: Task): void {
    new TaskModal(this.app, {
      title: "编辑任务",
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

  private openEditOccurrenceModal(task: TaskOccurrence): void {
    const seriesTask = this.plugin.store.getTask(task.taskId);
    if (!seriesTask) {
      return;
    }
    new TaskModal(this.app, {
      title: "编辑任务",
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
}

function buildHeatmapWeeks(days: Date[]): Date[][] {
  if (days.length === 0) {
    return [];
  }
  const first = startOfWeek(days[0]);
  const last = days[days.length - 1];
  const weeks: Date[][] = [];
  let cursor = first;
  while (cursor <= last) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addDays(cursor, index)));
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

function buildMonthLabels(weeks: Date[][]): Array<{ label: string; column: number; span: number }> {
  const labels: Array<{ label: string; column: number; span: number }> = [];
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

function heatLevel(count: number): number {
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

function recurrenceLabel(recurrence: Task["recurrence"]): string {
  if (recurrence === "daily") {
    return "每日重复";
  }
  if (recurrence === "weekly") {
    return "每周此时重复";
  }
  return "单次任务";
}

function compareWeekTasks(a: TaskOccurrence, b: TaskOccurrence): number {
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

function compareSeriesTasks(a: Task, b: Task): number {
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

function toChartPoint(index: number, value: number, max: number): string {
  const x = 20 + index * (860 / 29);
  const y = 210 - (value / max) * 170;
  return `${x},${y}`;
}

function scheduleSummary(task: Task): string {
  const total = task.occurrenceDates.length;
  const range = total > 1 ? `${task.occurrenceDates[0]} -> ${task.occurrenceDates[total - 1]}` : task.date;
  const time = task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "未排期";
  return `${range} | ${time} | 共 ${total} 次`;
}

function completionSummary(task: Task): string {
  return `${task.completedOccurrences.length}/${task.occurrenceDates.length}`;
}
