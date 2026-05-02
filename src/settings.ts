import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type ProjectManagementPlugin from "./main";

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
