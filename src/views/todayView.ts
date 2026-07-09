import { Menu, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { renderCompositeOccurrenceCards } from "../components/compositeTaskCards";
import { TaskModal } from "../components/taskModal";
import type ProjectManagementPlugin from "../main";
import { Task, TaskOccurrence } from "../types";
import { copyTextToClipboard } from "../utils/clipboard";
import { now, toDateKey } from "../utils/date";
import { BaseProjectView } from "./base";
import {
  SINGLE_TASK_RECURRENCE_COUNT,
  isActionableOccurrence,
  isAttentionOccurrence,
  recurrenceLabel as formatRecurrenceLabel,
  statusLabel as formatStatusLabel
} from "../domain/taskRules";
import { getTaskExecutionProgress, occurrenceExecutionLabel } from "../domain/occurrenceSchedule";
import {
  CompositeDisplayOccurrence,
  buildCompositeDisplayOccurrences,
  isSyntheticCompositeOccurrence,
  summarizeOccurrenceDisplay
} from "./compositeDisplay";

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
    const displayTasks = buildCompositeDisplayOccurrences(tasks, this.plugin.store.getAllTasks());
    const projects = this.plugin.store.getProjects();
    const todayDoingTasks = tasks.filter((task) => task.kind === "simple" && task.status === "doing");
    const totalSteps = todayDoingTasks.reduce((sum, task) => sum + task.totalSteps, 0);
    const completedSteps = todayDoingTasks.reduce((sum, task) => sum + task.completedSteps, 0);
    const progress = totalSteps === 0 ? 0 : Math.round((completedSteps / totalSteps) * 100);
    const rawIncomplete = tasks.filter(isActionableOccurrence);

    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "今日任务" });
    title.createDiv({ text: today, cls: "pm-muted" });
    const actions = header.createDiv({ cls: "pm-inline-actions" });
    const exportButton = actions.createEl("button", { text: "导出今日任务", cls: "pm-button pm-button-secondary" });
    exportButton.addEventListener("click", async () => this.copyIncompleteTasks(rawIncomplete));
    const addButton = actions.createEl("button", { text: "+ 新增任务", cls: "pm-button pm-button-primary" });
    addButton.addEventListener("click", () => {
      const suggested = this.plugin.store.getSuggestedTaskWindow(today);
      new TaskModal(this.app, {
        title: "新增今日任务",
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
    progressBody.createDiv({ cls: "pm-muted", text: "今日进度" });
    progressBody.createEl("strong", { text: `${completedSteps} / ${totalSteps} 步` });
    progressBody.createDiv({ cls: "pm-muted", text: todayDoingTasks.length === 0 ? "今天没有进行中的任务。" : `${todayDoingTasks.length} 个进行中任务，完成率 ${progress}%` });
    const progressBar = progressBody.createDiv({ cls: "pm-progress-bar" });
    progressBar.createDiv({
      cls: "pm-progress-bar-fill",
      attr: { style: `width: ${progress}%` }
    });

    const incomplete = displayTasks
      .map((item) => ({
        occurrence: item.occurrence,
        childOccurrences: item.childOccurrences.filter(isActionableOccurrence)
      }))
      .filter((item) => isActionableOccurrence(item.occurrence) || item.childOccurrences.length > 0);
    const attention = displayTasks
      .map((item) => ({
        occurrence: item.occurrence,
        childOccurrences: item.childOccurrences.filter(isAttentionOccurrence)
      }))
      .filter((item) => isAttentionOccurrence(item.occurrence) || (item.occurrence.kind === "composite" && item.childOccurrences.length === 0) || item.childOccurrences.length > 0);
    const complete = displayTasks.filter((item) => summarizeOccurrenceDisplay(item.occurrence, item.childOccurrences).completed);

    this.renderTaskSection(container, "未完成", incomplete, {
      emptyTitle: "今天暂时没有未完成任务",
      emptyBody: "已经清空待办时，这里会保持专注而安静。"
    });
    this.renderTaskSection(container, "留意", attention, {
      emptyTitle: "没有需要留意的任务",
      emptyBody: "待办、阻塞和空容器会集中到这一栏。"
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
    copy.createDiv({ cls: "pm-muted", text: "导出按钮会复制极简今日清单；把某一行改成已完成后粘回快速记录，会只完成今天已有任务。" });
  }

  private async copyIncompleteTasks(tasks: TaskOccurrence[]): Promise<void> {
    if (tasks.length === 0) {
      new Notice("今天没有未完成任务可导出");
      return;
    }
    const text = this.plugin.store.exportTasksAsMinimalCompletionText(tasks);
    await copyTextToClipboard(text);
    new Notice("已复制今日未完成任务");
  }

  private renderTaskSection(
    container: HTMLElement,
    title: string,
    tasks: CompositeDisplayOccurrence[],
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
            new Notice(error instanceof Error ? error.message : "更新失败");
          }
        });
      }

      const copy = main.createDiv({ cls: "pm-task-copy" });
      copy.createEl("div", { text: task.title, cls: `pm-task-title ${displayProgress.completed ? "is-complete" : ""}` });
      const meta = copy.createDiv({ cls: "pm-task-meta" });
      appendBadge(meta, task.startTime && task.endTime ? `${task.startTime}-${task.endTime}` : "未排期", "muted");
      appendBadge(meta, recurrenceLabel(task), "repeat");
      appendBadge(meta, statusLabel(task.status), `status-${task.status}`);
      const executionLabel = occurrenceExecutionLabel(task);
      if (executionLabel) {
        appendBadge(meta, executionLabel, "repeat");
      }
      appendBadge(meta, this.plugin.store.getProject(task.projectId)?.name ?? "未归属项目", "tag");
      if (task.kind === "composite") {
        appendBadge(meta, `${displayProgress.completedSteps}/${displayProgress.totalSteps} 子项`, "priority-medium");
        this.renderSubtasks(copy, task, item.childOccurrences);
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
    this.openOccurrenceEditor(seriesTask, task);
  }

  private openSeriesEditor(seriesTask: Task): void {
    new TaskModal(this.app, {
      title: "编辑任务",
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
        completed: isTaskSeriesCompleted(seriesTask)
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

  private openCreateChildTaskModal(parent: Task): void {
    new TaskModal(this.app, {
      title: "新增子任务",
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

  private openOccurrenceEditor(seriesTask: Task, task: TaskOccurrence): void {
    new TaskModal(this.app, {
      title: "编辑任务",
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

  private renderSubtasks(container: HTMLElement, task: TaskOccurrence, childOccurrences: TaskOccurrence[] = []): void {
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
          new Notice(error instanceof Error ? error.message : "更新失败");
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
  if (task.recurrence === "daily" && task.recurrenceCount === SINGLE_TASK_RECURRENCE_COUNT && !task.recurrenceUntil) {
    return "单次任务";
  }
  return formatRecurrenceLabel(task.recurrence);
}

function statusLabel(status: TaskOccurrence["status"]): string {
  return formatStatusLabel(status);
}

function isTaskSeriesCompleted(task: Task): boolean {
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
