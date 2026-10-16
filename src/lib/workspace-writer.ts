import type { AppState } from "../components/sites/rolly/replica/store";
import type { WorkspaceRecord } from "./workspace-model";
export type WorkspaceWriteStatus = "saved" | "saving" | "pending" | "error" | "conflict";
export function createWorkspaceWriter(input: { revision: number; initial: AppState; getState: () => AppState; save: (value: { revision: number; mutationId: string; data: AppState }) => Promise<WorkspaceRecord>; onStatus: (status: WorkspaceWriteStatus) => void }) {
  let revision = input.revision, saved = JSON.stringify(input.initial), pending: { revision: number; mutationId: string; data: AppState } | null = null;
  let running: Promise<void> | null = null, conflict = false, stopped = false;
  const dirty = () => !!pending || JSON.stringify(input.getState()) !== saved;
  async function run() {
    if (conflict || stopped) throw new Error("WORKSPACE_CONFLICT");
    while (!stopped && dirty()) {
      input.onStatus("saving");
      pending ||= { revision, mutationId: crypto.randomUUID(), data: JSON.parse(JSON.stringify(input.getState())) };
      try {
        const result = await input.save(pending);
        revision = result.revision; saved = JSON.stringify(pending.data); pending = null;
      } catch (e) {
        conflict = e instanceof Error && ["WORKSPACE_CONFLICT", "MUTATION_MISMATCH"].includes(e.message);
        input.onStatus(conflict ? "conflict" : "error"); throw e;
      }
    }
    if (!stopped) input.onStatus("saved");
  }
  return {
    dirty,
    changed() { if (dirty() && !running && !conflict) input.onStatus("pending"); },
    flush() { if (!running) running = run().finally(() => { running = null; }); return running; },
    stop() { stopped = true; },
  };
}
