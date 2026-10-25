import { verificationSchema, verifyRequestSchema } from "@/lib/plan-schema";
import { errorMessage, isDemoMode } from "@/lib/server/anthropic";
import { demoDelay, demoVerification } from "@/lib/server/demo";
import { SYSTEM_PROMPT, verifyInstruction } from "@/lib/server/prompts";
import { runStructured } from "@/lib/server/run";

export const maxDuration = 300;

/** ステップ2: 計画案を1日ずつ資料と照合して検証・修正する */
export async function POST(request: Request) {
  const parsed = verifyRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "リクエストが不正です。" }, { status: 400 });
  }
  const { generation, ...req } = parsed.data;

  if (isDemoMode()) {
    await demoDelay();
    return Response.json({ verification: demoVerification(req, generation) });
  }
  try {
    const verification = await runStructured(verificationSchema, {
      system: SYSTEM_PROMPT,
      sources: req.sources,
      instruction: verifyInstruction(req, generation),
    });
    return Response.json({ verification });
  } catch (err) {
    const { message, status } = errorMessage(err);
    return Response.json({ error: message }, { status });
  }
}
