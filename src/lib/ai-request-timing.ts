import { randomUUID } from "node:crypto";

type Stage = "auth" | "validation" | "workspace" | "model" | "calculation" | "pool" | "hydrate" | "write" | "safety" | "database";
type Route = "assistant" | "scenario-planner" | "workspace-actions" | "receipt-drafts" | "speech-transcription" | "transaction-drafts" | "translate-conversation";

/** Request-local durations only. Never accepts prompts, account IDs or errors. */
export class AiRequestTiming {
  private stages: Partial<Record<Stage, number>> = {};
  private modelCalls = 0;
  private databaseCalls = 0;
  async measure<T>(stage: Stage, run: () => Promise<T>): Promise<T> {
    if (stage === "model") this.modelCalls++;
    if (stage === "database") this.databaseCalls++;
    const started = performance.now();
    try { return await run(); }
    finally { this.stages[stage] = (this.stages[stage] || 0) + performance.now() - started; }
  }
  measureSync<T>(stage: "calculation", run: () => T): T {
    const started = performance.now();
    try { return run(); }
    finally { this.stages[stage] = (this.stages[stage] || 0) + performance.now() - started; }
  }
  snapshot() {
    return { modelCalls: this.modelCalls, databaseCalls: this.databaseCalls, stagesMs: Object.fromEntries(Object.entries(this.stages).map(([key, value]) => [key, Math.round(value! * 10) / 10])) };
  }
}

/** Observe promise-based pg calls without logging SQL, parameters or results.
 * A fresh proxy per request never changes the pooled client's methods. */
export function timeDatabaseClient<T extends object>(client: T, timing?: AiRequestTiming): T {
  if (!timing) return client;
  return new Proxy(client, { get(target, key) {
    const value = Reflect.get(target, key, target);
    if (key === "query" && typeof value === "function") return (...args: unknown[]) => timing.measure("database", async () => Reflect.apply(value, target, args));
    return typeof value === "function" ? value.bind(target) : value;
  } });
}

export async function traceAiRequest(route: Route, run: (timing: AiRequestTiming) => Promise<Response>): Promise<Response> {
  const timing = new AiRequestTiming(), requestId = randomUUID(), started = performance.now();
  let status = 500;
  try {
    const response = await run(timing);
    status = response.status;
    response.headers.set("X-FinBridge-Request-Id", requestId);
    response.headers.set("Cache-Control", "private, no-store");
    const { stagesMs } = timing.snapshot();
    response.headers.set("Server-Timing", [...Object.entries(stagesMs).map(([stage, duration]) => `${stage};dur=${duration}`), `total;dur=${Math.round((performance.now() - started) * 10) / 10}`].join(", "));
    return response;
  } finally {
    console.info("[FinBridge AI] request timing", { requestId, route, status, durationMs: Math.round((performance.now() - started) * 10) / 10, ...timing.snapshot() });
  }
}
