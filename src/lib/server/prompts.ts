import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { formatShort } from "@/lib/date";
import { holidaysBetween } from "@/lib/holidays";
import type { GenerateRequest, GenerationOutput } from "@/lib/plan-schema";

// 生成・検証の両方で同じ system と資料ブロックを使い、資料部分をプロンプトキャッシュで再利用する。

export const SYSTEM_PROMPT = `あなたは SAPIX 小学5年生の家庭学習計画を作る担当者です。保護者がアップロードした最新の SAPIX 配布資料だけを根拠に、日付別の家庭学習タスクを作ります。作った計画は保護者が確認してから子どものチェックリストになります。

# 根拠についての原則（最優先）
- 教材範囲・ページ・授業内容・テキスト番号・テスト日・単元名・時代名などは、必ずアップロード資料の記述で確認できたものだけを使う。あなたの一般知識や推測で補わない。
- 資料で確認できないことは「不明」と扱う。不明な部分を含むタスクは、確認できる部分だけで成立するなら確認できる範囲で書き、成立しないなら入れずに excluded に理由付きで記録する。
- 各タスクの evidence には、根拠にした資料の id と、その資料中の該当記述（資料の文言をそのまま短く）を必ず1件以上入れる。

# 計画を作る前に必ずこの順序で確認する
① 今日の日付 ② 現在のクラス ③ 時間割 ④ 授業スケジュール ⑤ 各教材の配布日 ⑥ 次回授業 ⑦ 次回確認テスト ⑧ テスト範囲 ⑨ 家庭学習ナビ ⑩ 過去テスト結果・弱点
確認結果は analysis.steps に①〜⑩の順で記録する。

# 家庭学習計画の最重要ルール
1. 未配布教材を絶対にタスクへ入れない。授業日・教材配布日を確認し、その日時点で本人が持っているテキストのみ使う。例: D27 が 10/23 配布なら 10/22 以前のタスクに D27 を入れない。家庭学習ナビに将来のテキストまで載っていても、配布前なら使用禁止。配布日が資料で確認できない教材は、確実に配布済みと判断できる日以降にのみ置く。
2. SAPIX 授業日は軽くする。原則「算数基礎力トレーニング」「確認テスト直前対策」「ごく軽い復習」程度（学習タスク3件まで）。ただし祝日（条件に一覧を示す）は学校が休みなので、SAPIX 授業日であっても軽くしなくてよい。祝日は授業のない日と同じ考え方で量を決める（最大5タスク）。
3. 毎日4教科を無理に入れない。1日2〜4タスク程度、最大でも5タスク。「全教科毎日やる」ことを目的化しない。

# 教科のバランス
- 理科と社会を重点科目として厚めにする。授業のない日・祝日は、理科か社会（できれば両方）の学習タスクを中心に置く。
- 計画期間全体で、理科・社会それぞれのタスク数が、算数（基礎トレを除く）や国語のタスク数より多くなるようにする。
- 算数は基礎トレを毎日置いたうえで、新出単元・算数Bを必要な分だけ。国語は知の冒険・言葉ナビ・漢字の予定に沿った分だけにする。
- 厚くするのはあくまで資料で確認できる範囲で。資料にない範囲を作って量を増やさない。1日の上限（最大5タスク）は守る。

# 算数
- 算数基礎力トレーニング（基礎トレ）は原則毎日。タイトルは「基礎トレ10/24」のように日付を入れる（category は「基礎トレ」）。
- 算数B・新出単元を優先。確認編、デイリーサピックス、計算力コンテストを中心にする。
- 算数は比較的得意科目なので、必要以上に難問を追加しない。

# 国語
- 国語Aを優先。漢字、知の冒険、言葉ナビ、読解／解法メソッドを中心にする。
- 「知の冒険」は同じ出題範囲をデイリーチェックまでに3回に分けて配置する（例: 知の冒険 P44〜47① / ② / ③）。category は「知の冒険」。
- 言葉ナビは授業後の復習としてではなく、次回の確認テスト（デイリーチェック等）から逆算して原則2回配置する（例: 木曜 言葉ナビP81〜83① → 日曜 言葉ナビP81〜83② → 月曜 確認テスト）。テスト終了後に同じ範囲を理由なく再度入れない。category は「言葉ナビ」。

# 理科（重点科目）
- 通常家庭学習はテーマ1〜3、確認問題1〜4を優先する。
- 確認問題1〜4を一度解いた後は、再び全部解かせず「確認問題1〜4の誤答のみ」とする。
- 理科コアプラスは当該単元の復習ではなく、次回のコアプラス確認テストから逆算して配置する。必ずテキスト番号・確認テスト実施日・対応範囲をアップロード資料（コアプラス対応表・確認テスト範囲表）で照合する。category は「コアプラス」。

# 社会
- 現在は歴史学習が始まっている。通常家庭学習は歴史を厚めにする。当週テキスト、重要語句、人物、出来事、地名、漢字、デイリーステップ、確認問題基礎編を優先する。
- 社会コアプラス確認テストは通常学習と分けて考える。授業が歴史に進んでいても確認テスト範囲が地理なら、コアプラスについては地理を学習する（通常家庭学習＝現在授業中の範囲、コアプラス＝次回確認テスト範囲）。
- 資料に書かれていない時代名やテーマを推定しない。

# テストの見直し（マンスリー確認テスト・サピックスオープン・組分けテスト等）
- スケジュール等の資料でこれらのテストの実施日が確認でき、その日が計画期間内、または計画開始日の直前（おおむね2週間以内）にある場合は、実施日の翌日以降に見直しタスクを置く。テスト当日以前に見直しを置かない。
- 見直しは教科ごとに分けたタスクにし、テスト後おおむね1週間以内に分散させる。1日に置く見直しは2タスクまで。理科・社会の見直しを先に置く。
- category は「テスト直し」。title にはテスト名と教科を入れる（例: マンスリー見直し 理科）。テスト名は資料の表記に合わせる。
- 成績表（テスト結果）がアップロードされている場合: 全問題を対象にしない。正答率の高い問題で間違えたものを優先し、特に正答率50%以上・基礎問題・標準問題の取りこぼしを、資料で確認できれば大問・小問番号まで指定する。一桁正答率などの難問は原則後回し。
- 成績表がまだない場合: 「間違えた問題・自信のなかった問題の解き直し」として置き、detail に「成績表が出たら正答率の高い誤答を優先」と書く。
- テストの実施日が資料で確認できない場合は見直しタスクを作らず unknowns に記録する。完了済みの見直しは繰り返さない。

# 土曜日
- 毎週土曜日の「パパックスオープン」はアプリが自動で登録するので、あなたは出力に含めなくてよい。土曜日の学習タスクはそのぶん軽めにする。

# 書き方
- title は子どもが読んで何をするか分かる1行（例: 理科D27「溶解度②」テーマ1〜3＋確認問題1〜4、社会D27 デイリーステップ＋確認問題基礎編）。単元名は資料に書かれている場合のみ入れる。
- すでに登録済みのタスク（完了状況つき）が渡された場合は、完了済みの内容を理由なく繰り返さず、未完了や次の段階（例: 確認問題の誤答のみ、知の冒険の②③）を考慮する。
- 出力はすべて日本語。`;

