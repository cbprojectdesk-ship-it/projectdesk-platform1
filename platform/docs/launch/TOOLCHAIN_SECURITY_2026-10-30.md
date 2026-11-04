# Verified toolchain security refresh — 30 October 2026

Network access through the normal approval-controlled execution path enabled a fresh registry advisory check. No proxy, credential, TLS or network-policy settings were changed.

## Findings and correction

The production-only platform audit returned zero known advisories. The full platform audit identified fourteen advisories in development/build dependencies: five high, eight moderate and one low, with none critical. Affected paths were Vite's development server/editor integration, Undici through Miniflare/Wrangler, and Satori through Vinext's Open Graph renderer. Dependency classification alone does not prove that a library is absent from a deployed artifact, and no hosted exploit assessment is claimed.

Updated Vite from 8.0.16 to 8.1.6, the existing Undici override from 7.29.1 to 7.30.1, and added Satori 0.33.5 as a targeted transitive override. The registry's patched ranges require these versions or later. Their publication ages exceeded seven days. The existing minimum-release-age guard, trust checks and allowed-build policy were preserved without a new exception. The lockfile was regenerated normally; no force fix, runtime billing change or provider configuration change was made.

## Executed validation

- Locked installation passed the existing supply-chain policy and frozen-lockfile checks using pnpm 11.25.0.
- `pnpm audit --json` after the patches: exit 0, zero known advisories across the complete 775-dependency graph, including development and optional dependencies.
- Browser-test `npm audit --json --package-lock-only`: exit 0, zero known advisories.
- Platform suite: 293 tests passed, zero failed/skipped. This includes the new exact-UTF-8 offline backup CLI regression.
- Lint: exit 0, no warnings/errors. TypeScript and syntax checks: exit 0.
- Production build: successful using Vite 8.1.6.
- Synthetic Vinext/Open Graph compatibility smoke: valid PNG, 6,611 bytes, no production data. The initial smoke harness used an unexported package subpath; its corrected installed-path lookup passed. This was a harness correction, not an application defect.
- Changed-file credential-pattern checks and diff whitespace checks passed. The synthetic test password is not a real credential.

These results apply to the reviewed source and lockfiles, not an unchanged hosted deployment. Registry audits cover known published advisories at the time of the check; they do not certify absence of all vulnerabilities. Current-head GitHub CI is recorded on the existing pull request. Independent review, supported hosted source/browser tooling, private Stripe diagnostics, real independent-account/email acceptance, complete hosted export/recovery and the owner's actual encrypted backup remain separate gates.
