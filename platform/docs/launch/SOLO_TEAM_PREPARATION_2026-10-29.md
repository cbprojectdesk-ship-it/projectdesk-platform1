# Solo and Team release preparation — 29 October 2026

This is staged code, not live activation. Existing billing=test, email=test, self-service=no, £19 sandbox price, trial/account mappings, data, audience and retry schedule remain unchanged. No new product/price/charge or provider contract was created.

## Prepared behaviour

- Opt in using QUENVIRA_PLAN_CATALOG=solo-team-v1 only after configuring distinct STRIPE_SOLO_PRICE_ID / STRIPE_TEAM_PRICE_ID, QUENVIRA_TEAM_STAFF_LIMIT (integer 2–50), and terms 2026-10-29. No default Team headcount is advertised or commercially promised. The upper configuration bound is a technical safeguard, not a scale/cost certification.
- Server validates exact £7.99 / £14.99 GBP inclusive monthly licensed prices. Client price, currency, cap and subscription status cannot override server configuration. Existing checkout is reused; a conflicting election cannot create a duplicate. The 14-day card-free trial remains anchored once in D1.
- Catalogue trial permits Team functionality at the explicitly configured allowance. A paid plan is derived from Stripe's current single quantity-one approved Price in the correct mode. Multiple ongoing subscriptions require support. Failed/expired payment states do not grant paid writing access; an upgrade/recovery is recognised from authoritative provider state.
- Solo permits one staff record for the owner and no independent staff membership/invitation. Staff requests, photos and invitation acceptance are denied server-side on Solo. Team enforces its configured staff-record limit. Existing over-limit records are preserved and manager read/export remains available; no automatic deletion or account revocation is performed.
- A downgrade below existing records/access pauses editing. Before a real downgrade, support must agree the retained-record/access arrangement. There is no staff-archive/data migration or automatic proration implementation in this change. Subscription changes use the configured Stripe portal; its allowed products, upgrade/downgrade timing and proration need sandbox acceptance before rollout.
- The plan chooser, exact price/allowance disclosure and a separately versioned draft Solo/Team schedule are conditional on configured catalogue. Current sandbox UI retains its existing price and terms. Live catalogue additionally requires QUENVIRA_PLAN_TERMS_APPROVED=yes and existing paid-launch approval; do not set these flags without actual approval.

## Verification and limits

New tests exercise wrong/incomplete catalogue configuration, forged plan/price/cap input, both checkout elections, duplicate/conflicting checkout, wrong price amounts, once-only trial, provider plan switches/failure/recovery, unsupported mode/price/quantity, multiple subscriptions, Solo staff denial, read/export retention and restoration of Team permissions, atomic staff limits, and the plan/version sent by the UI. Provider calls are fixtures, not real hosted subscription transitions.

Local managed preview could not start: its isolated /site environment could not resolve vinext through the existing node_modules symlink. No working product code, permissions or infrastructure were altered to compensate. Local browser QA is unverified; use the protected GitHub browser checks as separate simulated-browser evidence. Existing actual hosted staff/manager acceptance remains valid for the unchanged active pilot configuration.

## Current completed evidence retained

Anna's independent hosted staff checklist/note persistence, scoped revocation and restoration passed on 29 October. Main branch protection is active. Hosted quotes, availability, holiday conflicts, notifications and private photos passed. Sender QV-1006 and the isolated CCS enquiry receipt are verified; do not resend them.

## Remaining before paid rollout

1. Settle included Team headcount using capacity/cost evidence; approve the final Solo/Team schedule and operator/customer/provider particulars. Prepare distinct sandbox Products/Prices and a compatible restricted portal, then test real plan elections and plan-change behaviour. Do not switch the existing multi-person QA workspace into Solo or overwrite its trial/payment fixtures.
2. Complete supported provider-controlled automatic renewal/retry and mapped hosted entitlement acceptance. Current Stripe connector discovery exposes creation of test clocks, but not listing/advancing existing clocks; no duplicate fixture was created or agent payment submitted.
3. Complete controlled real email-provider failure/missed-run/bounce/complaint acceptance. Genuine owner delivery and healthy hourly invocation do not prove these cases; local callback/idempotency tests remain synthetic. Customer email stays separately gated.
4. Preserve owner's exclusion of the independent encrypted laptop backup. Commercial activation requires separate explicit authorisation and coherent live price/key/webhook/portal/terms settings. No tax-registration change or automatic-tax activation is made; confirm actual registration facts before changing tax collection.
