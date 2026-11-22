# Existing staging D1 — safe configuration procedure

This is a procedure, not a deployment or completed migration. Identify the already authorized staging database in the provider's secure configuration; the public placeholder is `CONFIGURE_IN_SECURE_ENVIRONMENT`. Do not provision a new or chargeable resource.

Bind only the verified existing database to `DB` and the isolated staging object bucket to `BUCKET` through the approved host configuration. The checked-in staging configuration names `quenvira-staging`; it is not evidence that the bucket exists. A standalone deployment must use verified identity policies and the reviewed standalone configuration. Do not replace managed/local build placeholders or expose an unverified Worker. Keep billing in test mode and self-service disabled.

Before migrations, compare account/database identity against the private inventory, review `platform/drizzle/` and obtain a complete verified recovery safeguard. Do not execute a remote migration against an unreviewed target. Current schema state and R2 bucket existence must be inspected; this document does not assert that migrations are applied or that the bucket is provisioned.

Required evidence: signed identity acceptance, unauthorized/cross-tenant denial, reviewed build/configuration, consistent schema and persistence.

Migration `0004_command_attempts.sql` adds the failed-command rate-limit counter used by the 22 November API hardening. Apply it only after the backup and schema review above; do not deploy the API change without the table., complete export and isolated restore, signed sandbox webhooks, subscriptions and operational/commercial review. Never restore fixtures into production or treat truncated table pages as a backup.

Local migration validation before any hosted apply:

```bash
cd platform
npm run db:verify
```

This uses an in-memory SQLite database, applies migrations `0000`–`0004`, and checks the
required tables plus SQLite foreign-key and quick checks. It does not connect to D1, R2 or
any hosted resource and is not a substitute for a reviewed staging migration and restore.
