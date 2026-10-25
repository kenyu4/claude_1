import { eachDate, formatShort, isDateKey, isSaturday, weekday } from "./date";
import { holidayName } from "./holidays";
import type { AiTask, GenerationOutput, VerificationOutput } from "./plan-schema";
import {
  RULE_SOURCE_ID,
  type DraftTask,
  type ExcludedItem,
  type PlanDraft,
  type PlanParams,
} from "./types";

// AI の出力に対してコード側で必ず適用する決定的なルール。
// AI の検証をすり抜けた「根拠のないタスク」を落とし、アプリ固有ルールを適用する。

export const PAPAX_TITLE = "パパックスオープン";
export const MAX_TASKS_PER_DAY = 5;
export const MAX_TASKS_LESSON_DAY = 3;

function newDraftId(): string {
  return `dt_${Math.random().toString(36).slice(2, 12)}`;
}

function papaxTask(date: string): DraftTask {
  return {
    id: newDraftId(),
    date,
    subject: "その他",
    material: "パパックス",
    textbookNumber: "",
    range: "",
    title: PAPAX_TITLE,
    detail: "",
    category: "イベント",
    evidence: [{ sourceId: RULE_SOURCE_ID, quote: "毎週土曜日はパパックスオープンを登録（アプリの固定ルール）" }],
  };
}

export function isPapax(title: string): boolean {
  return title.includes("パパックス");
}

export interface BuildDraftInput {
  mode: "live" | "demo";
  params: PlanParams;
  sourceIds: string[];
  generation: GenerationOutput;
  verification: VerificationOutput;
}

