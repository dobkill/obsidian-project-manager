import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { ProjectManagementStore } from "../storage/store";

type BulkImportModalOptions = {
  title: string;
  store: ProjectManagementStore;
  projectId?: string;
  defaultDate: string;
};

export class BulkImportModal extends Modal {
  private options: BulkImportModalOptions;

  constructor(app: App, options: BulkImportModalOptions) {
    super(app);
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("pm-modal", "pm-bulk-import-modal");
    contentEl.createEl("h2", { text: this.options.title });
    const projectName = this.options.projectId ? this.options.store.getProject(this.options.projectId)?.name ?? "当前项目" : "";
    contentEl.createDiv({
      cls: "pm-import-guide",
      text: this.options.projectId
        ? `当前处于项目导入模式：未显式切换项目时，任务会按“${projectName}”处理。同名任务会覆盖；如果时间冲突，会自动改成同日 1 分钟空档占位。- [x] 默认完成当天，repeat 任务可用 finish:series 提前结束整个系列。`
        : "支持 #项目：新项目名 自动建项目；同名任务会覆盖；如果时间冲突，会自动改成同日 1 分钟空档占位。- [x] 默认完成当天，repeat 任务可用 finish:series 提前结束整个系列。"
    });

    const state = {
      text: "",
      defaultDate: this.options.defaultDate
    };

    new Setting(contentEl)
      .setName("默认日期")
      .addText((text) =>
        text.setValue(state.defaultDate).onChange((value) => {
          state.defaultDate = value.trim();
          renderPreview();
        })
      );

    const input = contentEl.createEl("textarea", {
      cls: "pm-bulk-import-input",
      placeholder:
        "#项目：插件体验示例\n- [ ] 开发任务解析器 @2026-05-18 09:00-10:30 #parser !high status:doing\n  - 解析标题\n  - 解析日期\n- [x] 每周复盘导入流程 @2026-05-18 20:00-20:30 #review status:done repeat:weekly count:4 finish:series"
    });
    input.addEventListener("input", () => {
      state.text = input.value;
      renderPreview();
    });

    const previewEl = contentEl.createDiv({ cls: "pm-import-preview" });
    const renderPreview = (): void => {
      previewEl.empty();
      const preview = this.options.store.previewFormattedTasks(state.text, {
        projectId: this.options.projectId,
        defaultDate: state.defaultDate
      });
      previewEl.createDiv({
        cls: "pm-muted",
        text: `解析 ${preview.summary.total} 条，问题 ${preview.issues.length} 条`
      });
      const summaryGrid = previewEl.createDiv({ cls: "pm-import-summary-grid" });
      [
        ["新增任务", String(preview.summary.createCount)],
        ["覆盖任务", String(preview.summary.overwriteCount)],
        ["完成今日", String(preview.summary.completeTodayCount)],
        ["提前结束", String(preview.summary.completeSeriesCount)],
        ["组合任务", String(preview.summary.composite)],
        ["已勾选完成", String(preview.summary.completed)]
      ].forEach(([label, value]) => {
        const card = summaryGrid.createDiv({ cls: "pm-import-summary-card" });
        card.createDiv({ cls: "pm-muted", text: label });
        card.createEl("strong", { text: value });
      });
      if (preview.summary.newProjectNames.length > 0) {
        previewEl.createDiv({
          cls: "pm-import-project-hint",
          text: `将自动新建项目：${preview.summary.newProjectNames.join("、")}`
        });
      }
      if (preview.tasks.length > 0) {
        const list = previewEl.createEl("ul", { cls: "pm-import-preview-list" });
        preview.tasks.slice(0, 12).forEach((task) => {
          const line = [
            importActionText(task.action),
            task.projectName ?? "未归属项目",
            task.input.completed ? "已勾选完成" : task.input.status === "doing" ? "进行中" : task.input.status === "blocked" ? "阻塞" : "待办",
            task.input.date,
            task.input.startTime && task.input.endTime ? `${task.input.startTime}-${task.input.endTime}` : "未排期"
          ].join(" · ");
          list.createEl("li", { text: `${task.input.title} · ${line}` });
        });
      }
      if (preview.issues.length > 0) {
        const issueList = previewEl.createEl("ul", { cls: "pm-import-issues" });
        preview.issues.slice(0, 8).forEach((issue) => {
          issueList.createEl("li", { text: `第 ${issue.line} 行：${issue.message}` });
        });
      }
    };

    const footer = contentEl.createDiv({ cls: "pm-modal-actions" });
    new ButtonComponent(footer)
      .setButtonText("导入")
      .setCta()
      .onClick(async () => {
        try {
          const created = await this.options.store.importFormattedTasks(state.text, {
            projectId: this.options.projectId,
            defaultDate: state.defaultDate
          });
          new Notice(`已处理 ${created.length} 条任务`);
          this.close();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "导入失败");
        }
      });
    new ButtonComponent(footer).setButtonText("取消").onClick(() => this.close());
    renderPreview();
  }
}

function importActionText(action: "create" | "overwrite" | "overwrite-and-complete-today" | "overwrite-and-complete-series"): string {
  if (action === "overwrite-and-complete-series") {
    return "覆盖并提前结束";
  }
  if (action === "overwrite-and-complete-today") {
    return "覆盖并完成今日";
  }
  if (action === "overwrite") {
    return "覆盖";
  }
  return "新增";
}
