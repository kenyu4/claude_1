import { errorMessage, getClient, isDemoMode } from "@/lib/server/anthropic";

export const maxDuration = 60;

const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];

/** 資料1件を Anthropic Files API に保存し、file_id を返す */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "ファイルを受け取れませんでした。" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file がありません。" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return Response.json({ error: `未対応の形式です（${file.type || "不明"}）。PDFまたは画像を選んでください。` }, { status: 400 });
  }

  if (isDemoMode()) {
    return Response.json({ fileId: `demo_${crypto.randomUUID()}` });
  }
  try {
    const uploaded = await getClient().files.upload({ file });
    return Response.json({ fileId: uploaded.id });
  } catch (err) {
    const { message, status } = errorMessage(err);
    return Response.json({ error: message }, { status });
  }
}
