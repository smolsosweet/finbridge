/**
 * Canonical Internationalization and Localization Utilities
 * Core contracts for AppLanguage normalization and Data Integrity.
 */

export type AppLanguage = "en" | "vi" | "zh";

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ["en", "vi", "zh"] as const;

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: "English",
  vi: "Tiếng Việt",
  zh: "中文",
};

export const LANGUAGE_LOCALES: Record<AppLanguage, string> = {
  en: "en-US",
  vi: "vi-VN",
  zh: "zh-CN",
};

/**
 * Type guard for AppLanguage.
 */
export function isLanguage(lang: unknown): lang is AppLanguage {
  return lang === "en" || lang === "vi" || lang === "zh";
}

/**
 * Normalizes any language code, display name, or locale variant into canonical AppLanguage.
 * Supports:
 * - "en", "EN", "en-US", "en-GB", "English", "english", "anh" -> "en"
 * - "vi", "VI", "vi-VN", "Tiếng Việt", "tiếng việt", "tieng viet", "vietnamese" -> "vi"
 * - "zh", "ZH", "zh-CN", "zh-TW", "zh-Hans", "中文", "chinese", "trung" -> "zh"
 * Defaults to `fallback` (default "vi") for undefined, null, empty string, or unrecognized languages.
 */
export function resolveLanguage(lang: unknown, fallback: AppLanguage = "vi"): AppLanguage {
  if (typeof lang !== "string") {
    if (isLanguage(lang)) return lang;
    return fallback;
  }
  const normalized = lang.trim().toLowerCase();
  if (!normalized) return fallback;

  // Direct exact matches
  if (normalized === "en") return "en";
  if (normalized === "vi") return "vi";
  if (normalized === "zh") return "zh";

  // Chinese patterns
  if (
    normalized.startsWith("zh") ||
    normalized.includes("chinese") ||
    normalized.includes("trung") ||
    normalized.includes("中文")
  ) {
    return "zh";
  }

  // English patterns
  if (
    normalized.startsWith("en") ||
    normalized.includes("english") ||
    normalized.includes("anh")
  ) {
    return "en";
  }

  // Vietnamese patterns
  if (
    normalized.startsWith("vi") ||
    normalized.includes("việt") ||
    normalized.includes("viet")
  ) {
    return "vi";
  }

  return fallback;
}

/**
 * Returns human-readable label for language ("English" | "Tiếng Việt" | "中文").
 */
export function getLanguageLabel(lang: unknown): string {
  const resolved = resolveLanguage(lang);
  return LANGUAGE_LABELS[resolved];
}

/**
 * Returns BCP-47 locale tag ("en-US" | "vi-VN" | "zh-CN").
 */
export function getLocale(lang: unknown): string {
  const resolved = resolveLanguage(lang);
  return LANGUAGE_LOCALES[resolved];
}

/**
 * Data Integrity Contract:
 * - Sentinel wallet name (".", empty, or legacy localized sentinel labels) resolves to localized copy.
 * - Custom user wallet names (target.name !== ".") are preserved verbatim without dictionary translation.
 */
export function isSentinelWalletName(name: string | null | undefined): boolean {
  if (name === null || name === undefined) return true;
  if (typeof name !== "string") return false;
  const trimmed = name.trim();
  return !trimmed || trimmed === "." || trimmed === "Ví chính" || trimmed === "Main wallet" || trimmed === "主钱包";
}

/**
 * Resolves the display label of a wallet.
 * If the wallet name is a sentinel name, returns the localized label based on the active language.
 * Otherwise returns the custom user-defined wallet name unmodified.
 */
export function resolveWalletDisplayName(
  name: string | null | undefined,
  lang: unknown
): string {
  if (isSentinelWalletName(name)) {
    const canonical = resolveLanguage(lang);
    switch (canonical) {
      case "vi":
        return "Ví chính";
      case "zh":
        return "主钱包";
      case "en":
      default:
        return "Main wallet";
    }
  }
  return name!;
}

/**
 * Normalizes a wallet name before saving to store / localStorage.
 * If the name matches any sentinel label (e.g. user submitted localized default label "Ví chính", "Main wallet", "主钱包", or "."),
 * it stores canonical "." so future language switches will continue to translate dynamically.
 * Custom user names are preserved trimmed.
 */
export function normalizeWalletNameForStorage(name: string | null | undefined): string {
  if (isSentinelWalletName(name)) return ".";
  return name!.trim();
}

/**
 * Canonical dictionary of system default categories and their multilingual labels.
 * User-created custom categories are never modified and returned verbatim.
 */
export const SYSTEM_CATEGORY_LABELS: Record<string, Record<AppLanguage, string>> = {
  "Chưa được phân loại": { vi: "Chưa được phân loại", en: "Uncategorized", zh: "未分类" },
  "Uncategorized": { vi: "Chưa được phân loại", en: "Uncategorized", zh: "未分类" },
  "未分类": { vi: "Chưa được phân loại", en: "Uncategorized", zh: "未分类" },
  "Thức ăn & Đồ uống": { vi: "Thức ăn & Đồ uống", en: "Food & Dining", zh: "餐饮" },
  "Ăn uống": { vi: "Ăn uống", en: "Food & Dining", zh: "餐饮" },
  "Nhà": { vi: "Nhà", en: "Housing", zh: "住房" },
  "Nhà ở": { vi: "Nhà ở", en: "Housing", zh: "住房" },
  "Mua sắm": { vi: "Mua sắm", en: "Shopping", zh: "购物" },
  "Thu nhập": { vi: "Thu nhập", en: "Income", zh: "收入" },
  "Lương": { vi: "Lương", en: "Salary", zh: "工资" },
  "Quà tặng": { vi: "Quà tặng", en: "Gifts", zh: "礼物" },
  "Hóa đơn & Tiện ích": { vi: "Hóa đơn & Tiện ích", en: "Bills & Utilities", zh: "账单与公共事业" },
  "Di chuyển": { vi: "Di chuyển", en: "Transportation", zh: "交通出行" },
  "Giải trí": { vi: "Giải trí", en: "Entertainment", zh: "娱乐" },
  "Chuyển khoản nội bộ": { vi: "Chuyển khoản nội bộ", en: "Internal Transfer", zh: "内部转账" },
  "Chuyển khoản": { vi: "Chuyển khoản", en: "Transfer", zh: "转账" },
  "Điều chỉnh số dư": { vi: "Điều chỉnh số dư", en: "Balance Adjustment", zh: "余额调整" },
};

/**
 * Resolves the display label of a category.
 * If the category matches a known system default category, returns the localized label.
 * Otherwise returns the custom user-defined category name unmodified.
 */
export function resolveCategoryDisplayName(
  category: string | null | undefined,
  lang: unknown,
  fallbackLabel = ""
): string {
  if (!category || !category.trim()) return fallbackLabel;
  const canonical = resolveLanguage(lang);
  const trimmed = category.trim();
  const match = SYSTEM_CATEGORY_LABELS[trimmed];
  if (match) {
    return match[canonical];
  }
  return trimmed;
}

