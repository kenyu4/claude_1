import { errorMessage, getClient, isDemoMode } from "@/lib/server/anthropic";

/** 資料を削除したときに Files API 側のファイルも削除する */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (isDemoMode() || id.startsWith("demo_")) return Response.json({ ok: true });
  try {
    await getClient().files.delete(id);
    return Response.json({ ok: true });
  } catch (err) {
    const { message, status } = errorMessage(err);
    return Response.json({ error: message }, { status });
  }
}
