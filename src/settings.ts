import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ProjectManagementPlugin from "./main";

const IMPORT_SAMPLE_TEXT = [
  "#项目：英语四级冲刺",
  "- [ ] 搭建复习看板 @2026-05-18 09:00-10:30 #planning !high status:doing",
  "  - 整理词汇任务",
  "  - 安排阅读计划",
  "- [ ] 模考复盘 @2026-05-19 19:30-21:00 #mock !medium status:todo repeat:weekly count:4",
  "- [x] 提交报名材料 @2026-05-17 18:00-18:30 #admin status:done",
  "#项目：写作素材库",
  "- [ ] 修订作文模板 @2026-05-20 20:00-21:30 #writing !urgent status:blocked",
  "- [x] 周复盘总任务 @2026-05-21 21:00-21:30 #review status:done repeat:weekly count:6 finish:series",
  "#项目：",
  "- [ ] 补一条未归属临时任务 @2026-05-18 22:00-22:30 #adhoc status:todo"
].join("\n");

export class ProjectManagementSettingTab extends PluginSettingTab {
  plugin: ProjectManagementPlugin;

  constructor(app: App, plugin: ProjectManagementPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "项目管理插件设置" });
    const doc = containerEl.createDiv({ cls: "pm-settings-doc" });
    doc.createEl("h3", { text: "批量导入数据范例" });
    doc.createDiv({
      cls: "pm-muted",
      text: "这里的范例可直接编辑、实时观察导入效果，但不会保存；每次重新打开设置页都会恢复默认展示内容。"
    });
    const sampleInput = doc.createEl("textarea", { cls: "pm-settings-sample-input" });
    sampleInput.value = IMPORT_SAMPLE_TEXT;
    const insight = doc.createDiv({ cls: "pm-settings-preview" });
    const renderSamplePreview = (): void => {
      insight.empty();
      const preview = this.plugin.store.previewFormattedTasks(sampleInput.value, {
        defaultDate: "2026-05-18"
      });
      const statusCount = preview.tasks.reduce<Record<string, number>>((counts, task) => {
        const key = task.input.status ?? "todo";
        counts[key] = (counts[key] ?? 0) + 1;
        return counts;
      }, {});
      const dates = preview.tasks.map((task) => task.input.date).sort();
      const summary = insight.createDiv({ cls: "pm-settings-preview-grid" });
      [
        ["表格任务数", String(preview.summary.total)],
        ["覆盖/新增", `${preview.summary.overwriteCount}/${preview.summary.createCount}`],
        ["看板列分布", `待办 ${statusCount.todo ?? 0} · 进行中 ${statusCount.doing ?? 0} · 阻塞 ${statusCount.blocked ?? 0} · 已完成 ${statusCount.done ?? 0}`],
        ["甘特跨度", dates.length > 0 ? `${dates[0]} -> ${dates[dates.length - 1]}` : "暂无"],
        ["完成统计", `已勾选 ${preview.summary.completed}，组合任务 ${preview.summary.composite}`],
        ["项目变化", preview.summary.newProjectNames.length > 0 ? `会新建 ${preview.summary.newProjectNames.join("、")}` : "全部项目已存在或未归属"]
      ].forEach(([label, value]) => {
        const card = summary.createDiv({ cls: "pm-settings-preview-card" });
        card.createDiv({ cls: "pm-muted", text: label });
        card.createEl("strong", { text: value });
      });

      const notes = insight.createDiv({ cls: "pm-settings-preview-notes" });
      [
        "表格视图会展示标题、状态、优先级、标签、重复规则与完成进度。",
        "看板会按照 status:todo / doing / blocked / done 自动分列。",
        "甘特图直接读取日期和时间范围；repeat 任务会保留系列信息。",
        "思维导图的评语节点、任务挂载关系和依赖关系，导入后继续在项目进度页或快速记录页补充。"
      ].forEach((item) => notes.createEl("div", { text: item, cls: "pm-settings-note-item" }));

      if (preview.issues.length > 0) {
        const issueList = insight.createEl("ul", { cls: "pm-import-issues" });
        preview.issues.slice(0, 6).forEach((issue) => {
          issueList.createEl("li", { text: `第 ${issue.line} 行：${issue.message}` });
        });
      }
    };
    sampleInput.addEventListener("input", renderSamplePreview);
    doc.createEl("h3", { text: "导入后会呈现什么" });
    const list = doc.createEl("ul");
    [
      "表格视图会展示标题、状态、优先级、标签、重复规则和组合任务进度。",
      "看板视图会按 status:todo / doing / blocked / done 自动分列。",
      "甘特图会直接读取日期和时间范围生成时间轴条带。",
      "已完成统计会把 - [x] 任务直接计入完成数量与完成率，repeat 任务还支持 finish:series 提前结束整个系列。",
      "思维导图会先生成任务节点；评语节点、任务父子关系和依赖关系在项目进度页或快速记录页继续补充。"
    ].forEach((item) => list.createEl("li", { text: item }));
    renderSamplePreview();

    new Setting(containerEl)
      .setName("数据目录路径")
      .setDesc("必须是当前 Vault 内相对路径。目标目录已有有效插件数据时会直接加载；目录不存在、为空或插件数据损坏时会用当前数据创建新文件。")
      .addText((text) =>
        text.setValue(this.plugin.settings.dataFolder).onChange(async (value) => {
          this.plugin.pendingSettings.dataFolder = value.trim();
        })
      )
      .addButton((button) =>
        button.setButtonText("应用").setCta().onClick(async () => {
          const path = this.plugin.pendingSettings.dataFolder ?? this.plugin.settings.dataFolder;
          const validation = await this.plugin.store.validateDataFolder(path);
          if (!validation.ok) {
            new Notice(validation.message ?? "数据目录不可用");
            return;
          }
          await this.plugin.updateSettings({ dataFolder: path });
          new Notice("数据目录已更新");
        })
      );

    new Setting(containerEl)
      .setName("活跃度 Tab 名称")
      .addText((text) =>
        text.setValue(this.plugin.settings.overviewTab1Name).onChange(async (value) => {
          await this.plugin.updateSettings({ overviewTab1Name: value.trim() || "活跃度" });
        })
      );

    new Setting(containerEl)
      .setName("项目进度 Tab 名称")
      .addText((text) =>
        text.setValue(this.plugin.settings.overviewTab2Name).onChange(async (value) => {
          await this.plugin.updateSettings({ overviewTab2Name: value.trim() || "项目进度" });
        })
      );

    new Setting(containerEl)
      .setName("快速记录页名称")
      .addText((text) =>
        text.setValue(this.plugin.settings.dialogTabName).onChange(async (value) => {
          await this.plugin.updateSettings({ dialogTabName: value.trim() || "快速记录" });
        })
      );

    new Setting(containerEl)
      .setName("日记文件夹")
      .setDesc("按天生成日记时使用的 Vault 内相对路径。")
      .addText((text) =>
        text.setValue(this.plugin.settings.dailyNoteFolder).onChange(async (value) => {
          await this.plugin.updateSettings({ dailyNoteFolder: value.trim() || "日记" });
        })
      );

    new Setting(containerEl)
      .setName("日记保存方式")
      .setDesc("默认每天一个文件；也可以把快速记录统一追加到一个汇总文件。")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("per-day", "每天一个文件")
          .addOption("single-file", "汇总到单文件")
          .setValue(this.plugin.settings.dailyNoteMode)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ dailyNoteMode: value as typeof this.plugin.settings.dailyNoteMode });
          });
      });

    new Setting(containerEl)
      .setName("日记汇总文件")
      .setDesc("日记保存方式为“汇总到单文件”时使用，例如：日记/快速记录.md。")
      .addText((text) =>
        text.setValue(this.plugin.settings.dailyNoteSingleFilePath).onChange(async (value) => {
          await this.plugin.updateSettings({ dailyNoteSingleFilePath: value.trim() || "日记/快速记录.md" });
        })
      );

    new Setting(containerEl)
      .setName("最近笔记数量")
      .setDesc("快速记录追加任意笔记时显示的最近修改文件数量。")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.taskNoteRecentLimit)).onChange(async (value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) {
            await this.plugin.updateSettings({ taskNoteRecentLimit: Math.min(30, Math.floor(parsed)) });
          }
        })
      );

    new Setting(containerEl)
      .setName("快速记录默认目标")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("daily-note", "写入每日日记")
          .addOption("task-note", "追加到任务笔记")
          .addOption("quick-task", "快速创建任务")
          .addOption("mindmap", "扩充思维导图")
          .setValue(this.plugin.settings.defaultDialogTarget)
          .onChange(async (value) => {
            await this.plugin.updateSettings({ defaultDialogTarget: value as typeof this.plugin.settings.defaultDialogTarget });
          });
      });

    new Setting(containerEl)
      .setName("时间粒度")
      .setDesc("MVP 默认 15 分钟")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.timeSlotMinutes)).onChange(async (value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) {
            await this.plugin.updateSettings({ timeSlotMinutes: parsed });
          }
        })
      );

    new Setting(containerEl)
      .setName("默认任务时长")
      .setDesc("单位：分钟")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.defaultTaskDurationMinutes)).onChange(async (value) => {
          const parsed = Number(value);
          if (Number.isFinite(parsed) && parsed > 0) {
            await this.plugin.updateSettings({ defaultTaskDurationMinutes: parsed });
          }
        })
      );

    new Setting(containerEl)
      .setName("默认开始时间")
      .setDesc("当某一天尚无已排期任务时，新增任务默认从该时间开始")
      .addText((text) =>
        text.setValue(this.plugin.settings.defaultTaskStartTime).onChange(async (value) => {
          if (/^\d{2}:\d{2}$/.test(value.trim())) {
            await this.plugin.updateSettings({ defaultTaskStartTime: value.trim() });
          }
        })
      );

    new Setting(containerEl)
      .setName("显示已完成任务")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showCompletedTasks).onChange(async (value) => {
          await this.plugin.updateSettings({ showCompletedTasks: value });
        })
      );
  }
}
