// 日付はすべてローカルタイムの YYYY-MM-DD 文字列で扱う（タイムゾーンずれ防止）。

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDateKey(s).getTime());
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function weekday(key: string): number {
  return parseDateKey(key).getDay();
}

export function isSaturday(key: string): boolean {
  return weekday(key) === 6;
}

/** 10/24（土） */
export function formatShort(key: string): string {
  const d = parseDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEKDAYS[d.getDay()]}）`;
}

/** 2026年10月24日（土） */
export function formatLong(key: string): string {
  const d = parseDateKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 月曜始まりの週 [月, 日] */
export function weekRange(key: string): [string, string] {
  const wd = weekday(key);
  const offset = wd === 0 ? -6 : 1 - wd;
  const start = addDays(key, offset);
  return [start, addDays(start, 6)];
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  for (let k = start; k <= end && out.length < 400; k = addDays(k, 1)) out.push(k);
  return out;
}
