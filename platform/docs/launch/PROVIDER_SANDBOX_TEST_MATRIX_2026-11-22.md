# Provider sandbox test matrix — 22 November 2026

This is a test plan and evidence index, not proof that a live provider account has been
exercised. All automated provider tests use deterministic fakes and signed synthetic
webhooks. No live charge, real customer record or customer email is used.

## Stripe subscription billing

Scope: Quenvira's own subscription for a business workspace. This is separate from money
that a business's customers pay that business for cleaning work.

| Case | Automated coverage today | Required sandbox evidence before launch |
|---|---|---|
| Disabled/incomplete configuration fails closed | `tests/subscriptions.test.mjs` | Hosted configuration review |
| 14-day card-free trial, persistent and retry-safe | covered | Sandbox trial start and reload |
| Fixed catalogue price and tenant-owned customer | covered | Five test prices and portal configuration |
| Checkout expiry and one replacement generation | covered | Expired sandbox session and new session |
| Duplicate checkout/idempotency | covered | Repeated request evidence |
| Correct-plan paid subscription grants access | covered | Sandbox payment and entitlement read |
| Past-due, unpaid, paused, incomplete and canceled states | covered | Provider lifecycle events |
| Period-end cancellation preserves paid access | covered | Cancellation at period end |
| Renewal invoice settled / open invoice blocks access | covered with fakes | Sandbox renewal and failed-payment renewal |
| Refund, dispute and early-fraud review | covered with signed synthetic events | Sandbox refund/dispute event and manager review |
| Webhook signature, wrong mode, duplicate event, stale event | covered | Hosted endpoint reachability and event log |
| Provider outage fails closed without leaking details | covered | Controlled timeout/error test |
| Live billing remains disabled | covered by configuration tests | Owner approval and separate release decision |

Not yet proven: real Stripe test-mode keys, real prices, portal configuration, webhook
delivery to the hosted origin, actual invoice settlement, actual renewal, actual refund or
dispute, and the `charge_read` permission recorded in the prior review.

## Resend invoice email

Scope: optional invoice email from a business workspace to its customer. Customer sending
is disabled by default. The test-mode recipient allowlist must remain in force.

| Case | Automated coverage today | Required sandbox evidence |
|---|---|---|
| Disabled without complete configuration | `tests/invoice-delivery.test.mjs` | Hosted configuration review |
| Test recipient allowlist and draft/paid guard | covered | Owner-approved test inbox |
| Queue, lease, idempotency and duplicate dispatch | covered | Provider request IDs |
| Retry/backoff and terminal failure | covered | Controlled 4xx/5xx and retry |
| Bounce and complaint suppression | signed synthetic events | Real test-event delivery and suppression |
| Late/out-of-order delivery events | covered | Provider event ordering |
| Paid/credited invoice cancels pending delivery | covered | Sandbox invoice/payment state |
| Staff/other-tenant access denial | covered | Real-account permission test |
| Live customer sending remains disabled | configuration tests | Explicit owner approval |

Not yet proven: owned-sender delivery to a new inbox, real bounce/complaint callbacks,
unattended retry scheduling, and production suppression-list behaviour.

## Customer invoice payments — separate feature

Quenvira currently supports invoice creation, invoice management and **manual payment
tracking**. It does not collect money from a business's customers. Automated collection is
not implemented and must not be described as available.

If it is pursued, the technical options and obligations are documented in
`LEGAL_COMMERCIAL_READINESS_2026-11-22.md`. It requires a separate product decision,
provider account/onboarding, security review, reconciliation design, refund/dispute process,
tax treatment and customer terms. It is outside the current subscription-billing scope.

## Evidence rules

- Use fictional workspaces and test-mode providers only.
- Do not paste keys, webhook secrets, customer records or provider payloads into chat.
- Record provider event IDs and test timestamps in the private evidence pack.
- A green automated suite does not prove a hosted provider integration.
