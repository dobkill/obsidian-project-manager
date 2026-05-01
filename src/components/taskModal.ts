import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { Project, Task, TaskDeleteScope, TaskInput, TaskOccurrence, TaskRecurrence, TaskUpdateScope } from "../types";

type TaskModalOptions = {
  title: string;
  projects: Project[];
  initial: TaskInput;
  existingTask?: Task;
  occurrenceContext?: TaskOccurrence;
  onSubmit: (input: TaskInput, scope: TaskUpdateScope) => Promise<void>;
  onDelete?: (scope: TaskDeleteScope) => Promise<void>;
  onCompleteSeries?: () => Promise<void>;
};

export class TaskModal extends Modal {
  private options: TaskModalOptions;

  constructor(app: App, options: TaskModalOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal");
    contentEl.createEl("h2", { text: this.options.title });

    const state: TaskInput = { ...this.options.initial };
    const saveScope: TaskUpdateScope = "series";

    if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      contentEl.createDiv({
        cls: "pm-muted",
        text: this.options.occurrenceContext
          ? `当前正在查看 ${this.options.occurrenceContext.occurrenceDate} 这次发生，但保存会更新整条重复任务。`
          : "当前编辑的是整条重复任务，下面的日期与重复规则会一起更新全部发生时间。"
      });
    }

    new Setting(contentEl)
      .setName("标题")
      .addText((text) =>
        text
          .setPlaceholder("输入任务标题")
          .setValue(state.title)
          .onChange((value) => {
            state.title = value;
          })
      );

    new Setting(contentEl)
      .setName("描述")
      .addTextArea((text) =>
        text.setValue(state.description ?? "").onChange((value) => {
          state.description = value;
        })
      );

    new Setting(contentEl)
      .setName("日期")
      .addText((text) =>
        text.setPlaceholder("YYYY-MM-DD").setValue(state.date).onChange((value) => {
          state.date = value;
        })
      );

    new Setting(contentEl)
      .setName("开始时间")
      .addText((text) =>
        text.setPlaceholder("07:00").setValue(state.startTime ?? "").onChange((value) => {
          state.startTime = value || undefined;
        })
      );

    new Setting(contentEl)
      .setName("结束时间")
      .addText((text) =>
        text.setPlaceholder("07:30").setValue(state.endTime ?? "").onChange((value) => {
          state.endTime = value || undefined;
        })
      );

    new Setting(contentEl)
      .setName("所属项目")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "未归属项目");
        this.options.projects.forEach((project) => dropdown.addOption(project.id, project.name));
        dropdown.setValue(state.projectId ?? "");
        dropdown.onChange((value) => {
          state.projectId = value || undefined;
        });
      });

    new Setting(contentEl)
      .setName("重复类型")
      .setDesc("单次、每日重复、每周此时重复")
      .addDropdown((dropdown) => {
        const labels: Record<TaskRecurrence, string> = {
          once: "单次任务",
          daily: "每日重复",
          weekly: "每周此时重复"
        };
        (Object.keys(labels) as TaskRecurrence[]).forEach((key) => dropdown.addOption(key, labels[key]));
        dropdown.setValue(state.recurrence);
        dropdown.onChange((value) => {
          state.recurrence = value as TaskRecurrence;
          if (state.recurrence === "once") {
            state.recurrenceCount = null;
            state.recurrenceUntil = null;
          }
        });
      });

    new Setting(contentEl)
      .setName("重复次数")
      .setDesc("重复任务至少填写次数或结束日期之一")
      .addText((text) =>
        text.setPlaceholder("例如 10").setValue(state.recurrenceCount ? String(state.recurrenceCount) : "").onChange((value) => {
          state.recurrenceCount = value.trim() ? Number(value) : null;
        })
      );

    new Setting(contentEl)
      .setName("重复结束日期")
      .addText((text) =>
        text.setPlaceholder("YYYY-MM-DD").setValue(state.recurrenceUntil ?? "").onChange((value) => {
          state.recurrenceUntil = value.trim() || null;
        })
      );

    new Setting(contentEl)
      .setName("完成状态")
      .addToggle((toggle) =>
        toggle.setValue(Boolean(state.completed)).onChange((value) => {
          state.completed = value;
        })
      );

    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new ButtonComponent(footer)
      .setButtonText("保存")
      .setCta()
      .onClick(async () => {
        try {
          await this.options.onSubmit(state, saveScope);
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "保存失败");
        }
      });

    if (this.options.onDelete) {
      new ButtonComponent(footer)
        .setButtonText("删除本次")
        .setWarning()
        .onClick(async () => {
          await this.options.onDelete?.("single");
          this.close();
        });

      if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
        new ButtonComponent(footer)
          .setButtonText(this.options.occurrenceContext ? "删除整个任务" : "删除整个任务")
          .setWarning()
          .onClick(async () => {
            await this.options.onDelete?.("series");
            this.close();
          });
      }
    }

    if (this.options.onCompleteSeries && this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      new ButtonComponent(footer)
        .setButtonText("到本次为止结束重复")
        .onClick(async () => {
          await this.options.onCompleteSeries?.();
          this.close();
        });
    }
  }
}
