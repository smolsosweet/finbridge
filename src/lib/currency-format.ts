/**
 * FinBridge currency formatting and input normalization utilities.
 * Enforces uniform thousands separator (comma ',') and decimal separator (dot '.')
 * across all displays and input forms.
 */

export function parseCurrencyInput(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;
  const str = String(val).trim();
  if (!str) return 0;
  const isNeg = str.startsWith("-") || str.startsWith("−");
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  const num = Number(cleaned);
  if (!Number.isFinite(num)) return 0;
  return isNeg ? -num : num;
}

export function formatCurrencyInput(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === "") return "";
  const str = String(val).trim();
  if (!str) return "";
  const isNeg = str.startsWith("-") || str.startsWith("−");
  const cleaned = str.replace(/[^0-9.]/g, "");
  if (!cleaned) return "";

  const parts = cleaned.split(".");
  const intPart = parts[0].replace(/^0+(?=\d)/, "") || "0";
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (parts.length > 1) {
    // Keep decimal digits as entered
    return `${isNeg ? "-" : ""}${formattedInt}.${parts.slice(1).join("")}`;
  }
  if (str.endsWith(".")) {
    return `${isNeg ? "-" : ""}${formattedInt}.`;
  }
  return `${isNeg ? "-" : ""}${formattedInt}`;
}

export function formatCurrency(
  amount: number,
  currency = "VND",
  options?: {
    withSign?: boolean;
    maximumFractionDigits?: number;
    minimumFractionDigits?: number;
  }
): string {
  const isNeg = amount < 0;
  const absVal = Math.abs(amount);
  const isZeroDecimal = ["VND", "JPY", "KRW"].includes(currency.toUpperCase());
  const maxDigits = options?.maximumFractionDigits ?? (isZeroDecimal ? 0 : 2);
  const minDigits = options?.minimumFractionDigits ?? 0;
  const formatted = absVal.toLocaleString("en-US", {
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits,
  });
  const curr = (currency || "VND").toUpperCase();
  if (options?.withSign) {
    const sign = amount > 0 ? "+" : isNeg ? "−" : "";
    return `${sign}${formatted} ${curr}`;
  }
  return `${isNeg ? "−" : ""}${formatted} ${curr}`;
}
