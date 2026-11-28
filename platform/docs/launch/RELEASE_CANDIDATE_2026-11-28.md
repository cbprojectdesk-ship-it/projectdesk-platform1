# Quenvira release candidate — 28 November 2026

Status: **engineering release candidate for private staging and local acceptance. NO-GO for
commercial launch.** This is an AI-assisted verification record, not independent human
review, legal advice, a data-protection opinion or hosted production acceptance.

## Revision and scope

- Repository: `cbprojectdesk-ship-it/projectdesk-platform1`
- Branch: `feature/quenvira-launch-preparation-2026-11-22`
- Reviewed code head: `0fda90599177bce44bc05df6a538d21eec64e674`
- Previous verified head: `8f198ad5014cf3a763892fac0ae5e8f9fe7a7e7e`
- Base integration tree: `526f0cfa22f86a371db5cd658311207815bc2a31`
  (`origin/integration/pr52-pr60-verified-20261121`)

The branch integrates the verified PR #52/#60 tree, the dependency/RSC advisory work
represented in the lockfile, and the 22 November launch hardening. PRs #52, #60 and #61
remain separate open records; this branch is the consolidated candidate for review.

## Independent findings on the previous changes

1. **MCP browser origin check was missing.** `emailMcp()` accepted `tools/list` and then
   returned `401` only at `tools/call`, so a cross-origin browser page could discover the
   tool catalogue. It now rejects an external `Origin` and `sec-fetch-site: cross-site`
   before reading identity or queue state. Regression tests cover both signals.
2. **Workspace setup used a stale terms date.** The setup form always displayed
   28 October 2026 and submitted a fixed default. It now takes the configured
   `termsVersion`/`termsUrl` from the authenticated session and uses the matching date.
   The session endpoint is covered by a new regression test.
3. **Some non-static responses lacked an HTML CSP.** Static assets receive the
   `public/_headers` policy, but the app-rendered 404 page did not. The built Worker now
   applies the baseline header wrapper and a static HTML CSP to non-static responses.
   Vinext's static-asset hand-off (`x-vinext-static-file`) is deliberately not wrapped,
   because that response has no body and wrapping it would hide the asset. The local
   built Worker returned the actual workspace HTML with its CSP and a 404 page with a CSP.
4. **The email outbox was reviewed against the reported delivery cases.** Atomic lease
   claiming, concurrent claims, expired-lease recovery, stable provider idempotency and
   payload, the 23-hour retry boundary, local acknowledgement failure, retained outbox
   records, suppression and webhook ordering are implemented and covered by the existing
   suite. No new delivery defect was found in this review. No outbound message was sent;
   provider calls in the suite are sandboxed fakes.

## Verification run on this working tree

Run from `platform/` unless noted.

| Check | Result |
|---|---|
| Platform suite (`npm test`) | **320 passed, 0 failed, 0 skipped** |
| Root demonstration suite (`npm test` at repository root) | **59 passed, 0 failed** |
| Syntax (`npm run check`) | passed |
| ESLint (`npx eslint . --ignore-pattern dist --ignore-pattern .next`) | passed |
| TypeScript (`tsc --noEmit`) | passed |
| Migration verification (`npm run db:verify`) | 5 migrations, 11 required tables, foreign-key check OK, quick check OK |
| Production build (`npm run build`) | passed |
| Production dependency audit (`pnpm audit --prod --audit-level high`) | no known vulnerabilities |
| Full dependency audit (`pnpm audit --audit-level critical`) | 1 moderate development-only `minimatch` advisory; no high or critical |
| Chromium browser acceptance | **96 passed** — 1440, 360, 390 and 768 widths; five real client/API/SQLite scenarios per viewport |

The browser run used real Chromium against the source client, server handlers and
disposable SQLite databases with simulated managed identity. It is not hosted sign-in,
real-device, screen-reader, Firefox or WebKit acceptance. The repository's six-project CI
workflow is configured to cover Firefox and WebKit when a pull request runs.

### Built Worker header probe

The local built Vinext Worker was probed on its actual response boundary:

- `/` returned `200` with a nonce CSP; all 37 scripts carried the same nonce and there was no inline style block.
- `/workspace` and other static HTML returned the strict `_headers` CSP.
- `/workspace.html` returned a `307` with baseline headers and CSP.
- A missing route returned `404` with a static HTML CSP and baseline headers; the
  workspace HTML body was still served intact through the static hand-off.
- `/api/quenvira/session` without identity returned `401` with baseline security headers.
- `/mcp` with an external `Origin` returned `403`; the same-origin catalogue returned
  `200`; an anonymous `tools/call` returned `401`.

This evidence is from a local Worker with placeholder/no production bindings. It does not
prove the hosted edge, managed identity stripping, D1/R2 bindings or production headers.

## Approved commercial rules and unresolved decisions

The only approved catalogue in the repository is the five-band monthly sandbox catalogue:
Solo £7.99, Team 5 £14.99, Team 10 £24.99, Team 15 £32.99 and Team 20 £39.99, with people
including the owner. The earlier discussion of a higher "Pro/Enterprise" band around £60
is **not an approved price**, is not implemented and must not be published or charged
until the owner records a decision and the catalogue, terms, Stripe prices and tests are
updated.

Still requiring an owner decision:

- exact geographical areas, jurisdiction availability and the founding allocation;
- reservation timing, expiry, business uniqueness and treatment of existing rights;
- Southport introductory-offer interaction and overflow allocations;
- referral reward application, reversal and accumulated rewards;
- cancellation timing, payment grace, refunds, disputes and package changes;
- badge licensing, unresolved-mail retention and any Pro/Enterprise catalogue;
- customer/controller/provider particulars, DPA/DPIA/ROPA, VAT and privacy review.

## Remaining release blockers

1. **Hosted identity boundary.** The managed host must strip caller identity headers,
   inject a verified identity and keep the Worker origin private, or the standalone
   Cloudflare Access path must be verified. Local tests cannot prove this.
2. **Independent human review.** Issue #56 and normal branch protection still require an
   authorised reviewer. This record is not a substitute.
3. **Hosted D1/R2 and recovery.** Provision reviewed bindings, apply only reviewed
   migrations, take a complete consistent export and restore it into an isolated target.
   The local SQLite/encrypted-backup rehearsals do not prove infrastructure recovery.
4. **Stripe.** Test-mode prices, portal, webhook and the full lifecycle matrix require
   authorised sandbox access. Live billing stays disabled.
5. **Resend.** Customer sending stays disabled. Approved-recipient delivery, bounce,
   complaint, retry and suppression require hosted evidence.
6. **Monitoring and incident response.** No paging destination, on-call owner or tested
   production rollback drill exists.
7. **Legal and commercial approval.** Signed terms/order, DPA, privacy/retention decisions
   and owner acceptance remain outstanding.
8. **Browser breadth.** This local run used Chromium only. Firefox, WebKit, physical-device
   and assistive-technology acceptance remain separate gates.

## GO/NO-GO

- **Local engineering candidate: GO** for isolated review and private staging preparation.
- **Hosted preview or real-user acceptance: NO-GO** until the secure-access, identity,
  provider and independent-review evidence is available.
- **Commercial launch, live billing, customer email or public production deployment:
  NO-GO.** No deployment, production migration, Stripe activation, customer message,
  DNS, secret, schedule or public-indexing change was made by this verification.
