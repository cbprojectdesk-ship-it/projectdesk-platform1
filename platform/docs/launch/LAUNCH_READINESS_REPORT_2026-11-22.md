# Quenvira launch-readiness report — 22 November 2026

Status: **development candidate; not ready for real customers or live billing.**
Base: `origin/integration/pr52-pr60-verified-20261121` (`526f0cf`) with the
verified PR #52/#60 integration tree. Work branch:
`feature/quenvira-launch-preparation-2026-11-22` at commit `2060888`.
GitHub Actions `Server workspace checks` run `45072021216` and `Quenvira checks`
run `45072021042` passed.

This is an AI-assisted engineering report, not independent human review, legal advice,
a DPO opinion or proof of a deployed service.

## 1. Completed improvements

### Failed authenticated-command throttling (verified defect)

The prior review recorded that only successful commands created `operations` rows, so an
authenticated caller could send unlimited invalid commands without receiving `429`.

Implemented:

- `platform/drizzle/0004_command_attempts.sql` — durable per-workspace/user/minute counter.
- `platform/db/schema.ts` — matching `command_attempts` table and index.
- `platform/server/api.mjs` — every authenticated command attempt consumes the counter
  after the idempotent-replay check; the 121st request in the same minute returns `429`.
- One-day cleanup keeps the counter bounded.
- `platform/tests/command-attempt-limit.test.mjs` — 120 invalid commands return `400`,
  the next returns `429`.
- Migration is loaded by the test SQLite harness and must be applied to staging/production
  before deploying the API change.

### Baseline HTTP security headers (verified gap)

`platform/next.config.ts` was empty. Added `platform/server/security-headers.mjs` and
wired its header entries into Next/Vinext:

- HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- restrictive `Permissions-Policy`;
- `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`;
- CSP with `default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`, `form-action 'self'`, self-only connect/font/image sources.

The script and style policy is nonce/self-only and was verified on the local built Worker:
all 37 scripts carried the nonce and the entry page contained no inline style block.

### Managed-identity validation

`server/api.mjs` now rejects missing, malformed, oversized or non-email managed identities
as unauthenticated instead of using them as user IDs or returning them to the browser.
Regression test added in `platform/tests/api.test.mjs`.

### No functional rebuild

Customer management, recurring series, staff allocation, visits/checklists/notes, invoices,
quotes, dashboards, onboarding, phone preview and team features were not rebuilt. Their
existing tests continue to pass.

## 2. Test results

Environment: Node 24.22.2, Linux container, fictional fixtures.

| Check | Result |
|---|---|
| Root demo suite (`npm test`) | **59 passed, 0 failed** |
| Platform suite (`npm test` in `platform/`) | **316 passed, 0 failed** |
| Syntax (`npm run check`) | passed |
| ESLint (`npm run lint`) | passed |
| TypeScript (`tsc --noEmit`) | passed |
| Production build (`npm run build`) | passed |
| Production dependency audit (`pnpm audit --prod --audit-level high`) | no known vulnerabilities |
| Full dependency audit | 1 moderate, dev-only `minimatch`; no high/critical |
| Chromium browser acceptance (desktop, 360, 390, 768) | **96 passed, 0 failed** |
| Local built-Worker header probe | all baseline headers present; nonce CSP applied |
| Failed-command probe | 120 invalid/malformed commands rejected; next attempt `429` |

## 2a. Additional hardening completed after the first report

- CSP is now nonce-based on the app entry route (`proxy.ts`); all 37 scripts in the local
  built page carried the matching nonce; the entry page had no inline style block.
- Malformed, wrong-content-type and oversized command bodies are counted by the failed
  command limiter before parsing can be used as a bypass.
- Optional HMAC identity proof (`QUENVIRA_IDENTITY_PROOF_SECRET`) fails closed when enabled;
  it is not enabled until the hosting proxy contract is verified.
- `command_attempts` is included in health checks and v3 operator snapshots; legacy v1/v2
  snapshots remain readable.
- Added `IDENTITY_BOUNDARY_AND_PROXY_CONTRACT_2026-11-22.md`,
  `OPERATIONS_MONITORING_AND_ROLLBACK_2026-11-22.md`,
  `PROVIDER_SANDBOX_TEST_MATRIX_2026-11-22.md`,
  `LEGAL_COMMERCIAL_READINESS_2026-11-22.md` and
  `INDEPENDENT_REVIEW_EVIDENCE_2026-11-22.md`.

