import { Notice, WorkspaceLeaf } from "obsidian";
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
    const visibleTasks = this.plugin.settings.showCompletedTasks ? tasks : tasks.filter((task) => !task.completed);
    const totalSteps = tasks.reduce((sum, task) => sum + task.totalSteps, 0);
    const completedSteps = tasks.reduce((sum, task) => sum + task.completedSteps, 0);
    const progress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);

    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "今日任务" });
    title.createDiv({ text: today, cls: "pm-muted" });
    const addButton = header.createEl("button", { text: "新增任务", cls: "mod-cta" });
    addButton.addEventListener("click", () => {
      const suggested = this.plugin.store.getSuggestedTaskWindow(today);
      new TaskModal(this.app, {
        title: "新增今日任务",
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
    progressSection.createEl("h3", { text: "今日进度" });
    if (tasks.length === 0) {
      progressSection.createDiv({ cls: "pm-empty", text: "今天还没有任务，先新增一条开始吧。" });
    } else {
      progressSection.createDiv({ cls: "pm-muted", text: `${completedSteps} / ${totalSteps} 步 · ${progress}%` });
      progressSection.createDiv({ cls: "pm-progress-bar" }).createDiv({
        cls: "pm-progress-bar-fill",
        attr: { style: `width: ${progress}%` }
      });
    }

    const incomplete = visibleTasks.filter((task) => !task.completed);
    const complete = visibleTasks.filter((task) => task.completed);
    this.renderTaskSection(container, "未完成", incomplete);
    this.renderTaskSection(container, "已完成", complete);
  }

  private renderTaskSection(container: HTMLElement, title: string, tasks: TaskOccurrence[]): void {
    const section = container.createDiv({ cls: "pm-section" });
    section.createEl("h3", { text: `${title} (${tasks.length})` });

    if (tasks.length === 0) {
      section.createDiv({ cls: "pm-empty", text: "暂无任务" });
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
            new Notice(error instanceof Error ? error.message : "更新失败");
          }
        });
      }

      const info = left.createDiv({ cls: "pm-task-copy" });
      info.createEl("div", { text: task.title, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = info.createDiv({ cls: "pm-task-meta" });
      meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "未排期" });
      meta.createSpan({ text: recurrenceLabel(task) });
      const project = this.plugin.store.getProject(task.projectId);
      meta.createSpan({ text: project?.name ?? "未归属项目" });
      if (task.kind === "composite") {
        meta.createSpan({ text: `${task.completedSteps}/${task.totalSteps} 子任务` });
      }
      this.renderSubtasks(info, task);

      const actions = row.createDiv({ cls: "pm-task-actions" });
      actions.createEl("button", { text: "编辑" }).addEventListener("click", () => this.openEditor(task));
      actions.createEl("button", { text: "删除", cls: "mod-warning" }).addEventListener("click", async () => {
        await this.plugin.store.deleteTaskOccurrence(task.taskId, task.date);
      });
      if (task.recurrence !== "once") {
        actions.createEl("button", { text: "提前结束系列" }).addEventListener("click", async () => {
          await this.plugin.store.completeTaskSeries(task.taskId, task.date);
        });
      }
    });
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

function recurrenceLabel(task: TaskOccurrence): string {
  if (task.recurrence === "daily") {
    return "每日重复";
  }
  if (task.recurrence === "weekly") {
    return "每周此时重复";
  }
  return "单次任务";
}

function isTaskSeriesCompleted(task: Task): boolean {
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
