"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthenticatedUser } from "./AuthenticatedUser";
import { workspaceOwner } from "@/components/sites/rolly/replica/store";
import type { FeedbackReceipt } from "@/lib/feedback";

export const FEEDBACK_COPY = {
  vi: { busy: "Đang gửi…", saved: "Đã ghi nhận trong hệ thống. Mã tiếp nhận:", failed: "Chưa gửi được. Nội dung vẫn được giữ để bạn thử lại.", limited: "Bạn đã gửi 5 phản hồi trong 10 phút. Vui lòng thử lại sau.", account: "Vui lòng đăng nhập tài khoản để gửi phản hồi.", note: "Phản hồi được lưu trong hệ thống; chưa có thông báo email hay thời hạn phản hồi tự động." },
  en: { busy: "Sending…", saved: "Saved in the system. Reference:", failed: "Could not send. Your message is preserved so you can retry.", limited: "You have sent 5 messages in 10 minutes. Please try again later.", account: "Please sign in to submit feedback.", note: "Feedback is stored in the system; email delivery and automatic response times are not provided." },
  zh: { busy: "正在发送…", saved: "已保存到系统。记录编号：", failed: "发送失败，内容已保留，请重试。", limited: "10分钟内已发送5条反馈，请稍后再试。", account: "请先登录账户再提交反馈。", note: "反馈保存在系统中；目前不提供邮件通知或自动回复时限。" },
};

export function useFeedbackSubmission(kind: "contact" | "feature", language: keyof typeof FEEDBACK_COPY) {
  const user = useAuthenticatedUser();
  const copy = FEEDBACK_COPY[language];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<FeedbackReceipt | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);

  async function submit(subject: string, message: string) {
    if (controller.current) return false;
    const owner = user?.id;
    if (!owner || workspaceOwner() !== owner) { setError(copy.account); return false; }
    const payload = { kind, subject: subject.trim(), message: message.trim() };
    const key = JSON.stringify({ owner, ...payload });
    if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
    const mutationId = pending.current.id;
    const abort = new AbortController(); controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 20_000);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json", "x-finbridge-workspace-owner": owner },
        body: JSON.stringify({ mutationId, ...payload }), signal: abort.signal,
      });
      const result = await response.json();
      if (workspaceOwner() !== owner) return false;
      if (!response.ok) {
        setError(response.status === 429 ? copy.limited : response.status === 401 || result.error === "ACCOUNT_CHANGED" ? copy.account : copy.failed);
        return false;
      }
      if (result.receipt?.id !== mutationId || result.receipt.kind !== kind || result.receipt.status !== "received") throw new Error("INVALID_RECEIPT");
      setReceipt(result.receipt); return true;
    } catch {
      if (workspaceOwner() === owner) setError(copy.failed);
      return false;
    } finally { clearTimeout(timeout); controller.current = null; setBusy(false); }
  }
  function reset() { if (!controller.current) { if (receipt) pending.current = null; setReceipt(null); setError(""); } }
  return { busy, error, receipt, submit, reset, copy };
}
