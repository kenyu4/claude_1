"use client";

import { formatShort } from "@/lib/date";
import { replaceState, updateState } from "@/lib/storage";
import type { AppState } from "@/lib/types";
import { btn } from "../ui";

export function DataTools({ state }: { state: AppState }) {
  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `home-study-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as AppState;
      if (!Array.isArray(data.tasks) || !Array.isArray(data.sources)) throw new Error();
      if (!confirm(`タスク${data.tasks.length}件・資料${data.sources.length}件を読み込みます。現在のデータは置き換えられます。`)) return;
      replaceState(data);
    } catch {
      alert("読み込めないファイルです。");
    }
  }

  function clearTasks() {
    if (!confirm(`登録済みのタスク${state.tasks.length}件をすべて削除しますか？（元に戻せません）`)) return;
    updateState((s) => ({ ...s, tasks: [], plans: [] }));
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold">データ管理</h2>
      <p className="text-sm text-zinc-500">
        登録済みタスク {state.tasks.length}件 ・ 資料 {state.sources.length}件。データはこの端末のブラウザに保存されています。
      </p>
      {state.plans.length > 0 && (
        <ul className="space-y-1 text-sm text-zinc-600">
          {state.plans.slice(0, 5).map((p) => (
            <li key={p.id}>
              {new Date(p.confirmedAt).toLocaleDateString("ja-JP")} 確定: {formatShort(p.startDate)}〜{formatShort(p.endDate)}（追加{p.added}・変更
              {p.changed}・削除{p.removed}）
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <button className={btn.secondary} onClick={exportJson}>
          バックアップを保存
        </button>
        <label className={`${btn.secondary} cursor-pointer`}>
          バックアップから復元
          <input type="file" accept="application/json" className="sr-only" onChange={(e) => importJson(e.target.files?.[0])} />
        </label>
        <button className={btn.danger} onClick={clearTasks} disabled={state.tasks.length === 0}>
          タスクを全削除
        </button>
      </div>
    </section>
  );
}
