# Staging package verification — 31 October 2026

## Verified evidence

Owner Codespace screenshots on 30 October establish Wrangler authentication, the expected account's existing `quenvira-staging` D1 identity (`a91be5bb-6565-473e-98c2-40e83bc0e2d5`), existing business/subscription tables, and successful addition of migration `drizzle/0003_invoice_outbox.sql` after its SHA-256 matched the reviewed repository file. A follow-up read confirms `invoice_outbox`, `invoice_email_events` and `invoice_outbox_pending`. No other migration was applied in this work. This is schema evidence, not complete integrity or restore proof.

The deployment-history request returned Worker-not-found (10007) for `quenvira-staging` in the selected account. No new Worker was created. A dry run of the source-entry staging config failed on `virtual:vinext-worker-entry`; a dry run using generated `dist/server/wrangler.json` finished with exit status zero and showed the `site-creator-d1` placeholder. Thus the compiled package works, but that generated development configuration must not be deployed as staging.

## Safe local procedure

After obtaining this reviewed source, from `platform`:

```sh
pnpm build
pnpm staging:check
```

`staging:check` prepares `dist/server/wrangler.staging.json` and invokes Wrangler with `--dry-run`. It never deploys, migrates a database, installs secrets or sends email. The output lives alongside the generated config so `index.js` and `../client` keep their correct relative paths. The original generated config is unchanged. The preparation command deliberately accepts the currently plain-JSON staging source; future JSONC comments require a reviewed parser change.

The preparer validates the reviewed staging identity and uses compiled entry/module rules/assets. It rejects unexpected service/storage/background bindings instead of silently dropping them. It does not copy managed/development vars, routes, account selection or scheduled triggers. Output forces standalone identity, billing/email test mode, self-service disabled, paid approval false, no public routes, workers.dev disabled and preview URLs disabled. `assets.run_worker_first=true` keeps static requests behind the Worker authentication guard. Cloudflare documents this setting for authentication before asset serving: https://developers.cloudflare.com/workers/static-assets/routing/worker-script/ .

The checked-in `wrangler.staging.jsonc` remains the database/settings source for D1 commands, not a directly deployable source-entry Worker. Existing deployment workflow and preflight gates are unchanged. No production source, credentials, data or audience changes are included.

## Remaining deployment blockers

- Independently verify the existing Cloudflare Access application, team domain, audience, access policy and intended staging route. None are invented or provisioned by this script. Missing Access settings continue to fail closed in the standalone handler.
- Review whether standalone Access principals map to the intended isolated test workspace. Do not reuse managed identity mappings or live records implicitly.
- Verify complete schema/migration state and an appropriate recovery path; the email table migration alone does not prove these.
- Reconcile with PR 52 release hardening before release. This branch starts from current main and does not replace or duplicate those application changes.
- Verify isolated sandbox secrets, signed provider webhook delivery, billing lifecycle/entitlements, hosted email recovery and independent release review. Current managed pilot stays unchanged.

No deploy command without `--dry-run` is authorised by successful packaging. No live billing/customer email activation or account upgrade is performed. Owner's encrypted business backup remains deferred.
