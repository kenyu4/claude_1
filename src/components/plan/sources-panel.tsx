"use client";

import { useRef, useState } from "react";
import { deleteFile, getFile, putFile } from "@/lib/file-store";
import { newId, updateState } from "@/lib/storage";
import { SOURCE_CATEGORIES, type SourceCategory, type SourceDocument } from "@/lib/types";
import { btn, field } from "../ui";

const API_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const IMAGE_MAX_EDGE = 2400;
/** Vercel の関数リクエスト上限（約4.5MB）に対する目安 */
const UPLOAD_WARN_BYTES = 4.4 * 1024 * 1024;

export function guessCategory(name: string): SourceCategory {
  if (/結果|成績|偏差値|組分け/.test(name)) return "テスト結果";
  if (/範囲|コアプラス|言葉ナビ|対応表/.test(name)) return "確認テスト範囲";
  if (/ナビ|navi/i.test(name)) return "家庭学習ナビ";
  if (/時間割/.test(name)) return "時間割";
  if (/スケジュール|予定|年間|後期|前期/.test(name)) return "スケジュール";
  return "その他";
}

/** 大きな画像・非対応形式の画像はブラウザで JPEG に変換して送る */
async function prepareImage(file: File): Promise<File> {
  if (API_TYPES.includes(file.type) && file.size <= IMAGE_MAX_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  if (!blob) throw new Error("画像を変換できませんでした");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

interface UploadStatus {
  name: string;
  state: "uploading" | "done" | "error";
  message?: string;
}

export function SourcesPanel({ sources }: { sources: SourceDocument[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);
  const busy = statuses.some((s) => s.state === "uploading");

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = [...list];
    setStatuses(files.map((f) => ({ name: f.name, state: "uploading" })));
    const set = (i: number, s: Partial<UploadStatus>) =>
      setStatuses((prev) => prev.map((p, j) => (j === i ? { ...p, ...s } : p)));

    // 1件ずつ送る（1リクエストのサイズを小さく保つ）
    for (let i = 0; i < files.length; i++) {
      const original = files[i];
      try {
        let file = original;
        if (original.type.startsWith("image/")) file = await prepareImage(original);
        else if (original.type !== "application/pdf") throw new Error("PDFまたは画像のみ対応しています");

        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/files", { method: "POST", body });
        const json = (await res.json().catch(() => ({}))) as { fileId?: string; error?: string };
        if (!res.ok || !json.fileId) {
          throw new Error(
            json.error ??
              (res.status === 413 || file.size > UPLOAD_WARN_BYTES
                ? "ファイルが大きすぎます。ページを分けるか圧縮してください"
                : `アップロードに失敗しました (${res.status})`),
          );
        }
        const doc: SourceDocument = {
          id: newId("src"),
          name: original.name,
          category: guessCategory(original.name),
          memo: "",
          mimeType: file.type,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          fileId: json.fileId,
          active: true,
        };
        await putFile(doc.id, file);
        updateState((s) => ({ ...s, sources: [doc, ...s.sources] }));
        set(i, { state: "done" });
      } catch (e) {
        set(i, { state: "error", message: e instanceof Error ? e.message : "失敗しました" });
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold">1. 資料をアップロード</h2>
        <p className="mt-0.5 text-sm text-zinc-500">
          最新の家庭学習ナビ・時間割・スケジュール・確認テスト範囲表・成績表など（PDF・画像、複数可）
        </p>
      </div>

      <label
        className={`flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 px-4 py-5 text-center active:bg-zinc-50 ${
          busy ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <span className="font-bold">ファイルを選ぶ</span>
        <span className="mt-1 text-xs text-zinc-500">PDF / JPEG / PNG ・ 複数選択できます</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,image/*"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="file-input"
        />
      </label>

      {statuses.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {statuses.map((s, i) => (
            <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2">
              <span className="truncate">{s.name}</span>
              <span
                className={`shrink-0 text-xs font-bold ${
                  s.state === "error" ? "text-red-600" : s.state === "done" ? "text-emerald-700" : "text-zinc-500"
                }`}
              >
                {s.state === "uploading" ? "送信中…" : s.state === "done" ? "完了" : s.message}
              </span>
            </li>
          ))}
        </ul>
      )}

      {sources.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-zinc-500">
            計画に使う資料にチェック（{sources.filter((s) => s.active).length} / {sources.length}件）。分類は必ず確認してください。
          </p>
          <ul className="space-y-2">
            {sources.map((s) => (
              <SourceRow key={s.id} source={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function patchSource(id: string, patch: Partial<SourceDocument>) {
  updateState((s) => ({ ...s, sources: s.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
}

export async function openOriginal(sourceId: string) {
  const blob = await getFile(sourceId);
  if (!blob) {
    alert("この端末には原本が保存されていません。");
    return;
  }
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function SourceRow({ source }: { source: SourceDocument }) {
  async function remove() {
    if (!confirm(`「${source.name}」を資料一覧から削除しますか？\n（登録済みのタスクは削除されません）`)) return;
    updateState((s) => ({ ...s, sources: s.sources.filter((x) => x.id !== source.id) }));
    await deleteFile(source.id);
    fetch(`/api/files/${encodeURIComponent(source.fileId)}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <li className={`rounded-xl border p-3 ${source.active ? "border-zinc-300" : "border-zinc-200 bg-zinc-50 opacity-70"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={source.active}
          onChange={(e) => patchSource(source.id, { active: e.target.checked })}
          className="mt-1 h-5 w-5 shrink-0 accent-zinc-900"
          aria-label={`${source.name} を計画に使う`}
        />
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-bold">{source.name}</p>
          <p className="text-xs text-zinc-500">
            {source.mimeType === "application/pdf" ? "PDF" : "画像"} ・ {(source.size / 1024 / 1024).toFixed(1)}MB ・{" "}
            {new Date(source.uploadedAt).toLocaleDateString("ja-JP")}
          </p>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select
          value={source.category}
          onChange={(e) => patchSource(source.id, { category: e.target.value as SourceCategory })}
          className={field}
          aria-label="資料の分類"
        >
          {SOURCE_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input
          value={source.memo}
          onChange={(e) => patchSource(source.id, { memo: e.target.value })}
          placeholder="メモ（例: 理科コアプラス確認テスト範囲表）"
          className={field}
          aria-label="資料のメモ"
        />
      </div>
      <div className="mt-1 flex justify-end gap-1">
        <button className={btn.ghost} onClick={() => openOriginal(source.id)}>
          原本を開く
        </button>
        <button className={btn.danger} onClick={remove}>
          削除
        </button>
      </div>
    </li>
  );
}
