# FinBridge path migration

This change renames source and asset paths. It preserves the template, UI content,
asset bytes and financial behavior; it is not a redesign or a licensing clearance.

| Before | After |
| --- | --- |
| src/components/sites/rolly | src/components/finbridge |
| src/components/sites/rolly/replica | src/components/finbridge/workspace |
| RollyApp.tsx / RollyApp | FinBridgeApp.tsx / FinBridgeApp |
| replica.css | workspace.css |
| src/types/rolly.ts | src/types/finbridge.ts |
| public/sites/rolly | public/finbridge |
| Rolly-365-streak-removebg-preview.png | monthly-streak.png |

All source imports, asset references and repository test paths follow the new names.
Font-family identifiers now use FinBridge names; the original font files are unchanged.
Application routes, authentication configuration and PostgreSQL schema are unchanged.
No database migration is needed.

## Compatibility

Next.js redirects old `/sites/rolly/:path*` asset requests to `/finbridge/:path*`.
The renamed streak image has a specific redirect before that wildcard, so bookmarked
or cached pages continue to load its exact bytes at the new URL.

The browser key `rolly-replica-v2` is intentionally unchanged. It is only used by the
existing explicitly confirmed legacy import. It is never auto-assigned to another
account, deleted or overwritten. Current per-account keys remain
`finbridge-workspace-v1:<encoded-user-id>`. Database and authentication records do
not depend on the renamed component paths.

## Attribution

The template, inactive prototype pages and all assets are retained at the owner's
request. Historical prototype text and third-party notices remain accurate. Renaming
paths and font-family identifiers does not establish rights to the interface or
artwork. LICENSE, THIRD_PARTY_NOTICES.md and PROVENANCE_REVIEW.md remain applicable.

## Local verification

- Full business-unit command: 24 groups, 439 passed, zero failed, two existing
  localization TODOs. Total reported tests: 441, with no skipped tests.
- Transaction-history component handler checks: passed.
- TypeScript and production build: passed.
- ESLint: zero errors, 32 existing warnings.
- All 49 moved asset files match their original Git bytes.
- Served the production build on localhost and checked all 49 old asset URLs:
  each returned the expected 308 redirect; every new URL returned 200 with exact
  file bytes. This includes images, font files, category/bank icons and Lottie JSON.

These are local checks of the renamed build, not production deployment acceptance.

## Integration with latest main

Before publishing, integrated main `e1a2fc5`, preserving the Finn planning,
transfer-chat and performance work. The two newly added ChatTransferCard files
follow the new workspace directory. Updated new test imports and isolated the
relative database import in the persistence-route test adapter.

- Full business-unit suite after integration: 445 passed, zero failed, two existing
  localization TODOs (447 reported tests across 24 groups).
- Additional transfer-chat, resilience, planning-action and performance tests:
  48 passed, zero failed, no skipped tests or TODOs.
- Production build including TypeScript: passed.
