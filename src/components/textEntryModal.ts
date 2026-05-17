import { App, ButtonComponent, Modal, Notice } from "obsidian";

type TextEntryModalOptions = {
  title: string;
  description?: string;
  placeholder?: string;
  confirmText?: string;
  initialValue?: string;
  onSubmit: (value: string) => Promise<void>;
};

export class TextEntryModal extends Modal {
  private options: TextEntryModalOptions;

  constructor(app: App, options: TextEntryModalOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
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
    new ButtonComponent(footer)
      .setButtonText(this.options.confirmText ?? "保存")
      .setCta()
      .onClick(async () => {
        try {
          await this.options.onSubmit(textarea.value);
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "保存失败");
        }
      });
    new ButtonComponent(footer).setButtonText("取消").onClick(() => this.close());
  }
}
