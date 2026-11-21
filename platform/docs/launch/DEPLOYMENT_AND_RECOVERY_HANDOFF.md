# Non-destructive deployment and recovery handoff

Status: **procedure prepared; not executed**. Use existing authorized resources only, with no additional expenditure. This procedure does not authorize a merge, deployment, migration, data restore or commercial activation.

## Reconcile before publishing

1. Obtain required independent PR approval and current-head checks. Read the actual current hosted project/source/version through supported Sites tools. Record the project, source commit, saved version, audience, bindings, non-secret flags and rollback baseline in the approved private operational inventory; never put identifiers, credentials or customer data into this public guide.
2. Open the existing hosted source with the supported Sites source workflow. Use its current credential through the prescribed stdin path; never persist tokens. GitHub connectivity works through normal approval-controlled execution. Missing Sites helper/browser facilities remain a separate prerequisite, not a reason to replace keys or weaken networking.
3. Compare the actual hosted source against the reviewed PR. Preserve hosted changes, existing integrations and unrelated CCS products. GitHub/hosted commit differences establish provenance differences, not a complete content diff. Do not overwrite newer source or claim reconciliation from metadata alone.
4. Inspect the actual reopened hosting manifest. The GitHub checkout currently has a generic manifest with `DB`, no selected project identity and a null object binding. It is not proof of the live project's complete identity/storage configuration. Preserve the existing live database/object bindings through the supported source workflow; do not create a new Site, database or bucket, guess identifiers or substitute standalone staging resources.
5. Review the resulting diff and migrations. PR 52 itself adds no SQL migration. If reconciliation introduces one, stop for the appropriate schema/recovery review. Applied migration history is immutable, and a failed publish may already have applied SQL. Never down-migrate or restore production automatically.

## Acceptance and deployment

1. Use an existing authorized isolated test destination/businesses; if none is available, record BLOCKED rather than provision a resource or seed production. Keep billing/email in test mode and public signup/live activation off. Preserve recipient, pilot and role restrictions.
2. Run checks affected by the reconciled source, including the production build and independent-account pack. Verify sender/queue recovery and sandbox payment/entitlement transitions using approved fixtures. Do not treat mocked responses, redirects, timer configuration or database memberships as genuine provider/session acceptance.
3. Obtain required deployment approval and adequate recovery safeguards. Use the supported source helper to push and package the exact reviewed source. Save a version for that exact commit/archive; all Sites deployment URLs are production. Select the audience-appropriate publishing operation without changing access. Do not publish the internal website preview or activate prices/Checkout.
4. Inspect the native deployment result to a terminal state. Then verify the actual deployed version, read-only health route, expected authentication denial, static assets and authorized manager/staff smoke checks. Inspect bounded logs without recording secrets or customer details. Keep failure/retry queues and existing schedules intact; never add a duplicate scheduler.
5. Retain the previously reviewed compatible version/archive and record the actual result privately. A successful build is not deployment evidence, and deployment success is not commercial acceptance. If the required hosted/source/browser access is missing, stop before publication.

## Rollback boundary

- Re-deploy only a previously verified compatible version through normal hosting controls. Check schema compatibility, object references, session/access behavior and security fixes first. An older version that restores a security defect is not a safe rollback target.
- Code rollback does not undo data writes or migrations. Do not restore database files, alter memberships, replay invoice email, duplicate a subscription or rotate credentials as an automatic rollback step.
- Reconcile uncertain deployment/migration state before another publish. If compatible rollback cannot be established, escalate to the authorized operator for a reviewed forward fix. Do not change audience or bypass authentication to regain access.
- Verify version, health, access denial, records/photo availability and queues again after an approved rollback. Record limitations honestly; no recovery-time guarantee is implied.

## Consistent full database and attachment export checklist

This is separate from the owner's encrypted `.qvb` business snapshot. The connected bounded table reader is not a full-export method. A managed production full export requires the provider's supported consistent-snapshot/export facility operated by an authorized account holder. If that facility/account identity is unavailable, full infrastructure recoverability remains BLOCKED; do not substitute another database or independent table-page scrape.

- Establish the exact authorized database and object store from the private inventory. Include schema/migration history, all required tables and complete object inventory. Secrets are not part of an ordinary dump; retain only secure vault references in the inventory.
- Obtain a provider-supported coordinated snapshot or an expressly approved consistency boundary. Database rows and referenced attachments must represent the same state. If an approved write pause or equivalent immutable-export guarantee is unavailable, do not certify consistency. No write pause is performed by this guide.
- Follow every export page/chunk and record provider completion evidence. Detect truncation, missing pages, inconsistent revisions, unreadable objects and size limits. Read-only table counts alone do not establish a complete snapshot.
- Compare exported database references with exported staff/job photo objects, byte lengths and content hashes using the application's reference/hash rules. Record missing/unreferenced objects for review without deleting anything. Metadata/ETags alone do not prove identical bytes.
- Encrypt exports on the owner's trusted device using existing tools/storage; keep passwords separately. Compare SHA-256 across independent saved copies, authenticate/decrypt a copy, and retain safe counts/hash receipts privately. Never upload plaintext exports, credentials or actual customer evidence to Git/chat.
- Restore only into an authorized empty isolated destination with dispatch, schedules and collection disabled. Validate SQLite integrity/foreign keys, schema, row counts, tenant separation, invoice/credit history and every referenced photo. Reconstruct identities and secure bindings independently; never import working production credentials into test.
- Quarantine queued/retry/sending emails for provider reconciliation before any dispatch. The reviewed logical recovery utility applies this safeguard; a raw SQL import does not. Verify external Stripe mappings without creating subscriptions or replaying payments/events.
- Document precisely which source, database, object, identity and external-provider elements were verified and which remain outside recovery scope. An encrypted business snapshot does not prove complete hosted infrastructure recovery.

Use `ENCRYPTED_BACKUP_PROCEDURE.md` for the owner's two-button Windows download, second copy, hash and offline authentication. No actual owner backup or infrastructure export is claimed by this handoff.
