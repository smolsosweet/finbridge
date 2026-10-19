"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { getWorkspaceState, initialState, registerWorkspaceFlusher, replaceDatabaseWorkspace, subscribeWorkspace, workspaceOwner, type AppState } from "@/components/sites/rolly/replica/store";
import { parseWorkspace, type WorkspaceRecord } from "@/lib/workspace-model";
import { createWorkspaceWriter, type WorkspaceWriteStatus } from "@/lib/workspace-writer";
import { readUserWorkspace } from "@/lib/workspace-storage";
import { preferredLanguage, readPreferredLanguage, workspaceLanguage } from "@/lib/language-preference";
import { financialWorkspaceFingerprint, workspaceRequest } from "@/lib/workspace-payload";

const COPY = {
  en: { loading: "Loading your database workspace…", error: "Could not load your financial records. Check the database connection and try again.", retry: "Retry", migration: "Move your existing records to FinBridge's database", migrationHint: "This account has records saved on this device. Import them once so future edits are stored in PostgreSQL. The original copy stays unchanged.", import: "Import to database", saved: "Saved to your account", pending: "Changes waiting to save", saving: "Saving to your account…", failed: "Changes have not been saved. Keep this page open and retry.", conflict: "Another device updated this workspace. Your edits have not overwritten it. Download your unsaved copy before loading the database version.", download: "Download unsaved copy", reload: "Load database version", confirm: "Load the database version? Unsaved edits in this tab will be replaced. Download them first if you want to keep them." },
  vi: { loading: "Đang tải sổ tài chính từ database…", error: "Chưa tải được dữ liệu tài chính. Kiểm tra kết nối database rồi thử lại.", retry: "Thử lại", migration: "Chuyển dữ liệu hiện có lên database FinBridge", migrationHint: "Tài khoản này có dữ liệu trên thiết bị. Nhập một lần để các thay đổi sau được lưu vào PostgreSQL. Bản gốc trên thiết bị được giữ nguyên.", import: "Chuyển vào database", saved: "Đã lưu vào tài khoản", pending: "Có thay đổi chờ lưu", saving: "Đang lưu vào tài khoản…", failed: "Thay đổi chưa được lưu. Giữ trang này mở và thử lại.", conflict: "Thiết bị khác vừa cập nhật sổ tài chính. Thay đổi ở đây chưa ghi đè dữ liệu đó. Hãy tải bản chưa lưu trước khi mở bản từ database.", download: "Tải bản chưa lưu", reload: "Mở bản từ database", confirm: "Mở bản từ database sẽ thay thế các thay đổi chưa lưu ở tab này. Hãy tải bản sao trước nếu muốn giữ lại." },
  zh: { loading: "正在从数据库加载账本…", error: "无法加载财务记录，请检查数据库连接后重试。", retry: "重试", migration: "将现有记录迁移到 FinBridge 数据库", migrationHint: "此账户在本设备保存了记录。导入一次后，后续修改将存入 PostgreSQL，设备上的原始副本保持不变。", import: "导入数据库", saved: "已保存至数据库", pending: "有待保存的修改", saving: "正在保存至数据库…", failed: "修改尚未保存，请保持页面打开并重试。", conflict: "其他设备已更新账本。你的修改未覆盖该版本，请先下载未保存副本，再加载数据库版本。", download: "下载未保存副本", reload: "加载数据库版本", confirm: "加载数据库版本将替换本标签页未保存的修改，如需保留请先下载副本。" },
};
export function DatabaseWorkspace({ owner, children }: { owner: string; children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ready" | "migration" | "error">("loading"), [attempt, setAttempt] = useState(0), [writeStatus, setWriteStatus] = useState<WorkspaceWriteStatus>("saved");
  const [legacy, setLegacy] = useState<AppState | null>(null), [importing, setImporting] = useState(false);
  const writer = useRef<ReturnType<typeof createWorkspaceWriter> | null>(null);
  const [lang, setLang] = useState<keyof typeof COPY>("en"), copy = COPY[lang];
  const save = useCallback(async (input: { revision: number; mutationId: string; data: AppState }) => {
    if (workspaceOwner() !== owner) throw new Error("ACCOUNT_CHANGED");
    return workspaceRequest(input, owner);
  }, [owner]);
  useEffect(() => {
    let active = true, timer: ReturnType<typeof setTimeout>;
    let unsubscribe = () => {}, unregister = () => {};
    async function load() {
      try {
        const response = await fetch("/api/workspace", { headers: { "x-finbridge-workspace-owner": owner, "x-finbridge-compression": "gzip" }, cache: "no-store", signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error("WORKSPACE_UNAVAILABLE");
        const record: WorkspaceRecord = await response.json();
        if (!active || workspaceOwner() !== owner) return;
        const language = readPreferredLanguage(preferredLanguage(record.data?.settings.language)); setLang(language);
        if (!record.data) {
          let old: AppState | null = null;
          try { old = readUserWorkspace(localStorage, owner); } catch { /* Database use does not require browser storage. */ }
          if (old) { setLegacy(old); setStatus("migration"); return; }
        }
        const data = record.data ? parseWorkspace(record.data) : structuredClone(initialState);
        data.settings.language = workspaceLanguage(language);
        data.settings.timeZone ||= Intl.DateTimeFormat().resolvedOptions().timeZone;
        replaceDatabaseWorkspace(owner, data);
        let lastFinancial = financialWorkspaceFingerprint(record.data || data);
        const sync = createWorkspaceWriter({ revision: record.revision, initial: record.data || data, getState: getWorkspaceState, save, onStatus: value => {
          if (!active) return;
          setWriteStatus(value);
          if (value === "saved") {
            window.dispatchEvent(new Event("finbridge:workspace-saved"));
            const financial = financialWorkspaceFingerprint(getWorkspaceState());
            if (financial !== lastFinancial) { lastFinancial = financial; window.dispatchEvent(new Event("finbridge:financial-workspace-saved")); }
          }
        } });
        writer.current = sync;
        const changed = () => { if (!active || workspaceOwner() !== owner) return; setLang(preferredLanguage(getWorkspaceState().settings.language)); sync.changed(); clearTimeout(timer); timer = setTimeout(() => { void sync.flush().catch(() => {}); }, 600); };
        unsubscribe = subscribeWorkspace(changed); unregister = registerWorkspaceFlusher(owner, () => sync.flush(), () => sync.flushFinancial());
        changed(); setStatus("ready");
      } catch { if (active) setStatus("error"); }
    }
    void load();
    const beforeUnload = (event: BeforeUnloadEvent) => { if (writer.current?.dirty()) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", beforeUnload);
    return () => { active = false; clearTimeout(timer); unsubscribe(); unregister(); writer.current?.stop(); writer.current = null; window.removeEventListener("beforeunload", beforeUnload); };
  // The account key resets the boundary. The retry counter explicitly reloads it.
  }, [owner, attempt, save]);
  function download() {
    const blob = new Blob([JSON.stringify(getWorkspaceState(), null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = "finbridge-unsaved-workspace.json"; link.click(); URL.revokeObjectURL(url);
  }
  if (status !== "ready") return <main lang={lang} className="fb-database-gate"><h1>FinBridge</h1>{status === "migration" ? <><h2>{copy.migration}</h2><p>{copy.migrationHint}</p><button disabled={importing} onClick={async () => {
    if (!legacy) return; setImporting(true);
    try {
      const data = parseWorkspace(JSON.parse(JSON.stringify({ ...structuredClone(initialState), ...legacy })));
      // Migrate only account-owned chat keys, never the unclaimed legacy workspace.
      try { const chat = JSON.parse(localStorage.getItem(`finbridge-scenario-planner:${owner}:v1`) || "null"); if (Array.isArray(chat) && !data.planningChat) data.planningChat = chat.slice(-100); } catch { /* Original local copy remains intact. */ }
      try { const chat = JSON.parse(localStorage.getItem(`finbridge:transaction-chat:${owner}`) || "null"); if (chat && !data.transactionChat) data.transactionChat = chat; } catch { /* Original local copy remains intact. */ }
      await save({ revision: 0, mutationId: crypto.randomUUID(), data }); setAttempt(n => n + 1);
    } catch { setStatus("error"); } finally { setImporting(false); }
  }}>{importing ? copy.saving : copy.import}</button></> : status === "error" ? <><p role="alert">{copy.error}</p><button onClick={() => { setStatus("loading"); setAttempt(n => n + 1); }}>{copy.retry}</button></> : <p role="status">{copy.loading}</p>}</main>;
  return <>{writeStatus !== "saved" && <div className={`fb-database-status is-${writeStatus}`} role="status" aria-live="polite"><span>{writeStatus === "error" ? copy.failed : writeStatus === "conflict" ? copy.conflict : copy[writeStatus]}</span>{["error", "conflict"].includes(writeStatus) && <><button onClick={download}>{copy.download}</button>{writeStatus === "conflict" ? <button onClick={() => { if (window.confirm(copy.confirm)) { setStatus("loading"); setAttempt(n => n + 1); } }}>{copy.reload}</button> : <button onClick={() => void writer.current?.flush().catch(() => {})}>{copy.retry}</button>}</>}</div>}{children}</>;
}

