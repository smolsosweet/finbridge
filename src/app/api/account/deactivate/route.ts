import { deactivateAccountLifecycle } from "@/lib/account-lifecycle";
import { handleAccountDeactivation } from "@/lib/account-deactivation-handler";
import { getAuth } from "@/lib/auth";
import { readAuthConfig } from "@/lib/auth-config";
import { database } from "@/lib/database";

export async function POST(request: Request) {
  const config = readAuthConfig();
  if (!config) return Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 });
  const auth = getAuth();
  if (!auth) return Response.json({ code: "AUTH_UNAVAILABLE" }, { status: 503 });
  return handleAccountDeactivation(request, {
    baseURL: config.baseURL,
    secret: config.secret,
    getSession: (headers) => auth.api.getSession({ headers }),
    deactivate: (input) => deactivateAccountLifecycle(database(), input),
  });
}
