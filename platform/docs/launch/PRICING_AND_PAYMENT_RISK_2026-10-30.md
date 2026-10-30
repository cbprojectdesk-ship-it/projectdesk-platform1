# Quenvira public pricing and payment-risk release note — 30 October 2026

## Owner-agreed pricing (GBP per month)

| Plan | People included, owner counted | Monthly price |
| --- | ---: | ---: |
| Solo | 1 | £7.99 |
| Team 5 | 5 | £14.99 |
| Team 10 | 10 | £24.99 |
| Team 15 | 15 | £32.99 |
| Team 20 | 20 | £39.99 |
| 21+ | Tailored | Request a quote |

Team 5 includes the owner plus up to four other people. The larger bands follow the owner's instruction for more cost-effective per-person pricing as teams grow; they were proposed but require final approval before being represented as contractually available. Do not publicly list shelved Business/Pro plans. Present 14-day card-free trial clearly, without implying automatic paid conversion. These figures are proposed public-facing copy, **not activation of Stripe prices or an instruction to change billing mode**. Only show selectable tiers with configured, sandbox-tested provider prices and matching plan-aware server entitlements.

## Payment-risk verification, separate from pricing

Reviewed platform/server/subscriptions.mjs at main on 30 October. The paid() entitlement guard checks provider active status, current period, paid latest invoice, zero remaining balance, correct customer/subscription/mode, and no open invoices. Refund/dispute/fraud events are signed and mapped via provider objects into review receipts. **They do not automatically suspend entitlements or reverse paid invoice status.** A fully or partially refunded payment or an active dispute can therefore leave access available while the subscription remains active and the latest invoice is still paid. This is not necessarily a defect: refunds/disputes need a documented business policy rather than automatic punitive suspension.

Before public paid launch, perform isolated sandbox acceptance for:
1. Full and partial refund after an otherwise settled renewal; verify review alert and explicitly approved access policy.
2. Dispute created, won, lost and withdrawn; verify operator case handling and no cross-tenant mapping.
3. Early fraud warning, duplicate/reordered signed events and provider lookup failures.
4. Bacs Direct Debit pending settlement, success, failure, reversal and late webhook delivery; never grant paid editing on pending settlement.
5. Cancellation, payment retry and renewal across a period boundary; manager read/export must remain possible during payment failure.
6. Real provider invoices and invoice-payment permission scope for the restricted key.

Do not turn on live billing, public self-service, customer invoice email or direct debit advertising based on this document. Work Chat owns hosted deployment and live browser tests; keep its active configurations intact. Independent encrypted backup remains the final technical gate.
