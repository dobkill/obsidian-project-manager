import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { Project, Task, TaskDeleteScope, TaskInput, TaskKind, TaskOccurrence, TaskPriority, TaskRecurrence, TaskStatus, TaskSubtaskInput, TaskUpdateScope } from "../types";

type TaskModalOptions = {
  title: string;
  projects: Project[];
  initial: TaskInput;
  existingTask?: Task;
  occurrenceContext?: TaskOccurrence;
  allowSingleDelete?: boolean;
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
    state.kind = state.kind ?? "simple";
    state.subtasks = [...(state.subtasks ?? [])];

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
      .setName("任务类型")
      .setDesc("普通任务直接勾选完成；组合任务可拆成多个子任务分别完成")
      .addDropdown((dropdown) => {
        const labels: Record<TaskKind, string> = {
          simple: "普通任务",
          composite: "组合任务"
        };
        (Object.keys(labels) as TaskKind[]).forEach((key) => dropdown.addOption(key, labels[key]));
        dropdown.setValue(state.kind ?? "simple");
        dropdown.onChange((value) => {
          state.kind = value as TaskKind;
          state.subtasks = state.kind === "composite" ? state.subtasks ?? [{ title: "" }] : [];
          renderSubtaskFields();
        });
      });

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
      .setName("状态")
      .addDropdown((dropdown) => {
        const labels: Record<TaskStatus, string> = {
          todo: "待办",
          doing: "进行中",
          blocked: "阻塞",
          done: "已完成"
        };
        (Object.keys(labels) as TaskStatus[]).forEach((key) => dropdown.addOption(key, labels[key]));
        dropdown.setValue(state.status ?? "todo");
        dropdown.onChange((value) => {
          state.status = value as TaskStatus;
        });
      });

    new Setting(contentEl)
      .setName("优先级")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "无");
        const labels: Record<TaskPriority, string> = {
          low: "低",
          medium: "中",
          high: "高",
          urgent: "紧急"
        };
        (Object.keys(labels) as TaskPriority[]).forEach((key) => dropdown.addOption(key, labels[key]));
        dropdown.setValue(state.priority ?? "");
        dropdown.onChange((value) => {
          state.priority = (value || undefined) as TaskPriority | undefined;
        });
      });

    new Setting(contentEl)
      .setName("标签")
      .setDesc("多个标签用逗号分隔")
      .addText((text) =>
        text.setPlaceholder("例如 parser, ui").setValue((state.tags ?? []).join(", ")).onChange((value) => {
          state.tags = value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
        })
      );

    new Setting(contentEl)
      .setName("重复类型")
      .setDesc("单次、每日重复、每周此时重复")
      .addDropdown((dropdown) => {
        const labels: Array<[TaskRecurrence, string]> = [
          ["once", "单次任务"],
          ["daily", "每日重复"],
          ["weekly", "每周此时重复"]
        ];
        labels.forEach(([key, label]) => dropdown.addOption(key, label));
        dropdown.setValue(state.recurrence);
        dropdown.onChange((value) => {
          state.recurrence = value as TaskRecurrence;
          if (state.recurrence === "once") {
            state.recurrenceCount = null;
            state.recurrenceUntil = null;
          }
          renderRecurrenceFields();
        });
      });

    const recurrenceFields = contentEl.createDiv();
    const subtaskFields = contentEl.createDiv();
    const renderRecurrenceFields = (): void => {
      recurrenceFields.empty();
      if (state.recurrence === "once") {
        return;
      }
      new Setting(recurrenceFields)
        .setName("重复次数")
        .setDesc("重复任务至少填写次数或结束日期之一")
        .addText((text) =>
          text.setPlaceholder("例如 10").setValue(state.recurrenceCount ? String(state.recurrenceCount) : "").onChange((value) => {
            state.recurrenceCount = value.trim() ? Number(value) : null;
          })
        );

      new Setting(recurrenceFields)
        .setName("重复结束日期")
        .addText((text) =>
          text.setPlaceholder("YYYY-MM-DD").setValue(state.recurrenceUntil ?? "").onChange((value) => {
            state.recurrenceUntil = value.trim() || null;
          })
        );
    };
    renderRecurrenceFields();

    const renderSubtaskFields = (): void => {
      subtaskFields.empty();
      if (state.kind !== "composite") {
        return;
      }

      subtaskFields.addClass("pm-subtask-editor");
      subtaskFields.createDiv({ cls: "pm-muted", text: "组合任务会在周任务图和今日任务中渲染为一个大框，内部子任务可单独勾选完成。" });

      const list = subtaskFields.createDiv({ cls: "pm-subtask-editor-list" });
      const subtasks = state.subtasks ?? [];
      subtasks.forEach((subtask, index) => {
        const row = list.createDiv({ cls: "pm-subtask-editor-row" });
        row.createSpan({ cls: "pm-subtask-editor-index", text: `${index + 1}.` });
        const input = row.createEl("input", {
          type: "text",
          placeholder: `子任务 ${index + 1}`
        });
        input.value = subtask.title;
        input.addEventListener("input", () => {
          subtasks[index] = {
            ...subtasks[index],
            title: input.value
          };
          state.subtasks = [...subtasks];
        });
        row.createEl("button", { text: "删除", cls: "mod-warning" }).addEventListener("click", () => {
          subtasks.splice(index, 1);
          state.subtasks = [...subtasks];
          renderSubtaskFields();
        });
      });

      const actions = subtaskFields.createDiv({ cls: "pm-inline-actions" });
      actions.createEl("button", { text: "新增子任务" }).addEventListener("click", () => {
        state.subtasks = [...(state.subtasks ?? []), { title: "" } satisfies TaskSubtaskInput];
        renderSubtaskFields();
      });
    };
    renderSubtaskFields();

    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new ButtonComponent(footer)
      .setButtonText(this.options.occurrenceContext ? "保存整条系列" : "保存")
      .setCta()
      .onClick(async () => {
        try {
          await this.options.onSubmit(state, "series");
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "保存失败");
        }
      });

    if (this.options.occurrenceContext && this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
      new ButtonComponent(footer)
        .setButtonText("仅保存本次时间")
        .onClick(async () => {
          try {
            await this.options.onSubmit(state, "occurrence");
            this.close();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "保存失败");
          }
        });
    }

    if (this.options.onDelete) {
      if (this.options.allowSingleDelete) {
        new ButtonComponent(footer)
          .setButtonText("删除本次实例")
          .setWarning()
          .onClick(async () => {
            await this.options.onDelete?.("single");
            this.close();
          });
      }

      if (this.options.existingTask?.occurrenceDates.length && this.options.existingTask.occurrenceDates.length > 1) {
        new ButtonComponent(footer)
          .setButtonText("删除整个系列")
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
