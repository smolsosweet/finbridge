const MIN_TIMEOUT_MS = 1_000;

export function getGeminiTimeoutMs(name: string, fallbackMs: number, maxMs: number): number {
  const configured = Number(process.env[name]);
  if (!Number.isFinite(configured) || configured < MIN_TIMEOUT_MS) return fallbackMs;
  return Math.min(Math.floor(configured), maxMs);
}
