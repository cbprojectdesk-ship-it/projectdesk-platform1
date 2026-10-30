# Hosted Stripe 403 — evidence and least-privilege correction

## What is proven

Hosted subscription read returned application 503 after `StripePermissionError`, HTTP 403, provider request `req_z2hUDr5yxdXDqv` at 2026-10-30 00:39:10.767 UTC. The protected runtime `STRIPE_RESTRICTED_KEY` value is write-only/redacted. Runtime revision 15 remains billing=test, email=test, self-service=no. No key was copied, replaced, rotated or widened.

The mapped hosted customer exists in the intended CCS sandbox `acct_1USzoBJMLR8T7SSt`, livemode=false. This verifies the customer mapping in that sandbox through the connected Stripe account. **The connector credential is different from the hosted restricted key:** connector success does not prove any grant or account scope of the runtime key.

The code's subscription GET can make these permissioned calls, in order:

1. `GET /v1/subscriptions?customer=…&expand[]=data.latest_invoice`: Subscriptions read. Because `latest_invoice` is expanded, invoice access is an additional candidate to check in the failed-request log; do not assume the expansion is the confirmed cause.
2. If latest invoice is an ID, `GET /v1/invoices/{id}`: Invoices read.
3. For an otherwise active/settled subscription, `GET /v1/invoices?subscription=…&status=open`: Invoices read.

**Confirmed documentation defect:** older minimum-key instructions omitted invoice reads even though the settlement guard now requires them. Stripe's operation metadata independently confirms `GetInvoices` requires `invoice_read`; `GetSubscriptions` requires `subscription_read`. InvoicePayments also uses `invoice_read`, not a separate invented `invoice_payment_read` grant.

**Not proven:** which of the above calls failed in the historical request or the runtime key's actual current grants/account binding. The old log intentionally omitted both provider error text and operation. Do not label `invoice_read` the conclusively identified missing runtime grant until the request log confirms it. A 403 is an authorization error, not evidence that a key must be replaced.

## Exact supported resolution

In the existing CCS **sandbox** Dashboard, open Workbench/API request logs and find `req_z2hUDr5yxdXDqv` at the timestamp above. Record only endpoint, required permission/resource, mode and whether the existing key belongs to the intended sandbox. Never copy the key, provider message containing key fragments, customer details or headers into chat/Git.

Open API keys → the **same existing runtime restricted key** → View request logs/Edit key. Compare the failed call to the table below; grant only the missing resource access confirmed by the log. Do not enable payout/transfer/bank administration, broad write categories or live billing. Do not rotate a functioning key merely to inspect it. If the binding actually points to a different account/key, identify that mismatch in the secret manager and correct only the verified binding using the owner's secure workflow; never guess or overwrite credentials.

The connected tools expose neither runtime secret values, request-log retrieval nor restricted-key grant editing. This Dashboard-only step is blocked here. After correction, repeat the real hosted manager subscription read, then paid-state read/write and renewal/failed-payment recovery in an isolated sandbox business. Leave live flags disabled.

## Current resource permission map

These are permission identifiers returned by Stripe operation metadata on 30 October, not instructions to grant unrelated access:

| Code operation | API permission | Why needed |
| --- | --- | --- |
| Customers create | `customer_write` | Create tenant-owned subscription customer; write includes resource read |
| Prices retrieve | `plan_read` | Verify fixed GBP monthly price before Checkout |
| Checkout retrieve | `checkout_session_read` | Resolve existing/open/completed sessions |
| Checkout create/expire | `checkout_session_write` | Deliberate checkout and safe expiry before workspace deletion |
| Subscriptions list/retrieve | `subscription_read` | Authoritative entitlement/cancellation/risk mapping |
| Invoices retrieve/list and InvoicePayments list | `invoice_read` | Settlement/outstanding balances and risk ownership |
| Charges retrieve | `charge_read` | Refund/dispute/fraud ownership resolution |
| Billing Portal session create | `customer_portal_session_write` | Tenant-owned portal access |

No subscription-write, invoice-pay, refund, dispute-write, payout or transfer grant is required by the application's current flow. Card collection remains in hosted Checkout. Webhook signature verification is local cryptography with the separately stored signing secret; no Stripe permission can replace it.

## New redacted diagnostics (source only)

Known SDK operations are now annotated through a private WeakMap. On Stripe errors the API logs a bounded type, safe request ID, HTTP status, fixed operation name and static expected permission families. It never logs provider messages/params/URLs, customer IDs, payment tokens or keys. An expanded subscription list lists both candidate read permissions and does not falsely assert which one is missing. Unknown operation labels cannot be logged through the helper. Real Stripe SDK HTTP-transport tests reproduce 403s at both subscription listing and open-invoice listing, verify exact operation attribution and confirm the client still receives a generic 503.

This source has not been deployed over the newer hosted source. On supported source reconciliation, these diagnostics will let the next failing call identify its exact operation safely without exposing the free-form provider message.

References: https://docs.stripe.com/keys/restricted-api-keys and the connected operation details for GetSubscriptions, GetInvoices, GetInvoicePayments, GetChargesCharge, GetCheckoutSessionsSession, PostBillingPortalSessions and GetPricesPrice.