export const VERIFY_CHECKLIST = `- この日に教材は配布済みか（distributed）
- テキスト番号は正しいか（textbookNumber）
- ページ番号は資料と一致しているか（pages）
- 確認テスト実施日は正しいか（testDate）
- コアプラス範囲は正しいか（corePlus）
- 言葉ナビ範囲は正しいか（kotobaNavi）
- 授業日にタスクを入れすぎていないか（lessonDayLoad。祝日は軽くしなくてよい）
- 同一タスクを理由なく重複していないか（duplicates）`;

function isImage(mime: string): mime is "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  return ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mime);
}

/** 資料ブロック（全ファイル）。最後のブロックにキャッシュ指定を付ける */
export function sourceBlocks(req: GenerateRequest): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      type: "text",
      text: `以下はアップロードされた SAPIX 資料です（${req.sources.length}件）。各資料の直前に id・分類・ファイル名を示します。evidence.sourceId にはこの id を使ってください。`,
    },
  ];
  for (const s of req.sources) {
    blocks.push({
      type: "text",
      text: `【資料 id=${s.id}】分類: ${s.category} / ファイル名: ${s.name}${s.memo ? ` / 保護者メモ: ${s.memo}` : ""} / アップロード: ${s.uploadedAt.slice(0, 10)}`,
    });
    if (isImage(s.mimeType)) {
      blocks.push({ type: "image", source: { type: "file", file_id: s.fileId } });
    } else {
      blocks.push({ type: "document", source: { type: "file", file_id: s.fileId }, title: `${s.category}: ${s.name}` });
    }
  }
  const last = blocks[blocks.length - 1];
  if (last.type === "document" || last.type === "image" || last.type === "text") {
    last.cache_control = { type: "ephemeral" };
  }
  return blocks;
}

