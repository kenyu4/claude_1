import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// AI 処理はすべてサーバー側。API キーは環境変数からのみ読み、ブラウザには渡さない。

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

export function isDemoMode(): boolean {
  if (process.env.DEMO_MODE === "1") return true;
  return !process.env.ANTHROPIC_API_KEY;
}

let client: Anthropic | null = null;

export function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function errorMessage(err: unknown): { message: string; status: number } {
  if (err instanceof Anthropic.AuthenticationError) {
    return { message: "APIキーが無効です。ANTHROPIC_API_KEY を確認してください。", status: 500 };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return { message: "AIの利用上限に達しました。しばらく待ってから再実行してください。", status: 429 };
  }
  if (err instanceof Anthropic.BadRequestError) {
    return { message: `AIへのリクエストが不正です: ${err.message}`, status: 400 };
  }
  if (err instanceof Anthropic.APIError) {
    return { message: `AI APIエラー (${err.status ?? "?"}): ${err.message}`, status: 502 };
  }
  if (err instanceof Error) return { message: err.message, status: 500 };
  return { message: "不明なエラーが発生しました。", status: 500 };
}
