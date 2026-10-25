import "server-only";
import { eachDate, formatShort, weekday } from "@/lib/date";
import { holidayName } from "@/lib/holidays";
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

  const reviewQueue: AiTask["subject"][] = ["理科", "社会", "算数", "国語"];
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
    const holiday = holidayName(date);
    const lesson = lessonDays.includes(date);
    const t = (subject: AiTask["subject"], category: AiTask["category"], title: string, quote: string, detail = ""): AiTask => ({
      subject,
      category,
      material: category === "テスト直し" ? "マンスリー確認テスト" : "デイリーサピックス",
      textbookNumber: "",
      range: "",
      title: `${title}（デモ ${md}）`,
      detail,
      evidence: ev(category === "テスト直し" ? sched : category === "言葉ナビ" ? scope : navi, `（デモ）${quote}`),
    });
    // 授業日（祝日を除く）は基礎トレのみ
    if (!lesson || holiday) {
      // 理科・社会を厚めに: ほぼ毎日どちらか、週の半分は両方
      if (wd !== 2 || holiday) tasks.push(t("理科", "通常学習", wd % 2 ? "理科 テーマ1〜3＋確認問題1〜4" : "理科 確認問題1〜4の誤答のみ", "理科 テーマ1〜3・確認問題1〜4"));
      if (wd !== 4 || holiday) tasks.push(t("社会", "通常学習", wd % 2 ? "社会 重要語句・人物・出来事" : "社会 デイリーステップ＋確認問題基礎編", "社会 デイリーステップ"));
      if (wd === 3) tasks.push(t("国語", "言葉ナビ", "国語 言葉ナビ①", "言葉ナビ確認テスト範囲", "次回確認テストから逆算して2回配置"));
      if (wd === 0) tasks.push(t("国語", "言葉ナビ", "国語 言葉ナビ②", "言葉ナビ確認テスト範囲", "次回確認テストから逆算して2回配置"));
    }
    // テスト見直し: 期間2日目以降の授業のない日に、教科別に1つずつ（理科・社会を先に）
    if (dates.indexOf(date) >= 1 && (!lesson || holiday) && reviewQueue.length > 0) {
      const subject = reviewQueue.shift()!;
      tasks.push(t(subject, "テスト直し", `マンスリー見直し ${subject}`, "マンスリー確認テスト実施", "成績表が出たら正答率の高い誤答を優先"));
    }
    return { date, note: lessonDays.includes(date) ? (holidayName(date) ? "授業日・祝日（デモ）" : "授業日（デモ）") : "", tasks };
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
      lessonDayLoad: gen.lessonDays.includes(d.date) ? ok(holidayName(d.date) ? "祝日のため通常量" : "授業日は基礎トレのみ") : na,
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
