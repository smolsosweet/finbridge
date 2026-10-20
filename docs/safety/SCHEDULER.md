# Deploying generic reminder email

The application already has an authenticated POST worker at /api/internal/safety.
The added Safety email scheduler GitHub Actions workflow invokes it every five minutes,
offset from the beginning of the hour (at minute 03, 08, ... 58) to reduce shared
GitHub Actions scheduler contention.
on main, or manually through workflow_dispatch. GitHub schedules are best effort and
may be delayed or disabled for inactive repositories; this is not an exact delivery SLA.

Configure BEFORE enabling email:
1. On Vercel Production set a random server-only SAFETY_CRON_SECRET of at least 32
   characters, the existing Brevo sender/key, and canonical BETTER_AUTH_URL.
2. In GitHub Actions secrets set the identical SAFETY_CRON_SECRET. Set repository
   variable FINBRIDGE_BASE_URL to the canonical HTTPS origin with no path/query.
   Set FINBRIDGE_SAFETY_SCHEDULER_ENABLED=true only when these settings are ready.
   The workflow skips its job by default, including manual dispatch, until enabled.
3. Deploy the worker code, manually run the workflow, confirm its aggregate counts.
4. Opt a synthetic test account into a rule. After validating the sender/scheduler,
   set SAFETY_EMAIL_ENABLED=true on Vercel and redeploy. Trigger a known synthetic
   breach and confirm accepted status AND Brevo delivery separately.
5. Keep workflow failure notifications enabled. HTTP failures, malformed responses,
   failed or unknown sends fail the job. Ambiguous sends are not automatically retried.

The job needs no checkout credential write permissions, does not install packages,
does not follow HTTP redirects and never prints the bearer secret or response text.
Its concurrency group prevents overlapping workflow runs; the DB advisory lock also
serializes worker calls from any source. No GET endpoint is introduced.

The worker has maxDuration=180 seconds; check Fluid Compute is enabled on Vercel.
It evaluates at most 50 accounts and sends at most 10 queued messages per call.
For larger traffic or a strict timing requirement use a dedicated scheduler/queue.

Until the scheduler and delivery are actually tested, keep SAFETY_EMAIL_ENABLED=false
and describe only in-app alerts. Adding this workflow locally does not activate it;
it must reach main and have its repository settings configured.
