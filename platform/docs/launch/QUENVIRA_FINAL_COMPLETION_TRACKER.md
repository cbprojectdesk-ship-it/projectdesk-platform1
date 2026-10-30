# Quenvira commercial-readiness tracker

Status: **NO-GO for commercial launch**. This public tracker contains aggregate evidence only. Keep diagnostic request references, provider object identifiers, tenant records, account details, infrastructure inventory and access-policy information in existing approved private facilities. Never copy credentials into this file.

## Implemented and locally tested

- Manager-only reversible staff deactivation and access revocation; inactive staff do not consume active-person allowances. History and photographs remain retained.
- Tenant authorization, entitlement, concurrency, invoice settlement and duplicate-processing safeguards.
- Bounded Stripe error diagnostics without provider messages, credential values or customer data.
- Test-only, allowlisted enquiry acknowledgements with idempotency and failure isolation.
- Offline encrypted business-backup verification and synthetic isolated recovery coverage.
- Draft pricing/demo copy and corrected future order descriptions. These changes do not activate paid service.

## Verified evidence

- Existing application release checks passed: 30 platform test files, lint, syntax, TypeScript and production build.
- The application revision preceding this documentation update passed five CI workflows, including 144 browser tests. These are source/fixture checks, not independent hosted acceptance.
- All five approved monthly sandbox totals matched: Solo £7.99, Team 5 £14.99, Team 10 £24.99, Team 15 £32.99 and Team 20 £39.99. People include the owner; above 20 requires a tailored quotation.
- Existing fictional Checkout Sessions expired unpaid without creating a subscription or invoice. No sessions were recreated. See `STRIPE_CHECKOUT_EXPIRY_RECEIPT.json`.
- Bounded relational checks and an empty test email queue were observed. Neither establishes complete database integrity, backup completeness, delivered email or outage recovery.

## Open gates

| Gate | Safe next action | Required evidence |
| --- | --- | --- |
| Hosted Stripe authorization | Authorized administrator inspects the failed request in the existing sandbox Dashboard and corrects only the verified permission or secure binding problem. Keep its reference private. | Successful authenticated subscription read and isolated lifecycle acceptance. The missing grant is not yet proven. |
| Card lifecycle | Use existing sandbox fixtures and approved test identities after authorization is restored. | Completed Checkout, portal, renewal, cancellation, failed payment and entitlement recovery matched to real provider events. |
| Independent users | Two genuinely separate authorized identities exercise isolated fictional businesses. | Authentication/session recovery, tenant isolation, manager/staff denial and desktop/mobile journeys. Simulated sessions are insufficient. |
| Email | Confirm approved recipients, sender authentication and existing provider notification coverage; use isolated failure controls. | Accepted test notifications plus failure/retry/recovery/duplicate evidence. Do not resend historical delivered messages. |
| Data and recovery | Obtain supported complete consistent export and use an isolated restore destination. | Full schema/integrity and recovery evidence. Truncated table reads are not backups. |
| Website | Reconcile authorized source, retain branding, validate demonstrations, enquiries, mobile accessibility and disclosures. | Verified deployment and accurate availability. Draft prices must not activate Checkout. |
| Commercial | Owner completes customer/controller/provider/retention particulars and approves any required terms or communication changes. | Accurate approved disclosures and production acceptance. |

## Publication and deployment

The revised documentation contains no live credential values, provider object identifiers, private endpoints or infrastructure inventory. The original rejected documentation commit was not published. Its replacement passed normal security approval. Additional historical-document sanitization and scan limitations are recorded in `SECURITY_SANITIZATION_2026-10-30.md`. A source commit or successful build does not establish deployment.

No deployment, production migration, paid resource, live billing activation, customer charge or customer email was performed by this sanitization. Existing merge restrictions remain in force.

## Owner backup

Follow `ENCRYPTED_BACKUP_PROCEDURE.md` on the owner's trusted device for a non-destructive business backup and offline authentication. Verify actual saved bytes and independent copies; perform any restore only into an authorized empty isolated destination. A business backup does not replace infrastructure recovery. Repeat the backup for the final accepted release/data state. Backup completion is not claimed; **more than the owner backup remains**.

## Resume rule

New preparation completed: `INDEPENDENT_ACCOUNT_ACCEPTANCE.md` specifies two genuinely separate testers, two fictional businesses, cross-business manager/staff roles, safe zero-value records and the complete evidence checklist. It is not a fixture import or a hosted acceptance pass; no business, identity, invitation, payment or message was created. The internal website preview now includes Southport/Sefton/Merseyside repair, maintenance and quotation copy, section navigation and draft search metadata. It retains noindex, coming-soon wording, approved unpublished pricing and no Checkout/form/scripts. Static checks do not establish device, link, SEO or enquiry delivery acceptance.

Supported source-access diagnostic: the host issued a short-lived repository credential without automatic publication. A read-only Git probe failed at the configured network proxy before reaching authentication; this does not establish a bad provider account/key or rejected repository permission. The supported source helper and browser module remain absent. Restore those managed environment facilities through their administrator/provider; do not replace credentials, bypass the proxy or overwrite newer hosted source. Exact credential and endpoint information remain outside public documentation. Reviewer discovery still requires an eligible independent identity; do not self-approve.

Final review follow-up: the existing pull request is mergeable and has no unresolved inline review threads, but no submitted reviews/approvals were recorded. Its five workflows and 144 browser tests passed at the sanitized application head. This does not override the prior merge rejection; no merge or deployment was attempted. Supported hosted source/browser access, a second independent identity, private Stripe request diagnostics and consistent full infrastructure export remain unavailable. No fresh hosted lifecycle, email delivery or recovery pass is claimed. The backup procedure now includes the required second save click and a reviewed Windows/PowerShell workflow for the owner's laptop; that device sequence has not been executed here.

Resume at the open gates above. Keep exact access/diagnostic details in approved private facilities, use existing provider accounts and infrastructure, and preserve successful tests. Do not repeat consumed payment/email tests, expose secrets, bypass approvals or overwrite a newer hosted source. Remain at £0 additional expenditure and keep live billing disabled.
