import { hash, verify } from "@node-rs/argon2";
import { verifyPassword as verifyLegacyScrypt } from "@better-auth/utils/password";

// OWASP's Argon2id baseline: 19 MiB, two passes and one lane. The encoded PHC
// value retains its parameters and a fresh salt, so future policy upgrades can
// identify hashes that need replacement.
const ARGON2ID_OPTIONS = {
  algorithm: 2, // Argon2id
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

function normalized(password: string) {
  return password.normalize("NFKC");
}

export async function hashPassword(password: string) {
  return hash(normalized(password), ARGON2ID_OPTIONS);
}

export async function verifyPassword({ hash: storedHash, password }: { hash: string; password: string }) {
  try {
    // Existing users keep working. Their scrypt hash is replaced by Argon2id
    // when they next reset or change their password.
    if (storedHash.startsWith("$argon2id$")) return await verify(storedHash, normalized(password), ARGON2ID_OPTIONS);
    return await verifyLegacyScrypt(storedHash, password);
  } catch {
    return false;
  }
}
