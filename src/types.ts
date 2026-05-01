export type ProjectStatus = "active" | "paused" | "completed" | "archived";

export type TaskRecurrence = "once" | "daily" | "weekly";

export type TaskUpdateScope = "series";

export type TaskDeleteScope = "single" | "series";

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
  title: string;
  description?: string;
  projectId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  recurrence: TaskRecurrence;
  recurrenceCount?: number | null;
  recurrenceUntil?: string | null;
  occurrenceDates: string[];
  completedOccurrences: Array<{
    date: string;
    completedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type TaskOccurrence = {
  id: string;
  taskId: string;
  occurrenceDate: string;
  occurrenceNumber: number;
  title: string;
  description?: string;
  projectId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  recurrence: TaskRecurrence;
  recurrenceCount?: number | null;
  recurrenceUntil?: string | null;
  completed: boolean;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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
  weekStartsOn: "monday";
  timeSlotMinutes: number;
  heatmapRange: "12months";
  showCompletedTasks: boolean;
  defaultTaskDurationMinutes: number;
  defaultTaskStartTime: string;
};

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

export type StoreSnapshot = {
  config: PluginConfig;
  projects: Project[];
  progressPages: ProgressPage[];
  tasks: Task[];
  occurrences: TaskOccurrence[];
};

export type TaskInput = {
  title: string;
  description?: string;
  projectId?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  recurrence: TaskRecurrence;
  recurrenceCount?: number | null;
  recurrenceUntil?: string | null;
  completed?: boolean;
};

export type ProjectInput = {
  name: string;
  description?: string;
  color?: string;
  status?: ProjectStatus;
};
