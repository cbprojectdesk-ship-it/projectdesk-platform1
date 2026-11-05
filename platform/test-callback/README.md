# Quenvira isolated Stripe test receiver — proposed infrastructure

Status: source and local tests only. Not deployed or connected to Stripe. No new credentials, paid service, public audience or app billing activation is included.

## Why this exists

The isolated Quenvira Site is owner-private. Stripe cannot attach the `OAI-Sites-Authorization` header required by its platform gate. This standalone Worker provides a narrow `/stripe` callback without making the application public. The receiver is separate from both the business demo and the app's release candidate.

Only an operator-approved deployment may expose this receiver publicly. A new Sites project starts private; its audience must not be changed implicitly. Do not deploy this file as the Quenvira app's Worker or replace either existing Site's source.

## Scope and controls

- Accepts exact `POST /stripe`, JSON, at most 256 KiB. Query strings and other paths are rejected. `GET /health` reports readiness only.
- Verifies Stripe's documented HMAC-SHA256 `v1` signature against the unchanged raw body, with a 300-second timestamp window. Supports multiple signatures during endpoint-secret rotation; no secret rotation is performed by this implementation.
- Rejects live events, missing mode, unexpected Connect account, malformed event envelopes, unsupported event types and nested live objects.
- Forwards only to the hard-coded isolated acceptance callback. Caller-supplied destination URLs, cookies, authorization and identity headers are never forwarded. The service credential stays in secret storage, is never placed in a URL, and is sent only to the matching isolated Site.
- Preserves the original Stripe signature. Quenvira must independently verify it using the same dedicated endpoint signing secret and retain its durable event deduplication.
- Never follows redirects. Requires an actual successful JSON `{received:true}` acknowledgement from the app; HTML, login redirects, network errors and other responses remain failures so Stripe can retry. No in-memory deduplication can swallow a failed delivery.
- No database, API key, browser identity, signup, subscription creation, live mode, email sender or provider secrets in source. Errors return fixed generic messages and never upstream response bodies or exception text.
- No CORS permission. Responses use no-store, nosniff and restrictive CSP. Deployment provider request quotas/rate controls and logs remain operator responsibilities; this receiver is not a comprehensive perimeter security certification.

## Local verification

Node 22+ (tested with Node 24.22.1), no dependencies or installation:

```sh
node --test platform/test-callback/tests/relay.test.mjs
```

39 local cases cover exact-body forwarding (including UTF-8), invalid signatures/timestamps, rotation signatures, live/account rejection, disabled/missing configuration, body caps including streamed requests, path/target restrictions, upstream redirect/HTML/error/false/oversized acknowledgements and retry behavior. All provider calls are injected fakes; no external network or payment occurs. These tests do not establish hosted routing, actual Stripe delivery or paid entitlement.

## Secure configuration after deployment approval

| Variable | Handling | Purpose |
| --- | --- | --- |
| `STRIPE_TEST_WEBHOOK_SECRET` | Secret | Dedicated sandbox endpoint signing secret, also configured as `STRIPE_WEBHOOK_SECRET` in the isolated app |
| `ISOLATED_SITES_SERVICE_TOKEN` | Secret | Existing supported service-access token for the isolated app only |
| `TEST_RELAY_ENABLED` | Non-secret, default absent | Must be exactly `yes` after the complete test configuration is installed |

Use the hosting platform's secret controls. Never paste credentials into chat or commit them. No code defaults supply any credential. The relay remains 503/unready with missing or invalid configuration. The application must remain billing=disabled until the endpoint, secret, staged catalogue, portal and runtime key are ready. Then the isolated app may use billing=test; public registration and live billing remain off. Never copy the pilot's webhook signing secret or live key.

Stripe should use a new dedicated endpoint for this receiver in CCS sandbox `acct_1USzoBJMLR8T7SSt`. Configure only the event types listed in `worker/index.mjs`. Pin the endpoint payload version to the app's supported Stripe schema and verify actual signed payload compatibility. Existing pilot endpoint remains untouched.

## Hosted acceptance still required

1. Deploy as a separate minimal Worker using the supported hosting workflow; preserve both existing app audiences, data and bindings. Public exposure of this callback requires explicit owner approval. Do not add UI, D1, R2 or connected-app access to the receiver.
2. Install dedicated sandbox endpoint signing secret and isolated service token securely; check `/health` is ready and invalid signatures return 400 without hitting the app. Anonymous callback access must reach this receiver without a login redirect. Inspect provider logs without disclosing secrets.
3. Deliver a genuine signed sandbox event. Correlate provider delivery, relay response, app event record and no unintended entitlement. Replay it and prove one durable app event. A relay 200 alone does not prove payment settlement or entitlement.
4. Complete each staged plan's settlement/decline/expiry, recurring failure/recovery, upgrades, scheduled downgrades and cancellation. Verify entitlements, staff limits and duplicate protection against actual provider objects.
5. Test upstream failure/retry in this isolated environment without disabling pilot credentials or access controls. Record exact source, runtime revisions and callback provenance.

Email requires a separately reviewed sender/allowlist and signed email-webhook route. This Stripe-only receiver does not implement or prove email recovery. Full consistent D1/R2 infrastructure export/restore and distinct human identity tests remain separate gates. The final encrypted owner backup and public launch stay deferred.

## Disable and rollback

Disable this new sandbox endpoint in Stripe first, then set `TEST_RELAY_ENABLED` away from `yes`. Keep billing disabled/test and preserve the application's deduplication/event history. Do not delete financial records or rotate credentials automatically. Code rollback does not roll back provider events or data. No production/pilot deployment is part of this proposal.
