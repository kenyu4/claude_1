import { addDays, eachDate, parseDateKey, toDateKey } from "./date";

// 日本の国民の祝日（振替休日・国民の休日を含む）。祝日法の現行ルールで計算する（2020年以降を想定）。

function nthMonday(year: number, month: number, n: number): string {
  const first = new Date(year, month - 1, 1);
  const offset = (8 - first.getDay()) % 7; // 最初の月曜まで
  return toDateKey(new Date(year, month - 1, 1 + offset + (n - 1) * 7));
}

function equinox(year: number, base: number): number {
  return Math.floor(base + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

const cache = new Map<number, Map<string, string>>();

function holidaysOfYear(year: number): Map<string, string> {
  const hit = cache.get(year);
  if (hit) return hit;
  const k = (m: number, d: number) => toDateKey(new Date(year, m - 1, d));
  const base: [string, string][] = [
    [k(1, 1), "元日"],
    [nthMonday(year, 1, 2), "成人の日"],
    [k(2, 11), "建国記念の日"],
    [k(2, 23), "天皇誕生日"],
    [k(3, equinox(year, 20.8431)), "春分の日"],
    [k(4, 29), "昭和の日"],
    [k(5, 3), "憲法記念日"],
    [k(5, 4), "みどりの日"],
    [k(5, 5), "こどもの日"],
    [nthMonday(year, 7, 3), "海の日"],
    [k(8, 11), "山の日"],
    [nthMonday(year, 9, 3), "敬老の日"],
    [k(9, equinox(year, 23.2488)), "秋分の日"],
    [nthMonday(year, 10, 2), "スポーツの日"],
    [k(11, 3), "文化の日"],
    [k(11, 23), "勤労感謝の日"],
  ];
  const map = new Map(base);

  // 国民の休日: 前後を祝日に挟まれた平日
  for (const [d] of base) {
    const next = addDays(d, 2);
    const mid = addDays(d, 1);
    if (map.has(next) && !map.has(mid) && parseDateKey(mid).getDay() !== 0) map.set(mid, "国民の休日");
  }
  // 振替休日: 祝日が日曜なら、その後の最初の祝日でない日
  for (const [d] of [...map]) {
    if (parseDateKey(d).getDay() !== 0) continue;
    let s = addDays(d, 1);
    while (map.has(s)) s = addDays(s, 1);
    map.set(s, "振替休日");
  }
  cache.set(year, map);
  return map;
}

/** 祝日名。祝日でなければ null */
export function holidayName(key: string): string | null {
  return holidaysOfYear(Number(key.slice(0, 4))).get(key) ?? null;
}

/** 期間内の祝日 { date: 名前 } */
export function holidaysBetween(start: string, end: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of eachDate(start, end)) {
    const n = holidayName(d);
    if (n) out[d] = n;
  }
  return out;
}
