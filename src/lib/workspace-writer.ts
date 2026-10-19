import type { AppState } from "../components/sites/rolly/replica/store";
import type { WorkspaceRecord } from "./workspace-model";
import { definitelyRejectedWorkspace, financialWorkspaceFingerprint, WorkspaceRequestError, workspaceWireSnapshot } from "./workspace-payload";
export type WorkspaceWriteStatus = "saved" | "saving" | "pending" | "error" | "conflict";
export function createWorkspaceWriter(input: { revision: number; initial: AppState; getState: () => AppState; save: (value: { revision: number; mutationId: string; data: AppState }) => Promise<WorkspaceRecord>; onStatus: (status: WorkspaceWriteStatus) => void }) {
  let revision = input.revision, saved = JSON.stringify(workspaceWireSnapshot(input.initial)), pending: { revision: number; mutationId: string; data: AppState } | null = null;
  let running: Promise<void> | null = null, conflict = false, stopped = false;
  let pendingUncertain = false;
  const dirty = () => !!pending || JSON.stringify(workspaceWireSnapshot(input.getState())) !== saved;
  async function run() {
    if (conflict || stopped) throw new Error("WORKSPACE_CONFLICT");
    while (!stopped && dirty()) {
      input.onStatus("saving");
      pending ||= { revision, mutationId: crypto.randomUUID(), data: JSON.parse(JSON.stringify(workspaceWireSnapshot(input.getState()))) };
      try {
        const result = await input.save(pending);
        revision = result.revision; saved = JSON.stringify(pending.data); pending = null; pendingUncertain = false;
      } catch (e) {
        // These responses guarantee rejection. Allow a corrected snapshot to
        // receive a new mutation ID; network/timeout/5xx retries keep the old ID.
        const rejected = definitelyRejectedWorkspace(e);
        const failure = rejected && pendingUncertain ? new WorkspaceRequestError("SAVE_OUTCOME_UNKNOWN", 502, e instanceof WorkspaceRequestError ? e.requestId : undefined) : e;
        if (rejected && !pendingUncertain) pending = null;
        else if (!rejected) pendingUncertain = true;
        conflict = e instanceof Error && ["WORKSPACE_CONFLICT", "MUTATION_MISMATCH"].includes(e.message);
        input.onStatus(conflict ? "conflict" : "error"); throw failure;
      }
    }
    if (!stopped) input.onStatus("saved");
  }
  return {
    dirty,
    changed() { if (dirty() && !running && !conflict) input.onStatus("pending"); },
    flush() { if (!running) running = run().finally(() => { running = null; }); return running; },
    flushFinancial() {
      // History is already included in the AI request. Only wait for writes
      // that change the financial data the server will actually analyze.
      const savedFinancial = financialWorkspaceFingerprint(JSON.parse(saved) as AppState);
      if (financialWorkspaceFingerprint(input.getState()) === savedFinancial && (!pending || financialWorkspaceFingerprint(pending.data) === savedFinancial)) return Promise.resolve();
      if (!running) running = run().finally(() => { running = null; });
      return running;
    },
    stop() { stopped = true; },
  };
}
