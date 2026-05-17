import { Menu, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { DayTasksModal } from "../components/dayTasksModal";
import { BulkImportModal } from "../components/bulkImportModal";
import { ProjectModal } from "../components/projectModal";
import { TaskModal } from "../components/taskModal";
import { TextEntryModal } from "../components/textEntryModal";
import type ProjectManagementPlugin from "../main";
import { ProgressPage, Project, Task, TaskInput, TaskMindmapComment, TaskOccurrence, TaskStatus } from "../types";
import {
  addDays,
  compareDateKeys,
  formatShortMonth,
  getChineseWeekday,
  getLastTwelveMonthsDays,
  getWeekDates,
  isPastDateKey,
  isToday,
  isWeekend,
  now,
  parseDateKey,
  parseTimeToMinutes,
  startOfWeek,
  toDateKey,
  toMonthKey
} from "../utils/date";
import { BaseProjectView } from "./base";

export const OVERVIEW_VIEW_TYPE = "project-management-overview-view";

export class OverviewView extends BaseProjectView {
  private activePrimaryTab: "activity" | "projects" = "activity";
  private activeProjectView: "table" | "board" | "gantt" | "mindmap" = "table";
  private selectedProjectId: string | null = null;
  private weekAnchor: Date = now();
  private projectTablePage = 1;
  private readonly projectTablePageSize = 8;
  private selectedMindmapNodeId: string | null = null;
  private readonly mindmapMinZoom = MINDMAP_MIN_ZOOM;
  private readonly mindmapMaxZoom = MINDMAP_MAX_ZOOM;
  private readonly mindmapZoomStep = MINDMAP_ZOOM_STEP;
  private mindmapZoom = 1;
  private mindmapPan = { x: 0, y: 0 };
  private mindmapViewport: HTMLElement | null = null;
  private mindmapContent: HTMLElement | null = null;
  private mindmapZoomLabel: HTMLElement | null = null;
  private mindmapResizeObserver: ResizeObserver | null = null;
  private mindmapFitTimer: number | null = null;
  private mindmapNodes: MindmapNode[] = [];
  private mindmapProjectId: string | null = null;
  private mindmapLayoutSignature = "";
  private mindmapNeedsAutoFit = true;
  private mindmapViewportWidth = 0;
  private mindmapViewportHeight = 0;
  private ganttScale: GanttScale | null = null;
  private ganttZoom = 0.75;
  private ganttProjectId: string | null = null;
  private ganttDataSignature = "";
  private ganttScrollLeft = 0;
  private ganttPendingAnchor: { ratio: number; offset: number } | null = null;
  private ganttPendingFocus: "today" | "start" | null = null;

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

  async onClose(): Promise<void> {
    this.destroyMindmapViewport();
  }

  async render(): Promise<void> {
    this.destroyMindmapViewport();
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
    const weekDates = getWeekDates(this.weekAnchor);
    left.createEl("h3", { text: "周任务图" });
    left.createDiv({ cls: "pm-muted", text: `${toDateKey(weekDates[0])} 至 ${toDateKey(weekDates[6])}` });
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
    const yAxisValues = buildYAxisValues(max);

    const legend = container.createDiv({ cls: "pm-line-chart-legend" });
    [
      { label: "任务总数", cls: "pm-line-chart-total" },
      { label: "已完成", cls: "pm-line-chart-completed" }
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
        "aria-label": "最近 30 天任务趋势图"
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
      totalDot.createSvg("title").textContent = `${item.key}：任务 ${item.total}，完成 ${item.completed}`;
      const completedDot = svg.createSvg("circle", {
        attr: { cx: String(completedPoint.x), cy: String(completedPoint.y), r: "4", class: "pm-line-chart-point pm-line-chart-completed" }
      });
      completedDot.createSvg("title").textContent = `${item.key}：任务 ${item.total}，完成 ${item.completed}`;
    });

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
      const header = column.createDiv({ cls: "pm-week-day-header" });
      const title = header.createDiv({ cls: "pm-week-day-title" });
      title.createSpan({ text: getChineseWeekday(date), cls: "pm-week-day-weekday" });
      title.createSpan({ text: key, cls: "pm-week-day-date" });
      header.createEl("button", { text: "新增", cls: "mod-cta pm-week-day-add" }).addEventListener("click", () => {
        this.openCreateTaskModal("新增任务", projects, {
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
        column.createDiv({ cls: "pm-empty pm-week-day-empty", text: "暂无任务" });
        return;
      }

      const list = column.createDiv({ cls: "pm-week-day-list" });
      dayTasks.forEach((task) => this.renderWeekTaskCard(list, task));
    });
  }

  private renderWeekTaskCard(container: HTMLElement, task: TaskOccurrence): void {
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
          new Notice(error instanceof Error ? error.message : "更新失败");
        }
      });
    }
    const titleLine = top.createDiv({ cls: "pm-week-task-title-line" });
    titleLine.createSpan({ text: task.title, cls: "pm-task-title" });
    titleLine.createSpan({ text: recurrenceLabel(task.recurrence), cls: "pm-tag pm-week-recurrence-tag" });
    const editButton = top.createEl("button", { text: "✎", cls: "pm-week-task-edit" });
    editButton.setAttribute("aria-label", "编辑任务");
    editButton.title = "编辑任务";
    editButton.addEventListener("click", () => this.openEditOccurrenceModal(task));

    const meta = card.createDiv({ cls: "pm-task-meta" });
    meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "未排期" });
    meta.createSpan({ text: project?.name ?? "未归属项目" });
    if (task.recurrence !== "once") {
      meta.createSpan({ text: `第 ${task.occurrenceNumber} 次` });
    }
    if (task.kind === "composite") {
      meta.createSpan({ text: `${task.completedSteps}/${task.totalSteps} 子任务` });
      this.renderCompositeSubtasks(card, task);
    }
  }

  private renderCompositeSubtasks(container: HTMLElement, task: TaskOccurrence): void {
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
          new Notice(error instanceof Error ? error.message : "更新失败");
        }
      });
    });
  }

  private renderProjectsTab(container: HTMLElement, pages: ProgressPage[], projects: Project[], allTasks: Task[]): void {
    const header = container.createDiv({ cls: "pm-page-header" });
    const headerCopy = header.createDiv();
    headerCopy.createEl("h3", { text: "项目进度" });
    headerCopy.createDiv({ cls: "pm-muted", text: "围绕单个项目统一查看表格、看板、甘特图与思维导图。" });
    header.createEl("button", { text: "新增项目", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
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
      actions.createEl("button", { text: "↑", cls: "pm-button pm-button-ghost pm-compact-button" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, -1);
      });
      actions.createEl("button", { text: "↓", cls: "pm-button pm-button-ghost pm-compact-button" }).addEventListener("click", async (event) => {
        event.stopPropagation();
        await this.plugin.store.reorderProgressPage(page.projectId, 1);
      });
      actions.createEl("button", { text: "编辑", cls: "pm-button pm-button-ghost pm-compact-button" }).addEventListener("click", (event) => {
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
        this.projectTablePage = 1;
        this.selectedMindmapNodeId = null;
        this.mindmapNeedsAutoFit = true;
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

    const tasks = allTasks.filter((task) => task.projectId === project.id).sort(compareSeriesTasks);
    const occurrences = this.plugin.store.getOccurrencesForProject(project.id);
    const progress = this.plugin.store.getProjectProgress(project.id);
    const completedCount = occurrences.filter((task) => task.completed).length;
    const summaryCard = container.createDiv({ cls: "pm-project-summary-card" });
    const summaryLeft = summaryCard.createDiv({ cls: "pm-project-summary-main" });
    summaryLeft.createDiv({ cls: "pm-muted", text: "整体进度" });
    summaryLeft.createEl("strong", { text: project.name });
    summaryLeft.createDiv({ cls: "pm-muted", text: project.description || "项目级任务集中管理视图，可直接维护重复任务系列。" });
    summaryLeft.createDiv({ cls: "pm-progress-bar" }).createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${progress}%` }
    });
    summaryLeft.createDiv({ cls: "pm-muted", text: `完成率 ${progress}%` });

    const summaryRight = summaryCard.createDiv({ cls: "pm-project-summary-metrics" });
    [
      { label: "项目任务", value: String(tasks.length) },
      { label: "总次数", value: String(occurrences.length) },
      { label: "已完成", value: String(completedCount) },
      { label: "完成率", value: `${progress}%` }
    ].forEach((item) => {
      const metric = summaryRight.createDiv({ cls: "pm-project-metric" });
      metric.createDiv({ cls: "pm-muted", text: item.label });
      metric.createEl("strong", { text: item.value });
    });

    const body = container.createDiv({ cls: "pm-section pm-project-shell" });
    const top = body.createDiv({ cls: "pm-page-header" });
    const title = top.createDiv();
    title.createEl("h3", { text: project.name });
    title.createDiv({ cls: "pm-muted", text: "优先处理正确性，再统一优化视觉与交互层级。" });
    const projectActions = top.createDiv({ cls: "pm-inline-actions" });
    projectActions.createEl("button", { text: "批量导入", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      new BulkImportModal(this.app, {
        title: "批量导入项目任务",
        store: this.plugin.store,
        projectId: project.id,
        defaultDate: toDateKey(now())
      }).open();
    });
    projectActions.createEl("button", { text: "今日自动排程", cls: "pm-button pm-button-secondary" }).addEventListener("click", async () => {
      try {
        const result = await this.plugin.store.autoArrangeDate(toDateKey(now()));
        new Notice(result.moved.length > 0 ? `已移动 ${result.moved.length} 个任务` : "今日任务无需调整");
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "自动排程失败");
      }
    });
    projectActions.createEl("button", { text: "+ 新增任务", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
      this.openCreateTaskModal("新增项目任务", projects, {
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
      ["table", "表格"],
      ["board", "看板"],
      ["gantt", "甘特图"],
      ["mindmap", "思维导图"]
    ].forEach(([key, label]) => {
      const button = viewTabs.createEl("button", {
        text: label,
        cls: `pm-segmented-item ${this.activeProjectView === key ? "is-active" : ""}`
      });
      button.addEventListener("click", () => {
        this.activeProjectView = key as typeof this.activeProjectView;
        this.projectTablePage = 1;
        this.mindmapNeedsAutoFit = key === "mindmap";
        this.render();
      });
    });

    if (tasks.length === 0) {
      body.createDiv({ cls: "pm-empty", text: "暂无任务" });
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

  private renderProjectTable(container: HTMLElement, tasks: Task[]): void {
    const totalPages = Math.max(1, Math.ceil(tasks.length / this.projectTablePageSize));
    this.projectTablePage = Math.min(this.projectTablePage, totalPages);
    const pageTasks = tasks.slice((this.projectTablePage - 1) * this.projectTablePageSize, this.projectTablePage * this.projectTablePageSize);

    const card = container.createDiv({ cls: "pm-table-card" });
    const table = card.createEl("table", { cls: "pm-table" });
    const head = table.createEl("thead");
    const headRow = head.createEl("tr");
    ["任务名称", "状态", "优先级", "标签", "重复", "计划", "完成", "描述", "操作"].forEach((label) => headRow.createEl("th", { text: label }));

    const bodyEl = table.createEl("tbody");
    pageTasks.forEach((task) => {
      const row = bodyEl.createEl("tr");
      const titleCell = row.createEl("td");
      titleCell.createEl("strong", { text: task.title });
      titleCell.createDiv({ cls: "pm-muted", text: `${task.date} · ${task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "未排期"}` });

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
      appendBadge(recurrenceCell, recurrenceLabel(task.recurrence), "repeat");

      const scheduleCell = row.createEl("td");
      scheduleCell.createDiv({ text: task.occurrenceDates.length > 1 ? `${task.occurrenceDates[0]} -> ${task.occurrenceDates[task.occurrenceDates.length - 1]}` : task.date });
      scheduleCell.createDiv({ cls: "pm-muted", text: task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "未排期" });

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
      const menuButton = actionCell.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "更多操作" } });
      setIcon(menuButton, "ellipsis");
      menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, task));
    });

    const footer = card.createDiv({ cls: "pm-table-footer" });
    footer.createDiv({ cls: "pm-muted", text: `共 ${tasks.length} 项` });
    const pager = footer.createDiv({ cls: "pm-inline-actions" });
    const prev = pager.createEl("button", { text: "上一页", cls: "pm-button pm-button-secondary" });
    prev.disabled = this.projectTablePage <= 1;
    prev.addEventListener("click", () => {
      this.projectTablePage -= 1;
      this.render();
    });
    pager.createDiv({ cls: "pm-muted", text: `${this.projectTablePage} / ${totalPages}` });
    const next = pager.createEl("button", { text: "下一页", cls: "pm-button pm-button-secondary" });
    next.disabled = this.projectTablePage >= totalPages;
    next.addEventListener("click", () => {
      this.projectTablePage += 1;
      this.render();
    });
  }

  private renderProjectBoard(container: HTMLElement, project: Project, tasks: Task[]): void {
    const board = container.createDiv({ cls: "pm-project-board" });
    const columns: Array<[TaskStatus, string]> = [
      ["todo", "待办"],
      ["doing", "进行中"],
      ["blocked", "阻塞"],
      ["done", "已完成"]
    ];

    columns.forEach(([status, label]) => {
      const items = tasks
        .filter((task) => (task.viewState.board.columnId ?? task.status) === status)
        .sort((a, b) => a.viewState.board.order - b.viewState.board.order || compareSeriesTasks(a, b));

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
      title.createDiv({ cls: "pm-muted", text: `${items.length} 项` });
      const addButton = columnHeader.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "新建任务" } });
      setIcon(addButton, "plus");
      addButton.addEventListener("click", () => {
        this.openCreateTaskModal("新增项目任务", this.plugin.store.getProjects(), {
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
        const menuButton = top.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "更多操作" } });
        setIcon(menuButton, "ellipsis");
        menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, task));

        const badges = card.createDiv({ cls: "pm-board-badges" });
        appendBadge(badges, priorityLabel(task.priority), priorityTone(task.priority));
        task.tags.slice(0, 3).forEach((tag) => appendBadge(badges, `#${tag}`, "tag"));
        if (status === "blocked") {
          appendBadge(badges, task.viewState.gantt.dependencyIds.length > 0 ? "依赖未完成" : "等待处理", "status-blocked");
        }

        card.createDiv({ cls: "pm-board-schedule", text: task.occurrenceDates.length > 1 ? `${task.occurrenceDates[0].slice(5)} -> ${task.occurrenceDates[task.occurrenceDates.length - 1].slice(5)}` : task.date.slice(5) });
        card.createDiv({ cls: "pm-board-completion", text: completionSummary(task).replace(" · ", " | ") });
        const progress = Math.round(seriesProgress(task) * 100);
        card.createDiv({ cls: "pm-progress-bar pm-progress-bar-compact" }).createDiv({
          cls: "pm-progress-bar-fill",
          attr: { style: `width: ${progress}%` }
        });
      });

      column.createEl("button", { text: "+ 新建任务", cls: "pm-button pm-button-ghost pm-board-add-button" }).addEventListener("click", () => {
        this.openCreateTaskModal("新增项目任务", this.plugin.store.getProjects(), {
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
      { label: "总任务", value: String(tasks.length) },
      { label: "进行中", value: String(tasks.filter((task) => task.status === "doing").length) },
      { label: "已完成", value: String(tasks.filter((task) => isTaskSeriesCompleted(task)).length) },
      { label: "完成率", value: `${Math.round((tasks.filter((task) => isTaskSeriesCompleted(task)).length / Math.max(1, tasks.length)) * 100)}%` },
      { label: "逾期", value: String(overdueCount) }
    ].forEach((item) => {
      const stat = stats.createDiv({ cls: "pm-board-stat" });
      stat.createDiv({ cls: "pm-muted", text: item.label });
      stat.createEl("strong", { text: item.value });
    });
  }

  private renderProjectGantt(container: HTMLElement, project: Project, tasks: Task[]): void {
    const items = tasks
      .map((task) => ({
        task,
        startDate: task.occurrenceDates[0] ?? task.date,
        endDate: defaultCompletionDate(task),
        progress: Math.round(seriesProgress(task) * 100)
      }))
      .sort(
        (a, b) =>
          a.task.viewState.gantt.rowOrder - b.task.viewState.gantt.rowOrder ||
          a.startDate.localeCompare(b.startDate) ||
          compareSeriesTasks(a.task, b.task)
      );

    const card = container.createDiv({ cls: "pm-gantt-card tm-gantt-card" });
    if (items.length === 0) {
      card.createDiv({ cls: "pm-empty", text: "暂无任务" });
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
    headerCopy.createEl("h3", { text: "项目时间轴" });
    headerCopy.createDiv({ cls: "pm-muted", text: "按任务系列展示项目时间轴，长周期任务默认按周聚合显示。" });

    let viewportEl: HTMLElement | null = null;
    let contentWidth = geometry.contentWidth;
    const toolbar = header.createDiv({ cls: "pm-gantt-toolbar tm-gantt-toolbar" });
    toolbar.createEl("button", { text: "今天", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
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
    (["day", "week", "month"] as GanttScale[]).forEach((value) => {
      const button = scaleSwitch.createEl("button", {
        text: value === "day" ? "日" : value === "week" ? "周" : "月",
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
    toolbar.createEl("button", { text: "适应", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      const fit = fitGanttTimeline(items, viewportEl?.clientWidth ?? viewportEstimate);
      this.ganttScale = fit.scale;
      this.ganttZoom = fit.zoom;
      this.ganttPendingAnchor = null;
      this.ganttPendingFocus = "today";
      this.render();
    });
    toolbar.createEl("button", { text: "重置", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      const minDate = items.reduce((earliest, item) => (compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest), items[0].startDate);
      const maxDate = items.reduce((latest, item) => (compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest), items[0].endDate);
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
    ["任务", "状态", "优先级", "计划"].forEach((label) => leftHeader.createDiv({ text: label }));

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
      rowActions
        .createEl("button", {
          text: item.task.viewState.gantt.locked ? "解锁" : "锁定",
          cls: "pm-button pm-button-ghost pm-compact-button"
        })
        .addEventListener("click", async () => {
          await this.plugin.store.patchTask(item.task.id, {
            viewState: { gantt: { ...item.task.viewState.gantt, locked: !item.task.viewState.gantt.locked } }
          });
        });
      rowActions
        .createEl("button", {
          text: item.task.viewState.gantt.milestone ? "取消里程碑" : "设为里程碑",
          cls: "pm-button pm-button-ghost pm-compact-button"
        })
        .addEventListener("click", async () => {
          await this.plugin.store.patchTask(item.task.id, {
            viewState: { gantt: { ...item.task.viewState.gantt, milestone: !item.task.viewState.gantt.milestone } }
          });
        });
      const menuButton = rowActions.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "更多操作" } });
      setIcon(menuButton, "ellipsis");
      menuButton.addEventListener("click", (event) => this.openSeriesTaskMenu(event, item.task));
      taskCell.createDiv({ cls: "pm-muted pm-gantt-task-desc", text: item.task.description?.trim() || completionSummary(item.task) });

      const statusCell = leftRow.createDiv({ cls: "pm-gantt-status-cell" });
      appendBadge(statusCell, statusLabel(item.task.status), `status-${item.task.status}`);
      if (item.task.viewState.gantt.locked) {
        appendBadge(statusCell, "已锁定", "status-blocked");
      }

      const priorityCell = leftRow.createDiv({ cls: "pm-gantt-priority-cell" });
      appendBadge(priorityCell, priorityLabel(item.task.priority), priorityTone(item.task.priority));
      if (item.task.viewState.gantt.milestone) {
        appendBadge(priorityCell, "里程碑", "priority-medium");
      }

      const planCell = leftRow.createDiv({ cls: "pm-gantt-plan-cell" });
      planCell.createDiv({ text: item.startDate === item.endDate ? item.startDate : `${item.startDate} -> ${item.endDate}` });
      planCell.createDiv({ cls: "pm-muted", text: item.task.startTime && item.task.endTime ? `${item.task.startTime}-${item.task.endTime}` : "未排期" });

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
      bar.title = [item.task.title, `${item.startDate} -> ${item.endDate}`, `进度 ${item.progress}%`, `状态 ${statusLabel(item.task.status)}`].join("\n");
      bar.addEventListener("click", () => this.openEditTaskModal(item.task));
      bar.createSpan({ text: item.task.viewState.gantt.milestone ? `◆ ${item.progress}%` : `${item.progress}%` });

      if (item.task.viewState.gantt.dependencyIds.length > 0) {
        const dep = row.createDiv({ cls: "pm-gantt-dependency-note pm-muted", text: `依赖 ${item.task.viewState.gantt.dependencyIds.length} 项` });
        dep.style.left = `${Math.min(geometry.contentWidth - 92, barLeft + barWidth + 8)}px`;
      }
    });

    if (geometry.todayX !== null) {
      const todayLine = content.createDiv({ cls: "pm-gantt-today-line tm-gantt-today-line" });
      todayLine.style.left = `${geometry.todayX}px`;
      const todayBadge = todayLine.createDiv({ cls: "pm-gantt-today-badge" });
      todayBadge.setText("今天");
    }

    const minimap = card.createDiv({ cls: "pm-gantt-minimap tm-gantt-minimap" });
    const minimapTrack = minimap.createDiv({ cls: "pm-gantt-minimap-track" });
    items.forEach((item) => {
      const leftRatio = dateToTimelineX(item.startDate, geometry.rangeStart, scale, geometry.unitWidth) / Math.max(geometry.contentWidth, 1);
      const rightRatio =
        dateToTimelineX(toDateKey(addDays(parseDateKey(item.endDate), 1)), geometry.rangeStart, scale, geometry.unitWidth) / Math.max(geometry.contentWidth, 1);
      const miniBar = minimapTrack.createDiv({ cls: `pm-gantt-minimap-bar is-${item.task.status}` });
      miniBar.style.left = `${leftRatio * 100}%`;
      miniBar.style.width = `${Math.max((rightRatio - leftRatio) * 100, 1.4)}%`;
      miniBar.style.top = `${12 + items.indexOf(item) * 10}px`;
    });
    const minimapSelection = minimapTrack.createDiv({ cls: "pm-gantt-minimap-selection" });

    const updateMinimapSelection = (): void => {
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
      ["已完成", "completed"],
      ["进行中", "doing"],
      ["待办", "todo"],
      ["阻塞", "blocked"]
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

  private renderProjectMindmap(container: HTMLElement, project: Project, tasks: Task[]): void {
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
    toolbarCopy.createDiv({ cls: "pm-muted", text: "点击节点后可在右侧真实编辑评语、任务类型与关系。" });
    toolbarCopy.createDiv({ cls: "pm-muted", text: "画布支持缩放、拖拽平移与自适应视口；节点拖拽仍会保存位置。" });
    const toolbarActions = toolbar.createDiv({ cls: "pm-inline-actions" });
    toolbarActions.createEl("button", { text: "新增根任务", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
      this.openCreateTaskModal("新增根任务", this.plugin.store.getProjects(), {
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
    toolbarActions.createEl("button", { text: "适应", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      this.fitMindmapView();
    });
    toolbarActions.createEl("button", { text: "重置", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
      this.resetMindmapView();
    });

    const viewport = canvasCard.createDiv({ cls: "pm-mindmap-viewport tm-mindmap-viewport" });
    const content = viewport.createDiv({ cls: "pm-mindmap-content tm-mindmap-content" });
    const svg = content.createSvg("svg", { attr: { class: "pm-mindmap-lines pm-mindmap-svg tm-mindmap-svg" } });
    const redrawConnections = (): void => {
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
        element.addEventListener("dblclick", () => this.openEditTaskModal(node.task!));
      }
      if (node.type === "comment") {
        element.addEventListener("dblclick", () => void this.editMindmapComment(node.comment!));
      }

      element.createDiv({ cls: "pm-task-title", text: node.label });
      if (node.summary) {
        element.createDiv({ cls: "pm-mindmap-node-summary", text: node.summary });
      }
      const meta = element.createDiv({ cls: "pm-task-meta" });
      if (node.type === "project") {
        appendBadge(meta, "项目根节点", "tag");
      } else if (node.task && node.type === "task") {
        appendBadge(meta, priorityLabel(node.task.priority), priorityTone(node.task.priority));
        appendBadge(meta, recurrenceLabel(node.task.recurrence), "repeat");
        if (node.task.kind === "composite") {
          appendBadge(meta, `${node.task.subtasks.length} 个子任务`, "tag");
        }
      } else {
        appendBadge(meta, "评语", "tag");
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

  private renderMindmapInspector(container: HTMLElement, project: Project, tasks: Task[], node?: MindmapNode): void {
    container.empty();
    container.createEl("h4", { text: "节点详情" });
    if (!node) {
      container.createDiv({ cls: "pm-muted", text: "请选择一个节点。" });
      return;
    }

    if (node.type === "project") {
      container.createDiv({ cls: "pm-muted", text: "项目根节点用于组织全部任务分支。" });
      container.createEl("button", { text: "+ 新增根任务", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
        this.openCreateTaskModal("新增根任务", this.plugin.store.getProjects(), {
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
      appendBadge(badges, recurrenceLabel(node.task.recurrence), "repeat");
      if (node.task.description) {
        container.createDiv({ cls: "pm-muted", text: node.task.description });
      }

      const actions = container.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "编辑任务", cls: "pm-button pm-button-primary" }).addEventListener("click", () => this.openEditTaskModal(node.task!));
      actions.createEl("button", { text: "新增子任务", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
        this.openCreateTaskModal("新增子任务", this.plugin.store.getProjects(), {
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
              parentTaskId: node.task!.id,
              childOrder: Date.now(),
              expanded: true
            }
          },
          ...this.plugin.store.getSuggestedTaskWindow(toDateKey(now()))
        });
      });
      actions.createEl("button", { text: "新增评语", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
        void this.addMindmapComment(node.task!.id);
      });

      if (node.task.kind === "simple") {
        container.createEl("button", { text: "转为组合任务", cls: "pm-button pm-button-ghost" }).addEventListener("click", async () => {
          await this.plugin.store.updateTask(node.task!.id, {
            kind: "composite",
            subtasks: [{ title: "新子任务" }]
          });
          this.openEditTaskModal(this.plugin.store.getTask(node.task!.id) ?? node.task!);
        });
      } else {
        container.createDiv({ cls: "pm-muted", text: `当前为组合任务，共 ${node.task.subtasks.length} 个子任务。` });
      }

      const relationCard = container.createDiv({ cls: "pm-input-card" });
      relationCard.createEl("strong", { text: "上级任务" });
      const parentSelect = relationCard.createEl("select");
      parentSelect.createEl("option", { value: "", text: "挂到项目根节点" });
      const descendants = collectTaskDescendantIds(tasks, node.task.id);
      tasks
        .filter((task) => task.id !== node.task!.id && !descendants.has(task.id))
        .forEach((task) => parentSelect.createEl("option", { value: task.id, text: task.title }));
      parentSelect.value = node.task.viewState.mindmap.parentTaskId ?? "";
      parentSelect.addEventListener("change", async () => {
        await this.plugin.store.patchTask(node.task!.id, {
          viewState: {
            mindmap: {
              ...node.task!.viewState.mindmap,
              parentTaskId: parentSelect.value || null,
              childOrder: Date.now()
            }
          }
        });
      });

      const dependencyCard = container.createDiv({ cls: "pm-input-card" });
      dependencyCard.createEl("strong", { text: "依赖指向" });
      dependencyCard.createDiv({ cls: "pm-muted", text: "点击切换阻塞依赖，用于看板提示和甘特图说明。" });
      const chips = dependencyCard.createDiv({ cls: "pm-anchor-chip-list" });
      tasks
        .filter((task) => task.id !== node.task!.id)
        .forEach((task) => {
          const chip = chips.createEl("button", {
            text: task.title,
            cls: `pm-anchor-chip ${node.task!.viewState.gantt.dependencyIds.includes(task.id) ? "is-active" : ""}`
          });
          chip.addEventListener("click", async () => {
            const current = new Set(node.task!.viewState.gantt.dependencyIds);
            if (current.has(task.id)) {
              current.delete(task.id);
            } else {
              current.add(task.id);
            }
            await this.plugin.store.patchTask(node.task!.id, {
              viewState: {
                gantt: {
                  ...node.task!.viewState.gantt,
                  dependencyIds: [...current]
                }
              }
            });
          });
        });
      return;
    }

    if (node.comment) {
      container.createDiv({ cls: "pm-muted", text: "评语节点只保留导图所需内容，不展示无关状态信息。" });
      container.createEl("strong", { text: truncateText(node.comment.content, 96) });
      const actions = container.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "改写评语", cls: "pm-button pm-button-primary" }).addEventListener("click", () => {
        void this.editMindmapComment(node.comment!);
      });
      actions.createEl("button", { text: "新增子评语", cls: "pm-button pm-button-secondary" }).addEventListener("click", () => {
        void this.addMindmapComment(node.comment!.taskId, node.comment!.id);
      });
      actions.createEl("button", { text: "删除", cls: "pm-button pm-button-danger" }).addEventListener("click", () => {
        void this.deleteMindmapComment(node.comment!);
      });

      const relationCard = container.createDiv({ cls: "pm-input-card" });
      relationCard.createEl("strong", { text: "挂载到" });
      const parentSelect = relationCard.createEl("select");
      parentSelect.createEl("option", { value: "", text: "所属任务节点" });
      const task = tasks.find((item) => item.id === node.comment!.taskId);
      const descendants = collectCommentDescendantIds(task?.mindmapComments ?? [], node.comment.id);
      (task?.mindmapComments ?? [])
        .filter((comment) => comment.id !== node.comment!.id && !descendants.has(comment.id))
        .forEach((comment) => parentSelect.createEl("option", { value: comment.id, text: truncateText(comment.content, 24) }));
      parentSelect.value = node.comment.parentCommentId ?? "";
      parentSelect.addEventListener("change", async () => {
        await this.plugin.store.updateTaskMindmapComment(node.comment!.taskId, node.comment!.id, {
          parentCommentId: parentSelect.value || null,
          childOrder: Date.now()
        });
      });
    }
  }

  private buildMindmapNodes(project: Project, tasks: Task[]): MindmapNode[] {
    const rootId = `project:${project.id}`;
    const nodes: MindmapNode[] = [
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
    const nodeById = new Map<string, MindmapNode>([[rootId, nodes[0]]]);
    const childIdsByParent = new Map<string, string[]>();
    const tasksByParent = new Map<string | null, Task[]>();
    tasks.forEach((task) => {
      const parent = task.viewState.mindmap.parentTaskId ?? null;
      tasksByParent.set(parent, [...(tasksByParent.get(parent) ?? []), task]);
    });
    tasksByParent.forEach((items) => items.sort((a, b) => a.viewState.mindmap.childOrder - b.viewState.mindmap.childOrder || compareSeriesTasks(a, b)));

    tasks.forEach((task) => {
      const taskNode: MindmapNode = {
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
        const commentNode: MindmapNode = {
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
        ...task.mindmapComments
          .filter((comment) => (comment.parentCommentId ?? null) === null)
          .sort((a, b) => a.childOrder - b.childOrder)
          .map((comment) => `comment:${comment.id}`),
        ...(tasksByParent.get(task.id) ?? []).map((childTask) => `task:${childTask.id}`)
      ];
      childIdsByParent.set(`task:${task.id}`, childIds);
      task.mindmapComments.forEach((comment) => {
        const commentChildren = task.mindmapComments
          .filter((item) => (item.parentCommentId ?? null) === comment.id)
          .sort((a, b) => a.childOrder - b.childOrder)
          .map((item) => `comment:${item.id}`);
        childIdsByParent.set(`comment:${comment.id}`, commentChildren);
      });
    });

    let leafIndex = 0;
    const layoutBranch = (nodeId: string, depth: number): number => {
      const node = nodeById.get(nodeId);
      if (!node) {
        return 0;
      }
      const childIds = childIdsByParent.get(nodeId) ?? [];
      if (childIds.length === 0) {
        const fallbackY = leafIndex * MINDMAP_SIBLING_GAP;
        leafIndex += 1;
        node.x = node.type === "project" ? MINDMAP_ROOT_X : node.storedX ?? MINDMAP_ROOT_X + depth * MINDMAP_LEVEL_GAP;
        node.y = node.type === "project" ? fallbackY : node.storedY ?? fallbackY;
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

  private makeMindmapNodeDraggable(element: HTMLElement, node: MindmapNode, onPositionChange: () => void): void {
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;
    let moved = false;
    element.addEventListener("pointerdown", (event) => {
      if (node.type === "project") {
        return;
      }
      if ((event.target as HTMLElement).closest("button, select, input, textarea")) {
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

  private attachMindmapViewport(viewport: HTMLElement, content: HTMLElement): void {
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
      if ((event.target as HTMLElement).closest(".pm-mindmap-node, .tm-mindmap-node")) {
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
    const stopPanning = (event: PointerEvent): void => {
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

  private stepMindmapZoom(direction: 1 | -1): void {
    if (!this.mindmapViewport) {
      return;
    }
    const nextZoom = clamp(roundMindmapZoom(this.mindmapZoom + direction * this.mindmapZoomStep), this.mindmapMinZoom, this.mindmapMaxZoom);
    const pointX = this.mindmapViewport.clientWidth / 2;
    const pointY = this.mindmapViewport.clientHeight / 2;
    this.zoomMindmapToPoint(pointX, pointY, nextZoom);
  }

  private zoomMindmapToPoint(pointX: number, pointY: number, nextZoom: number): void {
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

  private resetMindmapView(): void {
    this.mindmapZoom = 1;
    this.mindmapPan = { x: 0, y: 0 };
    this.mindmapNeedsAutoFit = false;
    this.applyMindmapTransform();
  }

  private fitMindmapView(): void {
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

  private scheduleMindmapFit(): void {
    if (this.mindmapFitTimer !== null) {
      window.clearTimeout(this.mindmapFitTimer);
    }
    this.mindmapFitTimer = window.setTimeout(() => {
      this.mindmapFitTimer = null;
      this.fitMindmapView();
    }, 120);
  }

  private applyMindmapTransform(): void {
    if (!this.mindmapContent) {
      return;
    }
    this.mindmapContent.style.transform = `translate(${this.mindmapPan.x}px, ${this.mindmapPan.y}px) scale(${this.mindmapZoom})`;
    this.mindmapZoomLabel?.setText(`${Math.round(this.mindmapZoom * 100)}%`);
  }

  private updateMindmapViewportSize(viewport: HTMLElement): boolean {
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

  private destroyMindmapViewport(): void {
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

  private openSeriesTaskMenu(event: MouseEvent, task: Task): void {
    event.preventDefault();
    event.stopPropagation();
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("详细编辑").setIcon("square-pen").onClick(() => {
        this.openEditTaskModal(task);
      })
    );
    ([
      ["todo", "移动到待办"],
      ["doing", "移动到进行中"],
      ["blocked", "移动到阻塞"],
      ["done", "移动到已完成"]
    ] as Array<[TaskStatus, string]>).forEach(([status, label]) => {
      if (task.status === status) {
        return;
      }
      menu.addItem((item) =>
        item.setTitle(label).setIcon("arrow-right-left").onClick(async () => {
          await this.moveTaskToStatus(task, status);
        })
      );
    });
    menu.addItem((item) =>
      item.setTitle("删除").setIcon("trash-2").onClick(async () => {
        await this.plugin.store.deleteTask(task.id, "series");
      })
    );
    menu.showAtMouseEvent(event);
  }

  private async moveTaskToStatus(task: Task, status: TaskStatus): Promise<void> {
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

  private async addMindmapComment(taskId: string, parentCommentId?: string): Promise<void> {
    new TextEntryModal(this.app, {
      title: "新增评语",
      description: "这里会创建真实的导图评语节点，而不是占位文案。",
      placeholder: "输入评语内容",
      onSubmit: async (value) => {
        await this.plugin.store.addTaskMindmapComment(taskId, value, parentCommentId ?? null);
      }
    }).open();
  }

  private async editMindmapComment(comment: TaskMindmapComment): Promise<void> {
    new TextEntryModal(this.app, {
      title: "改写评语",
      initialValue: comment.content,
      placeholder: "输入新的评语内容",
      onSubmit: async (value) => {
        await this.plugin.store.updateTaskMindmapComment(comment.taskId, comment.id, { content: value });
      }
    }).open();
  }

  private async deleteMindmapComment(comment: TaskMindmapComment): Promise<void> {
    if (!window.confirm("删除该评语及其分支？")) {
      return;
    }
    await this.plugin.store.deleteTaskMindmapComment(comment.taskId, comment.id);
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
}

const MINDMAP_ROOT_X = 80;
const MINDMAP_LEVEL_GAP = 280;
const MINDMAP_SIBLING_GAP = 132;
const MINDMAP_NODE_WIDTH = 220;
const MINDMAP_NODE_HEIGHT = 84;
const MINDMAP_VIEW_PADDING = 48;
const MINDMAP_MIN_ZOOM = 0.35;
const MINDMAP_MAX_ZOOM = 1.6;
const MINDMAP_ZOOM_STEP = 0.1;
const GANTT_ROW_HEIGHT = 72;
const GANTT_HEADER_HEIGHT = 64;
const GANTT_LEFT_WIDTH = 420;
const GANTT_MIN_ZOOM = 0.4;
const GANTT_MAX_ZOOM = 2;
const GANTT_ZOOM_STEP = 0.1;

type GanttScale = "day" | "week" | "month";

type MindmapNode = {
  id: string;
  parentId?: string;
  type: "project" | "task" | "comment";
  label: string;
  summary?: string;
  task?: Task;
  comment?: TaskMindmapComment;
  x: number;
  y: number;
  width: number;
  height: number;
  storedX?: number;
  storedY?: number;
};

function buildMindmapPath(parent: MindmapNode, node: MindmapNode): string {
  const startX = parent.x + parent.width;
  const startY = parent.y + parent.height / 2;
  const endX = node.x;
  const endY = node.y + node.height / 2;
  const midX = startX + Math.max(80, (endX - startX) / 2);
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

function buildMindmapLayoutSignature(nodes: MindmapNode[]): string {
  return nodes.map((node) => `${node.id}:${node.parentId ?? ""}:${node.type}`).join("|");
}

function measureMindmapBounds(nodes: MindmapNode[]): { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number } {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundMindmapZoom(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildTaskMindmapSummary(task: Task): string {
  const summary = task.description?.replace(/\s+/g, " ").trim() ?? "";
  return summary ? truncateText(summary, 72) : "";
}

function appendBadge(container: HTMLElement, label: string, tone: string): void {
  container.createSpan({ text: label, cls: `pm-badge pm-badge-${tone}` });
}

function priorityTone(priority: Task["priority"]): string {
  if (priority === "urgent" || priority === "high") {
    return "priority-high";
  }
  if (priority === "medium") {
    return "priority-medium";
  }
  return "priority-low";
}

type GanttItem = {
  task: Task;
  startDate: string;
  endDate: string;
  progress: number;
};

type GanttHeaderCell = {
  left: number;
  width: number;
  label: string;
  tone?: "current";
};

type GanttMinorCell = {
  left: number;
  width: number;
  label: string;
  weekend: boolean;
  isToday: boolean;
};

type GanttGeometry = {
  scale: GanttScale;
  rangeStart: string;
  rangeEnd: string;
  unitWidth: number;
  contentWidth: number;
  todayX: number | null;
  majorCells: GanttHeaderCell[];
  minorCells: GanttMinorCell[];
};

function buildGanttDataSignature(projectId: string, items: GanttItem[]): string {
  return `${projectId}:${items
    .map(
      (item) =>
        `${item.task.id}:${item.task.revision}:${item.startDate}:${item.endDate}:${item.task.status}:${item.task.priority ?? ""}:${item.task.viewState.gantt.locked ? 1 : 0}:${item.task.viewState.gantt.milestone ? 1 : 0}`
    )
    .join("|")}`;
}

function fitGanttTimeline(items: GanttItem[], viewportWidth: number): { scale: GanttScale; zoom: number } {
  const spanDays = diffDateKeys(
    items.reduce((earliest, item) => (compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest), items[0].startDate),
    items.reduce((latest, item) => (compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest), items[0].endDate)
  ) + 1;
  const scale = recommendedGanttScale(spanDays);
  const { rangeStart, rangeEnd } = buildTimelineRange(
    items.reduce((earliest, item) => (compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest), items[0].startDate),
    items.reduce((latest, item) => (compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest), items[0].endDate),
    scale
  );
  const units = countTimelineUnits(rangeStart, rangeEnd, scale);
  const baseWidth = ganttBaseUnitWidth(scale);
  const zoom = clamp(roundTimelineZoom((Math.max(viewportWidth, 320) / Math.max(units * baseWidth, 1)) * 0.98), GANTT_MIN_ZOOM, GANTT_MAX_ZOOM);
  return { scale, zoom };
}

function recommendedGanttScale(spanDays: number): GanttScale {
  if (spanDays <= 14) {
    return "day";
  }
  if (spanDays <= 90) {
    return "week";
  }
  return "month";
}

function buildGanttGeometry(items: GanttItem[], scale: GanttScale, zoom: number): GanttGeometry {
  const minDate = items.reduce((earliest, item) => (compareDateKeys(item.startDate, earliest) < 0 ? item.startDate : earliest), items[0].startDate);
  const maxDate = items.reduce((latest, item) => (compareDateKeys(item.endDate, latest) > 0 ? item.endDate : latest), items[0].endDate);
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

function buildTimelineRange(minDate: string, maxDate: string, scale: GanttScale): { rangeStart: string; rangeEnd: string } {
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

function ganttBaseUnitWidth(scale: GanttScale): number {
  if (scale === "day") {
    return 48;
  }
  if (scale === "week") {
    return 160;
  }
  return 220;
}

function countTimelineUnits(rangeStart: string, rangeEnd: string, scale: GanttScale): number {
  if (scale === "day") {
    return diffDateKeys(rangeStart, rangeEnd) + 1;
  }
  if (scale === "week") {
    return Math.ceil((diffDateKeys(rangeStart, rangeEnd) + 1) / 7);
  }
  return diffMonthStarts(rangeStart, rangeEnd) + 1;
}

function timelineWidth(rangeStart: string, rangeEnd: string, scale: GanttScale, unitWidth: number): number {
  if (scale === "month") {
    const endBoundary = toDateKey(firstDayOfMonth(addMonthsDate(parseDateKey(rangeEnd), 1)));
    return Math.max(dateToTimelineX(endBoundary, rangeStart, scale, unitWidth), unitWidth);
  }
  const endBoundary = toDateKey(addDays(parseDateKey(rangeEnd), 1));
  return Math.max(dateToTimelineX(endBoundary, rangeStart, scale, unitWidth), unitWidth);
}

function buildGanttMajorCells(rangeStart: string, rangeEnd: string, scale: GanttScale, unitWidth: number): GanttHeaderCell[] {
  if (scale === "day") {
    return iterateDateKeys(rangeStart, rangeEnd).map((date) => ({
      left: dateToTimelineX(date, rangeStart, scale, unitWidth),
      width: unitWidth,
      label: date.slice(5),
      tone: isToday(date) ? "current" : undefined
    }));
  }
  if (scale === "week") {
    const cells: GanttHeaderCell[] = [];
    for (let cursor = parseDateKey(rangeStart); compareDateKeys(toDateKey(cursor), rangeEnd) <= 0; cursor = addDays(cursor, 7)) {
      const start = toDateKey(cursor);
      const end = toDateKey(addDays(cursor, 6));
      cells.push({
        left: dateToTimelineX(start, rangeStart, scale, unitWidth),
        width: unitWidth,
        label: `${start.slice(5)} ~ ${end.slice(5)}`
      });
    }
    return cells;
  }
  const cells: GanttHeaderCell[] = [];
  for (let cursor = firstDayOfMonth(parseDateKey(rangeStart)); compareDateKeys(toDateKey(cursor), rangeEnd) <= 0; cursor = addMonthsDate(cursor, 1)) {
    const start = toDateKey(cursor);
    const next = toDateKey(firstDayOfMonth(addMonthsDate(cursor, 1)));
    cells.push({
      left: dateToTimelineX(start, rangeStart, scale, unitWidth),
      width: dateToTimelineX(next, rangeStart, scale, unitWidth) - dateToTimelineX(start, rangeStart, scale, unitWidth),
      label: `${cursor.getFullYear()}年${cursor.getMonth() + 1}月`,
      tone: toMonthKey(cursor) === toMonthKey(now()) ? "current" : undefined
    });
  }
  return cells;
}

function buildGanttMinorCells(rangeStart: string, rangeEnd: string, scale: GanttScale, unitWidth: number): GanttMinorCell[] {
  if (scale === "month") {
    const cells: GanttMinorCell[] = [];
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

  const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
  return iterateDateKeys(rangeStart, rangeEnd).map((date) => {
    const current = parseDateKey(date);
    return {
      left: dateToTimelineX(date, rangeStart, scale, unitWidth),
      width: scale === "day" ? unitWidth : unitWidth / 7,
      label: scale === "day" ? getChineseWeekday(current).replace("周", "") : weekdayLabels[(current.getDay() + 6) % 7],
      weekend: isWeekend(current),
      isToday: isToday(date)
    };
  });
}

function dateToTimelineX(date: string, rangeStart: string, scale: GanttScale, unitWidth: number): number {
  if (scale === "day") {
    return diffDateKeys(rangeStart, date) * unitWidth;
  }
  if (scale === "week") {
    return (diffDateKeys(rangeStart, date) / 7) * unitWidth;
  }
  return diffMonthPosition(rangeStart, date) * unitWidth;
}

function scrollTimelineToDate(viewport: HTMLElement, geometry: GanttGeometry, date: string, alignRatio: number): void {
  const x = compareDateKeys(date, geometry.rangeStart) < 0 || compareDateKeys(date, geometry.rangeEnd) > 0 ? 0 : dateToTimelineX(date, geometry.rangeStart, geometry.scale, geometry.unitWidth);
  viewport.scrollLeft = clamp(x - viewport.clientWidth * alignRatio, 0, Math.max(geometry.contentWidth - viewport.clientWidth, 0));
}

function captureTimelineAnchor(viewport: HTMLElement, contentWidth: number, offset: number): { ratio: number; offset: number } {
  return {
    ratio: (viewport.scrollLeft + offset) / Math.max(contentWidth, 1),
    offset
  };
}

function roundTimelineZoom(value: number): number {
  return Math.round(value * 100) / 100;
}

function iterateDateKeys(start: string, end: string): string[] {
  const dates: string[] = [];
  for (let cursor = parseDateKey(start); compareDateKeys(toDateKey(cursor), end) <= 0; cursor = addDays(cursor, 1)) {
    dates.push(toDateKey(cursor));
  }
  return dates;
}

function diffDateKeys(start: string, end: string): number {
  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / (24 * 60 * 60 * 1000));
}

function addMonthsDate(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function firstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function diffMonthStarts(start: string, end: string): number {
  const startDate = parseDateKey(start);
  const endDate = parseDateKey(end);
  return (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
}

function diffMonthPosition(start: string, target: string): number {
  const startDate = parseDateKey(start);
  const targetDate = parseDateKey(target);
  const monthDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
  const dayFraction = (targetDate.getDate() - 1) / Math.max(daysInMonth(targetDate), 1);
  return monthDiff + dayFraction;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function collectTaskDescendantIds(tasks: Task[], taskId: string): Set<string> {
  const descendants = new Set<string>();
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

function collectCommentDescendantIds(comments: TaskMindmapComment[], commentId: string): Set<string> {
  const descendants = new Set<string>();
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

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  return `${value.slice(0, limit)}...`;
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

function buildYAxisValues(max: number): number[] {
  const steps = 4;
  const interval = Math.max(1, Math.ceil(max / steps));
  return Array.from({ length: steps + 1 }, (_, index) => interval * (steps - index));
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
  if (recurrence === "custom") {
    return "自定义重复";
  }
  return "单次任务";
}

function statusLabel(status: TaskStatus): string {
  const labels: Record<TaskStatus, string> = {
    todo: "待办",
    doing: "进行中",
    blocked: "阻塞",
    done: "已完成"
  };
  return labels[status] ?? "待办";
}

function priorityLabel(priority: Task["priority"]): string {
  if (priority === "urgent") {
    return "紧急";
  }
  if (priority === "high") {
    return "高";
  }
  if (priority === "medium") {
    return "中";
  }
  if (priority === "low") {
    return "低";
  }
  return "无";
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
  const { x, y } = toChartCoordinates(index, value, max);
  return `${x},${y}`;
}

function toChartCoordinates(index: number, value: number, max: number): { x: number; y: number } {
  const x = 20 + index * (860 / 29);
  const y = valueToChartY(value, max);
  return { x, y };
}

function valueToChartY(value: number, max: number): number {
  return 210 - (value / max) * 170;
}

function scheduleSummary(task: Task): string {
  const total = task.occurrenceDates.length;
  const range = total > 1 ? `${task.occurrenceDates[0]} -> ${task.occurrenceDates[total - 1]}` : task.date;
  const time = task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "未排期";
  return `${range} | ${time} | 共 ${total} 次`;
}

function defaultCompletionDate(task: Task): string {
  return task.recurrenceUntil ?? task.occurrenceDates[task.occurrenceDates.length - 1] ?? task.date;
}

function completionSummary(task: Task): string {
  const totalSteps = task.kind === "composite" ? task.occurrenceDates.length * task.subtasks.length : task.occurrenceDates.length;
  const completedSteps =
    task.kind === "composite"
      ? task.occurrenceStates.reduce((sum, state) => sum + (state.completedSubtaskIds?.length ?? 0), 0)
      : task.occurrenceStates.length;
  const ratio = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
  const label = task.kind === "composite" ? "子任务" : "次";
  return `${completedSteps}/${totalSteps} ${label} · ${ratio}%`;
}

function seriesProgress(task: Task): number {
  const totalSteps = task.kind === "composite" ? task.occurrenceDates.length * task.subtasks.length : task.occurrenceDates.length;
  const completedSteps =
    task.kind === "composite"
      ? task.occurrenceStates.reduce((sum, state) => sum + (state.completedSubtaskIds?.length ?? 0), 0)
      : task.occurrenceStates.length;
  return totalSteps === 0 ? 0 : completedSteps / totalSteps;
}

function isTaskSeriesCompleted(task: Task): boolean {
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