export function buildDraft(input: BuildDraftInput): PlanDraft {
  const { params, generation, verification } = input;
  const valid = new Set(input.sourceIds);
  const excluded: ExcludedItem[] = [...verification.excluded];
  const tasks: DraftTask[] = [];
  const dayNotes: Record<string, string> = {};

  for (const day of verification.days) {
    if (!isDateKey(day.date) || day.date < params.startDate || day.date > params.endDate) {
      for (const t of day.tasks) {
        excluded.push({ date: day.date, title: t.title, reason: "計画期間外の日付のため除外" });
      }
      continue;
    }
    if (day.note) dayNotes[day.date] = day.note;
    for (const t of day.tasks) {
      if (isPapax(t.title)) continue; // 下でルールとして付け直す
      const evidence = t.evidence.filter((e) => valid.has(e.sourceId) && e.quote.trim() !== "");
      if (evidence.length === 0) {
        excluded.push({
          date: day.date,
          title: t.title,
          reason: "根拠となる資料の記述が確認できないため除外（自動チェック）",
        });
        continue;
      }
      tasks.push(fromAi(day.date, t, evidence));
    }
  }

  // 毎週土曜日はパパックスオープン
  for (const date of eachDate(params.startDate, params.endDate)) {
    if (!isSaturday(date)) continue;
    const idx = tasks.findIndex((t) => t.date === date && t.category === "基礎トレ");
    const insertAt = idx >= 0 ? idx + 1 : tasks.findIndex((t) => t.date >= date);
    const p = papaxTask(date);
    if (insertAt < 0) tasks.push(p);
    else tasks.splice(insertAt, 0, p);
  }

  tasks.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return {
    id: `draft_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    mode: input.mode,
    params,
    sourceIds: input.sourceIds,
    analysis: generation.analysis,
    ...resolveLessonDays(params, generation.lessonDays),
    dayNotes,
    tasks,
    verification: { summary: verification.summary, dayChecks: verification.dayChecks },
    excluded: dedupeExcluded(excluded),
  };
}

/**
 * 授業日の確定。クラス設定（保護者確認済み）の曜日を正とする。
 * AI が資料から追加の授業日を見つけた場合は加える（その日は軽くなる側なので安全）。
 * 設定上の授業日を AI が授業なしと判断した場合は外さず、保護者に確認を促す。
 */
export function resolveLessonDays(
  params: PlanParams,
  aiLessonDays: string[],
): { lessonDays: string[]; lessonNotes: string[] } {
  const weekdays = new Set(params.lessons.filter((l) => l.subjects.length > 0).map((l) => l.weekday));
  const inRange = (d: string) => isDateKey(d) && d >= params.startDate && d <= params.endDate;
  const expected = eachDate(params.startDate, params.endDate).filter((d) => weekdays.has(weekday(d)));
  const ai = aiLessonDays.filter(inRange);
  if (weekdays.size === 0) return { lessonDays: ai, lessonNotes: [] };

  const aiSet = new Set(ai);
  const expectedSet = new Set(expected);
  const notes: string[] = [];
  for (const d of expected) {
    if (!aiSet.has(d)) notes.push(`${formatShort(d)} はAIが資料から「授業なし（休講など）」と判断しました。授業日として軽めの計画にしています。休講なら必要に応じてタスクを追加してください`);
  }
  for (const d of ai) {
    if (!expectedSet.has(d)) notes.push(`${formatShort(d)} はクラスの授業曜日ではありませんが、資料から授業ありと判断し、授業日として扱っています`);
  }
  return { lessonDays: [...new Set([...expected, ...ai])].sort(), lessonNotes: notes };
}

function fromAi(date: string, t: AiTask, evidence: DraftTask["evidence"]): DraftTask {
  return {
    id: newDraftId(),
    date,
    subject: t.subject,
    material: t.material.trim(),
    textbookNumber: t.textbookNumber.trim(),
    range: t.range.trim(),
    title: t.title.trim(),
    detail: t.detail.trim(),
    category: t.category,
    evidence,
  };
}

function dedupeExcluded(items: ExcludedItem[]): ExcludedItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = `${i.date}|${i.title}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function normalizeTitle(s: string): string {
  return s.replace(/[\s　]+/g, "").replace(/[〜～~]/g, "〜").toLowerCase();
}

/** 保護者向けの警告（タスク過多・重複など）。日付ごと */
export function draftWarnings(tasks: DraftTask[], lessonDays: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const push = (d: string, m: string) => (out[d] ??= []).push(m);
  const byDate = new Map<string, DraftTask[]>();
  for (const t of tasks) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
  const lessons = new Set(lessonDays);

  for (const [date, list] of byDate) {
    const study = list.filter((t) => !isPapax(t.title));
    if (study.length > MAX_TASKS_PER_DAY) push(date, `タスクが${study.length}件あります（目安は最大${MAX_TASKS_PER_DAY}件）`);
    // 祝日は学校が休みなので、授業日でも軽くしなくてよい
    if (lessons.has(date) && !holidayName(date) && study.length > MAX_TASKS_LESSON_DAY)
      push(date, `授業日なのにタスクが${study.length}件あります（授業日は軽めに）`);
  }

  const seen = new Map<string, string>();
  for (const t of tasks) {
    if (t.category === "基礎トレ" || isPapax(t.title)) continue;
    const k = normalizeTitle(t.title);
    const prev = seen.get(k);
    if (prev) push(t.date, `「${t.title}」が ${formatShort(prev)} にもあります（重複）`);
    else seen.set(k, t.date);
  }
  return out;
}

/** 理科・社会を厚めにする方針に対して、計画案全体が薄くなっていないか */
export function balanceWarning(tasks: DraftTask[]): string | null {
  const count = (subject: string) =>
    tasks.filter((t) => t.subject === subject && t.category !== "基礎トレ").length;
  const focus = Math.min(count("理科"), count("社会"));
  const other = Math.max(count("算数"), count("国語"));
  if (tasks.length === 0 || focus >= other) return null;
  return `理科・社会を厚めにする方針ですが、理科${count("理科")}件・社会${count("社会")}件に対し、算数${count("算数")}件（基礎トレ除く）・国語${count("国語")}件です。`;
}
