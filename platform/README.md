# Quenvira server workspace

A private development release for UK service businesses. Server-backed accounts, per-business authorization and durable records are implemented; commercial production readiness is not yet certified.

## Surfaces

- `/`: managed sign-in and workspace entry.
- `/workspace.html`: server-backed business management. Starts with an empty business.
- `/demo/index.html`: separate fictional browser-local demonstration.
- `/api/quenvira/*`: authenticated, tenant-scoped API. Hosted identity is supplied by Sites dispatch; the Worker must not be exposed directly with caller-controlled identity headers.
- `/mcp`: authenticated manager-only email retry controls. Browser cross-origin calls are rejected; no recipient data is returned.

## Development and tests

Node 24 is recommended for the SQLite integration suite. Install with
`pnpm install --frozen-lockfile`, then run `npm test`, `npm run check`, `npm run lint`,
`node node_modules/typescript/bin/tsc --noEmit`, `npm run db:verify` and
`npm run build`. The platform suite has 320 cases covering the original demo, the API
against actual SQLite migrations, and client handlers connected through DOM adapters.
The repository root demo suite has 59 cases. The separate `browser-tests/` workflow runs
real Chromium, Firefox and WebKit scenarios in CI; its local Chromium run covered 96
cases across 1440, 360, 390 and 768 widths. These are not hosted, physical-device,
screen-reader or production acceptance.

Use the Sites skill to build and publish. The root `.openai/hosting.json` declares `DB`
for D1; never commit credentials. Generate schema migrations with
`npm run db:generate` and inspect the SQL before publication. Migrations contain schema
only. No customer or demo data is seeded into the server database.

## Data integrity and access

Each workspace has a versioned aggregate document, capped at 512 KiB for this initial
design. Every command derives role and staff assignment from server membership, applies
domain validation, then atomically updates the document, previous revision, idempotency
record and metadata audit event. Stale writes return 409. Worker responses contain only
assigned jobs and required customer service fields, without invoice prices or customer
email. Invitations are email-bound, expire after seven days and are stored as hashes.
Revocation removes staff membership immediately. Invoice email uses a durable outbox,
leases, stable provider idempotency keys, a 23-hour retry boundary and
bounce/complaint suppression; customer sending remains disabled.

One initial workspace per account is supported. Recovery history retains up to twenty
previous revisions in the same database; it is not independent disaster recovery.
Managers can export and delete their workspace. Request bodies are limited to 16 KiB
(360 KiB for photos, up to 20 MiB for encrypted imports), updates to 120 authenticated
command attempts/user/workspace/minute, and the private deployment remains owner-only.
Solo/Team checkout is staged behind test-mode configuration; no live billing is active.

## Security dependencies

Patched versions and audited overrides are pinned in the lockfile. The
production-dependency audit reports zero known advisories as of this build. The full
development audit retains one moderate, development-only `minimatch` advisory in ESLint
tooling; no high or critical advisory remains. Do not build untrusted source or glob
patterns. See `docs/RELEASE_STATUS.md` and
`docs/launch/RELEASE_CANDIDATE_2026-11-28.md` for evidence and remaining gates.

## Limits

Invoices are manual-payment records, recurrence is finite and single-worker-per-visit,
external staff hosting access remains closed, and there are no online customer invoice
payments, accounting integrations or live subscription billing. Invoice email is a
gated test capability and customer sending is off. Cloudflare Access is implemented for
the standalone path but not configured or hosted. Do not use real customer records until
hosted identity, device acceptance, independent backup recovery, operational monitoring
and privacy/commercial requirements are verified.
