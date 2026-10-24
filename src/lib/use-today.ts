"use client";

import { useSyncExternalStore } from "react";
import { toDateKey } from "./date";

// 今日の日付はブラウザのローカル時刻で決める（ビルド時やサーバーの時刻を使わない）。
// 日付が変わったら再描画する。

function subscribe(cb: () => void) {
  const id = window.setInterval(cb, 60_000);
  const onVisible = () => cb();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

export function useToday(): string {
  return useSyncExternalStore(
    subscribe,
    () => toDateKey(new Date()),
    () => "",
  );
}
