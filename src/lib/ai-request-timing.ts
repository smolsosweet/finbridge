import { randomUUID } from "node:crypto";

type Stage = "auth" | "workspace" | "model" | "calculation" | "pool" | "hydrate" | "write" | "safety";
type Route = "assistant" | "scenario-planner" | "workspace-actions" | "receipt-drafts" | "speech-transcription" | "transaction-drafts";

/** Request-local durations only. Never accepts prompts, account IDs or errors. */
export class AiRequestTiming {
  private stages: Partial<Record<Stage, number>> = {};
  private modelCalls = 0;
  async measure<T>(stage: Stage, run: () => Promise<T>): Promise<T> {
    if (stage === "model") this.modelCalls++;
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
    return { modelCalls: this.modelCalls, stagesMs: Object.fromEntries(Object.entries(this.stages).map(([key, value]) => [key, Math.round(value! * 10) / 10])) };
  }
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
    response.headers.set("Server-Timing", Object.entries(stagesMs).map(([stage, duration]) => `${stage};dur=${duration}`).join(", "));
    return response;
  } finally {
    console.info("[FinBridge AI] request timing", { requestId, route, status, durationMs: Math.round((performance.now() - started) * 10) / 10, ...timing.snapshot() });
  }
}
