# Evidence package for independent human security review — 22 November 2026

This is a review packet prepared by an AI agent. It is **not** an independent human review,
penetration test, legal opinion or certification. The reviewer must reach their own
conclusion and record approval or requested changes.

## Revision under review

- Repository: `cbprojectdesk-ship-it/projectdesk-platform1`
- Branch: `feature/quenvira-launch-preparation-2026-11-22`
- Code head: `e647bd0` (security and launch-preparation changes)
- Documentation head: `db3451c` and subsequent evidence commits
- Base: `origin/integration/pr52-pr60-verified-20261121` (`526f0cf`)
- CI: GitHub Actions `Server workspace checks` and `Quenvira checks` pass on the branch.

The exact head must be re-read from GitHub at review time; do not rely on this document if
the branch has moved.

## What changed in this preparation cycle

1. Durable failed-command throttling, including malformed and oversized command bodies,
   with migration `0004_command_attempts.sql`.
2. Strict managed-identity validation and optional HMAC identity proof.
3. Baseline security headers plus a nonce-based CSP on the app entry route.
4. Health and operator recovery coverage for `command_attempts`.
5. Monitoring/rollback, identity-boundary, provider sandbox and legal/commercial notes.
6. No change to customer invoice payment collection; manual tracking only.

## Commands and results

Run from `platform/` unless noted.

| Command | Result |
|---|---|
| `npm test` (repository root) | 59 passed, 0 failed |
| `npm test` | 316 passed, 0 failed |
| `npm run check` | passed |
| `npm run lint` | passed |
| `node node_modules/typescript/bin/tsc --noEmit` | passed |
| `npm run build` | passed |
| `pnpm audit --prod --audit-level high` | no known vulnerabilities |
| `pnpm audit --audit-level critical` | 1 moderate development-only `minimatch`; no high/critical |
| Chromium Playwright projects (desktop, 360, 390, 768) | 96 passed |
| Built Worker nonce probe | CSP header, all 37 scripts and style policy verified |
| Failed-command tests | invalid, malformed and oversized attempts return `429` after the limit |

Full Firefox/WebKit local runs were not performed; CI is configured for six browser
projects. No hosted identity, real Stripe, real Resend, production D1/R2, physical-device
or screen-reader acceptance was performed.

## Review focus

Please review, in particular:

1. `server/api.mjs` — identity validation, optional proof, command attempt counting,
   malformed-body catch, authorization and commit-time checks.
2. `server/identity-proof.mjs` and `proxy.ts` — HMAC proof and nonce CSP.
3. `server/security-headers.mjs` — policy scope and style/script restrictions.
4. `drizzle/0004_command_attempts.sql`, `db/schema.ts`, `scripts/workspace-recovery.mjs` and
   `server/health.mjs` — migration, backup and readiness consistency.
5. `server/subscriptions.mjs` and `server/invoice-delivery.mjs` — test-mode fail-closed
   behaviour; no live activation.
6. Tests — whether they exercise real code paths rather than mocks, and whether any
   boundary is asserted only by a fake.

## Known limitations and open questions

- The managed host contract is not proven. The optional HMAC proof is not enabled in this
  branch because no edge integration has been verified.
- CSP script nonce and self-only style coverage are verified only on the local built page;
  re-check hosted RSC hydration and generated styles.
- The app cannot distinguish caller-supplied identity headers from host-injected headers;
  that must be solved at the edge.
- The full dependency audit retains one moderate dev-only `minimatch` advisory.
- No production deployment, live charge, customer email, credential change or real data
  was used.
- Legal/DPA/DPIA/ICO/VAT and owner commercial decisions remain outside engineering.

## Reviewer record

- Reviewer:
- Date:
- Exact commit reviewed:
- Decision: approve / request changes / reject
- Findings and required follow-up:
