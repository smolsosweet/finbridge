# Authentication data preservation plan

The login branch starts from main 765dd33 in a separate worktree. It does not
edit the original checkout or its browser storage.

Existing browser key `rolly-replica-v2` is NEVER deleted or overwritten.
It is not silently assigned to the first Google account. The new account has
a separate local key derived from the server-validated user ID.

After login, if a valid old workspace exists and this account has no saved
workspace, offer:
- Download the exact old JSON as a local backup.
- Explicitly copy old data into this account.
- Keep the old data for later and start with an empty workspace.

Copy is allowed only after the user chooses it, rejects an existing target
key, and preserves the original record byte-for-byte. No merge, reset,
automatic reassignment, or server upload occurs. A backup download remains
available until the user has copied or saved a new workspace.

Account/session records are in PostgreSQL. Financial records are still local
browser data, not database rows or multi-device sync. Key partitioning is
logical separation, not protection against someone controlling the browser.
Server-side finance ownership and RBAC remain a separate future task.

Tests must prove original bytes are unchanged, copying needs explicit
confirmation, existing target data cannot be overwritten, account A is not
loaded for account B, and logging out clears only memory, not saved records.