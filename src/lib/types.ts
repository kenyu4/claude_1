// ドメイン型。Supabase 等に移行する場合も、この形をそのままテーブル定義に写せるよう
// 入れ子を浅くし、ID 参照で関連を表現している。

export const SUBJECTS = ["算数", "国語", "理科", "社会", "その他"] as const;
export type Subject = (typeof SUBJECTS)[number];

export const TASK_CATEGORIES = [
  "基礎トレ",
  "通常学習",
  "確認テスト対策",
  "コアプラス",
  "言葉ナビ",
  "知の冒険",
  "テスト直し",
  "イベント",
  "その他",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const SOURCE_CATEGORIES = [
  "家庭学習ナビ",
  "時間割",
  "スケジュール",
  "確認テスト範囲",
  "テスト結果",
  "その他",
] as const;
export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

/** アプリ固有ルール（例: 土曜のパパックスオープン）で追加されたタスクの sourceId */
export const RULE_SOURCE_ID = "rule:app";
/** 保護者が手動で追加したタスクの sourceId */
export const MANUAL_SOURCE_ID = "manual:parent";

/** タスクの根拠。どの資料のどの記述から作られたか */
export interface Evidence {
  sourceId: string;
  /** 資料中の該当記述（AIが資料から抜き出したもの） */
  quote: string;
}

/** アップロード資料のメタデータ（ファイル本体は Anthropic Files API とブラウザの IndexedDB に保存） */
export interface SourceDocument {
  id: string;
  name: string;
  category: SourceCategory;
  memo: string;
  mimeType: string;
  size: number;
  uploadedAt: string; // ISO
  /** Anthropic Files API の file_id（デモモードでは demo_ で始まる） */
  fileId: string;
  /** 計画生成に使うかどうか */
  active: boolean;
}

/** 正式タスク */
export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  subject: Subject;
  material: string;
  textbookNumber: string;
  range: string;
  title: string;
  detail: string;
  category: TaskCategory;
  completed: boolean;
  completedAt: string | null;
  /** 主な根拠資料 */
  sourceId: string;
  /** 根拠資料すべて */
  sourceIds: string[];
  evidence: Evidence[];
  /** どの確定計画で登録されたか */
  planId: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** 計画案のタスク（確定前） */
export interface DraftTask {
  id: string;
  date: string;
  subject: Subject;
  material: string;
  textbookNumber: string;
  range: string;
  title: string;
  detail: string;
  category: TaskCategory;
  evidence: Evidence[];
}

export type CheckStatus = "ok" | "fixed" | "excluded" | "na";

export interface DayCheck {
  date: string;
  distributed: CheckItem;
  textbookNumber: CheckItem;
  pages: CheckItem;
  testDate: CheckItem;
  corePlus: CheckItem;
  kotobaNavi: CheckItem;
  lessonDayLoad: CheckItem;
  duplicates: CheckItem;
}

export interface CheckItem {
  status: CheckStatus;
  note: string;
}

export interface ExcludedItem {
  date: string;
  title: string;
  reason: string;
}

export interface AnalysisStep {
  step: string;
  finding: string;
  sourceIds: string[];
}

export interface PlanDraft {
  id: string;
  createdAt: string;
  mode: "live" | "demo";
  params: PlanParams;
  sourceIds: string[];
  analysis: {
    currentClass: string;
    steps: AnalysisStep[];
    unknowns: string[];
  };
  lessonDays: string[];
  /** クラス設定の授業日と資料（AI）の判断が食い違った日の説明 */
  lessonNotes?: string[];
  dayNotes: Record<string, string>;
  tasks: DraftTask[];
  verification: {
    summary: string;
    dayChecks: DayCheck[];
  };
  excluded: ExcludedItem[];
}

export interface PlanParams {
  today: string;
  startDate: string;
  endDate: string;
  currentClass: string;
  /** 保護者が確認したクラスの授業曜日・科目 */
  lessons: LessonDay[];
  notes: string;
}

/** 授業のある教科（SAPIX の授業科目） */
export const LESSON_SUBJECTS = ["算数", "国語", "理科", "社会"] as const;
export type LessonSubject = (typeof LESSON_SUBJECTS)[number];

/** 曜日ごとの授業。weekday は 0=日〜6=土 */
export interface LessonDay {
  weekday: number;
  subjects: LessonSubject[];
}

/** 時間割から読み取ったクラスの週間授業 */
export interface ClassSchedule {
  name: string;
  lessons: LessonDay[];
  /** 時間割中の該当記述 */
  quote: string;
}

export interface ClassSettings {
  className: string;
  lessons: LessonDay[];
  /** 時間割から読み取ったクラス一覧（選択肢） */
  catalog: ClassSchedule[];
  catalogSourceId: string | null;
  catalogNotes: string;
}

/** 確定済み計画の履歴 */
export interface PlanRecord {
  id: string;
  confirmedAt: string;
  draftId: string;
  startDate: string;
  endDate: string;
  sourceIds: string[];
  added: number;
  changed: number;
  removed: number;
}

export interface AppState {
  version: 1;
  tasks: Task[];
  sources: SourceDocument[];
  plans: PlanRecord[];
  draft: PlanDraft | null;
  classSettings: ClassSettings;
  prefs: {
    hideCompleted: boolean;
  };
}
