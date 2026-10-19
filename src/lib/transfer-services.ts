import { database } from "./database";
import { createInMemoryTransferRepository, internationalTransferRepository } from "./international-transfer-repository";
import { createInMemoryReferenceRepository, transferReferenceRepository } from "./transfer-reference-repository";

// Same repositories for the tab and Finn. Authenticated failures never fall
// back to demo data; demo maps are used only after the route's local-demo guard.
let demoTransfers: ReturnType<typeof createInMemoryTransferRepository> | undefined;
let demoReferences: ReturnType<typeof createInMemoryReferenceRepository> | undefined;
export function transferServices(demo: boolean) {
  return {
    transfers: () => demo ? (demoTransfers ??= createInMemoryTransferRepository()) : internationalTransferRepository(database()),
    references: () => demo ? (demoReferences ??= createInMemoryReferenceRepository()) : transferReferenceRepository(database()),
  };
}
