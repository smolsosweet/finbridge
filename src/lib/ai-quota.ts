export const AI_QUOTA_TIME_ZONE = "America/Los_Angeles";
export const AI_ROUTE_COST = {
  assistant: 1, "transaction-drafts": 1, "scenario-planner": 1,
  "proactive-feed": 1, "workspace-actions": 1, "speech-transcription": 2, "receipt-drafts": 3,
} as const;
export type AiRoute = keyof typeof AI_ROUTE_COST;
export type AiQuotaConfig = {
  userDailyPoints: number; userMinutePoints: number;
  serverDailyPoints: number; serverDailyRequests: number; serverMinuteRequests: number;
  cooldownSeconds: number;
};
export type AiQuotaCode = "AI_QUOTA_EXCEEDED" | "AI_RATE_LIMITED" | "AI_QUOTA_UNAVAILABLE" | "AI_QUOTA_NOT_CONFIGURED";
export class AiQuotaError extends Error {
  code: AiQuotaCode;
  retryAfter: number;
  constructor(code: AiQuotaCode, retryAfter = 60) { super(code); this.code = code; this.retryAfter = retryAfter; }
}

export function readAiQuotaConfig(env: NodeJS.ProcessEnv = process.env): AiQuotaConfig {
  function positive(name: string, fallback?: number) {
    const raw = env[name];
    const value = raw === undefined || raw === "" ? fallback : Number(raw);
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0 || value > 10_000_000) throw new AiQuotaError("AI_QUOTA_NOT_CONFIGURED");
    return value;
  }
  // Global budgets must be explicitly set after checking the project's active AI Studio limits.
  return {
    userDailyPoints: positive("AI_QUOTA_USER_DAILY_POINTS", 40),
    userMinutePoints: positive("AI_QUOTA_USER_MINUTE_POINTS", 6),
    serverDailyPoints: positive("AI_QUOTA_SERVER_DAILY_POINTS"),
    serverDailyRequests: positive("AI_QUOTA_SERVER_DAILY_REQUESTS"),
    serverMinuteRequests: positive("AI_QUOTA_SERVER_MINUTE_REQUESTS"),
    cooldownSeconds: Math.min(positive("AI_QUOTA_COOLDOWN_SECONDS", 60), 3600),
  };
}

const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: AI_QUOTA_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export function aiQuotaWindows(now: Date) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(now).map(p => [p.type, p.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  const nextDay = new Date(Date.parse(day + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10);
  // Pacific midnight is UTC+7 in daylight time and UTC+8 in standard time.
  let nextDayAt = new Date(nextDay + "T07:00:00Z");
  if (dayFormatter.format(nextDayAt) !== nextDay) nextDayAt = new Date(+nextDayAt + 3_600_000);
  const minuteAt = new Date(Math.floor(+now / 60_000) * 60_000);
  return { day, nextDayAt, minute: minuteAt.toISOString(), nextMinuteAt: new Date(+minuteAt + 60_000) };
}

export type AiQuotaReservation = { id: string; owner: string };
export type AiQuotaRepository = {
  reserve(owner: string, route: AiRoute, config: AiQuotaConfig): Promise<AiQuotaReservation>;
  release(reservation: AiQuotaReservation): Promise<void>;
  pause(seconds: number): Promise<void>;
};

export function aiQuotaLanguage(request: Request): "en" | "vi" | "zh" {
  const value = request.headers.get("x-finbridge-language") || request.headers.get("accept-language") || "en";
  return /^vi\b/i.test(value) ? "vi" : /^zh\b/i.test(value) ? "zh" : "en";
}
const QUOTA_COPY = {
  en: { limited: "The AI allowance has been reached. Please try again later or enter the details manually.", unavailable: "AI is temporarily unavailable. You can still enter and save details manually." },
  vi: { limited: "Đã đạt hạn mức sử dụng AI. Bạn hãy thử lại sau hoặc nhập thông tin thủ công.", unavailable: "AI tạm thời chưa khả dụng. Bạn vẫn có thể nhập và lưu thông tin thủ công." },
  zh: { limited: "AI 使用次数已达上限。请稍后重试，或手动输入信息。", unavailable: "AI 暂时不可用。您仍可手动输入并保存信息。" },
};
export function aiQuotaClientMessage(payload: unknown, language: "en" | "vi" | "zh"): string | null {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return null;
  if (["AI_QUOTA_EXCEEDED", "AI_RATE_LIMITED"].includes(String(payload.error))) return QUOTA_COPY[language].limited;
  if (["AI_QUOTA_UNAVAILABLE", "AI_QUOTA_NOT_CONFIGURED"].includes(String(payload.error))) return QUOTA_COPY[language].unavailable;
  return null;
}
export function aiQuotaErrorResponse(error: unknown, request: Request): Response | null {
  if (!(error instanceof AiQuotaError)) return null;
  const limited = error.code === "AI_QUOTA_EXCEEDED" || error.code === "AI_RATE_LIMITED";
  return Response.json({ error: error.code, message: QUOTA_COPY[aiQuotaLanguage(request)][limited ? "limited" : "unavailable"], manualEntryAvailable: true }, {
    status: limited ? 429 : 503,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(error.retryAfter))), "Cache-Control": "no-store" },
  });
}

/** Reserve before transport dispatch. Once fetch is invoked, even transport errors count. */
export function createQuotaFetch(options: {
  owner: string; route: AiRoute; repository: AiQuotaRepository; config: AiQuotaConfig;
  transport?: typeof fetch;
}): typeof fetch {
  const transport = options.transport || fetch;
  return async (input, init) => {
    const signal = init?.signal || (input instanceof Request ? input.signal : undefined);
    signal?.throwIfAborted();
    const reservation = await options.repository.reserve(options.owner, options.route, options.config);
    let dispatched = false;
    try {
      signal?.throwIfAborted();
      dispatched = true;
      const response = await transport(input, init);
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        const seconds = retry && /^\d+$/.test(retry) ? Number(retry)
          : retry && Number.isFinite(Date.parse(retry)) ? Math.ceil((Date.parse(retry) - Date.now()) / 1000) : 0;
        const pauseSeconds = Math.max(options.config.cooldownSeconds, Math.min(Math.max(0, seconds), 86_400));
        await options.repository.pause(pauseSeconds);
        // Consume the provider response, but never log its contents or credentials.
        await response.body?.cancel().catch(() => undefined);
        throw new AiQuotaError("AI_RATE_LIMITED", pauseSeconds);
      }
      return response;
    } finally {
      if (!dispatched) await options.repository.release(reservation);
    }
  };
}
