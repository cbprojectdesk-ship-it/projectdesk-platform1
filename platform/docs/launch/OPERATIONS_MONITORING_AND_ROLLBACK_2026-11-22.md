# Monitoring, alerting and rollback procedure — 22 November 2026

This is a prepared operational procedure. No production monitoring service, paging
provider or incident owner is configured in this repository. It must be completed and
exercised in staging before a real-data pilot.

## Signals and thresholds

| Signal | Source | Suggested alert | First action |
|---|---|---|---|
| Readiness failure | `/api/quenvira/health` returns `503` | 2 consecutive failures or 3 in 5 minutes | Check D1/R2 bindings, migrations, billing configuration and Worker logs |
| HTTP 5xx rate | hosting/edge metrics | >1% for 5 minutes or any sustained 5xx on `/api/quenvira/*` | Stop writes, inspect deployment revision, consider rollback |
| Authentication anomalies | edge logs | spike in `401`/`403` or forged-header probes | Confirm edge header stripping; preserve request metadata without bodies |
| Rate limiting | API `429` count | sustained `429` for a workspace | Check abuse, failed-command counter and WAF rule |
| Stripe webhook failure | Worker logs and `subscription_events` | any repeated signature/verification failure or provider 5xx | Keep billing closed; reconcile provider event log before retrying |
| Stripe payment state | provider dashboard | failed renewal, dispute, refund or past-due event | Review access state and billing review flag; do not move money |
| Email queue age | `invoice_outbox.next_attempt_at` and `invoice_email_events` | oldest queued/retry item >15 minutes | Keep customer sending off; inspect Resend status and suppress list |
| Email delivery failures | Resend webhook and outbox `failed`/`review` | any bounce/complaint or repeated failure | Stop that recipient, reconcile provider state, do not blind retry |
| Backup age | operator records | >24 hours without a verified D1/R2 backup | Take a backup before any further change |
| Disk/object growth | D1/R2 metrics | unexpected growth or quota risk | Review retention; never delete business records without approval |

Thresholds are starting proposals, not production commitments. The owner must approve
them and name a 24/7 contact before launch.

## Minimum runbook

1. Confirm the alert is not a stale browser or a single transient request.
2. Check `/api/quenvira/health`; a `503` means storage, schema, R2 or billing configuration
   is not ready. Do not bypass it.
3. Check the exact deployed revision and migration state. Never apply a migration without a
   verified backup and an isolated restore path.
4. For suspected tenant or identity faults, stop writes and preserve logs. Do not inspect
   or copy real customer records unless authorised.
5. For payment faults, leave live billing disabled. Reconcile the provider event and the
   application's subscription state; do not replay a charge or email.
6. Record time, revision, impact, affected workspace count, actions and follow-up owner.

## Rollback

### Application code

- Roll back to the previous verified Worker revision through the hosting provider.
- Keep the database schema forward-compatible. The 22 November API change requires
  migration `0004_command_attempts.sql`; rolling back the API while leaving the table in
  place is safe, but rolling back the table after the API has written attempts is not a
  normal rollback and needs a backup.
- Re-run `/health`, the identity probe, a manager read and a staff read after rollback.

### Data

- Use the encrypted operator snapshot/restore utility only against an isolated empty
  database. Do not restore over a populated production database.
- `platform/scripts/workspace-recovery.mjs` includes `command_attempts` in v3 snapshots;
  v1/v2 snapshots remain readable without inventing the table.
- Restored queued/retry/sending invoice emails are set to `review` and must not be sent
  until provider state is reconciled.
- Record `PRAGMA foreign_key_check` and `PRAGMA quick_check` results and compare row counts.

### Verification after rollback

```bash
cd platform
npm test
npm run check
node node_modules/typescript/bin/tsc --noEmit
npm run build
```

Browser acceptance is separate. A rollback is not complete until identity, reads, writes,
billing state and email queue state are checked in the isolated environment.

## Current evidence and gaps

- Local readiness tests, backup/restore tests and browser tests pass.
- No external paging, alert delivery, on-call rota, hosted dashboard or production rollback
  drill exists.
- No production deployment or live billing was used to prepare this procedure.
