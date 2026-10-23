# Sandbox checkout verification — 23 October 2026

Billing remains sandbox-only; public paid onboarding is not approved by this record.

## Verified

- Runtime Stripe key and webhook signing secret are stored as hosted secrets.
- Hosted unsigned webhook requests returned 400. Real Stripe sandbox events
  reached the hosted webhook and returned 200. These events used an unlinked
  fictional customer, so they prove delivery/signature handling, not entitlement.
- A fictional card-free test subscription was cancelled after verification.
- The owner's manager session reached the subscription panel and attempted checkout.
- The hosted attempt created its fixed trial/customer mapping but failed before
  saving a Checkout Session.

## Diagnosed and repaired

Reproducing the Checkout request in the connected sandbox exposed an account
default enabling Managed Payments. That conflicts with this application's
explicitly disabled Adaptive Pricing and changes the merchant-of-record model.
Checkout now explicitly sends `managed_payments.enabled=false`; it preserves
the fixed GBP price, required terms consent and existing tax configuration.
A regression case models the conflicting account default. All 179 application
tests, TypeScript checking and the production build passed.

## Remaining provider configuration

The next identical sandbox request with Managed Payments disabled was rejected
because the Stripe sandbox has no public Terms of Service URL. The owner must
set that URL in the sandbox's public business details to the application's
`/subscription-terms` page, then retry through the manager workspace.
Do not remove the required-consent safeguard to work around this requirement.

Hosted checkout completion, renewal/failure/cancellation, mapped entitlement,
two-account acceptance and hosted recovery remain unverified. No real payment
has been taken. Automatic tax remains disabled pending tax-status confirmation.

## Follow-up hosted diagnosis

The owner saved the sandbox public terms URL; an equivalent connector checkout
then succeeded without payment or subscription completion. The diagnostic
session is unshared and will expire automatically. The hosted retry revealed a
StripeIdempotencyError: the original request key was retained after adding the
Managed Payments opt-out. A bounded, redacted Stripe diagnostic is now logged
server-side while client errors remain generic. The corrected request uses a
new stable v2 namespace, preserving retries and the persisted session/generation
checks. Listing all sessions for this customer confirmed no original app
checkout was created; only the unshared diagnostic session exists.
A regression covers legacy-key conflict avoidance and lost-DB-response recovery.
Hosted checkout must still be retried and completed with test payment details.


## Subscription status follow-up — 23 October 2026

Read-only inspection of the connected CCS Stripe sandbox confirms the £19 plan
has an existing `trialing` subscription with cancellation scheduled at its trial
end, 5 November 2026. Stripe represents this with a non-null `cancel_at` while
`cancel_at_period_end` is false. This directly explains the previous missing
cancellation notice; no provider subscription was modified by this follow-up.

The API now reports provider trial/payment state, explicit checkout eligibility,
custom cancellation date and current period end. The billing panel shows a UK
time/date, sandbox notice, management and refresh controls. Existing trialing,
active, overdue, unpaid, paused and incomplete subscriptions cannot be offered a
second checkout. The independent server checkout guard remains enforced.

A completed Checkout Session can be superseded only after the exact linked
subscription appears in Stripe's authoritative list as canceled or
incomplete_expired. Missing or unrelated subscriptions keep checkout blocked;
retries preserve one new session generation. No trial end is extended and no
new paid-access entitlement is introduced by the status fix.

Verification: 183 application tests pass, including new API/status and client
regressions, plus syntax, TypeScript and production build checks. Preview
supervision reports running, but the browser receives connection refused;
therefore fresh browser and hosted acceptance of this change remain unverified.
No live billing or self-serve enrollment has been enabled. Renewal/failure
acceptance, two-account identity acceptance, an independently saved owner backup,
hosted recovery/monitoring and final business/data-provider sign-off remain open.
