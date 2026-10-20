# Deploying generic reminder email

The application has an authenticated POST worker at `/api/internal/safety`.
Production uses an external HTTPS scheduler, configured to call that endpoint every
15 minutes. The GitHub Actions workflow is retained for manual diagnostics only;
it has no automatic schedule.

Configure BEFORE enabling email:
1. On Vercel Production set a random server-only SAFETY_CRON_SECRET of at least 32
   characters, the existing Brevo sender/key, and canonical BETTER_AUTH_URL.
2. Configure an external scheduler with the canonical HTTPS POST URL, this header:
   `Authorization: Bearer <SAFETY_CRON_SECRET>`, a 30-second timeout, and failure
   notifications. It must have no database credentials. Confirm its first scheduled
   invocation returns HTTP 200.
3. The optional GitHub Actions workflow is only for manual diagnosis. If used, set
   the identical secret and base URL in its repository settings, then run it manually.
4. Opt a synthetic test account into a rule. After validating the sender/scheduler,
   set SAFETY_EMAIL_ENABLED=true on Vercel and redeploy. Trigger a known synthetic
   breach and confirm accepted status AND Brevo delivery separately.
5. Keep external-scheduler failure notifications enabled. HTTP failures, malformed
   responses, failed or unknown sends need review. Ambiguous sends are not retried.

The job needs no checkout credential write permissions, does not install packages,
does not follow HTTP redirects and never prints the bearer secret or response text.
Its concurrency group prevents overlapping workflow runs. A transaction advisory
lock, held on a separate connection until the worker finishes, serializes calls
from any source and works with Neon transaction pooling. A busy worker returns
HTTP 503 with `Retry-After: 60`; HTTP 200 alone does not confirm mail delivery.
The lock uses the two-integer key `(17961015, 1)` so leaked legacy session locks
cannot block the new worker. No GET endpoint is introduced.

The worker returns within a 20-second budget and the route has maxDuration=25 seconds,
which keeps it compatible with external schedulers that allow a 30-second request.
It sends already queued mail before scanning more accounts. When no mail is queued,
it evaluates at most 25 accounts and sends at most one queued message per call.
For larger traffic use a dedicated queue that can acknowledge work before delivery.

Until the scheduler and delivery are actually tested, keep SAFETY_EMAIL_ENABLED=false
and describe only in-app alerts. Adding workflow files locally never activates email.
