# Quenvira

Your business, running smoothly.

An interactive fictional-data demonstration for small service teams.

## Run checks

Requires Node.js 22 or newer. No package installation is needed.

```sh
npm test
npm run check
```

Serve `dist/` over HTTP using a static server. JavaScript modules need an HTTP origin rather than a file URL. Modern secure-context browser APIs are used.

## Source

- `dist/app.js`: interface, routing, forms and browser persistence
- `dist/domain.js`: validated customer, scheduling, staff, job and invoice operations
- `dist/style.css`: responsive styles
- `tests/`: domain and interface-module tests

The demo suite contains 59 checks. Interface tests use DOM adapters; they do not replace
real-browser acceptance testing. The separate `platform/` suite has 320 cases, and the
browser workflow exercises 96 Chromium cases across four viewports plus configured
Firefox and WebKit projects.

## Demo boundary

Use fictional data only. The demo stores data in the current browser. Role switching is a demonstration, not authentication. There is no production backend, real payment processing or outbound messaging. Invoice outputs are demonstration drafts.

Private business reports and hosting metadata are excluded from this public source. The private review deployment separately offers the owner report downloads.

## Review walkthrough and release gates

Open `dist/presentation.html` for the mobile-friendly product walkthrough, or
`dist/demo-guide.md` for the complete fictional-data exercise. Test output is
included in `dist/test-results.txt`. See `docs/LAUNCH_GATES.md` for production
architecture and acceptance requirements.

Saved records are validated before rendering. Detected stale-tab edits are
blocked until reload; this is not transactional multi-user concurrency control.
The demo clock is deliberately fixed to 20 October 2026. Browser/real-device
acceptance remains outstanding; automated UI tests run against DOM adapters.

## Server-backed workspace

`platform/` contains the private server-backed release candidate with managed sign-in,
server-enforced business/worker access, transactional records, idempotent writes, staff
invitation/revocation, revision recovery, gated five-band subscription preparation and a
durable invoice-email outbox. It includes 320 platform cases, preserving the original demo
under `platform/public/demo/`; the demo itself remains browser-local and fictional.

Invoice email is test-gated and customer sending is off. Live billing, public
subscription signup and production customer onboarding remain disabled. Hosted identity,
production D1/R2 recovery, independent human review, browser breadth, monitoring and legal
approval remain open. See `platform/README.md`,
`platform/docs/RELEASE_STATUS.md` and
`platform/docs/launch/RELEASE_CANDIDATE_2026-11-28.md` for exact evidence, blockers and
owner decisions. This does not certify a paid launch.

## CCS business contact

Support, business enquiries and privacy notices: [ccscreativetech@gmail.com](mailto:ccscreativetech@gmail.com).

GitHub username and repository names, historical commits and customer identities are unchanged.
