"use client";

import { useState } from "react";
import { addDays } from "@/lib/date";
import type { GenerateRequest, GenerationOutput, VerificationOutput } from "@/lib/plan-schema";
import { buildDraft } from "@/lib/plan-rules";
import { updateState } from "@/lib/storage";
import type { AppState, PlanParams } from "@/lib/types";
import { btn, field } from "../ui";

type Phase = "idle" | "generating" | "verifying" | "error";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `エラーが発生しました (${res.status})`);
  return json;
}

export function GeneratePanel({ state, today, mode }: { state: AppState; today: string; mode: "live" | "demo" | null }) {
  const [params, setParams] = useState<PlanParams>(() => ({
    today,
    startDate: today,
    endDate: addDays(today, 13),
    currentClass: state.draft?.params.currentClass ?? "",
    notes: state.draft?.params.notes ?? "",
  }));
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const active = state.sources.filter((s) => s.active);
  const running = phase === "generating" || phase === "verifying";

  async function run() {
    if (state.draft && !confirm("作成中の計画案があります。新しい計画案で置き換えますか？\n（登録済みのタスクは変わりません）")) return;
    setError("");
    const req: GenerateRequest = {
      sources: active.map(({ id, name, category, memo, mimeType, fileId, uploadedAt }) => ({
        id,
        name,
        category,
        memo,
        mimeType,
        fileId,
        uploadedAt,
      })),
      params,
      // 直近の実施状況を参考に渡す（完了済みの繰り返しを避けるため）
      existingTasks: state.tasks
        .filter((t) => t.date >= addDays(params.startDate, -14) && t.date <= params.endDate)
        .map((t) => ({ date: t.date, subject: t.subject, title: t.title, completed: t.completed })),
    };
    try {
      setPhase("generating");
      const g = await postJson<{ mode: "live" | "demo"; generation: GenerationOutput }>("/api/plan/generate", req);
      setPhase("verifying");
      const v = await postJson<{ verification: VerificationOutput }>("/api/plan/verify", { ...req, generation: g.generation });
      const draft = buildDraft({
        mode: g.mode,
        params,
        sourceIds: active.map((s) => s.id),
        generation: g.generation,
        verification: v.verification,
      });
      updateState((s) => ({ ...s, draft }));
      setPhase("idle");
      requestAnimationFrame(() => document.getElementById("draft")?.scrollIntoView({ behavior: "smooth" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "失敗しました");
      setPhase("error");
    }
  }

  const set = (k: keyof PlanParams) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setParams((p) => ({ ...p, [k]: e.target.value }));

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">2. AIで計画案を作成</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          資料に書かれていることだけを根拠に作成し、1日ずつ検証してから表示します。
        </p>
      </div>
      {mode === "demo" && (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          デモモードです（ANTHROPIC_API_KEY 未設定）。資料は読み取らず、操作確認用の計画案を作ります。
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="今日の日付">
          <input type="date" value={params.today} onChange={set("today")} className={field} />
        </Field>
        <Field label="計画の開始日">
          <input type="date" value={params.startDate} onChange={set("startDate")} className={field} />
        </Field>
        <Field label="計画の終了日">
          <input type="date" value={params.endDate} min={params.startDate} onChange={set("endDate")} className={field} />
        </Field>
      </div>
      <Field label="現在のクラス（任意・空欄なら資料から判断）">
        <input value={params.currentClass} onChange={set("currentClass")} placeholder="例: α2" className={field} />
      </Field>
      <Field label="補足（任意）">
        <textarea
          value={params.notes}
          onChange={set("notes")}
          rows={2}
          placeholder="例: 10/28は学校行事で家庭学習なし"
          className={field}
        />
      </Field>

      <button className={`${btn.primary} w-full`} onClick={run} disabled={running || active.length === 0 || params.startDate > params.endDate}>
        {phase === "generating"
          ? "資料を解析して計画案を作成中…"
          : phase === "verifying"
            ? "計画案を1日ずつ検証中…"
            : "AIで計画案を作成"}
      </button>
      {running && (
        <p className="text-center text-xs text-zinc-500" aria-live="polite">
          {mode === "demo" ? "まもなく完了します" : "資料の量によって数分かかります。画面を閉じずにお待ちください。"}
        </p>
      )}
      {active.length === 0 && <p className="text-center text-sm text-zinc-500">計画に使う資料を1件以上選んでください</p>}
      {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-zinc-600">{label}</span>
      {children}
    </label>
  );
}
