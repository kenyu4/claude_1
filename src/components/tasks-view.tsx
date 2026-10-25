"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, eachDate, formatLong, formatShort, weekRange } from "@/lib/date";
import { sortTasks } from "@/lib/diff";
import { holidayName } from "@/lib/holidays";
import { updateState, useAppState, useHydrated } from "@/lib/storage";
import type { Task } from "@/lib/types";
import { useToday } from "@/lib/use-today";
import { ProgressBar, SubjectChip } from "./ui";

type View = "today" | "tomorrow" | "week" | "all";
const VIEWS: { key: View; label: string }[] = [
  { key: "today", label: "今日" },
  { key: "tomorrow", label: "明日" },
  { key: "week", label: "今週" },
  { key: "all", label: "すべて" },
];

function toggleTask(id: string) {
  updateState((s) => ({
    ...s,
    tasks: s.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            completed: !t.completed,
            completedAt: t.completed ? null : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        : t,
    ),
  }));
}

function setHideCompleted(v: boolean) {
  updateState((s) => ({ ...s, prefs: { ...s.prefs, hideCompleted: v } }));
}

export function TasksView() {
  const state = useAppState();
  const hydrated = useHydrated();
  const today = useToday();
  const [view, setView] = useState<View>("today");
  const hide = state.prefs.hideCompleted;
  const todayRef = useRef<HTMLElement>(null);

  const byDate = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of sortTasks(state.tasks)) m.set(t.date, [...(m.get(t.date) ?? []), t]);
    return m;
  }, [state.tasks]);

  const dates = useMemo(() => {
    if (!today) return [];
    if (view === "today") return [today];
    if (view === "tomorrow") return [addDays(today, 1)];
    if (view === "week") {
      const [s, e] = weekRange(today);
      return eachDate(s, e).filter((d) => d === today || byDate.has(d));
    }
    return [...new Set([...byDate.keys(), today])].sort();
  }, [view, today, byDate]);

  const inView = dates.flatMap((d) => byDate.get(d) ?? []);
  const done = inView.filter((t) => t.completed).length;
  const pct = inView.length ? Math.round((done / inView.length) * 100) : 0;

  const todayRemaining = (byDate.get(today) ?? []).filter((t) => !t.completed).length;
  useEffect(() => {
    if (!hydrated) return;
    document.title = todayRemaining > 0 ? `(${todayRemaining}) 家庭学習タスク` : "家庭学習タスク";
  }, [todayRemaining, hydrated]);

  useEffect(() => {
    if (view === "week" || view === "all") todayRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [view]);

  if (!hydrated || !today) {
    return <div className="h-40 animate-pulse rounded-2xl bg-zinc-50" aria-label="読み込み中" />;
  }

  const viewLabel = VIEWS.find((v) => v.key === view)!.label;

  return (
    <div className="space-y-4">
      <section aria-label="進捗">
        <h1 className="text-xl font-bold tracking-tight">家庭学習タスク</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{formatLong(today)}</p>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-sm text-zinc-500">
            {viewLabel}
            <span className="ml-2 text-2xl font-bold tabular-nums text-zinc-900">
              {done} / {inView.length}
            </span>
            <span className="ml-1 text-zinc-900">完了</span>
          </p>
          <p className="text-2xl font-bold tabular-nums">{pct}%</p>
        </div>
        <div className="mt-2">
          <ProgressBar value={pct} />
        </div>
      </section>

      <div className="sticky top-12 z-10 -mx-4 space-y-2 bg-white/95 px-4 py-2 backdrop-blur">
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-zinc-100 p-1" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={`h-10 rounded-lg text-sm font-bold ${view === v.key ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <label className="flex min-h-9 cursor-pointer items-center justify-end gap-2 text-sm text-zinc-600">
          完了タスクを隠す
          <input
            type="checkbox"
            role="switch"
            checked={hide}
            onChange={(e) => setHideCompleted(e.target.checked)}
            className="peer sr-only"
          />
          <span className="relative h-6 w-10 rounded-full bg-zinc-200 transition peer-checked:bg-zinc-900 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-4" />
        </label>
      </div>

      {state.tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center">
          <p className="font-bold">まだタスクがありません</p>
          <p className="mt-1 text-sm text-zinc-500">SAPIXの資料をアップロードして計画を作りましょう。</p>
          <Link href="/plan" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-zinc-900 px-5 text-sm font-bold text-white">
            計画を作成する
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {dates.map((date) => (
            <DayCard
              key={date}
              ref={date === today ? todayRef : undefined}
              date={date}
              isToday={date === today}
              isPast={date < today}
              tasks={byDate.get(date) ?? []}
              hideCompleted={hide}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DayCard({
  date,
  isToday,
  isPast,
  tasks,
  hideCompleted,
  ref,
}: {
  date: string;
  isToday: boolean;
  isPast: boolean;
  tasks: Task[];
  hideCompleted: boolean;
  ref?: React.Ref<HTMLElement>;
}) {
  const done = tasks.filter((t) => t.completed).length;
  const allDone = tasks.length > 0 && done === tasks.length;
  const shown = hideCompleted ? tasks.filter((t) => !t.completed) : tasks;

  return (
    <section
      ref={ref}
      className={`scroll-mt-32 rounded-2xl ${
        isToday ? "border-2 border-zinc-900 shadow-[0_4px_20px_rgba(0,0,0,0.06)]" : "border border-zinc-200"
      } ${isPast && !isToday ? "bg-zinc-50/50" : "bg-white"}`}
    >
      <header className="flex items-center justify-between px-4 pb-1 pt-3">
        <h2 className={`font-bold ${isToday ? "text-lg" : "text-base"}`}>
          {formatShort(date)}
          {isToday && <span className="ml-2 rounded-md bg-zinc-900 px-1.5 py-0.5 align-middle text-[11px] text-white">今日</span>}
          {holidayName(date) && (
            <span className="ml-2 align-middle text-xs font-medium text-rose-600">{holidayName(date)}</span>
          )}
        </h2>
        <span className="text-sm tabular-nums text-zinc-500">
          {done} / {tasks.length}
        </span>
      </header>

      {allDone && (
        <p className="mx-3 mb-1 mt-1 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-3 text-[15px] font-bold text-emerald-800">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.6} aria-hidden>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isToday ? "今日のタスク完了！" : "この日のタスク完了！"}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="px-4 pb-4 pt-1 text-sm text-zinc-400">タスクはありません</p>
      ) : (
        <ul className="px-1.5 pb-1.5">
          {shown.map((t) => (
            <li key={t.id}>
              <TaskRow task={t} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskRow({ task }: { task: Task }) {
  const c = task.completed;
  return (
    <button
      role="checkbox"
      aria-checked={c}
      onClick={() => toggleTask(task.id)}
      className="flex min-h-14 w-full items-start gap-3 rounded-xl px-2.5 py-3 text-left active:bg-zinc-50"
    >
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition ${
          c ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white"
        }`}
        aria-hidden
      >
        {c && (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3.2}>
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className={`min-w-0 flex-1 transition ${c ? "opacity-40" : ""}`}>
        <span className="flex items-start gap-2">
          <SubjectChip subject={task.subject} />
          <span className={`text-[16px] font-bold leading-snug ${c ? "line-through" : ""}`}>{task.title}</span>
        </span>
        {task.detail && <span className={`mt-1 block text-[13px] leading-snug text-zinc-500 ${c ? "line-through" : ""}`}>{task.detail}</span>}
      </span>
    </button>
  );
}
