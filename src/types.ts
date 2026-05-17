export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export type TaskRecurrence = "once" | "daily" | "weekly" | "custom";
export type TaskKind = "simple" | "composite";
export type TaskStatus = "todo" | "doing" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskUpdateScope = "series" | "occurrence";

export type TaskDeleteScope = "single" | "series";

export type TaskSubtask = {
  id: string;
  title: string;
  order: number;
};

export type TaskSubtaskInput = {
  id?: string;
  title: string;
  order?: number;
};

export type TaskOccurrenceState = {
  date: string;
  completedAt?: string | null;
  completedSubtaskIds?: string[];
};

export type TaskOccurrenceOverride = {
  date: string;
  startTime?: string;
  endTime?: string;
  title?: string;
  skipped?: boolean;
  reason?: string;
};

export type TaskViewState = {
  board: {
    columnId: TaskStatus;
    order: number;
  };
  gantt: {
    rowOrder: number;
    dependencyIds: string[];
    locked: boolean;
    milestone: boolean;
  };
  mindmap: {
    parentTaskId?: string | null;
    childOrder: number;
    expanded: boolean;
    x?: number;
    y?: number;
  };
};

export type TaskSourceLink = {
  id: string;
  type: "note" | "daily-note" | "dialog" | "manual";
  path?: string;
  blockId?: string;
  line?: number;
  hash?: string;
  syncMode: "import-only" | "linked" | "mirror";
  lastSyncedAt?: string;
  missing?: boolean;
};

export type TaskNote = {
  id: string;
  content: string;
  createdAt: string;
  source?: "dialog" | "note" | "manual" | "file";
};

export type TaskMindmapComment = {
  id: string;
  taskId: string;
  parentCommentId?: string | null;
  content: string;
  childOrder: number;
  x?: number;
  y?: number;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  kind: TaskKind;
  title: string;
  description?: string;
  projectId?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  tags: string[];
  date: string;
  startTime?: string;
  endTime?: string;
  recurrence: TaskRecurrence;
  recurrenceCount?: number | null;
  recurrenceUntil?: string | null;
  subtasks: TaskSubtask[];
  occurrenceDates: string[];
  occurrenceStates: TaskOccurrenceState[];
  occurrenceOverrides: TaskOccurrenceOverride[];
  viewState: TaskViewState;
  sourceLinks: TaskSourceLink[];
  notes: TaskNote[];
  mindmapComments: TaskMindmapComment[];
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type TaskOccurrence = {
  id: string;
  taskId: string;
  occurrenceDate: string;
  occurrenceNumber: number;
  kind: TaskKind;
  title: string;
  description?: string;
  projectId?: string;
  status: TaskStatus;
  priority?: TaskPriority;
  tags: string[];
  date: string;
  startTime?: string;
  endTime?: string;
  recurrence: TaskRecurrence;
  recurrenceCount?: number | null;
  recurrenceUntil?: string | null;
  subtasks: TaskSubtask[];
  sourceLinks: TaskSourceLink[];
  notes: TaskNote[];
  completedSubtaskIds: string[];
  progress: number;
  totalSteps: number;
  completedSteps: number;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type ProgressPage = {
  id: string;
  projectId: string;
  name: string;
  columnOrder: string[];
  createdAt: string;
  updatedAt: string;
};

export type PluginConfig = {
  version: string;
  dataFolder: string;
  overviewTab1Name: string;
  overviewTab2Name: string;
  dialogTabName: string;
  weekStartsOn: "monday";
  timeSlotMinutes: number;
  heatmapRange: "12months";
  showCompletedTasks: boolean;
  defaultTaskDurationMinutes: number;
  defaultTaskStartTime: string;
  dailyNoteFolder: string;
  dailyNoteDateFormat: string;
  dailyNoteMode: DailyNoteMode;
  dailyNoteSingleFilePath: string;
  taskNoteRecentLimit: number;
  defaultDialogTarget: DialogTarget;
};

export type DialogTarget = "daily-note" | "task-note" | "quick-task" | "mindmap";

export type DailyNoteMode = "per-day" | "single-file";

export type ProjectsFile = {
  projects: Project[];
};

export type ProgressPagesFile = {
  pages: ProgressPage[];
};

export type TasksFile = {
  month: string;
  tasks: Task[];
};

export type NoteTaskIndexEntry = {
  path: string;
  mtime: number;
  hash: string;
  taskIds: string[];
  parsedAt: string;
};

export type NoteTaskIndexFile = {
  files: NoteTaskIndexEntry[];
};

export type WriteHistoryRecord = {
  id: string;
  type: "import" | "arrange" | "note-sync" | "dialog";
  summary: string;
  taskIds: string[];
  createdAt: string;
  before?: unknown;
  after?: unknown;
};

export type WriteHistoryFile = {
  records: WriteHistoryRecord[];
};

export type StoreSnapshot = {
  config: PluginConfig;
  projects: Project[];
  progressPages: ProgressPage[];
  tasks: Task[];
  occurrences: TaskOccurrence[];
  noteTaskIndex: NoteTaskIndexEntry[];
  writeHistory: WriteHistoryRecord[];
};

export type TaskInput = {
  kind?: TaskKind;
  title: string;
  description?: string;
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  tags?: string[];
  date: string;
  startTime?: string;
  endTime?: string;
  recurrence: TaskRecurrence;
  recurrenceCount?: number | null;
  recurrenceUntil?: string | null;
  occurrenceDates?: string[];
  occurrenceOverrides?: TaskOccurrenceOverride[];
  subtasks?: TaskSubtaskInput[];
  viewState?: Partial<TaskViewState>;
  sourceLinks?: TaskSourceLink[];
  notes?: TaskNote[];
  mindmapComments?: TaskMindmapComment[];
  completed?: boolean;
};

export type TaskImportIssue = {
  line: number;
  message: string;
  raw: string;
};

export type TaskImportCompletionMode = "pending" | "today" | "series";

export type TaskImportAction = "create" | "overwrite" | "overwrite-and-complete-today" | "overwrite-and-complete-series";

export type TaskImportPreviewTask = {
  line: number;
  raw: string;
  input: TaskInput;
  projectName?: string;
  projectId?: string;
  matchedTaskId?: string;
  matchedTaskTitle?: string;
  action: TaskImportAction;
  completionMode: TaskImportCompletionMode;
};

export type TaskImportPreview = {
  tasks: TaskImportPreviewTask[];
  issues: TaskImportIssue[];
  summary: {
    total: number;
    completed: number;
    composite: number;
    createCount: number;
    overwriteCount: number;
    completeTodayCount: number;
    completeSeriesCount: number;
    newProjectNames: string[];
  };
};

export type AutoArrangeOptions = {
  direction: "forward" | "backward";
  scope: "same-day" | "same-project" | "all-visible";
  includeCompleted: boolean;
  includeLocked: boolean;
  timeSlotMinutes: number;
};

export type AutoArrangeResult = {
  moved: Array<{
    taskId: string;
    date: string;
    title: string;
    from: string;
    to: string;
  }>;
  skipped: string[];
};

export type ProjectInput = {
  name: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
};
