"use client";
import { useState, useSyncExternalStore } from "react";
import { canImportLegacyWorkspace, legacyWorkspaceBackup } from "@/lib/workspace-storage";
import { importOldWorkspace, subscribeWorkspace, workspaceOwner } from "@/components/sites/rolly/replica/store";

export function LegacyWorkspaceNotice() {
  const [dismissed, setDismissed] = useState(false);
  const [failed, setFailed] = useState(false);
  const eligible = useSyncExternalStore(subscribeWorkspace, () => {
    const owner = workspaceOwner();
    try { return !!owner && canImportLegacyWorkspace(localStorage, owner); } catch { return false; }
  }, () => false);
  function backup() {
    try {
      const raw = legacyWorkspaceBackup(localStorage);
      if (!raw) return;
      const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "finbridge-browser-backup.json"; link.click();
      URL.revokeObjectURL(url);
    } catch { setFailed(true); }
  }
  if (!eligible || dismissed) return null;
  return <aside className="mx-auto max-w-5xl rounded-2xl border border-[#d7e8e2] bg-[#edf8f5] p-5 m-5 text-[#173e50]">
    <h2 className="font-semibold">Existing data on this device</h2>
    <p className="mt-2 text-sm leading-relaxed">This browser has an older FinBridge workspace that is not linked to a Google account. Keep a backup or explicitly copy it into this account. The original remains unchanged.</p>
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" onClick={backup} className="rounded-lg border border-[#147d78] px-4 py-2 text-sm">Download backup</button>
      <button type="button" onClick={() => { try { importOldWorkspace(true); } catch { setFailed(true); } }} className="rounded-lg bg-[#147d78] px-4 py-2 text-sm text-white">Copy old data into this account</button>
      <button type="button" onClick={() => setDismissed(true)} className="rounded-lg px-4 py-2 text-sm underline">Keep for later</button>
    </div>
    {failed && <p role="alert" className="mt-3 text-sm">Could not copy or export. Your existing data has not been deleted.</p>}
  </aside>;
}