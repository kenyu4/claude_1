import { normalizeTitle } from "./plan-rules";
import type { DraftTask, PlanDraft, PlanRecord, Task } from "./types";

// 新しい計画案と登録済みタスクの差分。計画案の期間内だけを比較し、期間外のタスクには触れない。

export type DiffItem =
  | { kind: "add"; id: string; draft: DraftTask }
  | { kind: "change"; id: string; draft: DraftTask; existing: Task; fields: string[] }
  | { kind: "remove"; id: string; existing: Task }
  | { kind: "same"; id: string; draft: DraftTask; existing: Task };

const FIELD_LABELS: Record<string, string> = {
  title: "タイトル",
  material: "教材",
  textbookNumber: "テキスト番号",
  range: "範囲",
  detail: "補足",
  subject: "教科",
  category: "分類",
};

function changedFields(d: DraftTask, e: Task): string[] {
  return (Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[])
    .filter((k) => (d as unknown as Record<string, string>)[k] !== (e as unknown as Record<string, string>)[k])
    .map((k) => FIELD_LABELS[k]);
}

export function computeDiff(draft: Pick<PlanDraft, "tasks" | "params">, existing: Task[]): DiffItem[] {
  const { startDate, endDate } = draft.params;
  const inRange = existing.filter((t) => t.date >= startDate && t.date <= endDate);
  const unmatched = new Set(inRange.map((t) => t.id));
  const items: DiffItem[] = [];

  const take = (pred: (e: Task) => boolean): Task | undefined => {
    const hit = inRange.find((e) => unmatched.has(e.id) && pred(e));
    if (hit) unmatched.delete(hit.id);
    return hit;
  };

  const pending: DraftTask[] = [];
  // 1) 同じ日・同じタイトル
  for (const d of draft.tasks) {
    const e = take((x) => x.date === d.date && normalizeTitle(x.title) === normalizeTitle(d.title));
    if (!e) {
      pending.push(d);
      continue;
    }
    const fields = changedFields(d, e);
    items.push(fields.length ? { kind: "change", id: d.id, draft: d, existing: e, fields } : { kind: "same", id: d.id, draft: d, existing: e });
  }
  // 2) 同じ日・同じ教科・同じ教材（範囲などが変わった）
  for (const d of pending) {
    const e = take(
      (x) =>
        x.date === d.date &&
        x.subject === d.subject &&
        x.material === d.material &&
        x.textbookNumber === d.textbookNumber &&
        x.category === d.category,
    );
    if (e) items.push({ kind: "change", id: d.id, draft: d, existing: e, fields: changedFields(d, e) });
    else items.push({ kind: "add", id: d.id, draft: d });
  }
  // 3) 計画案にない既存タスク → 削除候補
  for (const e of inRange) {
    if (unmatched.has(e.id)) items.push({ kind: "remove", id: e.id, existing: e });
  }

  const date = (i: DiffItem) => ("draft" in i ? i.draft.date : i.existing.date);
  return items.sort((a, b) => (date(a) < date(b) ? -1 : date(a) > date(b) ? 1 : 0));
}

/** 初期の承認状態: 追加・変更は承認、削除候補は未承認（勝手に消さない） */
export function defaultApprovals(items: DiffItem[]): Set<string> {
  return new Set(items.filter((i) => i.kind === "add" || i.kind === "change").map((i) => i.id));
}

function draftToTaskFields(d: DraftTask) {
  return {
    date: d.date,
    subject: d.subject,
    material: d.material,
    textbookNumber: d.textbookNumber,
    range: d.range,
    title: d.title,
    detail: d.detail,
    category: d.category,
    sourceId: d.evidence[0]?.sourceId ?? "",
    sourceIds: [...new Set(d.evidence.map((e) => e.sourceId))],
    evidence: d.evidence,
  };
}

export interface ApplyResult {
  tasks: Task[];
  record: PlanRecord;
}

export function applyDiff(
  existing: Task[],
  draft: PlanDraft,
  items: DiffItem[],
  approved: Set<string>,
  makeId: () => string,
): ApplyResult {
  const now = new Date().toISOString();
  const planId = `plan_${Date.now().toString(36)}`;
  const byId = new Map(existing.map((t) => [t.id, t]));
  let added = 0;
  let changed = 0;
  let removed = 0;

  for (const item of items) {
    if (item.kind === "same") {
      // 内容は同じ。根拠情報だけ最新にする
      const e = byId.get(item.existing.id);
      if (e) byId.set(e.id, { ...e, ...draftToTaskFields(item.draft), updatedAt: e.updatedAt });
      continue;
    }
    if (!approved.has(item.id)) continue;
    if (item.kind === "add") {
      const t: Task = {
        id: makeId(),
        ...draftToTaskFields(item.draft),
        completed: false,
        completedAt: null,
        planId,
        order: draft.tasks.indexOf(item.draft),
        createdAt: now,
        updatedAt: now,
      };
      byId.set(t.id, t);
      added++;
    } else if (item.kind === "change") {
      const e = byId.get(item.existing.id);
      if (!e) continue;
      const titleChanged = normalizeTitle(e.title) !== normalizeTitle(item.draft.title);
      byId.set(e.id, {
        ...e,
        ...draftToTaskFields(item.draft),
        // 内容が別物になった場合のみ完了状態をリセット
        completed: titleChanged ? false : e.completed,
        completedAt: titleChanged ? null : e.completedAt,
        planId,
        order: draft.tasks.indexOf(item.draft),
        updatedAt: now,
      });
      changed++;
    } else {
      byId.delete(item.existing.id);
      removed++;
    }
  }

  return {
    tasks: [...byId.values()],
    record: {
      id: planId,
      confirmedAt: now,
      draftId: draft.id,
      startDate: draft.params.startDate,
      endDate: draft.params.endDate,
      sourceIds: draft.sourceIds,
      added,
      changed,
      removed,
    },
  };
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.order - b.order));
}
