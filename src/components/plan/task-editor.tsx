"use client";

import { useState } from "react";
import { SUBJECTS, TASK_CATEGORIES, type DraftTask, type Subject, type TaskCategory } from "@/lib/types";
import { Sheet } from "../sheet";
import { btn, field } from "../ui";

export function TaskEditor({
  task,
  isNew,
  onSave,
  onClose,
}: {
  task: DraftTask;
  isNew: boolean;
  onSave: (t: DraftTask) => void;
  onClose: () => void;
}) {
  const [t, setT] = useState(task);
  const set = <K extends keyof DraftTask>(k: K, v: DraftTask[K]) => setT((p) => ({ ...p, [k]: v }));

  return (
    <Sheet title={isNew ? "タスクを追加" : "タスクを編集"} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!t.title.trim()) return;
          onSave({ ...t, title: t.title.trim() });
        }}
      >
        <L label="日付">
          <input type="date" required value={t.date} onChange={(e) => set("date", e.target.value)} className={field} />
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="教科">
            <select value={t.subject} onChange={(e) => set("subject", e.target.value as Subject)} className={field}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </L>
          <L label="分類">
            <select value={t.category} onChange={(e) => set("category", e.target.value as TaskCategory)} className={field}>
              {TASK_CATEGORIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </L>
        </div>
        <L label="タイトル（子どもに表示）">
          <input required value={t.title} onChange={(e) => set("title", e.target.value)} className={field} name="title" />
        </L>
        <div className="grid grid-cols-3 gap-3">
          <L label="教材">
            <input value={t.material} onChange={(e) => set("material", e.target.value)} className={field} />
          </L>
          <L label="テキスト番号">
            <input value={t.textbookNumber} onChange={(e) => set("textbookNumber", e.target.value)} className={field} />
          </L>
          <L label="範囲">
            <input value={t.range} onChange={(e) => set("range", e.target.value)} className={field} />
          </L>
        </div>
        <L label="補足">
          <textarea rows={2} value={t.detail} onChange={(e) => set("detail", e.target.value)} className={field} />
        </L>
        {isNew && <p className="text-xs text-zinc-500">手動で追加したタスクは「保護者が追加」として記録されます。</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" className={`${btn.secondary} flex-1`} onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className={`${btn.primary} flex-1`}>
            保存
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-bold text-zinc-600">{label}</span>
      {children}
    </label>
  );
}
