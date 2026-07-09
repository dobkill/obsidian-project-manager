import { Task, TaskOccurrence } from "../types";
import { addDays, compareDateKeys, parseDateKey, toDateKey } from "../utils/date";
import { addMonthsKeepingAnchorDay, isAttentionStatus, isExecutableTask } from "./taskRules";

export type TaskExecutionProgress = {
  total: number;
  completed: number;
  remaining: number;
  completedSeries: boolean;
};

export function isCompletionGatedTask(task: Pick<Task, "kind" | "consumeRequiresCompletion">): boolean {
  return isExecutableTask(task) && task.consumeRequiresCompletion;
}

export function getEffectiveOccurrenceDates(task: Task, referenceDate: string): string[] {
  if (!isCompletionGatedTask(task)) {
    return [...task.occurrenceDates];
  }

  const completedDates = getCompletedOccurrenceDates(task);
  const activeDate = getCompletionGatedActiveDate(task, referenceDate);
  return uniqueDateKeys(activeDate ? [...completedDates, activeDate] : completedDates);
}

export function getCompletionGatedActiveDate(task: Task, referenceDate: string): string | null {
  if (!isCompletionGatedTask(task)) {
    return null;
  }

  const progress = getTaskExecutionProgress(task);
  if (progress.completedSeries) {
    return null;
  }

  const completedDates = getCompletedOccurrenceDates(task);
  const dueDate = completedDates.length === 0
    ? task.date
    : toDateKey(nextRecurrenceDateAfter(parseDateKey(completedDates[completedDates.length - 1]), task));
  const activeDate = compareDateKeys(dueDate, referenceDate) < 0 ? referenceDate : dueDate;
  if (task.recurrenceUntil && compareDateKeys(activeDate, task.recurrenceUntil) > 0) {
    return null;
  }
  return activeDate;
}

export function isOccurrenceDateAvailable(task: Task, date: string, referenceDate: string): boolean {
  if (task.occurrenceDates.includes(date)) {
    return true;
  }
  return getEffectiveOccurrenceDates(task, referenceDate).includes(date);
}

export function getTaskExecutionProgress(task: Pick<Task, "kind" | "status" | "consumeRequiresCompletion" | "recurrenceCount" | "occurrenceDates" | "occurrenceStates">): TaskExecutionProgress {
  if (!isExecutableTask(task)) {
    return { total: 0, completed: 0, remaining: 0, completedSeries: false };
  }

  const completed = getCompletedOccurrenceCount(task);
  if (task.consumeRequiresCompletion) {
    const total = getExecutionTargetCount(task);
    return {
      total,
      completed,
      remaining: Math.max(0, total - completed),
      completedSeries: total > 0 && completed >= total
    };
  }

  const total = task.occurrenceDates.filter((date) => {
    if (task.occurrenceStates.some((state) => state.date === date)) {
      return true;
    }
    return !isAttentionStatus(task.status);
  }).length;
  return {
    total,
    completed,
    remaining: Math.max(0, total - completed),
    completedSeries: total > 0 && completed >= total
  };
}

export function appendOccurrenceDate(task: Task, date: string): Task {
  if (task.occurrenceDates.includes(date)) {
    return task;
  }
  task.occurrenceDates = uniqueDateKeys([...task.occurrenceDates, date]);
  return task;
}

export function occurrenceExecutionLabel(occurrence: Pick<TaskOccurrence, "consumeRequiresCompletion" | "recurrenceCount" | "completed" | "occurrenceNumber">): string | null {
  if (!occurrence.consumeRequiresCompletion || !occurrence.recurrenceCount || occurrence.recurrenceCount <= 1) {
    return null;
  }
  const consumed = occurrence.completed ? occurrence.occurrenceNumber : Math.max(0, occurrence.occurrenceNumber - 1);
  const remaining = Math.max(0, occurrence.recurrenceCount - consumed);
  return `剩余 ${remaining} 次`;
}

function getExecutionTargetCount(task: Pick<Task, "recurrenceCount" | "occurrenceDates">): number {
  return Math.max(1, task.recurrenceCount ?? task.occurrenceDates.length);
}

function getCompletedOccurrenceCount(task: Pick<Task, "occurrenceStates">): number {
  return getCompletedOccurrenceDates(task).length;
}

function getCompletedOccurrenceDates(task: Pick<Task, "occurrenceStates">): string[] {
  return uniqueDateKeys(task.occurrenceStates.filter((state) => Boolean(state.completedAt)).map((state) => state.date));
}

function nextRecurrenceDateAfter(reference: Date, task: Pick<Task, "date" | "recurrence">): Date {
  if (task.recurrence === "weekly") {
    const anchorWeekday = parseDateKey(task.date).getDay();
    const dayOffset = (anchorWeekday - reference.getDay() + 7) % 7 || 7;
    return addDays(reference, dayOffset);
  }
  if (task.recurrence === "monthly") {
    const anchorDay = parseDateKey(task.date).getDate();
    const sameMonth = addMonthsKeepingAnchorDay(new Date(reference.getFullYear(), reference.getMonth(), 1), 0, anchorDay);
    if (sameMonth.getTime() > reference.getTime()) {
      return sameMonth;
    }
    return addMonthsKeepingAnchorDay(reference, 1, anchorDay);
  }
  return addDays(reference, 1);
}

function uniqueDateKeys(dates: string[]): string[] {
  return [...new Set(dates)].sort(compareDateKeys);
}
