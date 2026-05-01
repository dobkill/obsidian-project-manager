import { Notice, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_CONFIG, ProjectManagementStore } from "./storage/store";
import { ProjectManagementSettingTab } from "./settings";
import { PluginConfig } from "./types";
import { OVERVIEW_VIEW_TYPE, OverviewView } from "./views/overviewView";
import { TODAY_VIEW_TYPE, TodayTasksView } from "./views/todayView";

export default class ProjectManagementPlugin extends Plugin {
  settings: PluginConfig = { ...DEFAULT_CONFIG };
  pendingSettings: Partial<PluginConfig> = {};
  store!: ProjectManagementStore;

  async onload(): Promise<void> {
    await this.loadPluginSettings();
    this.store = new ProjectManagementStore(this.app, this.settings);

    try {
      await this.store.initialize();
      this.settings = this.store.getConfig();
      await this.savePluginSettings();
    } catch (error) {
      console.error(error);
      new Notice(error instanceof Error ? error.message : "插件初始化失败");
    }

    this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new OverviewView(leaf, this));
    this.registerView(TODAY_VIEW_TYPE, (leaf) => new TodayTasksView(leaf, this));

    this.addRibbonIcon("layout-dashboard", "打开项目总览", async () => {
      await this.activateOverviewView();
    });
    this.addRibbonIcon("check-square", "打开今日任务", async () => {
      await this.activateTodayView();
    });

    this.addCommand({
      id: "open-project-overview",
      name: "打开项目总览",
      callback: async () => this.activateOverviewView()
    });

    this.addCommand({
      id: "open-today-tasks",
      name: "打开今日任务",
      callback: async () => this.activateTodayView()
    });

    this.addSettingTab(new ProjectManagementSettingTab(this.app, this));
  }

  async onunload(): Promise<void> {
    await this.app.workspace.detachLeavesOfType(OVERVIEW_VIEW_TYPE);
    await this.app.workspace.detachLeavesOfType(TODAY_VIEW_TYPE);
  }

  async updateSettings(patch: Partial<PluginConfig>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    this.pendingSettings = {};
    await this.savePluginSettings();
    await this.store.setConfig(this.settings);
  }

  private async loadPluginSettings(): Promise<void> {
    const loaded = await this.loadData();
    this.settings = { ...DEFAULT_CONFIG, ...(loaded ?? {}) };
  }

  private async savePluginSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async activateOverviewView(): Promise<void> {
    await this.activateInMainArea(OVERVIEW_VIEW_TYPE);
  }

  private async activateTodayView(): Promise<void> {
    await this.activateInRightSidebar(TODAY_VIEW_TYPE);
  }

  private async activateInMainArea(type: string): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(type);
    const misplacedLeaves = leaves.filter((leaf) => leaf.getRoot() === this.app.workspace.rightSplit);
    await Promise.all(misplacedLeaves.map((leaf) => leaf.detach()));

    const existingLeaf = leaves.find((leaf) => leaf.getRoot() !== this.app.workspace.rightSplit);
    const leaf = existingLeaf ?? this.app.workspace.getLeaf(true);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  private async activateInRightSidebar(type: string): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(type);
    const misplacedLeaves = leaves.filter((leaf) => leaf.getRoot() !== this.app.workspace.rightSplit);
    await Promise.all(misplacedLeaves.map((leaf) => leaf.detach()));

    const existingLeaf = leaves.find((leaf) => leaf.getRoot() === this.app.workspace.rightSplit);
    const leaf = existingLeaf ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      return;
    }
    await leaf.setViewState({ type, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}
