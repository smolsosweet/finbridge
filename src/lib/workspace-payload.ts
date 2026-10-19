import type { AppState } from "../components/sites/rolly/replica/store";

export function financialWorkspaceFingerprint(state: AppState) {
  const { transactionChat: _chat, planningChat: _planning, ...financial } = state;
  void _chat; void _planning;
  return JSON.stringify(financial);
}

/** Canonical receipt lives on its transaction. Chat resolves that same image by
 * stable transaction ID instead of uploading a second copy on every save. */
export function workspaceWireSnapshot(state: AppState): AppState {
  if (!state.transactionChat) return state;
  const images = new Map(state.transactions.filter(t => t.image).map(t => [t.id, t.image]));
  let changed = false;
  const messages = state.transactionChat.messages.map(message => {
    if (!message.transaction?.image || images.get(message.transaction.id) !== message.transaction.image) return message;
    const transaction = { ...message.transaction }; delete transaction.image; changed = true;
    return { ...message, transaction };
  });
  return changed ? { ...state, transactionChat: { ...state.transactionChat, messages } } : state;
}

export class WorkspaceRequestError extends Error {
  code: string;
  status: number;
  requestId?: string;
  constructor(code: string, status: number, requestId?: string) { super(code); this.name = "WorkspaceRequestError"; this.code = code; this.status = status; this.requestId = requestId; }
}
export function definitelyRejectedWorkspace(error: unknown) {
  return error instanceof Error && "status" in error && [400, 413, 415, 422, 429].includes(Number(error.status));
}
export function workspaceSaveErrorMessage(error: unknown, language: "vi" | "en" | "zh") {
  const code = error instanceof Error ? error.message : "";
  if (code === "INSUFFICIENT_FUNDS" || code === "BALANCE_UNAVAILABLE") return {
    vi: "Giao dịch chưa được lưu vì ví không đủ tiền hoặc chưa xác minh được số dư. Bản nháp vẫn được giữ; hãy kiểm tra ví và số tiền rồi thử lại.",
    en: "The transaction was not saved: insufficient or unverified wallet funds. Your draft is kept; check the wallet and amount, then retry.",
    zh: "交易未保存：钱包金额不足或无法核实余额。草稿已保留，请检查钱包和金额后重试。",
  }[language];
  const key = code === "PAYLOAD_TOO_LARGE" ? "large" : ["INVALID_WORKSPACE", "INVALID_PLANNING_CHANGE", "INVALID_BILL_PAYMENT"].includes(code) ? "invalid" : ["UNAUTHENTICATED", "ACCOUNT_CHANGED", "INVALID_ORIGIN"].includes(code) ? "auth" : ["WORKSPACE_CONFLICT", "MUTATION_MISMATCH"].includes(code) ? "conflict" : code === "RATE_LIMITED" ? "rate" : "unknown";
  return {
    vi: { large: "Ảnh hoặc sổ dữ liệu quá lớn để gửi. Bản nháp vẫn được giữ; hãy dùng ảnh nhỏ hơn hoặc tải bản chưa lưu trước khi thử lại.", invalid: "Máy chủ từ chối dữ liệu chưa hợp lệ; giao dịch này chưa được lưu. Hãy kiểm tra số tiền, tiền tệ, ví và thông tin cần bổ sung rồi xác nhận lại.", auth: "Phiên đăng nhập hoặc tài khoản đã thay đổi. Giữ trang này mở và đăng nhập lại đúng tài khoản trước khi thử lưu.", conflict: "Sổ dữ liệu đã thay đổi ở nơi khác. Hãy tải bản chưa lưu ở thanh thông báo trước khi đồng bộ lại.", rate: "Có quá nhiều lần lưu liên tiếp. Bản nháp vẫn được giữ; hãy chờ một chút rồi xác nhận lại.", unknown: "Chưa nhận được xác nhận lưu từ máy chủ. Giữ trang mở và bấm xác nhận lại để kiểm tra; Finn không tạo giao dịch trùng." },
    en: { large: "The receipt or workspace is too large to send. Your draft is kept; use a smaller image or download the unsaved copy before retrying.", invalid: "The server rejected invalid data; this transaction was not saved. Check the amount, currency, wallet and missing details, then confirm again.", auth: "Your session or account changed. Keep this page open and sign in to the correct account before retrying.", conflict: "The workspace changed elsewhere. Download the unsaved copy from the status bar before reloading.", rate: "Too many saves in a short period. Your draft is kept; wait briefly and confirm again.", unknown: "The server has not acknowledged this save. Keep the page open and confirm again to check; Finn will not create a duplicate." },
    zh: { large: "收据或账本过大，草稿仍保留。请使用较小图片或下载未保存副本后重试。", invalid: "服务器拒绝无效数据，此交易未保存。请检查金额、币种、钱包及缺失信息后重新确认。", auth: "登录会话或账户已变化。请保持页面打开，登录正确账户后重试。", conflict: "账本已在其他地方更新，请先从状态栏下载未保存副本再同步。", rate: "保存过于频繁，草稿已保留，请稍后重新确认。", unknown: "尚未收到服务器保存确认。请保持页面打开并再次确认检查；Finn 不会重复创建交易。" },
  }[language][key];
}

/** Bounded compressed transport; does not change financial state or retry a write. */
export async function workspaceRequest(input: { revision: number; mutationId: string; data: AppState }, owner: string, fetcher: typeof fetch = fetch) {
  const text = JSON.stringify(input);
  let body: BodyInit = text;
  const headers: Record<string, string> = { "content-type": "application/json", "x-finbridge-workspace-owner": owner, "x-finbridge-save-ack": "1", "x-finbridge-compression": "gzip" };
  const bytes = new TextEncoder().encode(text);
  if (bytes.byteLength > 32000 && typeof CompressionStream !== "undefined") {
    const compressed = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
    if (compressed.byteLength > 4000000) throw new WorkspaceRequestError("PAYLOAD_TOO_LARGE", 413);
    body = compressed; headers["content-encoding"] = "gzip";
  } else if (bytes.byteLength > 4000000) throw new WorkspaceRequestError("PAYLOAD_TOO_LARGE", 413);
  const response = await fetcher("/api/workspace", { method: "POST", headers, body, signal: AbortSignal.timeout(20000) });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const fallbackCodes: Record<number, string> = { 400: "INVALID_WORKSPACE", 401: "UNAUTHENTICATED", 403: "INVALID_ORIGIN", 409: "WORKSPACE_CONFLICT", 413: "PAYLOAD_TOO_LARGE", 429: "RATE_LIMITED" };
    const code = result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : fallbackCodes[response.status] || "WORKSPACE_UNAVAILABLE";
    throw new WorkspaceRequestError(code, response.status, response.headers.get("x-finbridge-request-id") || undefined);
  }
  if (!result || typeof result !== "object" || !("revision" in result) || !Number.isInteger(result.revision) || Number(result.revision) <= input.revision) throw new WorkspaceRequestError("INVALID_SAVE_ACK", 502);
  return result as { revision: number; data: AppState | null; updatedAt: string | null };
}
