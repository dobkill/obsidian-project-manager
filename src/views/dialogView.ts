import { Notice, TFile, TFolder, WorkspaceLeaf, normalizePath, setIcon } from "obsidian";
import { EntitySuggestModal } from "../components/entitySuggestModal";
import type ProjectManagementPlugin from "../main";
import { DialogTarget, Task } from "../types";
import { now, toDateKey } from "../utils/date";
import { BaseProjectView } from "./base";

export const DIALOG_VIEW_TYPE = "project-management-dialog-view";

type MindmapInsertMode = "inside" | "child";

type QuickTargetCard = {
  value: DialogTarget;
  label: string;
  desc: string;
  icon: string;
};

type MindmapAnchorOption = {
  taskId: string;
  commentId: string | null;
  projectId: string;
  label: string;
  note: string;
  taskTitle: string;
  pathLabel: string;
  kind: "task" | "comment";
};

type MindmapProjectOption = {
  id: string;
  label: string;
  note: string;
};

type RecentMindmapTarget = {
  taskId: string;
  commentId: string | null;
};

export class QuickDialogView extends BaseProjectView {
  private static recentMindmapTargets: RecentMindmapTarget[] = [];

  private target: DialogTarget = "daily-note";
  private selectedMindmapProjectId = "";
  private selectedTaskId = "";
  private selectedCommentId = "";
  private selectedNotePath = "";
  private draftContent = "";
  private mindmapInsertMode: MindmapInsertMode = "child";

  constructor(leaf: WorkspaceLeaf, plugin: ProjectManagementPlugin) {
    super(leaf, plugin);
    this.target = plugin.settings.defaultDialogTarget;
  }

  getViewType(): string {
    return DIALOG_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.plugin.settings.dialogTabName;
  }

  getIcon(): string {
    return "message-square-plus";
  }

