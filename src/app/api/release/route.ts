export const dynamic = "force-dynamic";
// Build-time public Git identity only. Never expose configuration or credentials.
export function GET() {
  const value = process.env.FINBRIDGE_BUILD_COMMIT || "";
  return Response.json({ app: "FinBridge", commit: /^[a-f0-9]{40}$/i.test(value) ? value : null, dirty: process.env.FINBRIDGE_BUILD_DIRTY !== "false" }, { headers: { "Cache-Control": "no-store" } });
}
