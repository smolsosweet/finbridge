import { aiQuotaLanguage } from "./ai-quota";

const copy = {
  en: { large: "This input is too large. Use a smaller file or enter the details manually.", invalid: "Please send valid JSON input.", timeout: "The upload took too long. Try a smaller file or enter the details manually." },
  vi: { large: "Dữ liệu quá lớn. Hãy chọn tệp nhỏ hơn hoặc nhập thông tin bằng tay.", invalid: "Dữ liệu gửi lên không hợp lệ.", timeout: "Tải lên quá lâu. Hãy chọn tệp nhỏ hơn hoặc nhập thông tin bằng tay." },
  zh: { large: "输入过大。请选择较小的文件或手动输入。", invalid: "请发送有效的 JSON 数据。", timeout: "上传时间过长。请选择较小的文件或手动输入。" },
};

/** Bound bytes before parsing, even without Content-Length or with a false value.
 * Cancel without awaiting a potentially uncooperative upload source. */
export async function readAiJson(request: Request, maximumBytes: number): Promise<{ value: unknown } | Response> {
  const t = copy[aiQuotaLanguage(request)];
  const fail = (status: number, error: string, message: string) => Response.json({ error, message, manualEntryAvailable: true }, { status, headers: { "Cache-Control": "no-store" } });
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > maximumBytes) {
    void request.body?.cancel().catch(() => {});
    return fail(413, "PAYLOAD_TOO_LARGE", t.large);
  }
  if (request.headers.get("content-encoding") && request.headers.get("content-encoding") !== "identity") return fail(415, "UNSUPPORTED_ENCODING", t.invalid);
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") || "")) return fail(415, "UNSUPPORTED_MEDIA_TYPE", t.invalid);
  if (!request.body) return fail(400, "INVALID_REQUEST", t.invalid);
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let bytes = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;
  const abort = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", abort, { once: true });
  const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => { timedOut = true; reject(new Error("UPLOAD_TIMEOUT")); abort(); }, 10_000); });
  try {
    while (true) {
      request.signal.throwIfAborted();
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (timedOut) throw new Error("UPLOAD_TIMEOUT");
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) { abort(); return fail(413, "PAYLOAD_TOO_LARGE", t.large); }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return { value: JSON.parse(chunks.join("")) as unknown };
  } catch (error) {
    abort();
    return error instanceof Error && error.message === "UPLOAD_TIMEOUT"
      ? fail(408, "UPLOAD_TIMEOUT", t.timeout) : fail(400, "INVALID_REQUEST", t.invalid);
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
