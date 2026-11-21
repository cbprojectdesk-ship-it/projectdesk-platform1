# Independent development review and release handover — 21 November 2026

Reviewer: OpenHands AI agent, working for CCS Creative Technologies.
Base revision reviewed: `47d4eda9a328ec73edaf9da0a28686319c822973` (`main`).
Working branch: `fix/recovery-and-command-defaults-20261121`.
This is a technical review by an AI agent. It is not an independent human
approval, a penetration test, a legal review or an accounting review.

## 1. What this repository actually contains

The repository holds two separate applications and supporting material.

1. **Public fictional-data demonstration** — `dist/`, root `tests/` and
   `wrangler.demo.jsonc`. It runs entirely in the browser with fictional records,
   a fixed demonstration clock (20 October 2026) and no backend, accounts,
   payments or outbound messaging. `wrangler.demo.jsonc` deploys only these static
   assets. Role switching is a demonstration, not authentication.
2. **Server-backed private candidate** — `platform/`. A Next/Vinext application
   on Cloudflare D1 (and optional R2) with managed-host identity headers,
   server-enforced memberships, an aggregate workspace document, revision
   history, an invoice-email outbox and Stripe subscription plumbing. It is not a
   deployed production service and has no production credentials in source.

Neither surface is a complete, hosted, paying-customer product. The hosted
identity provider, production D1/R2 resources, live Stripe account, live email
domain and operational tooling are external dependencies that are not present in
this repository.

## 2. Verified implementation

Verified by reading the source and by the automated suites listed in section 3:

- Tenant model: one workspace per manager, membership rows, manager/staff roles,
  server-side role derivation, staff projections that omit prices, invoices,
  customer email and other staff, and cross-tenant 404s.
- Authentication boundary: managed-host identity headers, invitation tokens that
  are hashed, email-bound, expiring and revocable, immediate membership removal
  on revocation, and a fail-closed standalone identity guard.
- Data integrity: optimistic revision checks, idempotent request replay, 120
  commands/user/workspace/minute, 16 KiB command bodies, 512 KiB workspace cap,
  bounded 20-revision history, database-failure rollback, audit/event rows.
- Customers and staff: validated records, archive for customers, capacity and
  working-hours rules, availability, approved leave, staff photos and job photos.
- Scheduling: one-off and finite recurring series (weekly, fortnightly,
  four-weekly, 1–12 visits), overlap detection, daily capacity, availability and
  leave checks, pause/resume/edit/cancel future visits with atomic validation.
- Visits: start, checklist ticks, guarded completion, notes, before/after photos.
- Money: GBP integer pence, supplier profile, VAT 0/20%, invoice issue snapshots,
  full credit notes, manual payment recording, exact totals, immutable issued
  records.
- Quotes: itemised draft, issue, accept/decline, conversion to a booking.
- Recovery: revision restore, encrypted on-device business backup, import into an
  empty workspace, photo integrity checks, operator recovery script.
- Subscriptions: 14-day card-free trial, Solo/Team bands, server-side plan and
  seat limits, Stripe Checkout/portal/webhook code that is disabled by default and
  fails closed without approved live flags, idempotent customer and checkout keys.
- Email: Resend outbox with leases, retries, idempotency keys, test allowlist,
  bounce/complaint suppression and signed delivery webhooks. Live customer email
  is disabled by default.
- Website enquiries: isolated CCS contact form with origin allowlist, quota,
  idempotency and no raw content persistence.
- Readiness: public health route that checks schema and storage without reading
  business rows.

Staff deactivation and reactivation are implemented in open PR #52, not on `main`.
Until that PR is reviewed and merged, a departed staff record cannot be
deactivated; access can still be revoked through the invitation controls.

## 3. Test evidence from this review

Environment: Node 24.22.2, Linux container, fictional fixtures only.

| Suite | Result |
| --- | --- |
| Root demonstration (`npm test` at repository root) | 59 passed, 0 failed |
| Platform server (`npm test` in `platform/`) | 285 passed, 0 failed (275 baseline + 10 new) |
| Platform syntax (`npm run check`) | passed |
| ESLint (`npm run lint`) | 0 errors, 16 pre-existing warnings |
| TypeScript (`tsc --noEmit`) | passed |
| Production build (`npm run build`) | passed |
| Production dependency audit (`pnpm audit --prod --audit-level high`) | no known vulnerabilities |
| Browser acceptance, Chromium desktop 1440 px | 23 passed |
| Browser acceptance, Chromium 360/390/768 px | 69 passed |

Firefox and WebKit browser projects were not run in this container because the
host libraries required by those Playwright browsers are not installed. CI runs
all six projects. No physical-device, screen-reader, hosted-identity or hosted-D1
acceptance was performed here.

