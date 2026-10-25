# Invoice email delivery — staging implementation contract

Status: design and integration gate only. No outbound email is enabled by this file.

## Existing behaviour
The server-backed workspace creates draft invoices automatically when configured, but job completion must never issue invoices or contact customers implicitly. Only an authorised manager can issue an invoice. The public demo is separate and must never send mail.

## Proposed authenticated API
- POST /api/quenvira/workspaces/:id/invoices/:invoiceId/send
- Manager membership and active entitlement required, using the existing trusted hosted identity and tenant-scoped workspace.
- Only immutable Issued invoices, never Draft, Credited or private-test documents, are eligible once commercial/legal approval is recorded.
- Validate a single customer email; snapshot recipient, invoice version, subject and document hash.
- Require an explicit manager confirmation for initial sending. Automatic sending remains behind a separately approved disabled-by-default business setting.
- Require an Idempotency-Key; repeated requests return the same delivery attempt rather than sending again.
- Store an outbox row in D1 with unique (workspace, invoice, invoice version, recipient, delivery purpose), attempt status and timestamps. Persist before provider dispatch.
- Deliver using a server-side email provider with credentials in hosting secrets, never in client code or GitHub.
- A worker/queue claims pending rows with a lease, records provider message ID, handles timeouts as unknown rather than blindly resending, and retries only known-safe failures with backoff.
- Verify signed provider webhook callbacks and map accepted/delivered/bounced/complained events to audit records; never claim delivered based on provider acceptance.
- Expose manager-only delivery status, retry and recipient correction. Do not expose customer email or invoice details to staff.
- Provider suppression, unsubscribe/complaint policy, rate limits, redacted logs, retention, GDPR processor details and monitoring are release gates.
- Render a genuine invoice PDF only after the private-test watermark and legal/commercial release gate are removed.

## Tests required before merge
Tenant and staff denial; forged identity; invalid recipient; draft/credited invoice rejection; two simultaneous send requests; webhook replay/signature failure; provider timeout; queue crash after send; bounce; suppression; manual retry; disabled configuration; no real sends in test; stable invoice/recipient snapshots.

## Operational constraint
Stripe live billing remains off. This branch must not be merged or deployed as an email delivery feature until actual provider integration, database migration, queue/webhook tests and owner approval are complete. Encrypted independent laptop backup remains the last pre-launch task.
