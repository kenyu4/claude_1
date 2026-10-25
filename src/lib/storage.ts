"use client";

import { useSyncExternalStore } from "react";
import type { AppState } from "./types";

// 永続化層。現在は localStorage だが、load/save の 2 関数を差し替えれば
// Supabase 等のリモートストアに移行できる。

const STORAGE_KEY = "sapix-home-study:v1";

export const EMPTY_STATE: AppState = {
  version: 1,
  tasks: [],
  sources: [],
  plans: [],
  draft: null,
  classSettings: { className: "", lessons: [], catalog: [], catalogSourceId: null, catalogNotes: "" },
  prefs: { hideCompleted: false },
};

function load(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...EMPTY_STATE,
      ...parsed,
      prefs: { ...EMPTY_STATE.prefs, ...parsed.prefs },
      classSettings: { ...EMPTY_STATE.classSettings, ...parsed.classSettings },
      version: 1,
    };
  } catch {
    return EMPTY_STATE;
  }
}

function save(state: AppState): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

let current: AppState | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function getSnapshot(): AppState {
  if (current === null) current = load();
  return current;
}

function getServerSnapshot(): AppState {
  return EMPTY_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** 状態を更新して即時保存する */
export function updateState(fn: (s: AppState) => AppState): void {
  const next = fn(getSnapshot());
  current = next;
  if (!save(next)) {
    alert("保存に失敗しました。ブラウザの保存容量を確認してください。");
  }
  emit();
}

export function replaceState(next: AppState): void {
  updateState(() => ({ ...EMPTY_STATE, ...next, version: 1 }));
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** クライアントで読み込み済みかどうか（SSR 時は false） */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function noopSubscribe() {
  return () => {};
}

export function newId(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}
