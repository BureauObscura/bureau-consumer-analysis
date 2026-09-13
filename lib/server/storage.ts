import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { Source, Stage } from "@/lib/sim/types";
import { AppError } from "./errors";
export { AppError } from "./errors";
export function db() {
  if (!env.DB)
    throw new AppError(
      "Saved work is unavailable. Your current inputs are still in this tab.",
      503,
    );
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new AppError("File storage is unavailable.", 503);
  return env.BUCKET;
}
export async function owner() {
  const user = await getChatGPTUser();
  if (!user) throw new AppError("Sign in to save work or upload sources.", 401);
  return user.userId;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    throw new AppError("This action requires a same-origin request.", 403);
}
export async function readBounded(response: Response, max: number) {
  const declared = Number(response.headers.get("content-length"));
  if (declared > max)
    throw new AppError("The content exceeds the size limit.", 413);
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max)
        throw new AppError("The content exceeds the size limit.", 413);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export const hash = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)),
    ),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
export function imageMime(b: Uint8Array) {
  if (
    b.length >= 33 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => b[i] === v) &&
    new DataView(b.buffer, b.byteOffset).getUint32(16) > 0 &&
    new DataView(b.buffer, b.byteOffset).getUint32(16) <= 20000 &&
    new DataView(b.buffer, b.byteOffset).getUint32(20) > 0 &&
    new DataView(b.buffer, b.byteOffset).getUint32(20) <= 20000
  )
    return "image/png";
  if (b.length > 128 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return "image/jpeg";
  if (
    b.length > 30 &&
    new TextDecoder().decode(b.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(b.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  throw new AppError("Upload a JPEG, PNG, or WebP image.");
}
export async function saveSource(
  who: string,
  stage: Stage,
  name: string,
  bytes: Uint8Array,
): Promise<Source> {
  if (bytes.length > 8_000_000)
    throw new AppError("Each file must be under 8 MB.", 413);
  const pdf = new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const mime = pdf ? "application/pdf" : imageMime(bytes),
    id = crypto.randomUUID(),
    key = `${who}/sources/${id}`,
    createdAt = new Date().toISOString();
  const source: Source = {
    id,
    stage,
    name,
    kind: pdf ? "pdf" : "image",
    url: `/api/sim/sources/${id}/file`,
    hash: await hash(bytes),
    capturedAt: createdAt,
    coverage: pdf ? "uploaded PDF" : "uploaded view",
    limitations: [
      pdf
        ? "PDF contains only the supplied pages. Interactive states, load speed, and working checkout behavior are unknown."
        : "Only supplied pixels are available; content outside this image is unknown.",
    ],
  };
  await bucket().put(key, bytes, { httpMetadata: { contentType: mime } });
  try {
    await db()
      .prepare(
        "INSERT INTO sources (id,owner,data,object_key,mime,created_at) VALUES (?,?,?,?,?,?)",
      )
      .bind(id, who, JSON.stringify(source), key, mime, createdAt)
      .run();
  } catch (error) {
    await bucket().delete(key);
    throw error;
  }
  return source;
}
export async function sourceFor(id: string, who: string) {
  const row = await db()
    .prepare(
      "SELECT data,object_key,mime FROM sources WHERE id = ? AND owner = ?",
    )
    .bind(id, who)
    .first<{ data: string; object_key: string | null; mime: string | null }>();
  if (!row) throw new AppError("Source not found in this workspace.", 404);
  return { ...row, source: JSON.parse(row.data) as Source };
}
export async function assertSources(sources: Source[], who: string) {
  for (const id of new Set(sources.map((s) => s.id))) await sourceFor(id, who);
}
export function dataUrl(bytes: Uint8Array, mime: string) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 16384)
    binary += String.fromCharCode(...bytes.subarray(i, i + 16384));
  return `data:${mime};base64,${btoa(binary)}`;
}
