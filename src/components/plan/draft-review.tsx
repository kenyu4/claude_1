"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { eachDate, formatShort } from "@/lib/date";
import { applyDiff, computeDiff, defaultApprovals, type DiffItem } from "@/lib/diff";
import { draftWarnings } from "@/lib/plan-rules";
import { newId, updateState } from "@/lib/storage";
import {
  MANUAL_SOURCE_ID,
  RULE_SOURCE_ID,
  type AppState,
  type CheckItem,
  type DayCheck,
  type DraftTask,
  type PlanDraft,
  type SourceDocument,
} from "@/lib/types";
import { Sheet } from "../sheet";
import { btn, SubjectChip } from "../ui";
import { openOriginal } from "./sources-panel";
import { TaskEditor } from "./task-editor";

function patchDraft(fn: (d: PlanDraft) => PlanDraft) {
  updateState((s) => (s.draft ? { ...s, draft: fn(s.draft) } : s));
}

export function DraftReview({ state }: { state: AppState }) {
  const draft = state.draft!;
  const router = useRouter();
  const [editing, setEditing] = useState<{ task: DraftTask; isNew: boolean } | null>(null);
  const [evidenceFor, setEvidenceFor] = useState<DraftTask | null>(null);

  const dates = eachDate(draft.params.startDate, draft.params.endDate);
  const lessons = new Set(draft.lessonDays);
  const warnings = useMemo(() => draftWarnings(draft.tasks, draft.lessonDays), [draft.tasks, draft.lessonDays]);
  const diff = useMemo(() => computeDiff(draft, state.tasks), [draft, state.tasks]);
  const hasExisting = diff.some((d) => d.kind !== "add");

  // 承認状態は差分 ID に対して保持し、計画案の編集で増えた項目は既定値で承認する
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const approved = useMemo(() => {
    const base = defaultApprovals(diff);
    for (const [id, v] of Object.entries(overrides)) {
      if (v) base.add(id);
      else base.delete(id);
    }
    return base;
  }, [diff, overrides]);

  function saveTask(t: DraftTask) {
    patchDraft((d) => {
      const exists = d.tasks.some((x) => x.id === t.id);
      const tasks = exists ? d.tasks.map((x) => (x.id === t.id ? t : x)) : [...d.tasks, t];
      return { ...d, tasks: [...tasks].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) };
    });
    setEditing(null);
  }

  function removeTask(t: DraftTask) {
    if (!confirm(`「${t.title}」を計画案から削除しますか？`)) return;
    patchDraft((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }));
  }

  function addTask(date: string) {
    setEditing({
      isNew: true,
      task: {
        id: newId("dt"),
        date,
        subject: "算数",
        material: "",
        textbookNumber: "",
        range: "",
        title: "",
        detail: "",
        category: "通常学習",
        evidence: [{ sourceId: MANUAL_SOURCE_ID, quote: "保護者が手動で追加" }],
      },
    });
  }

  function discard() {
    if (!confirm("この計画案を破棄しますか？（登録済みのタスクは変わりません）")) return;
    updateState((s) => ({ ...s, draft: null }));
  }

  function confirmPlan() {
    const changes = diff.filter((d) => d.kind !== "same" && approved.has(d.id)).length;
    if (changes === 0 && !confirm("反映する変更がありません。計画案を閉じますか？")) return;
    updateState((s) => {
      const { tasks, record } = applyDiff(s.tasks, draft, diff, approved, () => newId("task"));
      return { ...s, tasks, plans: [record, ...s.plans], draft: null };
    });
    router.push("/");
  }

  return (
    <section id="draft" className="scroll-mt-16 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">3. 計画案を確認</h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            {formatShort(draft.params.startDate)} 〜 {formatShort(draft.params.endDate)} ・ {draft.tasks.length}タスク
            {draft.mode === "demo" && <span className="ml-2 whitespace-nowrap rounded bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">デモ</span>}
          </p>
        </div>
        <button className={btn.danger} onClick={discard}>
          破棄
        </button>
      </div>

      <VerificationPanel draft={draft} sources={state.sources} />

      <div className="space-y-3">
        {dates.map((date) => {
          const tasks = draft.tasks.filter((t) => t.date === date);
          return (
            <article key={date} className="rounded-2xl border border-zinc-200" data-testid={`draft-day-${date}`}>
              <header className="flex flex-wrap items-center gap-2 px-4 pb-1 pt-3">
                <h3 className="font-bold">{formatShort(date)}</h3>
                {lessons.has(date) && <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-bold text-zinc-700">授業日</span>}
                {draft.dayNotes[date] && <span className="text-xs text-zinc-500">{draft.dayNotes[date]}</span>}
              </header>
              {warnings[date]?.map((w) => (
                <p key={w} className="mx-3 mt-1 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                  ⚠ {w}
                </p>
              ))}
              <ul className="divide-y divide-zinc-100 px-4">
                {tasks.map((t) => (
                  <li key={t.id} className="py-2.5">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded border-2 border-zinc-300" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-start gap-2">
                          <SubjectChip subject={t.subject} />
                          <span className="font-bold leading-snug">{t.title}</span>
                        </p>
                        {t.detail && <p className="mt-0.5 text-xs text-zinc-500">{t.detail}</p>}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap justify-end gap-0.5">
                      <button className={btn.ghost} onClick={() => setEvidenceFor(t)}>
                        根拠を確認
                      </button>
                      <button className={btn.ghost} onClick={() => setEditing({ task: t, isNew: false })}>
                        編集
                      </button>
                      <button className={btn.danger} onClick={() => removeTask(t)}>
                        削除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="px-2 pb-2">
                <button className={`${btn.ghost} w-full`} onClick={() => addTask(date)}>
                  ＋ タスクを追加
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {hasExisting && (
        <DiffPanel
          diff={diff}
          approved={approved}
          onToggle={(id, v) => setOverrides((o) => ({ ...o, [id]: v }))}
        />
      )}

      <div className="sticky bottom-20 z-10 md:bottom-4">
        <button className={`${btn.primary} w-full shadow-lg`} onClick={confirmPlan}>
          {hasExisting ? "承認した変更でこの計画を確定" : "この計画で確定"}
        </button>
      </div>

      {editing && <TaskEditor task={editing.task} isNew={editing.isNew} onSave={saveTask} onClose={() => setEditing(null)} />}
      {evidenceFor && <EvidenceSheet task={evidenceFor} sources={state.sources} onClose={() => setEvidenceFor(null)} />}
    </section>
  );
}

// ---- 根拠 ----

export function sourceLabel(sourceId: string, sources: SourceDocument[]): { name: string; category: string; exists: boolean } {
  if (sourceId === RULE_SOURCE_ID) return { name: "アプリの固定ルール", category: "ルール", exists: false };
  if (sourceId === MANUAL_SOURCE_ID) return { name: "保護者が追加", category: "手動", exists: false };
  const s = sources.find((x) => x.id === sourceId);
  return s ? { name: s.name, category: s.category, exists: true } : { name: "削除済みの資料", category: "不明", exists: false };
}

function EvidenceSheet({ task, sources, onClose }: { task: DraftTask; sources: SourceDocument[]; onClose: () => void }) {
  return (
    <Sheet title="根拠を確認" onClose={onClose}>
      <p className="font-bold">{task.title}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-zinc-500">日付</dt>
        <dd>{formatShort(task.date)}</dd>
        <dt className="text-zinc-500">教材</dt>
        <dd>{task.material || "—"}</dd>
        <dt className="text-zinc-500">テキスト番号</dt>
        <dd>{task.textbookNumber || "—"}</dd>
        <dt className="text-zinc-500">範囲</dt>
        <dd>{task.range || "—"}</dd>
      </dl>
      <h3 className="mt-4 text-sm font-bold">根拠となった資料</h3>
      <ul className="mt-2 space-y-2">
        {task.evidence.map((e, i) => {
          const s = sourceLabel(e.sourceId, sources);
          return (
            <li key={i} className="rounded-xl border border-zinc-200 p-3">
              <p className="text-xs font-bold text-zinc-500">{s.category}</p>
              <p className="break-all text-sm font-bold">{s.name}</p>
              <blockquote className="mt-1.5 border-l-2 border-zinc-300 pl-2 text-sm text-zinc-700">{e.quote}</blockquote>
              {s.exists && (
                <button className={`${btn.ghost} mt-1 -ml-3`} onClick={() => openOriginal(e.sourceId)}>
                  原本を開く
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

// ---- 検証結果 ----

const CHECK_LABELS: [keyof Omit<DayCheck, "date">, string][] = [
  ["distributed", "配布済み"],
  ["textbookNumber", "テキスト番号"],
  ["pages", "ページ"],
  ["testDate", "テスト日"],
  ["corePlus", "コアプラス"],
  ["kotobaNavi", "言葉ナビ"],
  ["lessonDayLoad", "授業日の量"],
  ["duplicates", "重複"],
];

const STATUS: Record<CheckItem["status"], { label: string; cls: string }> = {
  ok: { label: "OK", cls: "bg-emerald-50 text-emerald-700" },
  fixed: { label: "修正", cls: "bg-blue-50 text-blue-700" },
  excluded: { label: "除外", cls: "bg-amber-50 text-amber-800" },
  na: { label: "—", cls: "text-zinc-400" },
};

function VerificationPanel({ draft, sources }: { draft: PlanDraft; sources: SourceDocument[] }) {
  const counts = draft.verification.dayChecks.reduce(
    (acc, d) => {
      for (const [k] of CHECK_LABELS) acc[d[k].status]++;
      return acc;
    },
    { ok: 0, fixed: 0, excluded: 0, na: 0 },
  );
  return (
    <div className="space-y-2 rounded-2xl bg-zinc-50 p-4">
      <p className="text-sm font-bold">AIによる検証結果</p>
      <p className="text-sm leading-relaxed text-zinc-700">{draft.verification.summary}</p>
      <p className="text-xs text-zinc-500">
        修正 {counts.fixed}件 ・ 除外 {draft.excluded.length}件 ・ 不明事項{" "}
        {draft.analysis.unknowns.length}件
      </p>

      <Details title={`除外したタスク（${draft.excluded.length}件）`}>
        {draft.excluded.length === 0 ? (
          <p className="text-sm text-zinc-500">なし</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {draft.excluded.map((x, i) => (
              <li key={i}>
                <span className="font-bold">
                  {/^\d{4}-\d{2}-\d{2}$/.test(x.date) ? formatShort(x.date) : x.date} {x.title}
                </span>
                <span className="block text-xs text-zinc-500">{x.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </Details>

      <Details title="資料の確認内容（①〜⑩）">
        <p className="mb-2 text-sm">現在のクラス: {draft.analysis.currentClass}</p>
        <ol className="space-y-1.5 text-sm">
          {draft.analysis.steps.map((s, i) => (
            <li key={i}>
              <span className="font-bold">{s.step}</span>
              <span className="block text-zinc-700">{s.finding}</span>
              {s.sourceIds.length > 0 && (
                <span className="block text-xs text-zinc-400">
                  根拠: {s.sourceIds.map((id) => sourceLabel(id, sources).name).join("、")}
                </span>
              )}
            </li>
          ))}
        </ol>
        {draft.analysis.unknowns.length > 0 && (
          <>
            <p className="mt-3 text-sm font-bold">不明として扱った事項</p>
            <ul className="list-disc pl-5 text-sm text-zinc-700">
              {draft.analysis.unknowns.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </>
        )}
      </Details>

      <Details title="1日ごとの検証">
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead>
              <tr className="text-left text-zinc-500">
                <th className="p-1">日付</th>
                {CHECK_LABELS.map(([k, l]) => (
                  <th key={k} className="p-1 font-medium">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.verification.dayChecks.map((d) => (
                <tr key={d.date} className="border-t border-zinc-200">
                  <td className="whitespace-nowrap p-1 font-bold">{/^\d{4}-/.test(d.date) ? formatShort(d.date) : d.date}</td>
                  {CHECK_LABELS.map(([k]) => (
                    <td key={k} className="p-1" title={d[k].note}>
                      <span className={`rounded px-1 py-0.5 font-bold ${STATUS[d[k].status].cls}`}>{STATUS[d[k].status].label}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-[11px] text-zinc-400">PCではマウスを重ねると確認内容が表示されます。</p>
      </Details>
    </div>
  );
}

function Details({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl bg-white px-3 py-1">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-bold">
        {title}
        <span className="text-zinc-400 transition group-open:rotate-180">▾</span>
      </summary>
      <div className="pb-3 pt-1">{children}</div>
    </details>
  );
}

// ---- 差分 ----

const KIND: Record<Exclude<DiffItem["kind"], "same">, { label: string; cls: string }> = {
  add: { label: "追加", cls: "bg-emerald-50 text-emerald-700" },
  change: { label: "変更", cls: "bg-blue-50 text-blue-700" },
  remove: { label: "削除候補", cls: "bg-red-50 text-red-700" },
};

function DiffPanel({
  diff,
  approved,
  onToggle,
}: {
  diff: DiffItem[];
  approved: Set<string>;
  onToggle: (id: string, v: boolean) => void;
}) {
  const visible = diff.filter((d): d is Exclude<DiffItem, { kind: "same" }> => d.kind !== "same");
  const same = diff.length - visible.length;
  return (
    <div className="space-y-2 rounded-2xl border border-zinc-200 p-4" data-testid="diff-panel">
      <p className="font-bold">現在の計画との差分</p>
      <p className="text-sm text-zinc-500">
        チェックした変更だけを反映します。削除候補は初期状態では反映しません。変更なし {same}件。
      </p>
      {visible.length === 0 ? (
        <p className="text-sm text-zinc-500">変更はありません。</p>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {visible.map((d) => {
            const task = d.kind === "remove" ? d.existing : d.draft;
            return (
              <li key={d.id}>
                <label className="flex min-h-12 cursor-pointer items-start gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={approved.has(d.id)}
                    onChange={(e) => onToggle(d.id, e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 accent-zinc-900"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold ${KIND[d.kind].cls}`}>{KIND[d.kind].label}</span>
                    <span className="font-bold">{formatShort(task.date)}</span> {task.title}
                    {d.kind === "change" && (
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        変更前: {d.existing.title}
                        {d.fields.length > 0 && `（${d.fields.join("・")}）`}
                      </span>
                    )}
                    {d.kind === "remove" && d.existing.completed && (
                      <span className="mt-0.5 block text-xs text-zinc-500">完了済みのタスクです</span>
                    )}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
