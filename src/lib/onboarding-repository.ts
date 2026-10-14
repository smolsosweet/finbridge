import type { Pool } from "pg";
import { onboardingSchema, type OnboardingData, type OnboardingRecord } from "./onboarding";
export const ONBOARDING_SQL = `CREATE TABLE IF NOT EXISTS finbridge_onboarding (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
export async function readOnboarding(pool: Pool, userId: string): Promise<OnboardingRecord | null> {
  const result = await pool.query("SELECT data, completed_at FROM finbridge_onboarding WHERE user_id = $1", [userId]);
  const row = result.rows[0];
  return row ? { data: onboardingSchema.parse(row.data), completedAt: new Date(row.completed_at).toISOString() } : null;
}
export async function completeOnboarding(pool: Pool, userId: string, data: OnboardingData) {
  await pool.query("INSERT INTO finbridge_onboarding (user_id, data) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING", [userId, JSON.stringify(onboardingSchema.parse(data))]);
  return readOnboarding(pool, userId);
}
