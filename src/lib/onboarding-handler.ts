import { onboardingSchema, type OnboardingData, type OnboardingRecord } from "./onboarding";
export async function handleOnboarding(request: Request, userId: string | null, origin: string, repository: {
  read: (id: string) => Promise<OnboardingRecord | null>;
  complete: (id: string, data: OnboardingData) => Promise<OnboardingRecord | null>;
}) {
  if (!userId) return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  try {
    if (request.method === "GET") return Response.json({ profile: await repository.read(userId) }, { headers: { "Cache-Control": "no-store" } });
    if (request.headers.get("origin") !== new URL(origin).origin) return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
    const body = await request.text();
    if (body.length > 64000) return Response.json({ error: "PAYLOAD_TOO_LARGE" }, { status: 413 });
    let decoded: unknown;
    try { decoded = JSON.parse(body); } catch { return Response.json({ error: "INVALID_SETUP" }, { status: 400 }); }
    const parsed = onboardingSchema.safeParse(decoded);
    if (!parsed.success) return Response.json({ error: "INVALID_SETUP" }, { status: 400 });
    return Response.json({ profile: await repository.complete(userId, parsed.data) }, { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "SETUP_UNAVAILABLE" }, { status: 503 }); }
}
