# Quenvira server workspace

A private development release for UK service businesses. Server-backed accounts, per-business authorization and durable records are implemented; commercial production readiness is not yet certified.

## Surfaces

- `/`: managed sign-in and workspace entry.
- `/workspace.html`: server-backed business management. Starts with an empty business.
- `/demo/index.html`: separate fictional browser-local demonstration.
- `/api/quenvira/*`: authenticated, tenant-scoped API. Hosted identity is supplied by Sites dispatch; the Worker must not be exposed directly with caller-controlled identity headers.

## Development and tests

Node 24 is recommended for the SQLite integration suite. `pnpm install --frozen-lockfile`, `npm test`, `npm run check`, and `node node_modules/typescript/bin/tsc --noEmit`. Tests cover the original demo, the API against actual SQLite migrations, and the client handlers connected to that API through DOM adapters. These are not real-browser/device tests.

Use the Sites skill to build and publish. The root `.openai/hosting.json` declares `DB` for D1; never commit credentials. Generate schema migrations with `npm run db:generate` and inspect the SQL before publication. Migrations contain schema only. No customer or demo data is seeded into the server database.

## Data integrity and access

Each workspace has a versioned aggregate document, capped at 512 KiB for this initial design. Every command derives role and staff assignment from server membership, applies domain validation, then atomically updates the document, previous revision, idempotency record and metadata audit event. Stale writes return 409. Worker responses contain only assigned jobs and required customer service fields, without invoice prices or customer email. Invitations are email-bound, expire after seven days and are stored as hashes. Revocation removes staff membership immediately. No messages are sent.

One initial workspace per account is supported. Recovery history retains up to twenty previous revisions in the same database; it is not independent disaster recovery. Managers can export and delete their workspace. Request bodies are limited to 16 KiB, updates to 120 successful commands/user/workspace/minute, and the private deployment remains owner-only.

## Security dependencies

Patched versions and audited overrides are pinned in the lockfile. The production-dependency audit reports zero known advisories as of this build. The full development audit retains the unpatched `braces` 3.0.3 advisory in developer-only glob tooling. Do not build untrusted source or glob patterns. See docs/RELEASE_STATUS.md for verification evidence and remaining gates.

## Limits

Invoices remain drafts, recurrence remains finite and single-worker-per-visit, external staff hosting access remains closed, and there are no online payments, outbound email/SMS, accounting integrations or subscription billing. Do not use real customer records until device acceptance, independent backup recovery, operational monitoring and privacy/commercial requirements are verified.
