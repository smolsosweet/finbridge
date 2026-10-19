import { parseTransactionAmounts } from "./transaction-drafts";
import type { TransferChatRequest } from "./transfer-chat-model";

type Currency = "VND" | "CNY" | "USD" | "AUD";
const supported = new Set<Currency>(["VND", "CNY", "USD", "AUD"]);
const fold = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");

/** Narrow read-only shortcut, not a replacement for model orchestration.
 * Explicit currencies/direction and a single amount can be resolved without an
 * LLM. Ambiguity, historical requests, compound tasks and ALL writes fall through.
 */
export function resolveTransferRead(message: string, previous?: TransferChatRequest): TransferChatRequest | null {
  if (/\bbán\b/iu.test(message)) return null;
  if ([...message.matchAll(/\b[A-Z]{3}\b/g)].some(match => !["VND", "CNY", "USD", "AUD", "RMB"].includes(match[0]))) return null;
  const text = fold(message.replace(/tiền\s+tệ/giu, "currency").replace(/đô/giu, "USD"));
  if (/\b(?:luu|tao|them|sua|xoa|huy|chuyen tien|gui tien|thanh toan|hoc phi|hoa don|mua|xac nhan|duyet|save|create|edit|delete|cancel|send|transfer|pay|buy|sell|approve|confirm|fee|fees|phi|so du|chi tieu|ngan sach|vi|tai khoan|account|wallet|budget|balance|spending)\b|保存|创建|删除|取消|汇款|转账|支付|购买|手续费|余额/.test(text)) return null;
  // A current observation cannot answer a historical/future rate request.
  if (/\b(?:hom qua|ngay mai|tuan truoc|thang truoc|nam truoc|tomorrow|yesterday|last week|last month|last year|on \d|ngay \d)\b|\d{1,4}[/-]\d{1,2}|昨天|明天|上周|上个月|去年/.test(text)) return null;
  if (/\b(?:eur|euro|gbp|jpy|yen|cad|krw|sgd|thb)\b|€|£|日元|欧元/.test(text)) return null;
  const mentions: Currency[] = [];
  const alias = /\b(?:australian dollars?|do la uc|aud|us dollars?|do la my|do la|my kim|dollars?|usd|chinese yuan|nhan dan te|renminbi|yuan|rmb|cny|te|vietnamese dong|viet nam dong|tien viet|dong|vnd)\b|美元|人民币|人民幣|澳元|越南盾|₫|\$/g;
  const canonical = text.replace(alias, (value: string, offset: number) => {
    if (value === "te" && /\b(?:tien|quoc|kinh|y)\s+$/.test(text.slice(0, offset))) return value;
    const currency: Currency = /aud|australian|do la uc|澳元/.test(value) ? "AUD" : /usd|dollar|do la|my kim|美元|\$/.test(value) ? "USD" : /cny|rmb|yuan|renminbi|nhan dan te|^te$|人民币|人民幣/.test(value) ? "CNY" : "VND";
    mentions.push(currency); return ` ${currency} `;
  });
  const currencies = [...new Set(mentions)];
  if (currencies.length > 2) return null;
  const asksRate = /\b(?:ty gia|hoi doai|exchange rate|exchange rates|fx rate|fx rates)\b|汇率|匯率/.test(text);
  const conversionVerb = /\b(?:quy doi|doi|convert|conversion|equivalent|worth)\b|兑换|兌換|换成|換成|换算/.test(text);
  const asksConversion = conversionVerb || currencies.length === 2 && /\b(?:bang bao nhieu|duoc bao nhieu|how much)\b|多少/.test(text);
  const context = previous && ["rates", "convert"].includes(previous.operation) ? previous : undefined;
  if (!asksRate && !asksConversion && !context) return null;
  const amounts = parseTransactionAmounts(canonical.replace(/AUD/g, "USD"));
  // AUD is substituted only for the existing numeric parser; its actual ISO code
  // comes from the currency attached to the amount below, never from the substitute.
  const numbers = canonical.match(/\d[\d.,]*(?:\s*(?:k|nghin|ngan|trieu|tr|million|m)\b)?/g) || [];
  if (numbers.length > 1 || amounts.length > 1) return null;
  if (asksRate && numbers.length && !asksConversion) return null;
  if (currencies.length === 2 && !/\d[\d.,]*(?:\s*(?:k|nghin|ngan|trieu|tr|million|m)\b)?\s*(VND|CNY|USD|AUD)\b/.test(canonical) && !/\b(?:sang|to|into|thanh|ra)\b|\/|换|換|兑|兌/.test(text)) return null;
  if (/\b(?:va|and)\b/.test(text) && !/\b(?:va|and)\s+(?:(?:du lieu|data|rate|ty gia|nguon|source|ngay|date|what date|its date)\b)/.test(text)) return null;
  if (!asksRate && !asksConversion) {
    const residue = canonical.replace(/\d[\d.,]*(?:\s*(?:k|nghin|ngan|trieu|tr|million|m)\b)?/g, "").replace(/\b(?:VND|CNY|USD|AUD|vay|con|thi|sao|the|nao|nhe|nhi|what|how|about|then|and|instead)\b/gi, "").replace(/[那呢么麼怎样怎樣\s.,!?？]+/g, "");
    if (residue) return null;
  }
  if (asksRate && !numbers.length) {
    return { operation: "rates", ...(currencies[0] ? { sourceCurrency: currencies[0] } : {}), ...(currencies[1] ? { targetCurrency: currencies[1] } : {}) };
  }
  if (!numbers.length) {
    if (context?.amount && currencies.length === 1 && /\b(?:sang|to|into)\b|换成|換成/.test(text)) return { operation: "convert", amount: context.amount, sourceCurrency: context.sourceCurrency, targetCurrency: currencies[0] };
    return null;
  }
  // Avoid interpreting two-sided statements or unsupported numeric precision.
  const raw = numbers[0];
  if (!raw) return null;
  const numeric = amounts[0]?.amount ?? parseTransactionAmounts(`${raw} USD`)[0]?.amount;
  const digits = raw.match(/^\d[\d.,]*/)?.[0] || "";
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(digits) && !/^\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?$/.test(digits)) return null;
  if (!numeric || !Number.isFinite(numeric)) return null;
  const attached = canonical.match(/\d[\d.,]*(?:\s*(?:k|nghin|ngan|trieu|tr|million|m)\b)?\s*(VND|CNY|USD|AUD)\b/)?.[1] as Currency | undefined;
  const targetOnly = !attached && currencies.length === 1 && /\b(?:sang|to|into|thanh)\b|换成|換成/.test(text);
  const source = attached || (targetOnly ? amounts[0]?.currency as Currency | undefined || context?.sourceCurrency : currencies[0] || context?.sourceCurrency);
  const target = targetOnly ? currencies[0] : currencies.find(c => c !== source) || (context?.targetCurrency !== source ? context?.targetCurrency : undefined);
  if (source && !supported.has(source)) return null;
  return { operation: "convert", amount: String(numeric), ...(source ? { sourceCurrency: source } : {}), ...(target ? { targetCurrency: target } : {}) };
}
