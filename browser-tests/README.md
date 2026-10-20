# Free browser acceptance

GitHub Actions runs Playwright against the real secure workspace HTML, JavaScript,
styles, API handlers, domain logic and disposable SQLite databases. Five scenarios
run in five projects: Chromium/Firefox/WebKit desktop, Chromium 390px mobile and
Chromium 768px tablet. These are browser engines on Linux, not physical devices or
installed Safari/Android Chrome acceptance.

Coverage: customer/staff forms; bookings, overlap rejection and recurring controls;
checklist/completion guards; exact VAT and manual payment; invoice/download export;
offline retry, stale tabs, persistence, recovery history, worker projection and
cross-tenant rejection; keyboard skip link, navigation and page overflow.

The CI fixture server binds only to 127.0.0.1, requires GitHub Actions and an explicit
test environment flag, serves the application source unchanged and simulates the
hosting identity boundary using fictional accounts. It is outside `platform/`,
is not deployed and must never be used as a real application server. Each test
has a fresh session and database. Browser requests to external domains are blocked.
No real credentials, customer records or hosted workspace are used.

The workflow runs only while repository visibility is public, uses standard
`ubuntu-latest` runners, uploads no artifacts and disables screenshots, traces and
videos. Reports appear in logs and the GitHub job summary. No paid browser service
or subscription is used. Playwright is pinned in a separate lockfile; application
production dependencies are unchanged.

Live managed sign-in, logout, invitations with two real accounts, production D1,
independent encrypted backup restoration, physical-device/accessibility review and
legal/commercial readiness remain separate gates. A green browser job does not
establish these. This workflow does not exercise the built Vinext/Worker bundle;
the existing server workflow separately builds and checks that bundle.

Run: open **Actions → Free browser acceptance**, inspect the latest source run and
its job summary. The initial run may discover either app defects or test-harness
issues; preserve failing evidence and rerun only after a concrete repair.
