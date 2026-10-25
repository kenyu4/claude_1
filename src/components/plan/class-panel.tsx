"use client";

import { useState } from "react";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/date";
import { WEEKDAY_NAMES, type TimetableOutput } from "@/lib/plan-schema";
import { updateState } from "@/lib/storage";
import {
  LESSON_SUBJECTS,
  type ClassSchedule,
  type ClassSettings,
  type LessonDay,
  type LessonSubject,
  type SourceDocument,
} from "@/lib/types";
import { btn, field, SUBJECT_STYLE } from "../ui";

const MANUAL = "__manual__";

function patch(p: Partial<ClassSettings>) {
  updateState((s) => ({ ...s, classSettings: { ...s.classSettings, ...p } }));
}

export function lessonsSummary(lessons: LessonDay[]): string {
  const days = WEEKDAY_ORDER.map((w) => lessons.find((l) => l.weekday === w)).filter(
    (l): l is LessonDay => !!l && l.subjects.length > 0,
  );
  return days.length ? days.map((l) => `${WEEKDAY_LABELS[l.weekday]} ${l.subjects.join("・")}`).join(" / ") : "未設定";
}

export function ClassPanel({ settings, sources }: { settings: ClassSettings; sources: SourceDocument[] }) {
  const timetables = sources.filter((s) => s.category === "時間割");
  const [sourceId, setSourceId] = useState(() => settings.catalogSourceId ?? timetables[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState(
    () => settings.className !== "" && !settings.catalog.some((c) => c.name === settings.className),
  );
  const selected = timetables.find((t) => t.id === sourceId) ?? timetables[0];

  async function readTimetable() {
    if (!selected) return;
    setError("");
    setLoading(true);
    try {
      const { id, name, category, memo, mimeType, fileId, uploadedAt } = selected;
      const res = await fetch("/api/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: [{ id, name, category, memo, mimeType, fileId, uploadedAt }] }),
      });
      const json = (await res.json().catch(() => ({}))) as { timetable?: TimetableOutput; error?: string };
      if (!res.ok || !json.timetable) throw new Error(json.error ?? `読み取りに失敗しました (${res.status})`);
      const catalog: ClassSchedule[] = json.timetable.classes.map((c) => ({
        name: c.name,
        quote: c.quote,
        lessons: c.lessons.map((l) => ({ weekday: WEEKDAY_NAMES.indexOf(l.weekday), subjects: l.subjects })),
      }));
      // 選択中のクラスが一覧にあれば、その授業も最新の時間割で置き換える
      const current = catalog.find((c) => c.name === settings.className);
      patch({
        catalog,
        catalogSourceId: selected.id,
        catalogNotes: json.timetable.notes,
        ...(current ? { lessons: current.lessons } : {}),
      });
      if (current) setManual(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function chooseClass(value: string) {
    if (value === MANUAL) {
      setManual(true);
      patch({ className: "" });
      return;
    }
    setManual(false);
    const c = settings.catalog.find((x) => x.name === value);
    patch({ className: value, lessons: c ? c.lessons : settings.lessons });
  }

  function toggleSubject(weekday: number, subject: LessonSubject) {
    const day = settings.lessons.find((l) => l.weekday === weekday);
    const subjects = day?.subjects.includes(subject)
      ? day.subjects.filter((s) => s !== subject)
      : [...(day?.subjects ?? []), subject].sort((a, b) => LESSON_SUBJECTS.indexOf(a) - LESSON_SUBJECTS.indexOf(b));
    const lessons = [...settings.lessons.filter((l) => l.weekday !== weekday), { weekday, subjects }].filter(
      (l) => l.subjects.length > 0,
    );
    patch({ lessons });
  }

  const fromCatalog = settings.catalog.find((c) => c.name === settings.className);
  const edited =
    !!fromCatalog && lessonsSummary(fromCatalog.lessons) !== lessonsSummary(settings.lessons);

  return (
    <section className="space-y-3" data-testid="class-panel">
      <div>
        <h2 className="text-lg font-bold">2. クラスを選ぶ</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          選んだクラスの授業曜日・科目をもとに計画を作ります（授業日は軽め、祝日は除く）。
        </p>
      </div>

      <div className="space-y-2 rounded-2xl border border-zinc-200 p-3">
        <p className="text-sm font-bold">時間割からクラスを読み取る</p>
        {timetables.length === 0 ? (
          <p className="text-sm text-zinc-500">分類が「時間割」の資料をアップロードすると、クラスの一覧を読み取れます。</p>
        ) : (
          <>
            {timetables.length > 1 && (
              <select value={selected?.id} onChange={(e) => setSourceId(e.target.value)} className={field} aria-label="使う時間割">
                {timetables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <button className={`${btn.secondary} w-full`} onClick={readTimetable} disabled={loading}>
              {loading ? "時間割を読み取り中…" : settings.catalog.length ? "時間割をもう一度読み取る" : "時間割を読み取る"}
            </button>
          </>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {settings.catalogNotes && <p className="text-xs leading-relaxed text-zinc-500">読み取りメモ: {settings.catalogNotes}</p>}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-bold text-zinc-600">クラス</span>
        <select
          value={manual ? MANUAL : settings.className}
          onChange={(e) => chooseClass(e.target.value)}
          className={field}
          aria-label="クラス"
        >
          <option value="" disabled>
            選んでください
          </option>
          {settings.catalog.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name}（{lessonsSummary(c.lessons)}）
            </option>
          ))}
          <option value={MANUAL}>一覧にない（手入力）</option>
        </select>
      </label>
      {manual && (
        <input
          value={settings.className}
          onChange={(e) => patch({ className: e.target.value.trim() })}
          placeholder="クラス名（例: 5H）"
          className={field}
          aria-label="クラス名"
        />
      )}

      {(settings.className || manual) && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-zinc-600">
            授業曜日と科目（必ず時間割と見比べて確認。押すと切り替わります）
          </p>
          <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {WEEKDAY_ORDER.map((w) => {
              const subjects = settings.lessons.find((l) => l.weekday === w)?.subjects ?? [];
              return (
                <div key={w} className="flex items-center gap-2 px-3 py-2">
                  <span className={`w-6 shrink-0 text-sm font-bold ${subjects.length ? "text-zinc-900" : "text-zinc-400"}`}>
                    {WEEKDAY_LABELS[w]}
                  </span>
                  <div className="grid flex-1 grid-cols-4 gap-1.5">
                    {LESSON_SUBJECTS.map((sub) => {
                      const on = subjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          aria-pressed={on}
                          aria-label={`${WEEKDAY_LABELS[w]}曜 ${sub}`}
                          onClick={() => toggleSubject(w, sub)}
                          className={`h-9 rounded-lg text-xs font-bold ${
                            on ? SUBJECT_STYLE[sub].chip + " ring-1 ring-current" : "bg-zinc-50 text-zinc-300"
                          }`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-sm">
            <span className="font-bold">{settings.className || "（クラス名未入力）"}</span>
            <span className="ml-2 text-zinc-600">{lessonsSummary(settings.lessons)}</span>
          </p>
          {edited && <p className="text-xs text-amber-800">時間割の読み取り結果から手で修正しています。</p>}
          {fromCatalog?.quote && <p className="text-xs text-zinc-400">時間割の記述: {fromCatalog.quote}</p>}
        </div>
      )}
    </section>
  );
}
