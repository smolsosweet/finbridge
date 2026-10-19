/** Anonymous, volatile storage is an explicit localhost development mode only. */
export function isLocalDemoRequest(request: Request, environment: NodeJS.ProcessEnv = process.env) {
  if (environment.NODE_ENV !== "development" || environment.FINBRIDGE_DEMO_MODE !== "true") return false;
  try {
    const url = new URL(request.url);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || request.headers.get("host") !== url.host) return false;
    const origin = request.headers.get("origin");
    return origin ? new URL(origin).origin === url.origin : request.method === "GET";
  } catch { return false; }
}