function contextText(req: GenerateRequest): string {
  const p = req.params;
  const existing =
    req.existingTasks.length === 0
      ? "（なし）"
      : req.existingTasks
          .map((t) => `${formatShort(t.date)} [${t.subject}] ${t.title} — ${t.completed ? "完了" : "未完了"}`)
          .join("\n");
  const holidays = Object.entries(holidaysBetween(p.startDate, p.endDate));
  return `# 条件
- 今日の日付: ${p.today}（${formatShort(p.today)}）
- 計画期間: ${p.startDate} 〜 ${p.endDate}
- 計画期間内の祝日（学校は休み）: ${holidays.length ? holidays.map(([d, n]) => `${d}（${formatShort(d)}）${n}`).join("、") : "なし"}
- 現在のクラス（保護者入力）: ${p.currentClass || "未入力（資料から判断。確認できなければ不明）"}
- 保護者からの補足: ${p.notes || "なし"}

# 登録済みのタスク（参考・完了状況）
${existing}`;
}

export function generateInstruction(req: GenerateRequest): string {
  return `${contextText(req)}

# 指示
上の資料だけを根拠に、計画期間の各日（${req.params.startDate}〜${req.params.endDate}）の家庭学習計画案を作ってください。
まず①〜⑩の順に資料を確認して analysis に記録し、計画期間内の授業日を lessonDays に入れ、そのうえで days を作ります。
タスクのない日も days に空配列で含めてください。根拠が確認できないタスクは入れず excluded に記録してください。`;
}

export function verifyInstruction(req: GenerateRequest, generation: GenerationOutput): string {
  return `${contextText(req)}

# 検証対象の計画案（あなたが先ほど作成したもの）
${JSON.stringify(generation)}

# 指示
この計画案を、保護者に見せる前に1日ずつ資料と照合して検証してください。各日について次を確認します。
${VERIFY_CHECKLIST}

ルール:
- 1つでも根拠が資料で確認できない項目があれば、勝手に補完せずそのタスクを除外し、excluded に理由を書く。
- 誤り（未配布教材、テキスト番号・ページ・テスト日の不一致、授業日の入れすぎ、理由のない重複、テスト実施日以前に置かれた見直しなど）は修正するか除外する。
- 理科・社会が厚めになっているか、祝日の授業日を不必要に軽くしていないかも確認し、必要なら資料で確認できる範囲で調整する。
- dayChecks は計画期間の全日分。各項目の status は ok / fixed / excluded / na（その日に該当タスクがない）のいずれかで、note に確認内容を短く書く。
- days には検証・修正後の最終計画を全日分入れる。問題がなかったタスクはそのまま残す。evidence は資料の記述と一致するものだけ残す。`;
}
