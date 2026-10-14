<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FinBridge development

Use README.md for setup, package.json for checks and docs/auth for lifecycle constraints.

- Preserve teammate/user edits; use feature branches for functional work.
- Keep EN/VI/ZH aligned; English is the default.
- Preserve account isolation, origin checks, verification and deletion guards.
- Keep secrets, tokens, personal data and private backups out of Git/logs.
- Database tests use only the named isolated local test database.
- Wallets are manually tracked; never imply bank connectivity or real payments.
- Existing `sites/rolly` paths and storage keys need an explicit migration before renaming.
- Retain third-party copyright notices.
- Use typed TypeScript, named exports, PascalCase components and camelCase helpers.
- Run relevant checks; report failures and unrun checks honestly.
