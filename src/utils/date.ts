const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function now(): Date {
  return new Date();
}

export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function toIsoLocal(date: Date): string {
  const tz = -date.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const abs = Math.abs(tz);
  const hours = pad(Math.floor(abs / 60));
  const minutes = pad(abs % 60);
  return `${toDateKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${hours}:${minutes}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function parseTimeToMinutes(value?: string): number | null {
  if (!value) {
    return null;
  }
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatMinutesToTime(total: number): string {
  const safe = ((total % 1440) + 1440) % 1440;
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;
  return `${pad(hours)}:${pad(minutes)}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function addMinutes(time: string, minutes: number): string {
  const parsed = parseTimeToMinutes(time);
  if (parsed === null) {
    return time;
  }
  return formatMinutesToTime(parsed + minutes);
}

export function startOfWeek(date: Date): Date {
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = current.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(current, diff);
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6);
}

export function getWeekDates(anchor: Date): Date[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function getChineseWeekday(date: Date): string {
  return WEEKDAY_LABELS[date.getDay()];
}

export function formatWeekColumnTitle(date: Date): string {
  return `${getChineseWeekday(date)} ${toDateKey(date)}`;
}

export function formatShortMonth(date: Date): string {
  return `${date.getMonth() + 1}月`;
}

export function compareDateKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

export function isToday(dateKey: string): boolean {
  return dateKey === toDateKey(now());
}

export function isPastDateKey(dateKey: string, anchor = now()): boolean {
  return compareDateKeys(dateKey, toDateKey(anchor)) < 0;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getLastTwelveMonthsDays(anchor = now()): Date[] {
  const end = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const start = addDays(end, -364);
  const result: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    result.push(new Date(cursor));
  }
  return result;
}
