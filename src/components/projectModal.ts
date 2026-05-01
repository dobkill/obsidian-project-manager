import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { ProjectInput, ProjectStatus } from "../types";

type ProjectModalOptions = {
  title: string;
  initial: ProjectInput;
  onSubmit: (input: ProjectInput) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export class ProjectModal extends Modal {
  private options: ProjectModalOptions;

  constructor(app: App, options: ProjectModalOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal");
    contentEl.createEl("h2", { text: this.options.title });

    const state: ProjectInput = { ...this.options.initial };

    new Setting(contentEl)
      .setName("项目名称")
      .addText((text) =>
        text.setValue(state.name ?? "").onChange((value) => {
          state.name = value;
        })
      );

    new Setting(contentEl)
      .setName("项目描述")
      .addTextArea((text) =>
        text.setValue(state.description ?? "").onChange((value) => {
          state.description = value;
        })
      );

    new Setting(contentEl)
      .setName("项目颜色")
      .addText((text) =>
        text.setPlaceholder("#4f8cff").setValue(state.color ?? "").onChange((value) => {
          state.color = value;
        })
      );

    new Setting(contentEl)
      .setName("项目状态")
      .addDropdown((dropdown) => {
        const statuses: ProjectStatus[] = ["active", "paused", "completed", "archived"];
        statuses.forEach((status) => dropdown.addOption(status, status));
        dropdown.setValue(state.status ?? "active");
        dropdown.onChange((value) => {
          state.status = value as ProjectStatus;
        });
      });

    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new ButtonComponent(footer)
      .setButtonText("保存")
      .setCta()
      .onClick(async () => {
        try {
          await this.options.onSubmit(state);
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "保存失败");
        }
      });

    if (this.options.onDelete) {
      new ButtonComponent(footer)
        .setButtonText("删除项目")
        .setWarning()
        .onClick(async () => {
          await this.options.onDelete?.();
          this.close();
        });
    }
  }
}
