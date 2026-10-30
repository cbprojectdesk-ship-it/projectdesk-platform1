# Quenvira technical review — 30 October 2026

Commercial status: NOT ready for paid launch. Additional expenditure: £0.
Live billing, customer email, existing data and all staging/security gates preserved.

## Current evidence

- GitHub main: `47d4eda9a328ec73edaf9da0a28686319c822973`, protected; latest push checks for Quenvira checks, Quality checks, platform release checks and Server workspace checks all returned success. Recent public monitor runs succeeded. This does not verify the uncommitted state of the owner's Codespace.
- Existing Quenvira Site: `appgprj_6ad73314ff388191bbe5bf342922102e`, active, public audience preserved, latest saved version 57. Authenticated source access was reused securely; current source checkout HEAD `9738e6ce02eb68c3d3795e08617c332be8683d24`. No source push or application deployment performed by this review.
- Current hosted source: all 267 application tests passed, no skips/failures; JavaScript syntax passed; TypeScript with incremental disabled passed; production build passed. This is separate from the owner's reported 59 Codespaces tests.
- Hosted GET `/api/quenvira/health` returned `{"status":"ok"}` in the browser. Its implementation validates six D1 table projections with LIMIT 0, checks R2 access and validates billing configuration. No business records were fetched by that check. The managed manifest retains D1 `DB`, R2 `BUCKET` and MCP. This does not inspect the standalone staging database.
- Runtime revision 15: billing=test, email=test, self-service=no; verified-domain sender configured. Existing masked secrets remain in host storage. No new catalogue activation values or paid-launch approval were set.
- Connected email retry status: test, dueBefore=0, review=0, processed=0, blocked=0. No send operation performed. Real provider failure/recovery and missed-run acceptance remain unverified.
- Sandbox Stripe endpoint `we_1UTURsJMLR8T7SStOdaAii8p` is enabled, livemode=false, points to the existing hosted subscription webhook, and subscribes to 11 checkout/subscription/invoice/dispute/refund/fraud events. Portal configuration `bpc_1UT9sgJMLR8T7SStvLOSiTss` remains active; payment-method update, invoice history and period-end cancellation enabled; plan switching disabled.
- Reviewed webhook code verifies raw-body signatures with a 300-second tolerance, rejects wrong mode, bounds body size, deduplicates mapped events and queries current Stripe state. Paid entitlement checks require settled invoices and no outstanding open invoices; provider acceptance of every transition is still a release gate.

## Confirmed blockers

1. **Wrangler authentication**: this Work environment's Wrangler 4.92.0 reports unauthenticated. The browser has no reusable Cloudflare login. Codespaces is a separate machine; neither its running terminal nor its private port is attached here. A masked Sites credential cannot be extracted or reused as a general Cloudflare API credential. Do not copy host secrets into Codespaces.
2. **Stripe restricted-key permissions**: returned 24-hour hosted logs include subscription HTTP 503 at 2026-10-30 00:39:10.767 UTC, with StripePermissionError HTTP 403, provider request `req_z2hUDr5yxdXDqv`. Worker outcome was ok, so this was a handled provider failure. This review cannot determine the precise missing permission from that redacted log. Inspect that request in the existing sandbox Dashboard and grant only the required permission after approval; do not replace with an unrestricted key. Retest hosted subscription access and writes afterwards.
3. **Standalone staging safety**: staging D1 ID `a91be5bb-6565-473e-98c2-40e83bc0e2d5` is declared in main, not remotely verified this session. Configuration keeps workers_dev=false, standalone hosting, test billing and paid-launch=false. Access team domain/audience are absent; self-service is not explicitly declared in this staging file. Remote migrations, actual Worker binding, Access policy and production standalone build output remain unverified.
4. **Deployment workflow**: manual staging workflow still requires `feat/quenvira-cloudflare-access-verifier` and ends with an explicit non-deployment safety gate. Main cannot pass that branch assertion. Keep this gate intact until a reviewed replacement identifies the accepted release ref and all required Access/storage/build evidence exists. Wrangler login alone is not authority to deploy.
5. **Commercial acceptance**: five-band catalogue is staged but inactive on the owner pilot. Isolated checkout, portal tier changes, capacity/proration/downgrade, failed renewal and recovery, tenant access transitions, two-account isolation and email-provider recovery remain required. Preserve completed renewal evidence; do not create duplicate clocks/customers/infrastructure. Final operator/provider/terms particulars and separate explicit paid activation are still required. Encrypted owner backup remains deferred.

## Private Android/Codespaces callback procedure

The supplied Python helper is based on the installed Wrangler 4.92.0 callback implementation, which uses a 120-second OAuth timeout, validates its state and performs the code exchange itself. The helper does not implement OAuth or access token storage. It delivers only the exact local callback request to Wrangler on the SAME Codespace, without a proxy or redirect following. Never paste callback URLs into chat, issues, commits or command arguments.

The helper has four focused tests: exact callback/state preservation; rejection of foreign/malformed targets; loopback-only delivery without URL output; and rejection of non-interactive input. No real OAuth completion is claimed until Wrangler confirms success and whoami succeeds.

1. In Codespaces, obtain the reviewed helper from this branch without switching your working branch or overwriting application files:

   ```bash
   cd /workspaces/projectdesk-platform1
   git fetch origin fix/codespaces-private-oauth-handoff
   git show origin/fix/codespaces-private-oauth-handoff:scripts/wrangler_callback.py > /tmp/quenvira-wrangler-callback.py
   ```

2. Open a second terminal in that SAME Codespace and start the hidden prompt before beginning browser authorisation:

   ```bash
   python3 /tmp/quenvira-wrangler-callback.py
   ```

3. In terminal 1, stop the expired login with Ctrl+C, then run:

   ```bash
   cd /workspaces/projectdesk-platform1/platform
   pnpm exec wrangler login --browser=false
   ```

4. Open the new authorisation link yourself and approve the existing intended Cloudflare account. When Android fails at `http://localhost:8976/oauth/callback?...`, copy that complete address directly into terminal 2's hidden prompt and press Enter, within Wrangler's two-minute window. It must come from the current attempt. Keep port 8976 PRIVATE; no public forwarding is needed. If sign-in takes too long, start a fresh attempt rather than reusing an expired callback.
5. Terminal 1 must confirm successful authentication. Then run `pnpm exec wrangler whoami` from platform. Callback acknowledgement by the helper alone is not proof. Share only whether it succeeded; never share the callback URL, tokens or credentials. Confirm the expected account locally before any remote operation.

If callback transfer is impractical, use secure Cloudflare Dashboard sign-in in Work for supported account inspection, or configure a deliberately scoped token in Codespaces secret storage after reviewing necessary account/resources/permissions. Do not create a token, widen access or put credentials in chat to bypass this blocker.

## Exact owner actions

- Complete one secure Cloudflare authentication route. The private callback procedure above completes Codespaces OAuth; Work Dashboard sign-in is a separate session and will not log in Wrangler in Codespaces.
- Allow inspection of the existing sandbox Stripe request error; approve any specific restricted-key permission change only after its missing operation is identified.
- Supply/confirm outstanding commercial particulars if not already evidenced. Approve live billing separately only after remaining technical acceptance passes. Complete the encrypted backup separately as requested.

No purchase, account creation, infrastructure creation, live charge, customer email, database migration, security-control removal or production deployment occurred in this review.
