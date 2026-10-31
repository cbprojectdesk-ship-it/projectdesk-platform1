# Quenvira five-band sandbox catalogue — 30 October 2026

## Verified Stripe sandbox prices (not live)
All prices were independently read back from the existing authorized sandbox. Actual provider identifiers are omitted from this public guide; configure distinct verified IDs privately. All are active, GBP, monthly, licensed, quantity-one-compatible, tax-inclusive, and `livemode=false`.

| Plan | Owner-inclusive people | Amount | Stripe price |
| --- | ---: | ---: | --- |
| Solo | 1 | £7.99 | `CONFIGURE_IN_SECURE_ENVIRONMENT` |
| Team 5 | 5 | £14.99 | `CONFIGURE_IN_SECURE_ENVIRONMENT` |
| Team 10 | 10 | £24.99 | `CONFIGURE_IN_SECURE_ENVIRONMENT` |
| Team 15 | 15 | £32.99 | `CONFIGURE_IN_SECURE_ENVIRONMENT` |
| Team 20 | 20 | £39.99 | `CONFIGURE_IN_SECURE_ENVIRONMENT` |

The first two existed already; the remaining three were created and read back in sandbox on 30 October. This is a catalogue verification, not a successful Checkout, portal, renewal, Bacs, or hosted entitlement test.

## Hosted application activation — controlled test only

The current platform code `platform/server/plans.mjs` already implements `solo-team-v2` and checks distinct server-side price IDs, maximum people, and plan entitlement. Replace each placeholder with its distinct verified existing sandbox identifier and set these test configuration values on an **isolated hosted test deployment**, not on the existing owner's active workspace:

```text
QUENVIRA_PLAN_CATALOG=solo-team-v2
STRIPE_SOLO_PRICE_ID=CONFIGURE_IN_SECURE_ENVIRONMENT
STRIPE_TEAM_PRICE_ID=CONFIGURE_IN_SECURE_ENVIRONMENT
STRIPE_TEAM10_PRICE_ID=CONFIGURE_IN_SECURE_ENVIRONMENT
STRIPE_TEAM15_PRICE_ID=CONFIGURE_IN_SECURE_ENVIRONMENT
STRIPE_TEAM20_PRICE_ID=CONFIGURE_IN_SECURE_ENVIRONMENT
```

Preserve `QUENVIRA_BILLING_MODE=test`, `QUENVIRA_SELF_SERVE=no`, existing owner test account and trial mappings. Keep secrets in the host secret manager, not source. Confirm the sandbox Customer Portal allows only approved five prices and explicitly verify upgrade/downgrade, prorations, limits and failed payment handling before activating the catalogue on any existing workspace. Do not set live launch approval flags.

## Public CCS website pricing copy — publish only as preview until launch

**Quenvira: service-business management that grows with your team.**
Solo £7.99/month (one person); Team 5 £14.99/month; Team 10 £24.99/month; Team 15 £32.99/month; Team 20 £39.99/month. All people allowances include the business owner. Above 20: tailored quote via ccscreativetech@gmail.com. 14-day card-free trial, subject to the published trial terms. Mark as **Coming soon — register your interest** until the matching live prices, terms, payment handling and hosted customer flows have passed acceptance. Do not display functional payment buttons before they are ready.

## Remaining verification
- Real isolated sandbox Checkout for each plan and signed webhook mapping to tenant access
- Customer Portal plan change, proration, over-limit downgrade and cancellation
- Provider invoice settlement/failed renewal, direct-debit pending and dispute/refund review
- Two independent accounts, managed D1 persistence, support and legal terms
- Independent encrypted recovery, then separate explicit owner approval for paid launch

This handoff does not deploy a website, change hosted runtime settings, charge customers or approve live subscriptions.