Firefox and WebKit were not run locally; CI is configured to run six browser projects. No
physical-device, screen-reader, hosted-identity, hosted-D1, live Stripe or real Resend
acceptance was performed.

## 3. Remaining blockers

### Security and platform

1. **Managed hosting identity boundary** — the app trusts Sites-supplied identity headers.
   The host must overwrite caller headers and keep the Worker origin private, or a verified
   Cloudflare Access assertion is required. Local tests cannot prove this.
2. **Human/authorised review** — issue #56 requests an independent authorised reviewer.
   This AI report is not a substitute. Apply normal branch protection and review.
3. **CSP hosting check** — scripts use a nonce and styles are self-only in the local
   build; re-check generated styles and RSC hydration in the hosted build.
4. **Pre-route request limiting** — malformed, wrong-content-type and oversized command
   bodies are now counted. Requests rejected before the command route (missing/invalid
   identity, unsupported method) still rely on edge/WAF limiting.
5. **Monitoring and incident response** — health checks exist, but no paging, alerting,
   on-call ownership or tested production rollback drill is present.

### Infrastructure and providers

6. **Production D1/R2** — provision the real bindings, apply migrations `0000`–`0004`,
   verify `/health`, and add an isolated R2 bucket where required.
7. **Independent backup/restore** — synthetic encrypted backup and SQLite drills pass, but
   scheduled D1/R2 backups, separate key custody and a hosted restore have not been proven.
8. **Stripe** — five prices, portal and webhook must be configured in test mode; run
   checkout, renewal, failure, grace, cancellation, refund/dispute, duplicate and forged
   webhook tests. Live billing remains disabled until owner approval.
9. **Resend** — customer sending is disabled; test owned-sender delivery, bounce,
   complaint, retry and suppression in the hosted environment.
10. **DNS/domain** — production host and DNS are not part of this repository.

### Commercial and legal

11. Signed customer order, DPA, DPIA/ROPA, ICO fee assessment, VAT confirmation,
    privacy/terms review and support ownership are outstanding.
12. Retention/deletion limits for operations, events and billing records are not fully
    implemented.
13. Customer invoice payment collection (payment links/partial credit/accounting) is not
    implemented; documents are manual-payment records.

### Documentation consistency

14. Some launch documents still describe the older single-price plan, old migration state
    or old dates. The five-band catalogue and current migrations must be reconciled in the
    hosted source before publication.

## 4. Production dependencies

- A verified ChatGPT Sites project with the actual source repository and deployment path.
- Production Cloudflare D1 and R2 bindings, with migrations `0000`–`0004`.
- Managed identity header stripping and a private Worker origin, or verified Cloudflare
  Access (issuer, audience, expiry, signature).
- Hosted secrets: Stripe test keys and webhook secret, Resend API/webhook secrets,
  session/rate-limit secrets as applicable, and the D1 binding. Values must stay in the
  provider's secret store.
- A staging/private acceptance environment using test-mode billing and no customer data.
- A monitoring/alerting destination and named incident owner.
- Qualified UK legal/data-protection review and owner commercial approval.

## 5. Recommended launch sequence

1. Merge this development branch through normal review and branch protection; do not
   bypass required checks.
2. Deploy a private staging build. Apply migration `0004` only after a database backup and
   row-count check. Verify the new headers on the deployed origin.
3. Verify managed identity and tenant isolation using two real accounts; document MFA,
   session expiry and revocation.
4. Run the full platform, TypeScript, lint, build and browser suites on the exact staging
   head. Confirm the 121st failed command returns `429` against the staging D1 binding.
5. Configure Stripe test-mode prices, portal and webhook; execute the complete sandbox
   lifecycle and rejection matrix. Keep live billing off.
6. Configure Resend test mode and an owner-approved recipient; prove delivery, bounce,
   complaint and retry handling. Keep customer sending off.
7. Take an encrypted D1/R2 backup, restore into isolation, record RPO/RTO and test rollback.
8. Complete legal/privacy documents and owner acceptance. Then, and only then, make a
   separate explicit decision to enable live billing.

## 6. Honest verdict

The code candidate is suitable for a private, invitation-only fictional-data pilot after
human review. It is **not** ready for real customer data or paying customers. Passing
mocked tests and the local Worker probe does not prove hosted identity, D1/R2 recovery,
Stripe, Resend, monitoring or legal readiness.
