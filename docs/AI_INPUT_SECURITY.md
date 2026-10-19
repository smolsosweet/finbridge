# AI input and browser security

All seven routes use the same streaming UTF-8 reader after authentication/origin checks.
It counts actual bytes, cancels on overflow even without Content-Length, refuses compressed
or non-JSON uploads, and stops stalled uploads after ten seconds. JSON is parsed only
after the bounded read. Validation failures never reserve quota or contact Gemini.

| Input | Encoded JSON ceiling | Other bounds |
| --- | --- | --- |
| Text/context routes | 600,000 bytes | Per-field schema limits remain enforced |
| Receipt | 2,000,000 bytes | Client prepares image at most 1,800,000 data URL characters |
| Audio | 2,800,000 bytes | Client at most 2,000,000 raw bytes, 45 seconds, requests 64 kbps |

The existing receipt client preserves small originals and shrinks larger images to
JPEG, trying edges 2560/2048/1600 and qualities 0.92/0.84. Unsupported browser image
decoding fails visibly and manual entry remains available; HEIC support is not promised.
Speech generation has maxOutputTokens=1024; empty, truncated or over-2,000-character
transcripts are rejected rather than inserted into chat. Transaction draft generation
also has a 4096-token output cap. Existing schema validation still checks AI outputs.

Function maxDuration is 40 seconds for most routes, 35 for workspace actions and 60
for receipts. Receipt provider timeout is capped at 50 seconds to leave runtime headroom.
These declarations must still be checked against the deployment's Fluid Compute setting.

Next headers apply globally: DENY embedding, nosniff, strict-origin-when-cross-origin,
camera/microphone self, no geolocation/payment permissions. Enforced CSP contains only
frame-ancestors, base-uri, object-src and form-action. It does not constrain scripts or
images yet; a strict script policy needs a separate Next nonce rollout and OAuth/media QA.

References checked 2026-10-19:
- https://vercel.com/docs/functions/limitations (4.5 MB body; Fluid Hobby max 300 seconds)
- https://ai.google.dev/gemini-api/docs/rate-limits (project quotas, Pacific daily reset)

Local acceptance: test:ai-request, test:ai-quota (all seven real routes, no provider
network), test:production-chat (receipt resizing), typecheck and production build.
Real Preview microphone, OAuth, media and provider timing checks remain deployment gates.
