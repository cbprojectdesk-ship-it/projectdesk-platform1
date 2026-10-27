# Automated invoice delivery — 26 October 2026

## Evening hosted acceptance — current status

Owner authentication succeeded as the existing manager. In the private development workspace, a clearly labelled fictional zero-value visit was completed with both automatic-invoice preferences enabled. This atomically produced issued test invoice QV-1003 and queued its email. The manager dispatch control sent it once; the signed provider callback updated history to `delivered`, attempts `1`. Gmail independently confirmed receipt in ccscreativetech@gmail.com at 20:35:27 Europe/London on 26 October 2026. Header checks passed SPF, DKIM and DMARC. Reply-To is ccscreativetech@gmail.com; From remains onboarding@resend.dev.

Resend API and webhook secrets are stored as secret production runtime entries. QUENVIRA_EMAIL_MODE remains test, the recipient allowlist is owner-only, billing remains test and self-service remains disabled. No customer-invoice approval or dispatch token was added. The supplier profile uses explicitly fictional QA details, including the official CCS contact email, and must be replaced before customer use.

A background Worker dispatch now wakes after successful authenticated workspace command responses, scoped to that workspace and limited to one due message. Provider latency cannot fail a saved business command. Durable leases, suppression, provider idempotency and retry safety remain in force. This supports the first attempt without a manager click and opportunistic retries on later commands. It is not a periodic scheduler; guaranteed retries while all clients are closed remain unprovisioned. Independent owner-only receipt for the changed automatic wake is a separate deployment acceptance check.

Remaining launch blockers: owned sender-domain verification for customer delivery; unattended periodic retry scheduler and missed-run acceptance; applicable commercial/provider review; physical device/staff acceptance; final owner-held encrypted laptop backup LAST; separate live billing and customer-email activation approval. No purchase or domain registration is authorised. Never set the From address to the Gmail address to bypass domain verification.

The historical notes below describe the earlier build and must not be read as current provider status.

## Earlier implementation state (superseded by evening acceptance)
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

## Afternoon follow-up — 26 October 2026

An interrupted sixth dispatch attempt is now reclaimed for operator reconciliation without making a seventh provider request. A regression test reproduces the expired-lease case and verifies that no provider call or attempt event occurs. The provider idempotency key and 23-hour cutoff remain unchanged.

Current provider documentation reviewed (configuration remains absent):
- https://resend.com/pricing lists 3,000 emails/month and 100/day on Free. The application's 90-attempt rolling daily cap is conservative but other sending from the same provider account also consumes its allowance.
- https://resend.com/security and https://resend.com/security/gdpr state that stored data is in the United States, including when an EU sending region is selected; email/log retention is 30 days, account-termination deletion up to 90 days, and backups persist for seven days. These are published provider terms, not verified settings or an accepted customer processing agreement.
- https://resend.com/docs/dashboard/domains/introduction requires an owned, verified domain for customer sending. https://resend.com/docs/knowledge-base/403-error-resend-dev-domain limits the default test domain to the provider account's own email address. No account, key, DNS access or verified sender is available in this session; no purchase or signup was attempted.

Existing Stripe sandbox receipt 2238-3797 was authenticated in the CCS Inbox through old-address forwarding. Its historical reply-to remains the old address; a fresh native account read confirms current sandbox business support_email is ccscreativetech@gmail.com. This verifies existing receipt delivery and current configuration, not a new receipt rendered with the new reply-to. The account's login/representative identity was not changed.

Fresh hosted browser access reached the expected signed-out workspace explanation without a crash. Signed-in manager/staff, physical Samsung camera and hosted payment acceptance remain deferred until the owner is available. Live billing and invoice sending remain disabled. Final owner-held backup remains last.


## Callback integrity follow-up

Signed callback identifiers are now validated before database binding. Reusing a callback event ID for a different invoice or outcome is rejected; the atomic update also binds the audit event to its invoice and outcome. Duplicate identical callbacks return a replay acknowledgement. Unknown inherited object property names are ignored as unsupported event types. Tests reproduce the previous cross-invoice replay edge case, then verify the correction, malformed identifiers, body limits and method restrictions. Provider delivery and owner sign-in remain separate launch gates; sending and billing stay disabled.
