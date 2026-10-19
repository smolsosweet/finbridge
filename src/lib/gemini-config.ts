const MIN_TIMEOUT_MS = 1_000;

export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";

export function getGeminiModelCandidates(overrideEnv?: string): string[] {
  const configured = (overrideEnv ? process.env[overrideEnv]?.trim() : undefined) || process.env.GEMINI_TRANSACTION_MODEL?.trim();
  const primary = configured || DEFAULT_GEMINI_MODEL;
  const fallbacks = [primary, "gemini-3.5-flash-lite", "gemini-3.5-flash"];
  return fallbacks.filter((m, i, arr) => arr.indexOf(m) === i);
}

export function getGeminiTimeoutMs(name: string, fallbackMs: number, maxMs: number): number {
  const configured = Number(process.env[name]);
  if (!Number.isFinite(configured) || configured < MIN_TIMEOUT_MS) return fallbackMs;
  return Math.min(Math.floor(configured), maxMs);
}
