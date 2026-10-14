import "server-only";
import { Pool } from "pg";
import { readAuthConfig } from "./auth-config";
import { readOnboarding, completeOnboarding } from "./onboarding-repository";
import type { OnboardingData } from "./onboarding";
let pool: Pool | undefined;
function database() {
  const config = readAuthConfig();
  if (!config) throw new Error("AUTH_NOT_CONFIGURED");
  return pool ??= new Pool({ connectionString: config.databaseURL, max: 3, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
}
export const getOnboarding = (userId: string) => readOnboarding(database(), userId);
export const saveOnboarding = (userId: string, data: OnboardingData) => completeOnboarding(database(), userId, data);
