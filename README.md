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

The suite contains 56 checks. Interface tests use DOM adapters; they do not replace real-browser acceptance testing.

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
