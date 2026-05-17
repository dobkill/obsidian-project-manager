import { App, FuzzySuggestModal } from "obsidian";

type EntitySuggestModalOptions<T> = {
  items: T[];
  placeholder: string;
  emptyStateText?: string;
  getItemText: (item: T) => string;
  getItemGroup?: (item: T) => string | undefined;
  getItemNote?: (item: T) => string | undefined;
  onChoose: (item: T) => void;
};

export class EntitySuggestModal<T> extends FuzzySuggestModal<T> {
  private options: EntitySuggestModalOptions<T>;

  constructor(app: App, options: EntitySuggestModalOptions<T>) {
    super(app);
    this.options = options;
    this.emptyStateText = options.emptyStateText ?? "没有可选项";
  }

  onOpen(): void {
    super.onOpen();
    this.setPlaceholder(this.options.placeholder);
  }

  getItems(): T[] {
    return this.options.items;
  }

  getItemText(item: T): string {
    return this.options.getItemText(item);
  }

  renderSuggestion(item: { item: T }, el: HTMLElement): void {
    const group = this.options.getItemGroup?.(item.item);
    if (group) {
      el.createDiv({ cls: "pm-suggest-group", text: group });
    }
    el.createDiv({ cls: "pm-suggest-title", text: this.options.getItemText(item.item) });
    const note = this.options.getItemNote?.(item.item);
    if (note) {
      el.createDiv({ cls: "pm-suggest-note", text: note });
    }
  }

  onChooseItem(item: T): void {
    this.options.onChoose(item);
  }
}
