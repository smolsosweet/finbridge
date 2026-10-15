"use client";
// Compatibility export for callers built before the account-lifecycle change.
// It now deactivates; it never physically deletes a Better Auth user.
export { deactivateAccount as deleteAccount } from "./deactivate-account";
