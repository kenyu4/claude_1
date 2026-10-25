import "server-only";
import type { z } from "zod";
import { toJsonSchema, type SourceRef } from "@/lib/plan-schema";
import { getClient, MODEL } from "./anthropic";
import { sourceBlocks } from "./prompts";

/**
 * 資料＋指示を送り、構造化出力（JSON Schema）で結果を受け取って zod で検証する。
 * 長い入出力になるためストリーミングで受け、finalMessage() で完成形を得る。
 */
export async function runStructured<T extends z.ZodType>(
  schema: T,
  input: { system: string; sources: SourceRef[]; instruction: string },
): Promise<z.infer<T>> {
  const stream = getClient().beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: toJsonSchema(schema) },
    },
    // 安全分類器による拒否時はサーバー側で別モデルに自動フォールバック
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: input.system,
    messages: [
      {
        role: "user",
        content: [...sourceBlocks(input.sources), { type: "text", text: input.instruction }],
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("AIが処理を拒否しました。資料の内容を確認して再実行してください。");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("出力が長すぎて途中で切れました。計画期間を短くして再実行してください。");
  }

  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("AIの出力を読み取れませんでした。もう一度実行してください。");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error("AIの出力形式が想定と異なります。もう一度実行してください。");
  }
  return parsed.data;
}