Note on first run: the platform suite initially failed only because `stripe` and
`svix` were not installed in the review container. After
`pnpm install --frozen-lockfile` the suite passed. This was an environment gap,
not a product defect.

## 4. Defects found and fixed on this branch

### 4.1 A recorded payment could be erased by revision restore

`assertFinancialRestore` protected only invoices with an issue snapshot. A draft
invoice can be marked paid (the pilot allows recording money received elsewhere),
but that payment had no `issue` snapshot, so restoring an earlier revision
silently deleted the invoice and its payment. The repository documentation states
that recovery must not remove or alter a payment.

Reproduction: complete a visit, create a draft invoice, mark it paid, then restore
a revision made before the invoice. Before the fix the restore succeeded and the
paid invoice disappeared.

Fix: protect any invoice that is issued, credited, paid, or carries a payment
date. A restore that keeps the payment unchanged is still allowed.

### 4.2 Recovery was blocked when billing lapsed or the provider was unavailable

The documented behaviour is that viewing, exports, access revocation and recovery
remain available after an expired trial or subscription, and during a payment
provider outage. Only the import endpoint was treated as recovery. Revision
restore returned 402 after trial expiry and 409 when the plan check ran, and it
returned 503 during a provider outage because it called the provider.

Fix: both import and revision restore are treated as recovery maintenance. They
skip the routine entitlement and plan-fit checks, remain manager-only, and are
still audited and revision-checked. Routine writes still fail closed.

### 4.3 Command API rejected omitted optional fields with generic errors

- A booking without a `staffId` key failed with “Operation would create invalid
  records.” instead of creating an unassigned visit. Only an explicit empty
  string worked.
- `staff.add` without a role failed although the code intended to default to
  “Cleaning specialist”; the default was unreachable.
- `customer.save` required `email` and `notes` keys even though both are optional.
- Missing names and round names produced “Text is too long or invalid.” instead
  of the specific required-field message.

Fix: optional fields default to empty, an omitted or null staff assignment means
unassigned, the staff role default works, and required-field errors name the
field. The user interface already sent every field, so this is an API robustness
and validation-quality fix rather than a visible UI change.

### 4.4 Production dependency advisories

