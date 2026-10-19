import { z } from "zod";
import { getSession } from "@/lib/auth-session";
import { isLocalDemoRequest } from "@/lib/local-demo";
import { readTransferChat } from "@/lib/transfer-chat-runtime";
import { transferChatRequestSchema } from "@/lib/transfer-chat-model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({ id: z.string().uuid(), request: transferChatRequestSchema, language: z.enum(["en", "vi", "zh"]) }).strict();

/** Interactive choices only read data and propose actions. They never mutate. */
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const session = await getSession();
    const demo = !session && isLocalDemoRequest(request);
    if (!session && !demo) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401, headers });
    const expected = demo ? new URL(request.url).origin : new URL(process.env.BETTER_AUTH_URL!).origin;
    if (request.headers.get("origin") !== expected) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403, headers });
    if (session && request.headers.get("x-finbridge-workspace-owner") !== session.user.id) return Response.json({ error: "ACCOUNT_CHANGED" }, { status: 409, headers });
    if (!request.headers.get("content-type")?.startsWith("application/json")) return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 8192) { await reader.cancel(); return Response.json({ error: "INVALID_REQUEST" }, { status: 413, headers }); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    let decoded: unknown;
    try { decoded = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers }); }
    const input = schema.safeParse(decoded);
    if (!input.success) return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers });
    const transfer = await readTransferChat({ ...input.data, owner: session?.user.id || "finbridge-local-demo", demo });
    return Response.json({ transfer }, { headers });
  } catch {
    return Response.json({ error: "UNAVAILABLE" }, { status: 503, headers });
  }
}
