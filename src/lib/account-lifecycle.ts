import { createCipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";
import type { Pool } from "pg";

export const ACCOUNT_LIFECYCLE_SQL = `CREATE TABLE IF NOT EXISTS finbridge_account_lifecycle (
  user_id TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('deactivated')),
  deactivated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  identity_fingerprint TEXT NOT NULL,
  identity_ciphertext TEXT NOT NULL,
  identity_iv TEXT NOT NULL,
  identity_tag TEXT NOT NULL,
  retired_email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS finbridge_account_lifecycle_status_idx ON finbridge_account_lifecycle (status);`;

type IdentitySnapshot = { email: string; accounts: Array<{ providerId: string; accountId: string }> };

function encryptionKey(secret: string) {
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret), Buffer.alloc(0), Buffer.from("finbridge-account-lifecycle-v1"), 32));
}

function encryptIdentity(snapshot: IdentitySnapshot, userId: string, secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
  return { ciphertext: ciphertext.toString("base64url"), iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url") };
}

function fingerprint(email: string, secret: string) {
  return createHmac("sha256", secret).update("finbridge-deactivated-email-v1\0" + email.trim().toLowerCase()).digest("base64url");
}

function retiredEmail(userId: string) {
  return `deactivated+${userId}.${randomBytes(12).toString("hex")}@disabled.finbridge.invalid`;
}

export async function initializeAccountLifecycle(pool: Pool) {
  await pool.query(ACCOUNT_LIFECYCLE_SQL);
}

export async function isAccountActive(pool: Pool, userId: string) {
  const result = await pool.query<{ status: string }>("SELECT status FROM finbridge_account_lifecycle WHERE user_id = $1", [userId]);
  return result.rowCount === 0;
}

export async function deactivateAccountLifecycle(pool: Pool, { userId, secret }: { userId: string; secret: string }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: string; email: string }>("SELECT id, email FROM \"user\" WHERE id = $1 FOR UPDATE", [userId]);
    if (user.rowCount !== 1) throw new Error("USER_NOT_FOUND");
    const accounts = await client.query<{ id: string; providerId: string; accountId: string }>("SELECT id, \"providerId\", \"accountId\" FROM \"account\" WHERE \"userId\" = $1 FOR UPDATE", [userId]);
    const snapshot: IdentitySnapshot = { email: user.rows[0].email, accounts: accounts.rows.map(({ providerId, accountId }) => ({ providerId, accountId })) };
    const encrypted = encryptIdentity(snapshot, userId, secret);
    const replacementEmail = retiredEmail(userId);
    await client.query(
      `INSERT INTO finbridge_account_lifecycle (user_id, status, identity_fingerprint, identity_ciphertext, identity_iv, identity_tag, retired_email)
       VALUES ($1, 'deactivated', $2, $3, $4, $5, $6)`,
      [userId, fingerprint(snapshot.email, secret), encrypted.ciphertext, encrypted.iv, encrypted.tag, replacementEmail],
    );
    // Reset records are security credentials, not user content. Retain them for
    // auditability but make every token issued to this identity unusable before
    // its email address can be released to a replacement account.
    await client.query("UPDATE verification SET \"expiresAt\" = CURRENT_TIMESTAMP WHERE value = $1 AND \"expiresAt\" > CURRENT_TIMESTAMP", [userId]);
    await client.query("UPDATE \"account\" SET \"accountId\" = 'deactivated:' || id, \"accessToken\" = NULL, \"refreshToken\" = NULL, \"idToken\" = NULL WHERE \"userId\" = $1", [userId]);
    await client.query("UPDATE \"user\" SET email = $2, \"emailVerified\" = false WHERE id = $1", [userId, replacementEmail]);
    // Preserve session rows as an audit trail while making every cookie unusable.
    await client.query("UPDATE \"session\" SET \"expiresAt\" = CURRENT_TIMESTAMP WHERE \"userId\" = $1", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
