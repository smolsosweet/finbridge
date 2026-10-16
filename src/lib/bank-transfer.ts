import { z } from "zod";

export const bankRecipientSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/),
  accountNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9.-]{0,33}$/),
  accountName: z.string().trim().max(80),
  reference: z.string().max(50),
  preferredApp: z.string().regex(/^[a-z0-9-]{1,30}$/).optional(),
}).strict();
export type BankRecipient = z.infer<typeof bankRecipientSchema>;
export type TransferBank = { bin: string; code: string; name: string };
export type TransferApp = { id: string; name: string; autofill: boolean };
export type BankCatalog = { banks: TransferBank[]; apps: TransferApp[]; platform: "android" | "ios"; fallback: boolean };

export function transferText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\x20-\x7e]/g, "").trim();
}
export function qrCrc(value: Uint8Array) {
  let crc = 0xffff;
  for (const byte of value) { crc ^= byte << 8; for (let i = 0; i < 8; i++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
const encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", { fatal: true });
function fields(bytes: Uint8Array): Map<string, Uint8Array> {
  const result = new Map<string, Uint8Array>();
  for (let at = 0; at < bytes.length;) {
    if (at + 4 > bytes.length) throw new Error("INVALID_QR");
    const header = decoder.decode(bytes.slice(at, at + 4));
    if (!/^\d{4}$/.test(header)) throw new Error("INVALID_QR");
    const tag = header.slice(0, 2), length = Number(header.slice(2));
    if (!length || result.has(tag) || at + 4 + length > bytes.length) throw new Error("INVALID_QR");
    result.set(tag, bytes.slice(at + 4, at + 4 + length)); at += 4 + length;
  }
  return result;
}
const value = (map: Map<string, Uint8Array>, tag: string) => map.has(tag) ? decoder.decode(map.get(tag)!) : "";
export function parseTransferQr(raw: string): { recipient: BankRecipient; amount: number | null } {
  if (raw.length > 2000 || !raw.startsWith("000201") || !/6304[0-9A-Fa-f]{4}$/.test(raw)) throw new Error("INVALID_QR");
  const bytes = encoder.encode(raw), root = fields(bytes);
  if (value(root, "63").toUpperCase() !== qrCrc(bytes.slice(0, -4))) throw new Error("INVALID_QR");
  if (value(root, "53") !== "704" || value(root, "58") !== "VN" || !root.has("38") || ["55", "56", "57"].some(tag => root.has(tag))) throw new Error("UNSUPPORTED_QR");
  const service = fields(root.get("38")!);
  if (value(service, "00") !== "A000000727" || value(service, "02") !== "QRIBFTTA" || !service.has("01")) throw new Error("UNSUPPORTED_QR");
  const account = fields(service.get("01")!), additional = root.has("62") ? fields(root.get("62")!) : new Map<string, Uint8Array>();
  const amountText = value(root, "54"), amount = amountText ? Number(amountText) : null;
  if (amountText && (!/^\d+(?:\.0{1,2})?$/.test(amountText) || !Number.isSafeInteger(amount) || amount! <= 0 || amount! > 1e12)) throw new Error("INVALID_QR");
  const recipient = bankRecipientSchema.safeParse({ bankBin: value(account, "00"), accountNumber: value(account, "01"), accountName: value(root, "59"), reference: value(additional, "08") });
  if (!recipient.success) throw new Error("INVALID_QR");
  return { recipient: recipient.data, amount };
}
function tlv(tag: string, content: string) {
  const length = encoder.encode(content).length;
  if (!length || length > 99) throw new Error("INVALID_TRANSFER");
  return tag + String(length).padStart(2, "0") + content;
}
export function buildTransferQr(recipient: BankRecipient, amount: number, reference: string) {
  const r = bankRecipientSchema.parse(recipient);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e12) throw new Error("INVALID_TRANSFER");
  const memo = transferText(reference).slice(0, 50), name = transferText(r.accountName).slice(0, 25);
  const service = tlv("00", "A000000727") + tlv("01", tlv("00", r.bankBin) + tlv("01", r.accountNumber)) + tlv("02", "QRIBFTTA");
  const payload = "000201010212" + tlv("38", service) + "5303704" + tlv("54", String(amount)) + "5802VN" + (name ? tlv("59", name) : "") + (memo ? tlv("62", tlv("08", memo)) : "") + "6304";
  return payload + qrCrc(encoder.encode(payload));
}
export function buildBankLink(recipient: BankRecipient, amount: number, reference: string, bank: TransferBank, app: TransferApp, returnURL: string) {
  const r = bankRecipientSchema.parse(recipient), back = new URL(returnURL);
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1e12 || bank.bin !== r.bankBin || !/^[a-z0-9-]{1,30}$/.test(app.id) || !/^[A-Za-z0-9]{1,30}$/.test(bank.code) || !["https:", "http:"].includes(back.protocol) || back.username || back.password) throw new Error("INVALID_TRANSFER");
  const link = new URL("https://dl.vietqr.io/pay");
  link.search = new URLSearchParams({ app: app.id, ba: `${r.accountNumber}@${bank.code.toLowerCase()}`, am: String(amount), tn: transferText(reference).slice(0, 50), bn: transferText(r.accountName), url: back.href }).toString();
  return link.href;
}
