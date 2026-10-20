export type ScenarioLanguage = "vi" | "en" | "zh";
const locales = { vi: "vi-VN", en: "en-US", zh: "zh-CN" };

/** Language evidence only; never routes financial intent or extracts amounts. */
export function detectScenarioLanguage(message: string): ScenarioLanguage | null {
  const words = message.toLowerCase().match(/[\p{L}']+/gu) || [];
  const plain = words.map(word => word.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d"));
  const en = words.filter(w => /^(if|i|my|me|will|would|still|have|enough|money|for|spend|buy|on|the|what|how|much|can|could|this|month|rent|after|please|keep|without|with|purchase|go|ahead)$/.test(w)).length;
  const vi = plain.filter(w => /^(neu|toi|minh|tui|ban|mua|chi|tien|con|du|khong|thang|cuoi|nha|thue|tra|thi|bao|nhieu|nhu|nay|vay|khoan|duoc|voi|giu|lai|nay|cua)$/.test(w)).length;
  const zh = (message.match(/[\u3400-\u9fff]/g) || []).length;
  if (zh >= 3 && zh > en + vi) return "zh";
  if (en >= 2 && en > vi) return "en";
  if (vi >= 2 && vi > en) return "vi";
  return null;
}
export function resolveScenarioLanguage(message: string, fallback: ScenarioLanguage): ScenarioLanguage {
  return detectScenarioLanguage(message) || fallback;
}
export function formatScenarioMoney(amount: number, currency: string, language: ScenarioLanguage) {
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(locales[language], { maximumFractionDigits: digits }).format(amount) + " " + currency;
}
export function formatScenarioDate(value: string, language: ScenarioLanguage) {
  const date = new Date(value + "T12:00:00Z");
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(locales[language], { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date) : value;
}
