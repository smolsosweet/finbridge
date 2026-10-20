import { readMailConfig } from "./auth-mail";
export function safetyEmailAvailable(env: NodeJS.ProcessEnv = process.env) {
  try { return env.SAFETY_EMAIL_ENABLED === "true" && (env.SAFETY_CRON_SECRET?.length || 0) >= 32 && readMailConfig(env)?.mode === "brevo"; } catch { return false; }
}
const COPY = {
  en: { subject: "FinBridge · You have a new alert", heading: "Review your FinBridge alerts", body: "A safety rule needs your attention. Sign in to view the details securely.", action: "View alerts", footer: "Manage email notifications in FinBridge settings." },
  vi: { subject: "FinBridge · Bạn có cảnh báo mới", heading: "Kiểm tra cảnh báo FinBridge", body: "Một quy tắc an toàn cần bạn chú ý. Đăng nhập để xem chi tiết an toàn.", action: "Xem cảnh báo", footer: "Quản lý thông báo email trong phần Cài đặt FinBridge." },
  zh: { subject: "FinBridge · 你有新提醒", heading: "查看 FinBridge 提醒", body: "一项安全规则需要关注。请登录后安全地查看详情。", action: "查看提醒", footer: "在 FinBridge 设置中管理邮件通知。" },
};
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
// No financial values, rule names, wallet names or forecasts enter email payloads.
export function renderSafetyEmail(language: keyof typeof COPY, origin: string) {
  const t = COPY[language], url = new URL("/app/safetyAlerts", origin).href;
  return { subject: t.subject, text: [t.heading, t.body, `${t.action}: ${url}`, t.footer].join("\n\n"), html: `<!doctype html><html lang="${language}"><body style="margin:0;background:#f6f7fb;font-family:Arial,sans-serif;color:#203343"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px"><table role="presentation" width="100%" style="max-width:560px;background:white;border:1px solid #e2e8f0;border-radius:20px"><tr><td style="padding:28px"><b style="color:#713ee8;font-size:24px">FinBridge</b><h1 style="font-size:23px">${t.heading}</h1><p style="line-height:1.7">${t.body}</p><a href="${escape(url)}" style="display:inline-block;padding:14px 20px;border-radius:10px;background:#713ee8;color:white;text-decoration:none">${t.action}</a><p style="font-size:12px;color:#667085;line-height:1.7">${t.footer}</p></td></tr></table></td></tr></table></body></html>` };
}
export async function sendSafetyEmail(to: string, language: keyof typeof COPY, env: NodeJS.ProcessEnv = process.env): Promise<"accepted" | "retry" | "failed" | "unknown"> {
  if (!safetyEmailAvailable(env)) return "failed";
  const config = readMailConfig(env); if (config?.mode !== "brevo") return "failed";
  const message = renderSafetyEmail(language, env.BETTER_AUTH_URL!);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", signal: AbortSignal.timeout(8000), redirect: "error", headers: { "api-key": config.key, "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ sender: { name: "FinBridge", email: config.from }, to: [{ email: to }], subject: message.subject, htmlContent: message.html, textContent: message.text }) });
    if (response.ok) return "accepted";
    return response.status === 429 ? "retry" : response.status >= 500 ? "unknown" : "failed";
  } catch { return "unknown"; }
}