  async render(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("pm-view", "pm-dialog-view");

    const tasks = sortTasksForMindmapSelection(this.plugin.store.getAllTasks(), (task) => this.projectNameForTask(task));
    const recentFiles = this.getRecentMarkdownFiles();
    const mindmapProjects = buildMindmapProjectOptions(tasks, (task) => this.projectNameForTask(task));
    this.ensureDialogSelections(tasks, recentFiles, mindmapProjects);
    const projectTasks = this.selectedMindmapProjectId
      ? tasks.filter((task) => mindmapProjectKey(task) === this.selectedMindmapProjectId)
      : [];
    const projectNodeOptions = buildMindmapAnchorOptions(projectTasks);
    const selectedNode = this.ensureMindmapNodeSelection(projectNodeOptions);
    const recentNodeOptions = this.resolveRecentMindmapTargets(buildMindmapAnchorOptions(tasks));

    const header = container.createDiv({ cls: "pm-page-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "快速记录" });
    title.createDiv({ cls: "pm-muted", text: "快速记录、写日记、追加任意笔记，或给思维导图补充评语。" });

    const targetCards = container.createDiv({ cls: "pm-dialog-target-grid" });
    getTargetCards().forEach((item) => {
      const card = targetCards.createEl("button", {
        cls: `pm-dialog-target ${this.target === item.value ? "is-active" : ""}`
      });
      const icon = card.createDiv({ cls: "pm-dialog-target-icon" });
      setIcon(icon, item.icon);
      card.createSpan({ cls: "pm-dialog-target-title", text: item.label });
      card.createSpan({ cls: "pm-dialog-target-desc", text: item.desc });
      card.addEventListener("click", () => {
        this.target = item.value;
        this.render();
      });
    });

    if (this.target === "daily-note") {
      this.renderPathCard(container, {
        icon: "calendar-days",
        title: "写入位置",
        path: this.resolveDailyNotePath(),
        muted: this.plugin.settings.dailyNoteMode === "single-file" ? "单文件模式" : "按日生成 Markdown 文件"
      });
    }

    if (this.target === "task-note") {
      this.renderTaskNoteControls(container, recentFiles);
    }

    if (this.target === "mindmap") {
      this.renderMindmapControls(container, mindmapProjects, projectNodeOptions, recentNodeOptions, selectedNode);
    }

    if (this.target === "quick-task") {
      const importHint = container.createDiv({ cls: "pm-input-card" });
      const hintHeader = importHint.createDiv({ cls: "pm-input-card-header" });
      hintHeader.createEl("strong", { text: "任务导入规则" });
      hintHeader.createDiv({ cls: "pm-muted", text: "这套语法与项目页批量导入、今日任务导出完全互通。" });
      [
        "可用 #项目：新项目名 自动建项目；#项目： 会导入为未归属任务。",
        "同项目下若任务名重复，会直接覆盖旧任务，而不是重复新增；若时间冲突，会自动改成同日 1 分钟空档占位。",
        "勾选 - [x] 默认只完成当天；repeat 任务加 finish:series 可提前结束整个系列。"
      ].forEach((item) => importHint.createDiv({ cls: "pm-settings-note-item", text: item }));
    }

    const editorCard = container.createDiv({ cls: "pm-editor-card" });
    const editorHeader = editorCard.createDiv({ cls: "pm-editor-header" });
    const editorCopy = editorHeader.createDiv();
    editorCopy.createEl("h3", { text: "内容编辑" });
    editorCopy.createDiv({ cls: "pm-muted", text: editorHint(this.target, this.mindmapInsertMode) });

    const textarea = editorCard.createEl("textarea", {
      cls: "pm-dialog-input",
      placeholder: this.placeholderForTarget()
    });
    textarea.value = this.draftContent;
    textarea.addEventListener("input", () => {
      this.draftContent = textarea.value;
      const counter = editorCard.querySelector(".pm-editor-count");
      if (counter instanceof HTMLElement) {
        counter.setText(`字数：${this.draftContent.length}`);
      }
    });

    const toolbar = editorCard.createDiv({ cls: "pm-editor-toolbar" });
    const toolActions: Array<{ label: string; action: ToolbarAction }> = [
      { label: "B", action: "bold" },
      { label: "I", action: "italic" },
      { label: "H", action: "heading" },
      { label: "列表", action: "list" },
      { label: "引用", action: "quote" },
      { label: "代码", action: "code" }
    ];
    toolActions.forEach((item) => {
      const button = toolbar.createEl("button", { text: item.label, cls: "pm-button pm-button-ghost pm-editor-tool" });
      button.addEventListener("click", () => {
        applyEditorFormat(textarea, item.action);
        this.draftContent = textarea.value;
        const counter = editorCard.querySelector(".pm-editor-count");
        if (counter instanceof HTMLElement) {
          counter.setText(`字数：${this.draftContent.length}`);
        }
      });
    });

    const footer = editorCard.createDiv({ cls: "pm-editor-footer" });
    footer.createDiv({ cls: "pm-editor-count pm-muted", text: `字数：${this.draftContent.length}` });
    const submitButton = footer.createEl("button", { text: "提交内容", cls: "pm-button pm-button-primary" });
    submitButton.addEventListener("click", async () => {
      try {
        await this.submit(this.draftContent, tasks);
        this.draftContent = "";
        textarea.value = "";
        footer.querySelector(".pm-editor-count")?.setText("字数：0");
        new Notice("已保存");
      } catch (error) {
        new Notice(error instanceof Error ? error.message : "保存失败");
      }
    });
  }

  private renderTaskNoteControls(container: HTMLElement, recentFiles: TFile[]): void {
    const pathCard = this.renderPathCard(container, {
      icon: "file-text",
      title: "目标文件",
      path: this.selectedNotePath || "请选择 Markdown 文件",
      muted: "支持最近文件快捷选择，也可以手动输入 Vault 内路径。"
    });
    const actions = pathCard.createDiv({ cls: "pm-path-actions" });
    const pickerButton = actions.createEl("button", { cls: "pm-button pm-button-secondary pm-path-button" });
    setIcon(pickerButton, "folder-open");
    pickerButton.title = "选择文件";
    pickerButton.addEventListener("click", () => {
      new EntitySuggestModal<TFile>(this.app, {
        items: recentFiles,
        placeholder: "选择 Markdown 文件",
        emptyStateText: "没有可选的 Markdown 文件",
        getItemText: (file) => file.basename,
        getItemNote: (file) => file.path,
        onChoose: (file) => {
          this.selectedNotePath = file.path;
          this.render();
        }
      }).open();
    });

    const inputCard = container.createDiv({ cls: "pm-input-card" });
    inputCard.createDiv({ cls: "pm-muted", text: "手动路径" });
    const pathInput = inputCard.createEl("input", {
      type: "text",
      value: this.selectedNotePath,
      placeholder: "例如：Projects/英语四级.md"
    });
    pathInput.addEventListener("input", () => {
      this.selectedNotePath = pathInput.value.trim();
      const pathEl = pathCard.querySelector(".pm-path-value");
      if (pathEl instanceof HTMLElement) {
        pathEl.setText(this.selectedNotePath || "请选择 Markdown 文件");
      }
    });
  }

  private renderMindmapControls(
    container: HTMLElement,
    projects: MindmapProjectOption[],
    nodeOptions: MindmapAnchorOption[],
    recentNodeOptions: MindmapAnchorOption[],
    selectedNode?: MindmapAnchorOption
  ): void {
    const project = projects.find((item) => item.id === this.selectedMindmapProjectId);
    const projectCard = this.renderPathCard(container, {
      icon: "folders",
      title: "目标项目",
      path: project?.label ?? "请选择项目",
      muted: project?.note ?? "先选择项目，再展开该项目下的任务节点和评语节点。"
    });
    const projectActions = projectCard.createDiv({ cls: "pm-path-actions" });
    const projectPicker = projectActions.createEl("button", { cls: "pm-button pm-button-secondary pm-path-button" });
    setIcon(projectPicker, "folder-tree");
    projectPicker.title = "选择项目";
    projectPicker.addEventListener("click", () => {
      new EntitySuggestModal<MindmapProjectOption>(this.app, {
        items: projects,
        placeholder: "先选择项目",
        emptyStateText: "暂无可补充导图的项目",
        getItemText: (item) => item.label,
        getItemNote: (item) => item.note,
        onChoose: (item) => {
          this.selectedMindmapProjectId = item.id;
          this.selectedTaskId = "";
          this.selectedCommentId = "";
          this.render();
        }
      }).open();
    });

    const nodeCard = this.renderPathCard(container, {
      icon: "workflow",
      title: "目标节点",
      path: selectedNode?.pathLabel ?? "请选择导图节点",
      muted: selectedNode?.note ?? "当前项目内的任务节点与评语节点都会在这里展示。"
    });
    const nodeActions = nodeCard.createDiv({ cls: "pm-path-actions" });
    const nodePicker = nodeActions.createEl("button", { cls: "pm-button pm-button-secondary pm-path-button" });
    nodePicker.disabled = nodeOptions.length === 0;
    setIcon(nodePicker, "list-tree");
    nodePicker.title = "选择节点";
    nodePicker.addEventListener("click", () => {
      new EntitySuggestModal<MindmapAnchorOption>(this.app, {
        items: nodeOptions,
        placeholder: "选择项目内的任务或评语节点",
        emptyStateText: "当前项目下暂无可用节点",
        getItemGroup: (item) => item.taskTitle,
        getItemText: (item) => item.label,
        getItemNote: (item) => item.note,
        onChoose: (item) => {
          this.selectMindmapNode(item);
          this.render();
        }
      }).open();
    });

    const modeTabs = container.createDiv({ cls: "pm-segmented-control" });
    [
      ["child", "创建子节点"],
      ["inside", "追加到节点正文"]
    ].forEach(([value, label]) => {
      const button = modeTabs.createEl("button", {
        text: label,
        cls: `pm-segmented-item ${this.mindmapInsertMode === value ? "is-active" : ""}`
      });
      button.addEventListener("click", () => {
        this.mindmapInsertMode = value as MindmapInsertMode;
        this.render();
      });
    });

    const shortcutCard = container.createDiv({ cls: "pm-input-card" });
    const shortcutHeader = shortcutCard.createDiv({ cls: "pm-input-card-header" });
    shortcutHeader.createEl("strong", { text: "快捷节点" });
    shortcutHeader.createDiv({ cls: "pm-muted", text: "跨任务共享，只保留最近使用的 6 个节点，并标注所属任务。" });
    const shortcuts = shortcutCard.createDiv({ cls: "pm-anchor-chip-list pm-anchor-shortcut-list" });
    if (recentNodeOptions.length === 0) {
      shortcuts.createDiv({ cls: "pm-muted", text: "还没有快捷节点，保存过一次导图补充后会出现在这里。" });
    } else {
      recentNodeOptions.forEach((option) => {
        const chip = shortcuts.createEl("button", {
          cls: `pm-anchor-chip pm-anchor-shortcut ${
            selectedNode?.taskId === option.taskId && selectedNode?.commentId === option.commentId ? "is-active" : ""
          }`
        });
        chip.title = `${option.taskTitle} · ${option.note}`;
        chip.createSpan({ cls: "pm-anchor-shortcut-task", text: option.taskTitle });
        chip.createSpan({ cls: "pm-anchor-shortcut-label", text: option.kind === "task" ? "任务节点" : option.pathLabel });
        chip.addEventListener("click", () => {
          this.selectedMindmapProjectId = option.projectId;
          this.selectMindmapNode(option);
          this.render();
        });
      });
    }
  }

  private renderPathCard(
    container: HTMLElement,
    options: { icon: string; title: string; path: string; muted: string }
  ): HTMLElement {
    const card = container.createDiv({ cls: "pm-path-card" });
    const icon = card.createDiv({ cls: "pm-path-icon" });
    setIcon(icon, options.icon);
    const body = card.createDiv({ cls: "pm-path-copy" });
    body.createDiv({ cls: "pm-path-label pm-muted", text: options.title });
    body.createDiv({ cls: "pm-path-value", text: options.path });
    body.createDiv({ cls: "pm-path-note pm-muted", text: options.muted });
    return card;
  }

  private ensureDialogSelections(tasks: Task[], recentFiles: TFile[], projects: MindmapProjectOption[]): void {
    if ((!this.selectedTaskId || !tasks.some((task) => task.id === this.selectedTaskId)) && tasks.length > 0) {
      this.selectedTaskId = tasks[0].id;
      this.selectedCommentId = "";
    }
    if ((!this.selectedNotePath || !recentFiles.some((file) => file.path === this.selectedNotePath)) && recentFiles.length > 0) {
      this.selectedNotePath = recentFiles[0].path;
    }
    if ((!this.selectedMindmapProjectId || !projects.some((project) => project.id === this.selectedMindmapProjectId)) && tasks.length > 0) {
      const selectedTask = tasks.find((task) => task.id === this.selectedTaskId);
      this.selectedMindmapProjectId = selectedTask ? mindmapProjectKey(selectedTask) : projects[0]?.id ?? "";
    }
  }

  private projectNameForTask(task: Task): string {
    return task.projectId ? this.plugin.store.getProject(task.projectId)?.name ?? "未归属项目" : "未归属项目";
  }

  private placeholderForTarget(): string {
    if (this.target === "quick-task") {
      return "#项目：新的学习计划\n- [ ] 快速任务 @2026-05-18 09:00-10:00 #tag !high status:doing\n- [x] 每周回顾 @2026-05-18 20:00-20:30 #review status:done repeat:weekly count:4 finish:series";
    }
    if (this.target === "mindmap") {
      return this.mindmapInsertMode === "inside"
        ? "输入后会追加到当前节点正文…"
        : "每一行会创建为一个评语子节点，例如：\n今天阅读效率不错\n语法题需要单独复盘";
    }
    if (this.target === "task-note") {
      return "在此输入或粘贴内容…";
    }
    return "在此输入或粘贴内容…";
  }

  private async submit(content: string, tasks: Task[]): Promise<void> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error("内容不能为空");
    }
    if (this.target === "daily-note") {
      await this.appendDailyNote(trimmed);
      return;
    }
    if (this.target === "quick-task") {
      await this.plugin.store.importFormattedTasks(trimmed, {
        defaultDate: toDateKey(now()),
        source: {
          id: crypto.randomUUID(),
          type: "dialog",
          syncMode: "import-only",
          lastSyncedAt: new Date().toISOString()
        },
        historySummary: "从快速记录创建任务"
      });
      return;
    }
    if (this.target === "task-note") {
      await this.appendMarkdownNote(this.selectedNotePath, trimmed);
      return;
    }
    const selected = this.plugin.store.getTask(this.selectedTaskId) ?? tasks.find((task) => task.id === this.selectedTaskId);
    if (!selected) {
      throw new Error("请先选择导图节点");
    }
    if (this.mindmapInsertMode === "inside") {
      await this.appendToMindmapNode(selected, trimmed);
      this.recordRecentMindmapTarget(selected.id, this.selectedCommentId || null);
      return;
    }
    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      await this.plugin.store.addTaskMindmapComment(selected.id, line.replace(/^-\s*/, ""), this.selectedCommentId || null);
    }
    this.recordRecentMindmapTarget(selected.id, this.selectedCommentId || null);
  }

  private ensureMindmapNodeSelection(options: MindmapAnchorOption[]): MindmapAnchorOption | undefined {
    const selected =
      options.find((option) => option.taskId === this.selectedTaskId && option.commentId === (this.selectedCommentId || null)) ?? options[0];
    if (!selected) {
      this.selectedTaskId = "";
      this.selectedCommentId = "";
      return undefined;
    }
    this.selectMindmapNode(selected);
    return selected;
  }

  private selectMindmapNode(option: MindmapAnchorOption): void {
    this.selectedTaskId = option.taskId;
    this.selectedCommentId = option.commentId ?? "";
  }

  private resolveRecentMindmapTargets(allNodeOptions: MindmapAnchorOption[]): MindmapAnchorOption[] {
    const lookup = new Map(allNodeOptions.map((option) => [`${option.taskId}::${option.commentId ?? ""}`, option]));
    QuickDialogView.recentMindmapTargets = QuickDialogView.recentMindmapTargets.filter((item) =>
      lookup.has(`${item.taskId}::${item.commentId ?? ""}`)
    );
    return QuickDialogView.recentMindmapTargets
      .map((item) => lookup.get(`${item.taskId}::${item.commentId ?? ""}`))
      .filter((item): item is MindmapAnchorOption => Boolean(item))
      .slice(0, 6);
  }

  private recordRecentMindmapTarget(taskId: string, commentId: string | null): void {
    const key = `${taskId}::${commentId ?? ""}`;
    QuickDialogView.recentMindmapTargets = [
      { taskId, commentId },
      ...QuickDialogView.recentMindmapTargets.filter((item) => `${item.taskId}::${item.commentId ?? ""}` !== key)
    ].slice(0, 6);
  }

  private async appendToMindmapNode(task: Task, content: string): Promise<void> {
    const latestTask = this.plugin.store.getTask(task.id);
    if (!latestTask) {
      throw new Error("目标任务不存在");
    }
    if (this.selectedCommentId) {
      const comment = latestTask.mindmapComments.find((item) => item.id === this.selectedCommentId);
      if (!comment) {
        throw new Error("评语节点不存在");
      }
      await this.plugin.store.updateTaskMindmapComment(latestTask.id, comment.id, {
        content: joinParagraphs(comment.content, content)
      });
      return;
    }
    await this.plugin.store.updateTask(latestTask.id, {
      description: joinParagraphs(latestTask.description ?? "", content)
    });
  }

  private resolveDailyNotePath(): string {
    return this.plugin.settings.dailyNoteMode === "single-file"
      ? normalizePath(this.plugin.settings.dailyNoteSingleFilePath)
      : normalizePath(`${this.plugin.settings.dailyNoteFolder}/${toDateKey(now())}.md`);
  }

  private async appendDailyNote(content: string): Promise<void> {
    await this.appendMarkdownNote(this.resolveDailyNotePath(), content);
  }

  private async appendMarkdownNote(path: string, content: string): Promise<void> {
    const filePath = normalizePath(path.trim());
    if (!filePath || filePath.endsWith("/")) {
      throw new Error("请选择或输入有效的 Markdown 文件路径");
    }
    await this.ensureParentFolder(filePath);
    const existing = await this.app.vault.adapter.read(filePath).catch(() => "");
    const next = `${existing.trimEnd()}\n\n## ${toDateKey(now())} ${new Date().toLocaleTimeString()}\n\n${content}\n`;
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (file) {
      await this.app.vault.modify(file as TFile, next);
    } else {
      await this.app.vault.adapter.write(filePath, next);
    }
  }

  private async ensureParentFolder(filePath: string): Promise<void> {
    const parts = filePath.split("/");
    parts.pop();
    const folder = normalizePath(parts.join("/"));
    if (folder) {
      await this.ensureFolder(folder);
    }
  }

  private getRecentMarkdownFiles(): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .sort((a, b) => b.stat.mtime - a.stat.mtime)
      .slice(0, this.plugin.settings.taskNoteRecentLimit);
  }

  private async ensureFolder(path: string): Promise<void> {
    const normalized = normalizePath(path);
    const parts = normalized.split("/").filter(Boolean);
    let cursor = "";
    for (const part of parts) {
      cursor = cursor ? `${cursor}/${part}` : part;
      const folder = this.app.vault.getAbstractFileByPath(cursor);
      if (folder instanceof TFolder) {
        continue;
      }
      const stat = await this.app.vault.adapter.stat(cursor);
      if (stat?.type === "folder") {
        continue;
      }
      await this.app.vault.createFolder(cursor);
    }
  }
}

