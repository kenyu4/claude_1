import "server-only";
import { eachDate, formatShort, weekday } from "@/lib/date";
import type { AiTask, GenerateRequest, GenerationOutput, VerificationOutput } from "@/lib/plan-schema";

// APIキー未設定時のデモ用。資料は読まずに固定パターンで計画案を作る（画面・操作確認用）。
// 実在の範囲を装わないよう、すべてのタスクに「デモ」と明記する。

function pickSource(req: GenerateRequest, categories: string[]): string {
  const s = req.sources.find((x) => categories.includes(x.category)) ?? req.sources[0];
  return s.id;
}

export function demoGeneration(req: GenerateRequest): GenerationOutput {
  const navi = pickSource(req, ["家庭学習ナビ"]);
  const sched = pickSource(req, ["スケジュール", "時間割"]);
  const scope = pickSource(req, ["確認テスト範囲"]);
  const ev = (sourceId: string, quote: string) => [{ sourceId, quote }];

  // デモでは火・木・金を授業日とみなす
  const dates = eachDate(req.params.startDate, req.params.endDate);
  const lessonDays = dates.filter((d) => [2, 4, 5].includes(weekday(d)));

  const days = dates.map((date) => {
    const md = formatShort(date).replace(/（.）/, "");
    const tasks: AiTask[] = [
      {
        subject: "算数",
        category: "基礎トレ",
        material: "基礎力トレーニング",
        textbookNumber: "",
        range: md,
        title: `基礎トレ${md}`,
        detail: "",
        evidence: ev(navi, "（デモ）基礎力トレーニングは毎日"),
      },
    ];
    const wd = weekday(date);
    if (!lessonDays.includes(date)) {
      if (wd === 1 || wd === 3) {
        tasks.push({
          subject: "理科",
          category: "通常学習",
          material: "デイリーサピックス",
          textbookNumber: "",
          range: wd === 1 ? "テーマ1〜3" : "確認問題1〜4",
          title: wd === 1 ? "理科 デイリーサピックス テーマ1〜3＋確認問題1〜4（デモ）" : "理科 確認問題1〜4の誤答のみ（デモ）",
          detail: "デモデータです。実際の範囲は資料から生成されます。",
          evidence: ev(navi, "（デモ）理科 テーマ1〜3・確認問題1〜4"),
        });
      }
      if (wd === 0 || wd === 3) {
        tasks.push({
          subject: "国語",
          category: "言葉ナビ",
          material: "言葉ナビ",
          textbookNumber: "",
          range: "",
          title: `国語 言葉ナビ${wd === 3 ? "①" : "②"}（デモ）`,
          detail: "次回確認テストから逆算して2回配置（デモ）",
          evidence: ev(scope, "（デモ）言葉ナビ確認テスト範囲"),
        });
      }
      if (wd === 6 || wd === 1) {
        tasks.push({
          subject: "社会",
          category: "通常学習",
          material: "デイリーサピックス",
          textbookNumber: "",
          range: "",
          title: "社会 デイリーステップ＋確認問題基礎編（デモ）",
          detail: "",
          evidence: ev(navi, "（デモ）社会 デイリーステップ"),
        });
      }
    }
    return { date, note: lessonDays.includes(date) ? "授業日（デモ）" : "", tasks };
  });

  return {
    analysis: {
      currentClass: req.params.currentClass || "不明",
      steps: [
        "①今日の日付",
        "②現在のクラス",
        "③時間割",
        "④授業スケジュール",
        "⑤各教材の配布日",
        "⑥次回授業",
        "⑦次回確認テスト",
        "⑧テスト範囲",
        "⑨家庭学習ナビ",
        "⑩過去テスト結果・弱点",
      ].map((step, i) => ({
        step,
        finding: i === 0 ? req.params.today : "デモモードのため資料は読み取っていません（不明）",
        sourceIds: i === 3 ? [sched] : [],
      })),
      unknowns: ["デモモードのため、すべての範囲・配布日は不明として扱っています"],
    },
    lessonDays,
    days,
    excluded: [
      {
        date: req.params.startDate,
        title: "理科コアプラス（デモ）",
        reason: "デモモード: 確認テスト実施日と対応範囲を資料で照合できないため除外",
      },
    ],
  };
}

export function demoVerification(req: GenerateRequest, gen: GenerationOutput): VerificationOutput {
  const ok = (note: string) => ({ status: "ok" as const, note });
  const na = { status: "na" as const, note: "該当タスクなし" };
  return {
    summary:
      "デモモードで作成した計画案です（ANTHROPIC_API_KEY が未設定のため、資料は読み取っていません）。画面と操作の確認用としてお使いください。",
    dayChecks: gen.days.map((d) => ({
      date: d.date,
      distributed: ok("デモ: 配布日の照合は行っていません"),
      textbookNumber: na,
      pages: na,
      testDate: na,
      corePlus: na,
      kotobaNavi: d.tasks.some((t) => t.category === "言葉ナビ") ? ok("デモ: 2回配置") : na,
      lessonDayLoad: gen.lessonDays.includes(d.date) ? ok("授業日は基礎トレのみ") : na,
      duplicates: ok("重複なし"),
    })),
    days: gen.days,
    excluded: gen.excluded,
  };
}

/** デモ時に「AIが考えている」感を出しすぎないよう、短い待ち時間だけ入れる */
export function demoDelay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 600));
}
