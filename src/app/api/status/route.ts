import { connection } from "next/server";
import { isDemoMode, MODEL } from "@/lib/server/anthropic";

export async function GET() {
  await connection();
  return Response.json({ mode: isDemoMode() ? "demo" : "live", model: MODEL });
}
