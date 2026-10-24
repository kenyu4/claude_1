import { eachDate, formatShort, isDateKey, isSaturday } from "./date";
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
    lessonDays: generation.lessonDays.filter(isDateKey),
    dayNotes,
    tasks,
    verification: { summary: verification.summary, dayChecks: verification.dayChecks },
    excluded: dedupeExcluded(excluded),
  };
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
    if (lessons.has(date) && study.length > MAX_TASKS_LESSON_DAY)
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
