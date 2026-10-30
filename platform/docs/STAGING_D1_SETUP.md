# Existing staging D1 — safe configuration procedure

This is a procedure, not a deployment or completed migration. Identify the already authorized staging database in the provider's secure configuration; the public placeholder is `CONFIGURE_IN_SECURE_ENVIRONMENT`. Do not provision a new or chargeable resource.

Bind only the verified existing database to `DB` through the approved host configuration. A standalone deployment must use verified identity policies and the reviewed standalone configuration. Do not replace managed/local build placeholders or expose an unverified Worker. Keep billing in test mode and self-service disabled.

Before migrations, compare account/database identity against the private inventory, review `platform/drizzle/` and obtain a complete verified recovery safeguard. Do not execute a remote migration against an unreviewed target. Current schema state must be inspected; this document does not assert that migrations are applied or unapplied.

Required evidence: signed identity acceptance, unauthorized/cross-tenant denial, reviewed build/configuration, consistent schema and persistence, complete export and isolated restore, signed sandbox webhooks, subscriptions and operational/commercial review. Never restore fixtures into production or treat truncated table pages as a backup.