type ToolbarAction = "bold" | "italic" | "heading" | "list" | "quote" | "code";

function getTargetCards(): QuickTargetCard[] {
  return [
    { value: "daily-note", label: "写日记", desc: "保存到每日记录", icon: "book-marked" },
    { value: "task-note", label: "追加笔记", desc: "选择任意 Markdown 文件", icon: "file-pen-line" },
    { value: "quick-task", label: "创建任务", desc: "解析多行任务语法", icon: "list-plus" },
    { value: "mindmap", label: "补充导图", desc: "支持节点正文 / 子节点两种方式", icon: "git-branch-plus" }
  ];
}

function sortTasksForMindmapSelection(tasks: Task[], getProjectName: (task: Task) => string): Task[] {
  return [...tasks].sort((left, right) => {
    const leftProject = getProjectName(left);
    const rightProject = getProjectName(right);
    const projectCompare = leftProject.localeCompare(rightProject, "zh-Hans-CN");
    if (projectCompare !== 0) {
      return projectCompare;
    }
    const titleCompare = left.title.localeCompare(right.title, "zh-Hans-CN");
    if (titleCompare !== 0) {
      return titleCompare;
    }
    return left.date.localeCompare(right.date);
  });
}

function buildMindmapProjectOptions(tasks: Task[], getProjectName: (task: Task) => string): MindmapProjectOption[] {
  const projects = new Map<string, MindmapProjectOption>();
  tasks.forEach((task) => {
    const key = mindmapProjectKey(task);
    if (projects.has(key)) {
      return;
    }
    projects.set(key, {
      id: key,
      label: getProjectName(task),
      note: key === UNASSIGNED_PROJECT_KEY ? "未归属项目任务会在这里集中展示。" : "选择后只展示该项目下的任务节点与评语节点。"
    });
  });
  return [...projects.values()].sort((left, right) => {
    if (left.id === UNASSIGNED_PROJECT_KEY) {
      return 1;
    }
    if (right.id === UNASSIGNED_PROJECT_KEY) {
      return -1;
    }
    return left.label.localeCompare(right.label, "zh-Hans-CN");
  });
}