Seven moderate Next.js advisories affected the pinned 16.4.1. All are fixed in
16.4.5 and later. The branch pins Next 16.4.6 (published 9 November 2026, inside
the repository's seven-day release-age policy). The production audit is now clean.
The affected features (`use cache`, image optimisation, self-hosted response
forwarding) are not used by this application, so the practical exposure was low,
but the upgrade removes the advisories.

## 5. Security findings and open risks

- **Managed identity trust.** Production safety depends on the managed host
  stripping caller-supplied `oai-authenticated-user-id` and
  `oai-authenticated-user-email` headers and keeping the Worker origin private.
  Tests simulate the headers; they cannot prove the hosted boundary.
- **Standalone Cloudflare path.** It is deliberately not deployed. The guard
  rejects requests without a verified principal and strips identity headers.
  Cloudflare Access verification exists but is not configured (owner budget
  decision). `/api/quenvira/subscription-webhook/live`, `/email-webhook`,
  `/website-enquiry` and `/health` are not exempted by the standalone guard, so
  they would be unavailable on a standalone deployment.
- **Staging storage binding.** `platform/wrangler.staging.jsonc` declares D1 but
  no R2 binding. On that configuration the health route returns 503 and photos,
  encrypted backups and enquiries fail. A bucket binding must be added and
  verified before staging acceptance. This review did not provision one.
- **MCP endpoint.** `/mcp` requires manager membership and accepts no arguments,
  but it does not check `Origin`. It relies on the managed identity boundary. A
  same-origin check for browser callers would be prudent.
- **Invoice email.** Live customer email requires two independent approval flags
  and a configured sender; test mode is restricted to an owner allowlist. No
  customer email was sent.
- **Limits.** 512 KiB per workspace aggregate, 20 MB backups, four job photos per
  visit, 30 checklist items, finite recurrence. These are deliberate pilot limits
  and will constrain larger businesses.
- **No monitoring, alerting, incident ownership or rollback drill is configured**
  in this repository. The health route is a readiness probe, not monitoring.
- **No independent backup.** Revision history shares the same D1 failure domain;
  the encrypted file backup is manual. Independent encrypted backup and a timed
  restore exercise remain open.
- **Delegated authentication.** There is no product-managed password, MFA or
  session lifetime; these depend on the managed host. Invitation and membership
  revocation are the product-level controls.
- No secrets, production credentials or customer records were found in source.
  No credentials or infrastructure were changed by this review.

## 6. Remaining functional gaps and defects

- Staff deactivation/reactivation is in open PR #52 and still needs review.
- Recurrence is a finite batch (maximum 12 visits). There is no unattended
  generation, no skip-one-occurrence action, and no separate “this and future”
  time-series generation.
- Invoicing supports GBP, one visit per invoice line, 0/20% VAT and full credits
  only. Partial credits, paid-invoice refunds, PDF attachments, reminders and
  accounting reconciliation are not implemented.
- A draft invoice can be recorded as paid (pilot behaviour). It is now protected
  from restore, but it is not a valid tax invoice unless issued first.
- No online customer payment, customer portal, SMS, push notifications or
  calendar sync.
- The demo copy under `platform/public/demo/` has drifted from the root `dist/`
  demo (for example, an older invoice-email helper). This is a marketing surface
  issue, not a server security issue, but the two copies should be reconciled or
  one should become the single source.
- Landing-page copy is conservative and does not advertise the sandbox billing
  and email capabilities that exist in the platform candidate.
- Accessibility and responsive behaviour are covered by automated Chromium
  projects only; no physical-device or assistive-technology review was done.

## 7. Missing production integrations and external dependencies

- Managed host sign-in dispatch, origin privacy and hosted identity acceptance.
- Production D1 database, migrations applied and verified, plus an R2 bucket.
- Stripe live account, approved prices, portal configuration, webhook endpoint,
  tax configuration and live restricted key.
- Resend live sending domain, verified sender, webhook secret and delivery
  monitoring.
- Monitoring, alerting, log retention, incident ownership and a rollback drill.
- Independent encrypted backup storage and a timed restore exercise.
- Approved subscription terms, privacy notice, data-processing schedule,
  retention/deletion policy and controller/processor contracts.
- Business support ownership and response targets.

## 8. Commercial decisions still owned by CCS

- Approve the plan catalogue and prices: Solo £7.99, Team 5 £14.99, Team 10
  £24.99, Team 15 £32.99, Team 20 £39.99 per month (verified sandbox catalogue).
- Approve the terms versions used by checkout and workspace acceptance.
- Decide whether to sell compliant tax invoices, and obtain supplier/VAT and
  accounting review before doing so.
- Decide refunds, partial credits, trial length and staff-seat policy.
- Keep `QUENVIRA_PAID_LAUNCH_APPROVED`, `QUENVIRA_PLAN_TERMS_APPROVED` and
  `QUENVIRA_CUSTOMER_INVOICES_APPROVED` unset until those decisions and the
  operational gates are complete.

## 9. Pull requests and review state

- This branch: recovery integrity, recovery availability, command defaults and
  the Next.js security patch, with ten new regression tests.
- PR #52 (`quenvira-final-verification-20261030`, open, green): staff lifecycle,
  active-person plan limits, Stripe diagnostics, dependency patches and recovery
  snapshot fixes. Recommended for review and merge after this branch, because it
  also touches `api.mjs`, `domain.mjs`, `plans.mjs` and `subscriptions.mjs`.
- PR #54, #55, #58 and #59 are open or draft deployment/acceptance work. PR #17 is
  an older staff-photo branch. None were merged, deployed or activated here.
- Issues #56 (independent review request) and #57 (acceptance evidence matrix)
  remain open. This review does not satisfy the independent human approval that
  #56 requests.

## 10. Verdict

**Not ready for real paying customers.** The server candidate is a credible,
well-tested private pilot for fictional records: tenant isolation, permissions,
scheduling conflicts, invoice arithmetic, trial gating and recovery all have
automated coverage, and the production dependency audit is clean. It is **not** a
production service because hosted identity, production D1/R2, live Stripe, live
email, independent backup, monitoring, legal documents and human acceptance are
not verified, and the staging configuration is missing its R2 binding.

Safe next step: continue the invitation-only fictional-data pilot, review and
merge #52, close the storage binding and hosted-acceptance gates, then run a
consented pilot before enabling any live payment or customer email.

## 11. Commands used

```sh
# Root demonstration
npm test

# Platform
cd platform
pnpm install --frozen-lockfile
npm test
npm run check
npm run lint
node node_modules/typescript/bin/tsc --noEmit
npm run build
pnpm audit --prod --audit-level high

# Browser acceptance (Chromium projects only in this container)
cd ../browser-tests
npm ci
npx playwright install chromium
GITHUB_ACTIONS=true QUENVIRA_E2E=1 npx playwright test --project=chromium-desktop
GITHUB_ACTIONS=true QUENVIRA_E2E=1 npx playwright test --project=chromium-small-mobile --project=chromium-mobile --project=chromium-tablet
```
