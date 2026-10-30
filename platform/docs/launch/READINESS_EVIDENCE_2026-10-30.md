# Commercial-readiness evidence — 30 October 2026 continuation

Decision: **NO-GO**. New source is committed/reviewed separately from the unchanged hosted deployment. No live billing, production pricing, public Checkout, key replacement, paid resource, production-data mutation or rejected merge bypass.

## Real Stripe sandbox reads/writes in this continuation

Created exactly one synthetic customer, with no email, payment method, address or hosted tenant mapping. Metadata: `application=quenvira`, `fictional=yes`, `quenvira_qa=readiness-checkout-20261030-c`. Through the connected sandbox account `acct_1USzoBJMLR8T7SSt`, created five independent subscription-mode Checkout Sessions using the approved existing prices and the application's flexible billing, managed-payments-off, automatic-tax-off and adaptive-pricing-off settings. No payment method restriction was hardcoded, no card details entered, and no Checkout URL was published.

| Plan | Expected / returned GBP total | livemode | Provider state at creation | Subscription created |
| --- | --- | --- | --- | --- |
| Solo | 799p / 799p | false | open, unpaid | no |
| Team 5 | 1499p / 1499p | false | open, unpaid | no |
| Team 10 | 2499p / 2499p | false | open, unpaid | no |
| Team 15 | 3299p / 3299p | false | open, unpaid | no |
| Team 20 | 3999p / 3999p | false | open, unpaid | no |

Sessions were configured for automatic expiry on 30 October 2026 at **03:11:05–03:11:27 GMT**. Native operation discovery exposes no expire-session operation, so immediate expiry could not be invoked through that connector. Natural expiry was not yet observed at this document's write time. The connector operation schema reports 2026-09-30.preview; its success does not independently verify the application's pinned endive transport. These noncharging sandbox sessions are not an application Checkout-completion test, a trial/renewal simulation or permission to use their links. The synthetic customer is searchable by the metadata above; it has no active subscription from this exercise.

Reconciled all four hosted `subscription_events` receipts to actual sandbox events: checkout.session.completed, customer.subscription.created, invoice.paid and customer.subscription.updated; matching event types, livemode=false, pending_webhooks=0. This substantiates retained historical delivery receipts; it is not a fresh signed redelivery by this agent. Signed replay/tamper/settlement behaviour is separately tested locally.

The existing hosted customer's current provider subscription is trialing on the retained £19 sandbox price, with latest invoice paid/remaining=0. No catalogue switch or owner subscription change was made. The customer exists in the expected sandbox. This cannot establish the account scope/grants of the **different** runtime restricted key.

Re-read both historical fictional `timed-cycle-20261023` subscriptions: both remain canceled, livemode=false, with paid GBP 1900 subscription_cycle invoices, zero remaining balance and one payment attempt. Historical owner decline/manual recovery evidence remains in `docs/MANUAL_PAYMENT_RECOVERY_2026-10-23.md`; do not repeat that payment or relabel it automatic retry evidence.

Actual card completion, new renewal/automatic retry, portal plan changes and hosted entitlement transitions remain blocked by unavailable authenticated Checkout/browser execution and the runtime key 403. No payment submission or PaymentMethod attachment operation was improvised. Bacs/SEPA remain unavailable and are not advertised.

## Hosted read-only database audit

Read every returned page of all ten application tables, following server-provided offsets. 275 rows: 3 workspaces, 4 memberships, 45 history, 97 operations, 100 events, 1 invitation, 1 subscription account, 4 subscription events, 4 invoice outbox and 16 email events.

- No duplicate expected primary keys in the returned rows.
- No orphan workspace references, or mismatched outbox/email-event tenant references.
- Column-name sets match the local logical recovery schema; no column-name drift observed.
- History counts per business are 10, 15 and 20; all returned history revisions precede their workspace revision.
- Three distinct manager IDs and one staff membership exist; one invitation is accepted. This is persisted configuration evidence, **not** three independently authenticated human sessions or a cross-account acceptance exercise.

**Limits:** reads span multiple requests rather than one consistent transaction. All three workspace documents and 33 historical documents are truncated by the tool. Full JSON/state/invoice/staff-reference validation, remote PRAGMA integrity/foreign-key checks, index/type constraints, complete export and independent restoration cannot be certified from these results. Do not assemble truncated table pages into a claimed backup. The actual owner's independent .qvb download/verification remains reserved and pending.

## Hosted email and identity observations

The connected Quenvira read-only queue tool reports mode=test, dueBefore=0, review=0, processed=0, blocked=0. Invoking the existing bounded due processor also returned zero processed/blocked and made no message delivery claim. No delivered invoice was resent. Exactly one existing enabled hourly Europe/London retry schedule is linked; no duplicate schedule was created.

The tool call uses the current manager's genuine managed connection. No other person's identity was impersonated. A second browser identity/session is unavailable, so fresh two-independent-account login, role denial, revocation, expiry and recovery acceptance remains unverified. Existing local cross-tenant tests remain distinct evidence.

Actual provider-failure/missed-run/bounce acceptance is still blocked: there is no due approved test message, no transport-fault control on an isolated hosted deployment, no readable provider key and no supported source deployment path here. Do not fault production or resend delivered records to manufacture a pass. `NOTIFICATION_COVERAGE.md` distinguishes in-app/provider/custom email ownership and genuine gaps.

## Source corrections and tests

Added private operation-level Stripe error attribution without recording provider messages/parameters/URLs, keys or customer information. Corrected the current minimum permission guide to include Invoices read and Charges read where the code actually uses them; InvoicePayments uses `invoice_read` according to provider operation metadata. The historical 403's exact missing grant still requires Workbench request `req_z2hUDr5yxdXDqv`; see `STRIPE_RESTRICTED_KEY_DIAGNOSIS.md`.

Three new actual-SDK/local-HTTP-transport tests passed: redacted subscription/invoice 403 attribution, unsafe diagnostic rejection, and signed lifecycle receipt/replay plus failed-payment, pending settlement, recovery, renewal boundary, cancellation, export retention and cross-tenant denial. The HTTP responses are local fixtures, not new real provider charges or a hosted lifecycle pass.

An additional encrypted recovery regression passed: deactivated staff history/photos and credited invoices survive restore into a new isolated workspace, while former memberships/invitations are not restored and old invitation tokens stay invalid. This is synthetic local recovery, not a new hosted restore or the owner’s final backup.

Full local release checks passed: 30 platform test files, zero failures/skips; lint zero warnings/errors; syntax, TypeScript and production build passed. Unchanged demo tests/144 browser acceptance from the prior head remain historical until new CI results are observed.

Prepared private CCS pricing/demo handoff and corrected the order template's stale two-plan/larger-bands-shelved copy. Nothing was published. Final committed-head CI receipts are recorded in PR #52.