function buildMindmapAnchorOptions(tasks: Task[]): MindmapAnchorOption[] {
  if (tasks.length === 0) {
    return [];
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const taskChildrenByParent = new Map<string | null, Task[]>();
  tasks.forEach((task) => {
    const parentId = task.viewState.mindmap.parentTaskId ?? null;
    const key = parentId && taskById.has(parentId) ? parentId : null;
    taskChildrenByParent.set(key, [...(taskChildrenByParent.get(key) ?? []), task]);
  });
  taskChildrenByParent.forEach((items) => items.sort((a, b) => a.viewState.mindmap.childOrder - b.viewState.mindmap.childOrder || compareTaskTitles(a, b)));

  const options: MindmapAnchorOption[] = [];
  const visitComments = (task: Task, parentCommentId: string | null, depth: number): void => {
    const comments = task.mindmapComments
      .filter((comment) => (comment.parentCommentId ?? null) === parentCommentId)
      .sort((left, right) => left.childOrder - right.childOrder);
    comments.forEach((comment) => {
      const prefix = depth > 0 ? "· ".repeat(depth) : "";
      options.push({
        taskId: task.id,
        commentId: comment.id,
        projectId: mindmapProjectKey(task),
        label: `${prefix}评语 · ${truncateText(comment.content, 20)}`,
        note: comment.content,
        taskTitle: task.title,
        pathLabel: `评语 · ${truncateText(comment.content, 24)}`,
        kind: "comment"
      });
      visitComments(task, comment.id, depth + 1);
    });
  };
  const visitTasks = (parentTaskId: string | null, depth: number): void => {
    (taskChildrenByParent.get(parentTaskId) ?? []).forEach((task) => {
      const prefix = depth > 0 ? "· ".repeat(depth) : "";
      options.push({
        taskId: task.id,
        commentId: null,
        projectId: mindmapProjectKey(task),
        label: `${prefix}${task.title}`,
        note: `${task.projectId ? "项目任务" : "未归属项目"} · ${task.date} · ${statusText(task.status)}`,
        taskTitle: task.title,
        pathLabel: task.title,
        kind: "task"
      });
      visitComments(task, null, depth + 1);
      visitTasks(task.id, depth + 1);
    });
  };
  visitTasks(null, 0);
  return options;
}

function editorHint(target: DialogTarget, mode: MindmapInsertMode): string {
  if (target === "mindmap") {
    return mode === "inside" ? "当前会把内容并入所选节点正文。" : "当前会把每一行解析成一个新的评语节点。";
  }
  if (target === "quick-task") {
    return "支持任务语法批量导入，适合快速拆分待办。";
  }
  return "编辑区已包裹成独立卡片，便于专注输入。";
}

function applyEditorFormat(textarea: HTMLTextAreaElement, action: ToolbarAction): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.slice(start, end);
  let next = selected;
  if (action === "bold") {
    next = `**${selected || "加粗"}**`;
  } else if (action === "italic") {
    next = `*${selected || "斜体"}*`;
  } else if (action === "heading") {
    next = `## ${selected || "标题"}`;
  } else if (action === "list") {
    next = prefixEachLine(selected || "列表项", "- ");
  } else if (action === "quote") {
    next = prefixEachLine(selected || "引用", "> ");
  } else if (action === "code") {
    next = selected.includes("\n") ? `\`\`\`\n${selected || "代码"}\n\`\`\`` : `\`${selected || "代码"}\``;
  }
  textarea.setRangeText(next, start, end, "end");
  textarea.dispatchEvent(new Event("input"));
  textarea.focus();
}

function prefixEachLine(value: string, prefix: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function joinParagraphs(current: string, addition: string): string {
  const trimmedCurrent = current.trim();
  const trimmedAddition = addition.trim();
  if (!trimmedCurrent) {
    return trimmedAddition;
  }
  return `${trimmedCurrent}\n${trimmedAddition}`;
}

const UNASSIGNED_PROJECT_KEY = "__pm-unassigned-project__";

function mindmapProjectKey(task: Task): string {
  return task.projectId ?? UNASSIGNED_PROJECT_KEY;
}

function compareTaskTitles(left: Task, right: Task): number {
  const titleCompare = left.title.localeCompare(right.title, "zh-Hans-CN");
  if (titleCompare !== 0) {
    return titleCompare;
  }
  return left.date.localeCompare(right.date);
}

function statusText(status: Task["status"]): string {
  if (status === "doing") {
    return "进行中";
  }
  if (status === "blocked") {
    return "阻塞";
  }
  if (status === "done") {
    return "已完成";
  }
  return "待办";
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, Math.max(1, maxLength - 1))}…` : value;
}
