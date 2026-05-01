import { App, Modal } from "obsidian";
import { Project, TaskOccurrence } from "../types";

type DayTasksModalOptions = {
  date: string;
  tasks: TaskOccurrence[];
  getProject: (projectId?: string) => Project | undefined;
};

export class DayTasksModal extends Modal {
  private options: DayTasksModalOptions;

  constructor(app: App, options: DayTasksModalOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal");
    contentEl.createEl("h2", { text: this.options.date });
    contentEl.createEl("div", { cls: "pm-muted", text: `相关任务 ${this.options.tasks.length} 条` });

    if (this.options.tasks.length === 0) {
      contentEl.createDiv({ cls: "pm-empty", text: "当天没有相关任务。" });
      return;
    }

    const list = contentEl.createDiv({ cls: "pm-task-list" });
    this.options.tasks.forEach((task) => {
      const row = list.createDiv({ cls: "pm-task-row" });
      const copy = row.createDiv({ cls: "pm-task-copy" });
      copy.createEl("div", { text: `${task.completed ? "✓" : "○"} ${task.title}`, cls: `pm-task-title ${task.completed ? "is-complete" : ""}` });
      const meta = copy.createDiv({ cls: "pm-task-meta" });
      meta.createSpan({ text: task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : "未排期" });
      meta.createSpan({ text: recurrenceLabel(task) });
      meta.createSpan({ text: this.options.getProject(task.projectId)?.name ?? "未归属项目" });
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
