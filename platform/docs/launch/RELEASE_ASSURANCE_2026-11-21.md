# Quenvira release assurance — 21 November 2026

Independent technical review of `cbprojectdesk-ship-it/projectdesk-platform1` at `main` (`47d4eda`), PR #52 (`822e69f`) and PR #60 (`340f016`). This is an AI-assisted engineering review, not independent human approval, legal advice, a DPO opinion or formal compliance certification.

## Scope and method

Examined source, tests, migrations, Wrangler configuration, workflows, launch documents, open issues #56/#57 and PRs #52/#54/#55/#58/#59/#60. Re-ran the suites and adversarial probes locally; checked the production build and dependency graph; performed a read-only secret scan. No deployment, live charge, customer email, credential change or production data access was performed.

Evidence commands were run in `/workspace/project/projectdesk-platform1/platform` and a scratch merge of PR #52 + PR #60 in `/tmp/q60b`.

## What the repository is

The repository contains:

- a **static fictional-data demonstration** (root `dist/`, `wrangler.demo.jsonc`), and
- a **private, invitation-only server candidate** under `platform/` (D1 schema, API, staff roles, scheduling, invoicing, recovery, Stripe test-mode billing, Resend test-mode email).

It does **not** contain the managed hosting configuration, live credentials, production D1/R2 data, real Stripe products or the production deployment. Those remain external.

## Release verdict

**Not ready for real paying customers.** The server candidate is suitable for a continued invitation-only fictional-data pilot after human review and merge of #52/#60. Public paid launch requires the external approvals and infrastructure in section D. The previously reported “green CI” was not sufficient: this review found a **critical React Server Components advisory** that the production-only audit missed, and fixed it in #60.

---

## A — Independently verified and technically passed

