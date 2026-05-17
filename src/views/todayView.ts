import { Menu, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { TaskModal } from "../components/taskModal";
import type ProjectManagementPlugin from "../main";
import { Task, TaskOccurrence } from "../types";
import { now, toDateKey } from "../utils/date";
import { BaseProjectView } from "./base";

export const TODAY_VIEW_TYPE = "project-management-today-view";

export class TodayTasksView extends BaseProjectView {
  constructor(leaf: WorkspaceLeaf, plugin: ProjectManagementPlugin) {
    super(leaf, plugin);
  }

  getViewType(): string {
    return TODAY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "今日任务";
  }

  getIcon(): string {
    return "check-square";
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("pm-view", "pm-today-view");

    const today = toDateKey(now());
    const tasks = this.plugin.store.getTasksForDate(today);
    const projects = this.plugin.store.getProjects();
    const totalSteps = tasks.reduce((sum, task) => sum + task.totalSteps, 0);
    const completedSteps = tasks.reduce((sum, task) => sum + task.completedSteps, 0);
    const progress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "今日任务" });
    title.createDiv({ text: today, cls: "pm-muted" });
    const actions = header.createDiv({ cls: "pm-inline-actions" });
    const exportButton = actions.createEl("button", { text: "导出今日任务", cls: "pm-button pm-button-secondary" });
    exportButton.addEventListener("click", async () => this.copyIncompleteTasks(incomplete));
    const addButton = actions.createEl("button", { text: "+ 新增任务", cls: "pm-button pm-button-primary" });
    addButton.addEventListener("click", () => {
      const suggested = this.plugin.store.getSuggestedTaskWindow(today);
      new TaskModal(this.app, {
        title: "新增今日任务",
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
    progressBody.createDiv({ cls: "pm-muted", text: "今日进度" });
    progressBody.createEl("strong", { text: `${completedSteps} / ${totalSteps} 步` });
    progressBody.createDiv({ cls: "pm-muted", text: tasks.length === 0 ? "今天还没有任务，先新增一条开始吧。" : `${tasks.length} 个任务，完成率 ${progress}%` });
    const progressBar = progressBody.createDiv({ cls: "pm-progress-bar" });
    progressBar.createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${progress}%` }
    });

    const incomplete = tasks.filter((task) => !task.completed);
    const complete = tasks.filter((task) => task.completed);

    this.renderTaskSection(container, "未完成", incomplete, {
      emptyTitle: "今天暂时没有未完成任务",
      emptyBody: "已经清空待办时，这里会保持专注而安静。"
    });
    this.renderTaskSection(container, "已完成", complete, {
      emptyTitle: "完成任务后会显示在这里",
      emptyBody: "完成的任务会自动汇总到这一栏，方便你快速回顾。"
    });

    const tipCard = container.createDiv({ cls: "pm-tip-card" });
    const icon = tipCard.createDiv({ cls: "pm-tip-icon" });
    setIcon(icon, "sparkles");
    const copy = tipCard.createDiv();
    copy.createEl("strong", { text: "小贴士" });
    copy.createDiv({ cls: "pm-muted", text: "导出按钮会直接复制今天仍未完成的任务，方便回贴或二次整理。" });
  }

  private async copyIncompleteTasks(tasks: TaskOccurrence[]): Promise<void> {
    if (tasks.length === 0) {
      new Notice("今天没有未完成任务可导出");
      return;
    }
    const text = this.plugin.store.exportTasksAsFormattedText(tasks, "current");
    await copyTextToClipboard(text);
    new Notice("已复制今日未完成任务");
  }

  private renderTaskSection(
    container: HTMLElement,
    title: string,
    tasks: TaskOccurrence[],
    emptyState: { emptyTitle: string; emptyBody: string }
  ): void {
    const section = container.createDiv({ cls: "pm-section pm-task-section" });
    const header = section.createDiv({ cls: "pm-section-header" });
    header.createEl("h3", { text: `${title} (${tasks.length})` });

    if (tasks.length === 0) {
      const empty = section.createDiv({ cls: "pm-empty-state-card" });
      const icon = empty.createDiv({ cls: "pm-empty-state-icon" });
      setIcon(icon, "badge-check");
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
          new Notice(error instanceof Error ? error.message : "更新失败");
        }
      });

      const copy = main.createDiv({ cls: "pm-task-copy" });
      copy.createEl("div", { text: task.title, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = copy.createDiv({ cls: "pm-task-meta" });
      appendBadge(meta, task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "未排期", "muted");
      appendBadge(meta, recurrenceLabel(task), "repeat");
      appendBadge(meta, statusLabel(task.status), `status-${task.status}`);
      appendBadge(meta, this.plugin.store.getProject(task.projectId)?.name ?? "未归属项目", "tag");
      if (task.kind === "composite") {
        appendBadge(meta, `${task.completedSteps}/${task.totalSteps} 子项`, "priority-medium");
        this.renderSubtasks(copy, task);
      }

      const actions = row.createDiv({ cls: "pm-task-card-actions" });
      const moreButton = actions.createEl("button", { cls: "pm-icon-button", attr: { "aria-label": "更多操作" } });
      setIcon(moreButton, "ellipsis");
      moreButton.addEventListener("click", (event) => this.openTaskMenu(event, task));
    });
  }

  private openTaskMenu(event: MouseEvent, task: TaskOccurrence): void {
    event.preventDefault();
    event.stopPropagation();
    const menu = new Menu();
    menu.addItem((item) =>
      item.setTitle("编辑任务").setIcon("square-pen").onClick(() => {
        this.openEditor(task);
      })
    );
    if (task.recurrence !== "once") {
      menu.addItem((item) =>
        item.setTitle("提前结束系列").setIcon("calendar-x").onClick(async () => {
          await this.plugin.store.completeTaskSeries(task.taskId, task.date);
        })
      );
    }
    menu.addItem((item) =>
      item.setTitle("删除").setIcon("trash-2").onClick(async () => {
        await this.plugin.store.deleteTaskOccurrence(task.taskId, task.date);
      })
    );
    menu.showAtMouseEvent(event);
  }

  private openEditor(task: TaskOccurrence): void {
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

  private renderSubtasks(container: HTMLElement, task: TaskOccurrence): void {
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
          new Notice(error instanceof Error ? error.message : "更新失败");
        }
      });
    });
  }
}

function renderProgressRing(container: HTMLElement, progress: number): void {
  const ring = container.createDiv({ cls: "pm-progress-ring" });
  ring.style.setProperty("--pm-progress", String(progress));
  ring.createDiv({ cls: "pm-progress-ring-inner", text: `${progress}%` });
}

function appendBadge(container: HTMLElement, label: string, tone: string): void {
  container.createSpan({ text: label, cls: `pm-badge pm-badge-${tone}` });
}

function recurrenceLabel(task: TaskOccurrence): string {
  if (task.recurrence === "daily") {
    return "每日重复";
  }
  if (task.recurrence === "weekly") {
    return "每周此时重复";
  }
  if (task.recurrence === "custom") {
    return "自定义重复";
  }
  return "单次任务";
}

function statusLabel(status: TaskOccurrence["status"]): string {
  if (status === "doing") {
    return "进行中";
  }
  if (status === "blocked") {
    return "阻塞";
  }
  if (status === "done") {
    return "已完成";
  }
  return "待办";
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

async function copyTextToClipboard(text: string): Promise<void> {
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
    throw new Error("复制失败，请检查系统剪贴板权限");
  }
}
