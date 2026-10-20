# Quenvira launch gates

Status (20 October 2026): private server-backed development candidate, with a separate fictional-data demonstration. The API/database and client-adapter tests pass locally; hosted identity, physical-device acceptance, operations, legal readiness and commercial invoicing remain unverified. The sections below are release requirements, not a statement that all are missing or completed.

## 1. Server architecture and identity

Preserve the current domain operations and interface. Introduce an API boundary rather than rewriting the application. Use a maintained identity provider with verified invitations, session expiry, logout/revocation and manager MFA. Keep credentials server-side; use Secure, HttpOnly, SameSite cookies and CSRF protection where appropriate. Do not put customer records or session tokens in localStorage in the real product.

Every API request must derive the authenticated user and tenant from trusted session context. Enforce manager, office and assigned-worker permissions server-side. Workers receive only the customer fields necessary for their own visits, without invoices, exports or other tenants' data. Deny by default. Tests must attempt forged tenant IDs and direct access to every other tenant's record, export, attachment and job.

## 2. Transactional storage

Use a managed relational database with tenants, memberships, customers, staff, job series, visits, checklist items, invoices, invoice lines, payments and audit events. Each business record carries tenant_id. Enforce foreign keys, unique tenant/invoice numbers and version checks. Allocate invoice numbers, mark payments and update job/invoice links in transactions. Use idempotency keys for payment/webhook writes and recurring generation. Add migrations and rollback/forward recovery procedures.

Use Europe/London as the initial business timezone with real injectable clocks. Store timestamps in UTC, local service dates separately and prices in integer pence. Define DST and overnight-visit policies. A recurrence series must support pause, skip and edit-this/future/all semantics with conflict validation and audit history. The demo's fixed clock and finite batches are deliberately insufficient.

## 3. Privacy and operations

Create a data inventory and lawful-basis record. Determine controller/processor responsibilities; usually customers control their service-client records and Quenvira processes those records, while Quenvira controls its own account and billing records. Confirm the facts before finalising contracts. Prepare privacy notices, processing agreements, subprocessors, transfer safeguards, retention/deletion rules, subject-access procedures and incident response. Assess DPIA and ICO fee applicability. Minimise home-access instructions and avoid health information by default.

Separate demo, development, staging and production databases, accounts, secrets and backups. Never copy production personal data into demo fixtures. Use transport and at-rest encryption, restricted administrative access, redacted logs and secret scanning. Backups must be automated, encrypted and successfully restored in a timed exercise; propose a 24-hour recovery-point objective and 8-hour recovery-time objective for initial validation, without promising them before testing.

## 4. Invoice and payment correctness

Implement supplier identity, legal/contact address, VAT registration where applicable, supply date, invoice date, line items, immutable issued records, credit notes and configurable tax/rounding rules. Validate with an accountant before tax-invoice claims. Add sandbox-only payment and webhook tests before enabling real money. PDF delivery, email consent/configuration, failed sends and accounting reconciliation remain separate requirements.

## 5. Acceptance and release

Run automated checks on the exact proposed commit. Perform real-browser acceptance on desktop Chrome/Edge/Firefox/Safari, iOS Safari and Android Chrome at 360, 390, 768 and 1440 CSS pixels. Verify every link/button/form, keyboard navigation, dialogs, screen-reader labels, zoom, horizontal scrolling, downloads, print, reload, failed storage, offline behaviour and stale/multiple tabs. Test data migration, concurrent bookings, database failure, restore, rate limiting and cross-tenant attacks. Record actual results and device/browser versions.

Do not describe the application as production-ready until these results and security/deployment evidence are available. Run a limited, consented pilot only after the real-data gates pass. Paid launch additionally needs owner approval, clear terms/refunds, pricing, billing, support ownership, monitoring and a rollback drill. Branch protection and required checks should be configured once a stable consolidated check is selected; current workflow success alone does not prove branch protection.


## Current verification record — 20 October 2026

The server-backed app is under `platform/`. Source review and SQLite-backed tests verify membership isolation, assigned-worker projections, optimistic concurrency, idempotent requests, bounded revision history, invitations and deletion. These checks do not establish live hosting boundary security, independent backups or commercial readiness.

The launch hardening branch fixes duplicate records after an acknowledged write followed by a failed refresh, malformed response or upstream error. Six added regression cases exercise these failures and prevent a different mutation from replacing an unresolved retry. The Legal & Privacy section is a development-status page only; reviewed terms, privacy and subscription agreements are still required.

Remaining priorities: supported browser/device acceptance; live multi-user and trusted identity boundary testing; independent backup/restore and incident/rollback exercises; recurring generation and load limits; compliant issued invoices/credit notes; approved legal documents and explicit launch approval. No real customer data, billing or sales claims should be introduced while these gates remain open.

The merged recurring-series controls now support pausing, resuming, cancelling and editing pending future visits, with atomic overlap/capacity checks. They still book finite batches of at most twelve visits and do not provide unattended generation. See `QA_AUDIT_2026-10-20.md` for the current evidence and rollback constraints.

## Browser and recovery progress

Thirty browser cases passed on GitHub in Chromium, Firefox and WebKit desktop and Chromium 360/390/768px projects using the real client/API and isolated SQLite with simulated identity. Evidence: PR #8 and its linked Actions run. This is not hosted authentication, D1 or physical-device certification.

The operator recovery module and three added regression cases exercise authenticated encryption, recovery into an empty isolated database after closing the source, preservation of paid invoices and paused visits, tenant denial, wrong keys, tampering and transactional rollback. These are synthetic tests, not scheduled independent production backups. See OPERATIONS_RUNBOOK.md.
