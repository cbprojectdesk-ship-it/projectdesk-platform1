# Automated invoice delivery — 26 October 2026

## Actual release state
Implemented server-side and tested with fictional records/mocked provider HTTP. Sending remains OFF. No provider account, paid service, domain, API credential or real customer email was created. Existing Stripe test mode and self-service=no are preserved. Provider delivery and signed-in hosted UI acceptance are launch blockers.

This supersedes the disconnected prototype in PR 37. One implementation lives in server/invoice-delivery.mjs and the normal command transaction in server/api.mjs. The public browser-local demo does not invoke it.

## Behaviour
- Manager opt-in: supplier.autoDraftInvoices plus autoEmailInvoices. Assigned staff completion can trigger the authorised policy, never see financial data. Default is off. Eligible completed visits produce an invoice and queue row in the same revision transaction. An absent configuration, invalid/unapproved test recipient or suppression leaves a draft and visible manager activity message; completion still saves.
- A manager can separately issue an invoice and use Queue server email. Only unpaid Issued invoices belonging to Completed jobs qualify. Customer recipient, invoice text, supplier details, sender and mode are snapshotted. Replays and repeated commands do not create another row for that business/invoice.
- Additive migration 0003 creates invoice_outbox and invoice_email_events. No existing record is rewritten or deleted. Outbox/history routes are manager-only and tenant-scoped. Payloads and credentials are never returned by these routes.
- HTTPS Resend adapter uses bearer credentials and a fixed endpoint, 10s timeout, stable provider idempotency key and exact persisted JSON. Atomic leases prevent simultaneous sends. Provider acceptance is stored as accepted, never delivered.
- 429/5xx/network uncertainty retry with exponential backoff, at most six attempts; expired leases reclaim safely. After 23h from first attempt, ambiguous sends require reconciliation, within Resend's documented 24h retention. Permanent rejection and bounced/complained recipients do not auto-resend. Bounce/complaint suppression applies to subsequent messages for the same business/recipient.
- At most five rows per dispatch, and at most 90 provider attempts in any rolling 24h (global across modes), enforced by atomic attempt insertion. This conservative application limit does not replace verifying provider free-tier/account limits. Do not enable sending unless usage can remain within the owner's no-cost constraint.
- Signed Svix callbacks verify the bounded raw body, signatures and timestamp. Unique event IDs deduplicate callbacks; late sent/delayed events cannot downgrade delivered/bounced/complained states. An event racing provider-acceptance persistence gets 503 so the provider retries.
- Financial/account roles, revision locking, audit records and entitlement checks remain. Paid/credited invoices cancel pending dispatch. A recovery import of full-store v3 data holds queued/retrying/sending rows in review pending provider reconciliation. v1/v2 backups remain supported. This is recovery code validation, not the final owner backup task.

## Configuration inventory (names only)
- RESEND_API_KEY (secret, sending scope only).
- RESEND_WEBHOOK_SECRET (secret).
- QUENVIRA_EMAIL_MODE: unset/off, test or live.
- QUENVIRA_EMAIL_FROM: verified provider sender mailbox, not a Gmail impersonation.
- QUENVIRA_EMAIL_TEST_RECIPIENTS: exact owner-approved test addresses, comma-separated; empty denies every test recipient.
- QUENVIRA_CUSTOMER_INVOICES_APPROVED: absent; only explicit owner approval may set yes for live customer documents.
- QUENVIRA_EMAIL_DISPATCH_TOKEN: optional high-entropy secret for a future scheduler; at least 32 characters.

Never overwrite sandbox or live Stripe secrets with email credentials. No production email variables have been installed.

## Routes and operation
- POST /api/quenvira/workspaces/:id/commands, action invoice.email.queue: normal revision/requestId and manager authorization.
- GET /api/quenvira/workspaces/:id/email-history: last 200 status summaries, no private payload.
- POST /api/quenvira/workspaces/:id/email-dispatch: manager/entitlement, bounded due batch.
- POST /api/quenvira/email-dispatch: independent constant-time bearer check using dispatch token. No browser identity grants scheduler access.
- POST /api/quenvira/email-webhook: provider signature; subscribe to email.sent, email.delivered, email.bounced, email.complained, email.failed and email.delivery_delayed.

A production scheduler is NOT provisioned or claimed working. After provider acceptance, configure a supported server schedule to call the authenticated dispatcher, verify missed-run recovery and stay within free quotas. Manager Process due email supports controlled acceptance before unattended scheduling. Use an owner-approved test address and fictional data only. No provider send has occurred during this implementation.

## Remaining gates
1. Owner-authorised sender/provider account and secure credentials. Resend requires DNS verification on a domain the sender controls. Existing Gmail contact remains unchanged; no domain purchase is authorised. A Gmail OAuth transport would be a separate implementation/consent choice, not an interchangeable Resend secret.
2. Verify current free allowance, verified sender, data region, processor/retention terms, suppression management and notification monitoring before enablement.
3. Genuine owner-only delivery test, provider-signed delivery/bounce callbacks, retries, scheduler and received content. Test transport mocks do not establish these.
4. Fresh signed-in manager/staff/mobile browser acceptance; physical Samsung camera capture.
5. Final independent encrypted laptop backup LAST, followed by explicit commercial billing/customer-invoice activation approval.

## Primary implementation references checked
- https://resend.com/docs/api-reference/emails/send-email
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://resend.com/docs/dashboard/domains/introduction
- Svix 2.8.0 installed source verifies signatures and returns undefined; JSON is parsed only after successful verification.
