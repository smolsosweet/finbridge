import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import nodemailer from "nodemailer";

export type AuthMail = { to: string; kind: "verify" | "reset"; url: string };
export type SendAuthMail = (mail: AuthMail) => Promise<void>;

export function readMailConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.AUTH_EMAIL_MODE && !["local", "smtp", "brevo"].includes(env.AUTH_EMAIL_MODE)) throw new Error("Unsupported auth email mode.");
  if (env.AUTH_EMAIL_MODE === "brevo") {
    if (!env.BREVO_API_KEY || !env.AUTH_EMAIL_FROM || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(env.AUTH_EMAIL_FROM)) throw new Error("Brevo key and verified sender email are required.");
    return { mode: "brevo" as const, key: env.BREVO_API_KEY, from: env.AUTH_EMAIL_FROM };
  }
  if (env.AUTH_EMAIL_MODE === "local") {
    const origin = new URL(env.BETTER_AUTH_URL || "https://invalid.example");
    if (env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
      throw new Error("Local mail is only allowed in development on localhost.");
    }
    return { mode: "local" as const };
  }
  if (!env.SMTP_HOST && !env.SMTP_FROM) return null;
  const port = Number(env.SMTP_PORT || 587);
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM || ![465, 587].includes(port) || /[\r\n]/.test(env.SMTP_FROM)) {
    throw new Error("Complete SMTP settings with TLS port 465 or 587 are required.");
  }
  return { mode: "smtp" as const, host: env.SMTP_HOST, port, user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.SMTP_FROM };
}

export function createMailSender(env: NodeJS.ProcessEnv = process.env): SendAuthMail | undefined {
  const config = readMailConfig(env);
  if (!config) return undefined;
  if (config.mode === "local") return async (mail) => {
    const directory = path.join(process.cwd(), ".local", "mail-outbox");
    await mkdir(directory, { recursive: true });
    // This private local file is never served by the app or printed in logs.
    await writeFile(path.join(directory, randomUUID() + ".json"), JSON.stringify({ ...mail, createdAt: new Date().toISOString() }, null, 2), { mode: 0o600, flag: "wx" });
  };
  if (config.mode === "brevo") return async ({ to, kind, url }) => {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST", signal: AbortSignal.timeout(15000), redirect: "error",
      headers: { "api-key": config.key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ sender: { name: "FinBridge", email: config.from }, to: [{ email: to }],
        subject: kind === "verify" ? "Verify your FinBridge email" : "Reset your FinBridge password",
        textContent: (kind === "verify" ? "Verify your email to sign in to FinBridge:\n" : "Reset your FinBridge password:\n") + url + "\n\nIf you did not request this, ignore this email. Never share this link.",
      }),
    });
    if (!response.ok) throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
  };
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: true, auth: { user: config.user, pass: config.password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return async ({ to, kind, url }) => {
    await transport.sendMail({ from: config.from, to,
      subject: kind === "verify" ? "Verify your FinBridge email" : "Reset your FinBridge password",
      text: (kind === "verify" ? "Verify your email to sign in to FinBridge:\n" : "Reset your FinBridge password:\n") + url + "\n\nIf you did not request this, ignore this email. Never share this link.",
    });
  };
}
