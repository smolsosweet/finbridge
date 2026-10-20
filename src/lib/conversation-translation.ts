import type { AppLanguage } from "./i18n";

export const CONVERSATION_TRANSLATION_COPY = {
  en: { pending: "Translating conversation…", failed: "Finn couldn't translate some messages. The originals are still available.", retry: "Retry translation", original: "Original message" },
  vi: { pending: "Đang chuyển ngôn ngữ hội thoại…", failed: "Finn chưa dịch được một số tin nhắn. Nội dung gốc vẫn được giữ.", retry: "Thử dịch lại", original: "Tin nhắn gốc" },
  zh: { pending: "正在翻译对话…", failed: "Finn 暂时未能翻译部分消息，原文仍然保留。", retry: "重试翻译", original: "消息原文" },
} as const;

const marker = /⟦FINN_[A-Z]+⟧/g;
function letters(index: number): string {
  return index >= 26 ? letters(Math.floor(index / 26) - 1) + String.fromCharCode(65 + index % 26) : String.fromCharCode(65 + index);
}

/** Only translate prose. Protect numeric values, dates, URLs and user-owned names. */
export function protectTranslationText(text: string, names: string[] = []) {
  if (text.includes("⟦FINN_")) throw new Error("RESERVED_TRANSLATION_MARKER");
  const values: string[] = [];
  const protect = (value: string) => { const token = `⟦FINN_${letters(values.length)}⟧`; values.push(value); return token; };
  const escaped = [...new Set(names.filter(Boolean))].sort((a, b) => b.length - a.length).map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  // One pass prevents later substitutions from changing an earlier placeholder.
  const expression = new RegExp(["https?:\\/\\/[^\\s)]+", ...escaped, "[-+−]?\\p{N}+(?:[.,:/ -]\\p{N}+)*(?:%| ?(?:VND|USD|CNY|RMB|₫|đ(?![\\p{L}])|¥|\\$))?", "\\b(?:VND|USD|CNY|RMB)\\b", "[₫¥$]"].join("|"), "gu");
  return { text: text.replace(expression, protect), values };
}

export function restoreTranslationText(translated: string, protectedText: ReturnType<typeof protectTranslationText>): string {
  const expected: string[] = protectedText.text.match(marker) || [];
  const received: string[] = translated.match(marker) || [];
  if (received.length !== expected.length || expected.some(token => received.filter(item => item === token).length !== 1)) throw new Error("TRANSLATION_CHANGED_FACTS");
  const prose = translated.replace(marker, "");
  if (/\p{N}|\b(?:VND|USD|CNY|RMB)\b|[₫¥$]|⟦FINN_/u.test(prose)) throw new Error("TRANSLATION_ADDED_FACTS");
  const result = translated.replace(marker, token => protectedText.values[expected.indexOf(token)]);
  if (!result.trim()) throw new Error("EMPTY_TRANSLATION");
  return result;
}

export function conversationTranslationKey(text: string, language: AppLanguage) { return `${language}\u0000${text}`; }

/** Bound each provider request without dropping long historical explanations. */
export function splitConversationText(text: string, maxLength = 10000): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (text.length - start > maxLength) {
    const limit = start + maxLength;
    const boundary = Math.max(text.lastIndexOf("\n", limit), text.lastIndexOf(" ", limit));
    const end = boundary > start + maxLength / 2 ? boundary + 1 : limit;
    chunks.push(text.slice(start, end)); start = end;
  }
  chunks.push(text.slice(start));
  return chunks;
}
