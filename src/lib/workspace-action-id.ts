import {createHash} from "node:crypto";

/** Shared with both planners so retries keep exactly the same proposal IDs. */
export function stableWorkspaceActionId(batch: string, index: number) {
  const hash = createHash("sha256").update(`${batch}:create:${index}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
