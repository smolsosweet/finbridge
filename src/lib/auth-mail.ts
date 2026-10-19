import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import nodemailer from "nodemailer";

export type AuthMail = { to: string; kind: "verify" | "reset"; url: string };
export type SendAuthMail = (mail: AuthMail) => Promise<void>;

type RenderedAuthEmail = { subject: string; text: string; html: string };

const AUTH_EMAIL_COPY = {
  en: {
    verifySubject: "Verify your FinBridge email", resetSubject: "Reset your FinBridge password",
    verifyHeading: "Verify your email address", resetHeading: "Reset your password",
    verifyCopy: "Confirm your email address to activate your FinBridge account and sign in.",
    resetCopy: "We received a request to reset the password for your FinBridge account.",
    verifyAction: "Verify email", resetAction: "Reset password",
    verifyExpiry: "This verification link expires in 1 hour.", resetExpiry: "This reset link expires in 30 minutes.",
    verifyIgnore: "If you did not create a FinBridge account, you can safely ignore this email.",
    resetIgnore: "If you did not request a password reset, you can safely ignore this email.",
    fallback: "Button not working? Copy this link into your browser:", safety: "Never share this link with anyone.",
  },
  vi: {
    verifySubject: "Xác minh email FinBridge của bạn", resetSubject: "Đặt lại mật khẩu FinBridge",
    verifyHeading: "Xác minh địa chỉ email", resetHeading: "Đặt lại mật khẩu",
    verifyCopy: "Xác nhận địa chỉ email để kích hoạt tài khoản FinBridge và đăng nhập.",
    resetCopy: "Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản FinBridge của bạn.",
    verifyAction: "Xác minh email", resetAction: "Đặt lại mật khẩu",
    verifyExpiry: "Liên kết xác minh này hết hạn sau 1 giờ.", resetExpiry: "Liên kết đặt lại mật khẩu này hết hạn sau 30 phút.",
    verifyIgnore: "Nếu bạn không tạo tài khoản FinBridge, bạn có thể bỏ qua email này.",
    resetIgnore: "Nếu bạn không yêu cầu đặt lại mật khẩu, bạn có thể bỏ qua email này.",
    fallback: "Nút không hoạt động? Sao chép liên kết này vào trình duyệt:", safety: "Không chia sẻ liên kết này với bất kỳ ai.",
  },
  zh: {
    verifySubject: "验证您的 FinBridge 邮箱", resetSubject: "重置您的 FinBridge 密码",
    verifyHeading: "验证您的邮箱地址", resetHeading: "重置您的密码",
    verifyCopy: "请确认您的邮箱地址，以激活 FinBridge 账户并登录。",
    resetCopy: "我们收到了重置您 FinBridge 账户密码的请求。",
    verifyAction: "验证邮箱", resetAction: "重置密码",
    verifyExpiry: "此验证链接将在 1 小时后失效。", resetExpiry: "此密码重置链接将在 30 分钟后失效。",
    verifyIgnore: "如果您没有创建 FinBridge 账户，可以忽略此邮件。",
    resetIgnore: "如果您没有请求重置密码，可以忽略此邮件。",
    fallback: "按钮无法使用？请将此链接复制到浏览器中：", safety: "请勿将此链接分享给任何人。",
  },
} as const;

function emailLanguage(url: string): keyof typeof AUTH_EMAIL_COPY {
  try {
    const callback = new URL(new URL(url).searchParams.get("callbackURL") ?? "/", "https://finbridge.invalid");
    const language = callback.searchParams.get("lang");
    return language === "vi" || language === "zh" ? language : "en";
  } catch {
    return "en";
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character] ?? character);
}

export function renderAuthEmail({ kind, url }: Pick<AuthMail, "kind" | "url">): RenderedAuthEmail {
  const isVerification = kind === "verify";
  const language = emailLanguage(url);
  const copy = AUTH_EMAIL_COPY[language];
  const action = isVerification ? copy.verifyAction : copy.resetAction;
  const subject = isVerification ? copy.verifySubject : copy.resetSubject;
  const heading = isVerification ? copy.verifyHeading : copy.resetHeading;
  const description = isVerification ? copy.verifyCopy : copy.resetCopy;
  const expiry = isVerification ? copy.verifyExpiry : copy.resetExpiry;
  const ignore = isVerification ? copy.verifyIgnore : copy.resetIgnore;
  const safeUrl = escapeHtml(url);
  const text = [
    `FinBridge — ${heading}`,
    "",
    description,
    "",
    `${action}: ${url}`,
    "",
    expiry,
    ignore,
    copy.safety,
  ].join("\n");
  const html = `<!doctype html>
<html lang="${language}">
  <body style="margin:0;padding:0;background:#f7f7fb;color:#172f3c;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7fb;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e7ef;border-radius:20px;overflow:hidden;">
          <tr><td style="height:4px;background:#7357f5;background:linear-gradient(90deg,#ec269b,#7357f5,#168bf5);"></td></tr>
          <tr><td style="padding:36px 36px 12px;font-size:25px;font-weight:700;letter-spacing:-.4px;">FinBridge</td></tr>
          <tr><td style="padding:8px 36px 28px;">
            <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">${heading}</h1>
            <p style="margin:0;color:#5f7180;font-size:16px;line-height:1.6;">${description}</p>
          </td></tr>
          <tr><td style="padding:0 36px 28px;">
            <a href="${safeUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#7357f5;background:linear-gradient(90deg,#ec269b,#7357f5,#168bf5);color:#ffffff;font-size:16px;font-weight:700;line-height:1;text-decoration:none;">${action}</a>
          </td></tr>
          <tr><td style="padding:0 36px 28px;">
            <p style="margin:0 0 10px;color:#5f7180;font-size:14px;line-height:1.6;">${expiry}</p>
            <p style="margin:0;color:#5f7180;font-size:14px;line-height:1.6;">${ignore} ${copy.safety}</p>
          </td></tr>
          <tr><td style="padding:20px 36px 30px;border-top:1px solid #edf0f4;color:#7b8794;font-size:12px;line-height:1.6;">${copy.fallback}<br><a href="${safeUrl}" style="color:#5930b5;word-break:break-all;">${safeUrl}</a></td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
  return { subject, text, html };
}

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
    const message = renderAuthEmail({ kind, url });
    let response: Response;
    try {
      response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST", signal: AbortSignal.timeout(15000), redirect: "error",
        headers: { "api-key": config.key, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ sender: { name: "FinBridge", email: config.from }, to: [{ email: to }], subject: message.subject, textContent: message.text, htmlContent: message.html }),
      });
    } catch (error) {
      // Do not log recipients, API keys, verification links, or provider response bodies.
      console.error("AUTH_MAIL_BREVO_NETWORK_FAILED", { provider: "brevo", errorName: error instanceof Error ? error.name : "UnknownError" });
      throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
    }
    if (!response.ok) {
      // The HTTP status distinguishes a rejected key/sender from a network failure without exposing secrets.
      console.error("AUTH_MAIL_BREVO_DELIVERY_FAILED", { provider: "brevo", status: response.status, retryAfter: response.headers.get("retry-after") || null });
      throw new Error("AUTH_EMAIL_DELIVERY_FAILED");
    }
  };
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: true, auth: { user: config.user, pass: config.password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  });
  return async ({ to, kind, url }) => {
    const message = renderAuthEmail({ kind, url });
    await transport.sendMail({ from: config.from, to, subject: message.subject, text: message.text, html: message.html });
  };
}
