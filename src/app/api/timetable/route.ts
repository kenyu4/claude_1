import { timetableRequestSchema, timetableSchema } from "@/lib/plan-schema";
import { errorMessage, isDemoMode } from "@/lib/server/anthropic";
import { demoDelay, demoTimetable } from "@/lib/server/demo";
import { TIMETABLE_INSTRUCTION, TIMETABLE_SYSTEM_PROMPT } from "@/lib/server/prompts";
import { runStructured } from "@/lib/server/run";

export const maxDuration = 300;

/** 時間割から 5 年生の各クラスの授業曜日・科目を読み取る */
export async function POST(request: Request) {
  const parsed = timetableRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "時間割の資料を選んでください。" }, { status: 400 });
  }
  if (isDemoMode()) {
    await demoDelay();
    return Response.json({ timetable: demoTimetable() });
  }
  try {
    const timetable = await runStructured(timetableSchema, {
      system: TIMETABLE_SYSTEM_PROMPT,
      sources: parsed.data.sources,
      instruction: TIMETABLE_INSTRUCTION,
    });
    return Response.json({ timetable });
  } catch (err) {
    const { message, status } = errorMessage(err);
    return Response.json({ error: message }, { status });
  }
}
