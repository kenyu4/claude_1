"use client";

import { useEffect, useState } from "react";
import { useAppState, useHydrated } from "@/lib/storage";
import { useToday } from "@/lib/use-today";
import { ClassPanel } from "./class-panel";
import { DataTools } from "./data-tools";
import { DraftReview } from "./draft-review";
import { GeneratePanel } from "./generate-panel";
import { SourcesPanel } from "./sources-panel";

export function PlanView() {
  const state = useAppState();
  const hydrated = useHydrated();
  const today = useToday();
  const [mode, setMode] = useState<"live" | "demo" | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((j: { mode: "live" | "demo" }) => setMode(j.mode))
      .catch(() => setMode(null));
  }, []);

  useEffect(() => {
    document.title = "計画作成 | 家庭学習タスク";
  }, []);

  if (!hydrated || !today) return <div className="h-40 animate-pulse rounded-2xl bg-zinc-50" aria-label="読み込み中" />;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-xl font-bold tracking-tight">家庭学習計画を作る</h1>
        <p className="mt-0.5 text-sm text-zinc-500">保護者用 ・ 資料をもとにAIが計画案を作り、確認してから登録します</p>
      </div>
      <SourcesPanel sources={state.sources} />
      <ClassPanel settings={state.classSettings} sources={state.sources} />
      <GeneratePanel state={state} today={today} mode={mode} />
      {state.draft && <DraftReview state={state} />}
      <hr className="border-zinc-100" />
      <DataTools state={state} />
    </div>
  );
}
