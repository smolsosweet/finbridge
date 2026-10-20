# Neon transfer usage

Neon public network transfer is bytes leaving the database. Pooled connections
reduce connection pressure, not the size of query results. A Preview branch in
the same Neon project shares its transfer allowance; a separate database/branch
does not restore already consumed transfer. Deleting data is not a quota refund.

## Changes in this feature

- Safety refreshes on initial load and immediately after financial saves. Idle
  visible tabs poll every five minutes instead of every minute. Hidden tabs skip
  timer polls; returning after a minute without a successful read refreshes once.
  Another tab's changes and email status may take up to five minutes to appear in
  an already visible tab; explicit refresh and local mutations still run normally.
- Safety workspace lookup reads only its timestamp/existence, not the full JSON
  workspace with chat history, drafts and receipt data. The existing relational
  reader continues to supply authoritative account-owned financial inputs.
- The safety projection sends only fields needed for threshold calculations and
  language/timezone preferences. Transaction notes and other unrelated JSON do
  not leave PostgreSQL in that query. Stored data is preserved.

No schema migration or environment variable is needed. Deploy the feature to
apply it. These changes are not a measured percentage reduction for the entire
application, and do not prove which queries exhausted the old project's quota.
The isolated PostgreSQL regression measures serialized query results for a
synthetic large-workspace fixture; it does not include transport/TLS overhead.
In that fixture the old full-workspace lookup alone returned 501,339 bytes; the
new timestamp lookup plus the complete safety projection returned 579 bytes.

## Operations

- Keep one automatic scheduler. The worker currently sends at most one queued
  message per invocation for the whole app, including attempts that are cancelled
  or deferred. Every twelve hours means at most two attempts/day and a backlog
  can take days. Every fifteen minutes allows at most 96/day, still subject to
  the provider, queue validity, and request time budget. No interval is a delivery
  guarantee; choose it according to acceptable delay and measured usage.
- Use a local isolated database for PostgreSQL tests. Turn off unused Preview
  deployments/schedulers; deleting an environment variable only affects future
  deployments, not existing deployments that already received its value.
- Observe the new project's public-network-transfer usage before and after a
  controlled test session. Avoid repeated full exports and manual refresh loops.
- Workspace reads/saves still hydrate chat and finance history; pagination and
  separate conversation persistence are larger future changes. Keep this open
  rather than claiming that polling reduction eliminates all transfer usage.

Reference: https://neon.com/blog/more-data-transfer-on-paid-plans
