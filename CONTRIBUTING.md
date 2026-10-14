# Contributing to FinBridge

Create focused feature branches from the latest main. Do not merge branches based on obsolete history after a coordinated history rewrite.

Use Node.js 24+, `npm ci` and ignored `.env.local` settings per [README](README.md). PostgreSQL starts separately from the web server.

Run typecheck, build and tests for the edited area. Report actual results and unrun checks in pull requests against main. Keep EN/VI/ZH copy aligned, preserve account isolation and retain financial review steps.

Keep credentials, personal data, email tokens and backups out of Git. Follow [AGENTS](AGENTS.md), report vulnerabilities privately per [SECURITY](SECURITY.md) and retain [third-party notices](THIRD_PARTY_NOTICES.md).
