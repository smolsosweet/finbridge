export type PreferredLanguage = "en" | "vi" | "zh";

const STORAGE_KEY = "finbridge-preferred-language-v1";

export function preferredLanguage(value: unknown, fallback: PreferredLanguage = "en"): PreferredLanguage {
  const normalized = String(value || "").trim().toLocaleLowerCase();
  if (normalized === "zh" || normalized.includes("中文") || normalized.includes("chinese") || normalized.includes("trung")) return "zh";
  if (normalized === "vi" || normalized.includes("tiếng việt") || normalized.includes("vietnamese") || normalized.includes("việt")) return "vi";
  return normalized === "en" || normalized.includes("english") || normalized.includes("anh") ? "en" : fallback;
}

export function readPreferredLanguage(fallback: PreferredLanguage = "en"): PreferredLanguage {
  try { return preferredLanguage(localStorage.getItem(STORAGE_KEY), fallback); } catch { return fallback; }
}

export function rememberPreferredLanguage(value: unknown) {
  const language = preferredLanguage(value);
  try { localStorage.setItem(STORAGE_KEY, language); } catch { /* The current page can still use its selected language. */ }
  return language;
}

export function workspaceLanguage(language: PreferredLanguage) {
  return language === "vi" ? "Tiếng Việt" : language === "zh" ? "中文" : "English";
}
