import { z } from "zod";
import { SOURCE_CATEGORIES, SUBJECTS, TASK_CATEGORIES } from "./types";

// AI の出力形式（構造化出力の JSON Schema の元）と API の入出力スキーマ。
// サーバー・クライアント双方で使う。

const evidenceSchema = z.strictObject({
  sourceId: z.string().describe("根拠資料の id（資料一覧の id をそのまま書く）"),
  quote: z.string().describe("資料中の該当記述。資料の文言をそのまま短く抜き出す"),
});

export const aiTaskSchema = z.strictObject({
  subject: z.enum(SUBJECTS),
  category: z.enum(TASK_CATEGORIES),
  material: z.string().describe("教材名（例: デイリーサピックス、基礎力トレーニング、言葉ナビ）"),
  textbookNumber: z.string().describe("テキスト番号（例: D27）。資料で確認できなければ空文字"),
  range: z.string().describe("範囲・ページ（例: P44〜47）。資料で確認できなければ空文字"),
  title: z.string().describe("子どもが読むチェックリストの1行。例: 理科D27「溶解度②」テーマ1〜3＋確認問題1〜4"),
  detail: z.string().describe("補足（なぜこの日に置いたか、何回目か等）。不要なら空文字"),
  evidence: z.array(evidenceSchema).describe("このタスクの根拠。必ず1件以上"),
});
export type AiTask = z.infer<typeof aiTaskSchema>;

const aiDaySchema = z.strictObject({
  date: z.string().describe("YYYY-MM-DD"),
  note: z.string().describe("その日の位置づけ（授業日・テスト前日など）。不要なら空文字"),
  tasks: z.array(aiTaskSchema),
});

const excludedSchema = z.strictObject({
  date: z.string(),
  title: z.string(),
  reason: z.string().describe("除外理由（未配布、根拠不明など）"),
});

export const generationSchema = z.strictObject({
  analysis: z.strictObject({
    currentClass: z.string().describe("現在のクラス。資料で確認できなければ「不明」"),
    steps: z
      .array(
        z.strictObject({
          step: z.string().describe("確認順序の項目名（①今日の日付 〜 ⑩過去テスト結果・弱点）"),
          finding: z.string().describe("資料から確認できた内容。確認できなければ「不明」"),
          sourceIds: z.array(z.string()),
        }),
      )
      .describe("①〜⑩の順に10件"),
    unknowns: z.array(z.string()).describe("資料で確認できず不明として扱った事項"),
  }),
  lessonDays: z.array(z.string()).describe("計画期間内の SAPIX 授業日（YYYY-MM-DD）。資料で確認できた日のみ"),
  days: z.array(aiDaySchema),
  excluded: z.array(excludedSchema).describe("検討したが根拠不足・未配布などで入れなかったタスク"),
});
export type GenerationOutput = z.infer<typeof generationSchema>;

const checkItemSchema = z.strictObject({
  status: z.enum(["ok", "fixed", "excluded", "na"]).describe("ok=問題なし / fixed=修正した / excluded=除外した / na=該当なし"),
  note: z.string(),
});

export const verificationSchema = z.strictObject({
  summary: z.string().describe("検証結果の要約（保護者向け、日本語で3〜5文）"),
  dayChecks: z.array(
    z.strictObject({
      date: z.string(),
      distributed: checkItemSchema.describe("この日に教材は配布済みか"),
      textbookNumber: checkItemSchema.describe("テキスト番号は正しいか"),
      pages: checkItemSchema.describe("ページ番号は資料と一致しているか"),
      testDate: checkItemSchema.describe("確認テスト実施日は正しいか"),
      corePlus: checkItemSchema.describe("コアプラス範囲は正しいか"),
      kotobaNavi: checkItemSchema.describe("言葉ナビ範囲は正しいか"),
      lessonDayLoad: checkItemSchema.describe("授業日にタスクを入れすぎていないか（祝日は対象外）"),
      duplicates: checkItemSchema.describe("同一タスクを理由なく重複していないか"),
    }),
  ),
  days: z.array(aiDaySchema).describe("検証・修正後の最終計画（全日分）"),
  excluded: z.array(excludedSchema).describe("検証で除外したタスク（生成時の除外分も含めて全件）"),
});
export type VerificationOutput = z.infer<typeof verificationSchema>;

/** 構造化出力用の JSON Schema */
export function toJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}

// ---- API 入出力 ----

export const sourceRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(SOURCE_CATEGORIES),
  memo: z.string(),
  mimeType: z.string(),
  fileId: z.string(),
  uploadedAt: z.string(),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;

export const planParamsSchema = z.object({
  today: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  currentClass: z.string(),
  notes: z.string(),
});

export const existingTaskSchema = z.object({
  date: z.string(),
  subject: z.string(),
  title: z.string(),
  completed: z.boolean(),
});

export const generateRequestSchema = z.object({
  sources: z.array(sourceRefSchema).min(1),
  params: planParamsSchema,
  existingTasks: z.array(existingTaskSchema),
});
export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const verifyRequestSchema = generateRequestSchema.extend({
  generation: generationSchema,
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;
