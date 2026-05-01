import { ItemView, WorkspaceLeaf } from "obsidian";
import type ProjectManagementPlugin from "../main";

export abstract class BaseProjectView extends ItemView {
  protected plugin: ProjectManagementPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: ProjectManagementPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  async onOpen(): Promise<void> {
    this.registerEvent(this.plugin.store.on("changed", () => this.render()));
    await this.render();
  }

  abstract render(): Promise<void>;
}
