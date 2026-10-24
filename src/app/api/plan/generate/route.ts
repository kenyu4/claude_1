import { generateRequestSchema, generationSchema } from "@/lib/plan-schema";
import { errorMessage, isDemoMode } from "@/lib/server/anthropic";
import { demoDelay, demoGeneration } from "@/lib/server/demo";
import { generateInstruction } from "@/lib/server/prompts";
import { runStructured } from "@/lib/server/run";

export const maxDuration = 300;

/** ステップ1: 資料を解析して計画案を作る */
export async function POST(request: Request) {
  const parsed = generateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "リクエストが不正です。資料を1件以上選んでください。" }, { status: 400 });
  }
  const req = parsed.data;
  if (req.params.startDate > req.params.endDate) {
    return Response.json({ error: "計画期間の開始日が終了日より後になっています。" }, { status: 400 });
  }

  if (isDemoMode()) {
    await demoDelay();
    return Response.json({ mode: "demo", generation: demoGeneration(req) });
  }
  try {
    const generation = await runStructured(generationSchema, req, generateInstruction(req));
    return Response.json({ mode: "live", generation });
  } catch (err) {
    const { message, status } = errorMessage(err);
    return Response.json({ error: message }, { status });
  }
}