| Area | Evidence | Result |
| --- | --- | --- |
| Root demo suite | CI run 44953403283: 59/59 | Pass |
| Platform suite on #60 | Local and CI 44953403228: 286/286 | Pass |
| Platform suite with #52 + #60 | Scratch merge `/tmp/q60b`: 310/310 | Pass |
| Browser acceptance on #60 | CI 44953403311: 138/138, Chromium/Firefox/WebKit, desktop/360/390/768 | Pass |
| TypeScript, syntax, build | `tsc --noEmit`, `npm run check`, `npm run build` on #60 and combined tree | Pass |
| Production dependency audit | `pnpm audit --prod --audit-level high` on #60: no known vulnerabilities | Pass |
| Full dependency audit, combined | #52 + #60: 1 moderate (dev-only `minimatch`), 0 high/critical | Pass |
| Tenant isolation | Existing tests plus probe: cross-tenant reads, commands, backups and exports return 404/403; staff projections omit price, invoice, customer email and other staff | Pass |
| Authentication boundary | `server/api.mjs` requires both identity headers; same-origin POST check; standalone guard strips caller identity headers (`server/standalone-identity.mjs:5-9`); Access verifier checks RS256, issuer, audience, expiry and `exp>iat` (`server/cloudflare-access.mjs`) | Pass (code) |
| Staff role boundaries | Manager-only billing, backup, restore, invitations, deletion, supplier and invoice routes; assigned-visit checks; commit-time membership recheck | Pass |
| Invitation security | SHA-256 token storage, email binding, 7-day expiry, single-use acceptance, revocation, 20-pending quota, active-staff check in #52 | Pass |
| Concurrency and idempotency | Stale revision 409, request-hash replay protection, atomic D1 batch rollback, in-flight revocation denial | Pass |
| Successful-command rate limit | 120 commands/user/workspace/minute | Pass |
| Invoice accuracy and immutability | Integer pence, 0/20% VAT, totals, issued snapshots, full credits, payment guards | Pass |
| Financial recovery integrity | #60 protects paid/credited invoices and payments from revision restore; 3 new tests | Pass |
| Encrypted business backup | PBKDF2-SHA256 600k, AES-256-GCM, random salt/IV, AAD, 12-character minimum, client-side password | Pass (code) |
| Subscription entitlement logic | Trial anchoring, paid-invoice/zero-balance/no-open-invoice checks, cancellation at period end, payment failure and provider outage fail closed | Pass (simulated) |
| Webhook signature and replay | Stripe SDK raw-body verification, 300-second tolerance, mode match, event-ID dedupe, authoritative re-query, 30-day receipt pruning | Pass (simulated/real SDK signing) |
| Plan limits | Five bands, exact prices, owner-inclusive seats, active-person counts in #52, checkout/plan-change guards | Pass |
| Health endpoint | Read-only schema check, no records/identity/configuration returned, generic failure log | Pass |
| Browser hardening | CSP `default-src 'self'`, `script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `no-referrer`, `no-store` API responses | Pass |
| Secret scan | No committed `sk_`/`rk_`/`whsec_`/`re_`/GitHub/AWS credentials; no `.env` files tracked | Pass |
| PR #54 helper | 4/4 Python tests independently re-run; exact localhost callback only, hidden prompt, no URL output | Pass (code) |
| PR #55 staging package | 3/3 tests independently re-run; compiled entry, reviewed D1, rejects unexpected bindings and routes | Pass (code) |
| PR #58 relay | 39/39 tests independently re-run; disabled by default, fixed target, raw-body signature, test-only events | Pass (code) |

---

## B — Defects found and corrected

### B1. A recorded payment could be erased by revision restore

- **Where:** `platform/server/billing.mjs:61-66`; commit `57b0b1a`.
- **Defect:** `assertFinancialRestore` protected only invoices with an `issue` snapshot. A draft invoice marked paid had no snapshot, so restoring an earlier revision deleted the invoice and the payment.
- **Fix:** protect any invoice with `issue`, `paidOn`, `status==='Paid'` or `status==='Credited'`.
- **Regression tests:** `platform/tests/financial-recovery.test.mjs` (3 tests).
- **Evidence:** 286/286 platform tests; combined 310/310.

### B2. Recovery was blocked after billing lapsed or the provider was unavailable

- **Where:** `platform/server/api.mjs:123-132`; commit `57b0b1a`.
- **Defect:** only `backup.import` was treated as recovery. Revision restore returned 402 after trial expiry, 409 when the plan check ran, and 503 during a provider outage, contradicting `platform/docs/SUBSCRIPTION_RELEASE.md`.
- **Fix:** recognise both `commands/backup` and `backup.restore` as recovery, skip routine entitlement and plan-fit checks, keep manager-only/revision/audit controls. Routine writes still fail closed.
- **Regression tests:** `platform/tests/recovery-entitlement.test.mjs` (4 tests).

### B3. Command API rejected omitted optional fields

- **Where:** `platform/server/domain.mjs:55,57,71`; commit `57b0b1a`.
- **Defect:** a booking without `staffId` failed with a generic invalid-records error; `staff.add` without a role failed; `customer.save` required optional `email`/`notes` keys; missing names/round names produced a generic message.
- **Fix:** default optional fields, treat omitted/null `staffId` as unassigned, apply the staff role default, name required fields in errors.
- **Regression tests:** `platform/tests/command-defaults.test.mjs` (3 tests).

### B4. Next.js advisories

- **Where:** `platform/package.json`; commit `57b0b1a`.
- **Defect:** Next.js 16.4.1 had seven moderate advisories.
- **Fix:** pin 16.4.6 (published 9 November 2026, inside the seven-day release-age policy).
- **Evidence:** production audit clean.

### B5. Critical React Server Components advisory (found in this review)

- **Where:** `platform/package.json`; commit `340f016`.
- **Defect:** `react-server-dom-webpack@19.2.8` is affected by GHSA-xqc2-xf4c-x3h3 (unauthenticated RCE in React Server Components, patched in 19.2.9). It is declared as a devDependency but is bundled into the production Worker; `pnpm audit --prod` therefore did not report it. The built assets contained `19.2.8` and RSC client code.
- **Fix:** pin `react`, `react-dom` and `react-server-dom-webpack` to 19.2.9.
- **Regression test:** `platform/tests/dependency-security.test.mjs` rejects versions below 19.2.9.
- **Evidence:** rebuilt Worker has 0 references to `19.2.8` and 14 to `19.2.9`; `pnpm audit --audit-level critical` has no critical advisory; combined tree has only one moderate dev finding.

### B6. Development toolchain advisories in PR #52 (verified, not merged)

- **Where:** PR #52 `pnpm-workspace.yaml`; commits `07a9865` and others.
- **Fix:** vite 8.1.6, undici 7.30.1, satori 0.33.5.
- **Evidence:** combined tree full audit reduced from 16 findings (1 critical, 5 high) to 1 moderate (`minimatch` in ESLint, dev-only).
- **Status:** open PR, not merged.

No regression was found in #60 or #52 beyond the above. The combined merge resolution was tested: `api.mjs` keeps #52's `permittedMaintenance` and #60's `recovery`; the plan post-check is `!recovery && !(body.action==='staff.active' && data.active===false)`; `saveJob` keeps #60's `staffId` default and #52's active-staff check.

---

## C — Still awaiting external infrastructure, provider testing or human approval

| ID | Item | Exact reason | Corrective action |
| --- | --- | --- | --- |
| C1 | Independent authorised reviewer for issue #56 | No human review has been submitted on #52/#54/#55; an AI review cannot satisfy “independent” or “authorised” | A repository collaborator/maintainer must review the exact heads and record approval or requested changes |
| C2 | Hosted identity, MFA and session policy | Managed Sites headers are trusted by design; standalone Access is deferred/off; no verified live assertion | Verify managed identity overwrites headers; or configure Access, verify a real assertion and document MFA/session/logout |
| C3 | Production D1/R2 and migrations | No production Wrangler config; staging has D1 only and no R2 binding; `health` requires both DB and bucket | Provision production D1/R2, apply migrations 0000–0003, verify `/health`; add a staging R2 bucket |
| C4 | Real Stripe acceptance | Local tests use controlled fakes; issue #57 records a restricted-key Charges Read 403; no independently verifiable hosted event log | Grant minimum scopes (including `charge_read`), configure five prices/portal/webhook, run sandbox checkout/renewal/failure/cancel/refund/dispute, then live approval |
| C5 | Resend customer sending | Live customer invoice sending remains disabled; owned sender verified but new-sender delivery, bounce/complaint and unattended retries are not accepted | Approve customer sending, configure owned sender, test bounce/complaint/retry, schedule the dispatcher |
| C6 | Independent encrypted backup and restore | Only a synthetic SQLite operator drill exists; no scheduled D1/R2 backup, separate key custody or hosted restore | Schedule D1 export + R2 object backup, separate key custody, restore into isolation, record RPO/RTO |
| C7 | Monitoring, alerting and rollback | No 24/7 paging, no automated alerts, no production rollback drill | Add error/payment/email/webhook alerts, on-call ownership and a tested rollback procedure |
| C8 | Legal, DPA, DPIA, ROPA, ICO and VAT | Privacy/terms are prepared drafts; no signed customer order/DPA, DPIA, ROPA or ICO fee decision; VAT status is owner-confirmed only | Qualified UK legal/DPO review, customer order/DPA, DPIA/ROPA, ICO fee assessment, VAT confirmation |
| C9 | Retention and deletion policy | `operations` and `events` grow without time limits; `subscription_accounts`/`subscription_events` survive workspace deletion; legal page admits no fixed schedule | Approve and implement retention (e.g. operations 7 days, events 90 days, billing records per tax/legal need), document deletion/anonymisation |
| C10 | PR #54/#55/#58/#59/#17 | #54 needs real owner OAuth completion; #55 staging is DB-only and blocked on Access; #58 is draft and needs independent review; #59 grants a trial on first legacy checkout (commercial decision); #17 is stale/dirty and superseded | Complete owner OAuth; decide staging Access/R2; review #58; approve/deny #59 trial behaviour; close #17 |
| C11 | Documentation consistency | `platform/docs/SUBSCRIPTION_RELEASE.md` and `launch/SUBSCRIPTIONS.md` still describe a single £19 plan; `STAGING_D1_SETUP.md` says the DB is unmigrated while issue #57 records 0003 applied; legal footer says 28 October while #52 says 4 November | Update operator docs to the five-band catalogue, current migration state and dated notices |
| C12 | Production deployment and rollback | No production deployment has been performed; the staging workflow is a dry-run/safety gate | Approve a production release, deploy, verify, and run a rollback drill |
| C13 | Failed-command rate limiting | Probe: 130 failed commands returned 0 × 429 because only successful commands create `operations` rows; hosting WAF is the only backstop | Add edge/WAF rate limiting or a bounded attempt counter; monitor |
| C14 | Customer invoice payment collection | Invoices are paid manually; no Stripe invoice/payment link, partial credit, refund or accounting integration | Decide commercial scope; if promised, implement and test before advertising |

---

## D — Critical blockers preventing commercial launch

1. **No independent human approval.** Issue #56 is unassigned and no review is submitted on #52/#54/#55. The repository author cannot be the independent approver, and this AI review is not a substitute.
2. **Production identity boundary is unverified.** Managed Sites header trust or a verified Cloudflare Access assertion must be demonstrated against the deployed origin, with manager MFA/session/revocation evidence.
3. **No real payment-provider acceptance for a paid launch.** The code is fail-closed and simulated tests pass, but live/sandbox Checkout, renewal, failed payment, cancellation, refund/dispute, webhook reachability and the Charges Read permission are not independently verified.
4. **No independent hosted backup/restore.** A production D1/R2 export, separate key custody and an isolated restore drill are mandatory before real customer data.
5. **No legal/DPA/privacy approval.** The privacy notice and customer data-processing schedule are prepared drafts, not approved contracts; DPIA/ROPA/ICO/VAT decisions are outstanding.
6. **No production deployment, monitoring or rollback evidence.** A deploy, health verification, alerting and rollback drill have not been performed.
7. **Critical RSC advisory** — fixed in #60 (`340f016`) but not merged. After merge, it is no longer a blocker; before merge, the deployed predecessor still contains 19.2.8.
8. **Staging acceptance environment is incomplete** — no R2 binding, no Access, DB-only packaging. This blocks realistic staging acceptance, though it is not itself a production-runtime blocker.

---

## Issue #56 and #57 item-by-item

### Issue #56 — independent review request

| Original requirement | Evidence examined | Tests performed | Status | Reason / action |
| --- | --- | --- | --- | --- |
| Independently review PR #52 security boundaries, billing fail-closed, backups, dependencies | Full #52 diff, combined merge, 310-test suite, audit | Yes (AI-assisted) | **Unverified as independent approval** | Findings recorded here; a human collaborator must approve the exact head |
| Review PR #54 Codespaces OAuth forwarding | Code and 4 Python tests | 4/4 pass | **Pass (code); external completion pending** | Owner must complete a real browser OAuth/wrangler whoami |
| Review PR #55 compiled staging packaging and D1 binding | Code, 3 tests, staging config | 3/3 pass | **Pass (code); staging blocked** | Add R2/Access, apply migrations, deploy only after review |
| Check secrets and deployment configuration | Secret scan, Wrangler configs, workflows | No committed secrets found | **Pass (repository); hosted secrets unverified** | Verify hosted secret scopes and rotation |
| Record findings/approvals on each PR | This report and PR #60 review material | N/A | **Requested changes recorded** | Human approval still required |

### Issue #57 — pre-release acceptance matrix

| Item | Status | Evidence / reason |
| --- | --- | --- |
| #52 source correction (consistent snapshot, empty-target lock, four regressions) | **Pass on current head** | `workspace-recovery.mjs`, `disaster-recovery.test.mjs`; combined 310/310 |
| New-head server CI 298 tests | **Pass (historical)** | Current #52 CI: 299 platform tests, all 7 checks green |
| Managed candidate patch/hash | **Unverified** | Artifact and SHA not present in the repository |
| Staging D1 migration 0003 and packaging dry-run | **Partially verified** | Migration file and #55 preparer exist; hosted staging state not independently checked |
| Independent reviewer approval #52/#54/#55 | **External approval required** | Issue #56 still unassigned |
| Standalone Access route | **Deferred by owner** | Guard exists and fails closed; Access not configured |
| Complete managed DB/object export and isolated restore | **Unverified** | No hosted backup; synthetic SQLite drill only |
| Charges Read, key expiry, full provider lifecycle | **External/provider** | Local simulated tests; issue #57 records a 403 |
| Hosted invoice email retries/bounce/complaint | **Unverified** | Code and simulated tests; no hosted acceptance |
| Final commercial terms and production release approval | **External/human** | Owner approval required |

---

## PR #60 and #52 — conflicts and safest integration order

Both PRs are individually `MERGEABLE` and green. They both edit `platform/server/api.mjs`, `platform/server/domain.mjs` and `platform/pnpm-lock.yaml`; the second merge conflicts.

**Recommended order: merge #52 first, then rebase #60.**

- #52 is the larger, older change (63 files, ~3,044 insertions, 16 commits). Rebasing it after #60 would require re-reviewing a large diff.
- #60 is small (11 files, 3 commits) and its 11 targeted regression tests directly exercise the combined recovery and command-default semantics.
- The final tree was verified: **310/310 platform tests, TypeScript, production build, production audit clean**, with the combined resolution below.

Resolution if #52 lands first:

- `api.mjs`: keep #52's `permittedMaintenance` (invitation revoke + `staff.active` deactivation) and #60's `recovery` (backup + `backup.restore`); use `!recovery && !(body.action==='staff.active'&&data.active===false)` for the plan post-check.
- `domain.mjs`: keep #60's `staffId` default and `round` default, plus #52's `s.id===staffId && s.active!==false` check.
- `pnpm-lock.yaml`: take either side and run `pnpm install`.

If the critical RSC/Next security patch is urgent, merge #60 first and accept the same resolution while rebasing #52; the final tree and test evidence are identical.

---

## Data protection technical assessment

**Strong controls verified:** server-side role checks; assigned-visit projections; hashed, email-bound invitations; optimistic concurrency and idempotency; encrypted client-side backups; no card data in the app; private R2 photo keys; CSP/no-referrer/no-store; audit events and bounded revision history; no committed secrets.

**Gaps requiring human/legal decisions:** no approved DPA/order; no DPIA/ROPA; no fixed retention schedule; `operations`/`events` unbounded; billing metadata survives workspace deletion; no hosted backup or restore evidence; no tamper-evident audit or admin-access logging; no breach-notification exercise; ICO fee and VAT status unconfirmed. The legal page correctly avoids UK-only storage and promises no immediate erasure of provider copies, but it remains a prepared draft.

**This is not legal advice and does not constitute DPO or ICO approval.**

---

## Smallest remaining action set to reach a safe commercial launch

1. **Human review and merge:** approve #52 and #60 (or #60 then #52) after reviewing the exact heads; close #17; decide #59.
2. **Identity:** verify managed Sites identity header overwrite, or configure Cloudflare Access with a real assertion; document MFA, session expiry and revocation.
3. **Infrastructure:** provision production D1 and R2, apply migrations 0000–0003, verify `/health`; add staging R2 and Access.
4. **Payments:** configure five Stripe prices, portal and webhook; grant `charge_read`; run sandbox checkout, renewal, failure, cancellation, refund/dispute and duplicate-event acceptance; keep live billing off until owner approval.
5. **Email:** approve customer sending; configure the owned sender; test delivery, bounce, complaint and unattended retry.
6. **Recovery:** schedule independent encrypted D1/R2 backups with separate key custody; restore into isolation; record RPO/RTO.
7. **Legal:** obtain qualified UK legal/DPO review, customer order/DPA, DPIA/ROPA, ICO fee and VAT confirmation; update the privacy notice and terms.
8. **Operations:** add monitoring/alerting/on-call, failed-command/WAF rate limiting, retention cleanup and a rollback drill.
9. **Commercial:** finalise pricing/terms/support ownership; obtain explicit owner approval; deploy and verify.

Until items 1–9 are complete, Quenvira should remain an invitation-only fictional-data pilot.

## Limits of this review

- AI-assisted, not independent human certification, legal advice or a DPO opinion.
- No live Stripe charge, customer email, deployment, credential change or production data access.
- Hosted provider behaviour, managed identity, D1/R2 recovery and real email delivery cannot be proven from this repository alone.
- CI success proves the tested commit, not the deployed predecessor or production configuration.
