export type ScenarioLanguage = "vi" | "en" | "zh";
const locales = { vi: "vi-VN", en: "en-US", zh: "zh-CN" };
export function formatScenarioMoney(amount: number, currency: string, language: ScenarioLanguage) {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(locales[language], { maximumFractionDigits: digits }).format(amount) + " " + currency;
}
export function formatScenarioDate(value: string, language: ScenarioLanguage) {
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locales[language], { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date) : value;
}
