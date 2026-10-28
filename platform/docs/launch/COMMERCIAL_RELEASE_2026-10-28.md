# Quenvira commercial release candidate — 28 October 2026

## Completed evidence

The site is online, but commercial activation remains deliberately off. Current runtime revision 13 has billing=test, email=test and public self-service=no. The existing live Stripe subscription webhook is disabled. Existing staged live price price_1UUA4hQtn278HgtTHyoRbR2g is GBP 1900, licensed monthly, interval_count=1, tax_behavior=inclusive. No price, charge, bank, subscription or provider contract was changed in this review.

Website version 16 and app version 49 were previously published. PR 43 merged as 278d35f66cc6fa2b749687fcd30dcd321f3d47e2 after all checks including browser acceptance passed. New commercial-document changes are described below; retain their exact final source/version from deployment results.

The approved owner-only zero-value test produced QV-1006. Gmail search independently returned message 1a182a686f727c8e received 28 October 13:15:12 UTC, From invoices@mail.ccscreativetech.co.uk, To ccscreativetech@gmail.com, subject explicitly test/no payment due. This verifies receipt from the owned sender. A later full-message/header read encountered Gmail's project quota limit; do not claim new SPF/DKIM/DMARC inspection from that failed read. Do not resend QV-1005 or QV-1006 to obtain evidence.

Linked test-only hourly retry task Automation_3037cd4d828481919cf0111ccf8bd118 exists and is enabled. Its 13:15 UTC execution completed and reported an empty healthy test queue; the connected bounded processor was also successfully exercised on an empty queue. This proves a cloud invocation and connected-tool access, not an observed real provider failure/retry. The prompt stops outside test mode and cannot create invoices or enable customer sending. Durable missed-run, provider-retry, bounce/complaint, lease, entitlement and duplicate-send behaviour has local automated coverage; actual hosted failure/recovery acceptance remains distinct.

## Commercial-document correction

Previously every issued document was labelled private test, including in a hypothetical commercial release. Issuance now snapshots commercial mode only from validated live server configuration; command data cannot choose it. Old snapshots without a mode remain test. Text/email, preview and print use the frozen snapshot. Test and live email queues reject mismatched documents, and dispatch rechecks the snapshot before provider contact. No old financial snapshot or existing QA business record is rewritten. Test mode and public fictional demonstrations retain their warnings. Commercial workspace notices are conditional on the validated server response and do not turn on billing.

Fresh local suite: 232 passing tests, syntax checks, TypeScript and production build. Four new regressions cover legacy test safety, live document output/mode separation forged client modes and mode-stable client previews. The existing copied demo helper stays identical. Hosted/browser/GitHub verification for this candidate must be recorded after publication; a passing local suite is not a new second-person device test.

## Contract and provider preparation

CUSTOMER_ORDER_TEMPLATE.md is ready to complete for the first business and incorporates the existing £19/month, no-VAT, card-free trial, cancellation, support and processing scope. It is unsigned. Customer identity and instructions are ordinary per-customer onboarding particulars, not invented facts. Current draft subscription terms are still labelled draft/testing; final commercial wording/version must be approved and retained before live checkout accepts it.

Official provider sources rechecked: OpenAI Sites DPA (https://openai.com/policies/chatgpt-sites-data-processing-addendum/), current subprocessor list (https://openai.com/policies/sub-processor-list/), Resend DPA (https://resend.com/legal/dpa), and Resend GDPR/storage disclosure (https://resend.com/security/gdpr). The existing owner-created provider account is not a new contract accepted by this work. Service-level disclosures do not establish an exact Quenvira D1/R2 or provider-backup location/retention, and no UK-only promise is made.

## Remaining release decisions and evidence

1. Complete independent second-account staff acceptance: accept an email-bound invitation as the intended staff user, see assigned work, attempt manager data/routes and confirm denial, then exercise revocation. Preserve prior owner-reported Android/iPhone checks; do not repeat them without a changed path or unresolved issue. This session has no second-person identity.
2. Sandbox subscription recovery/hosted entitlement transitions: historical success, decline and owner-completed manual recovery remain valid. The old disposable cycle fixtures were cancelled and must not be recreated as a duplicate test. Automatic provider retry plus mapped hosted entitlements remains unproven. No agent payment submission or live charge is authorised by preparation.
3. Obtain actual operator/provider particulars and final standard contract approval; complete owner-specific HMRC/ICO assessment facts. Do not certify a registration, exemption, professional legal review or customer signature without evidence.
4. Save the independent encrypted laptop business backup LAST; verify its saved file and keep keys/passwords separately. Synthetic hosted recovery has already passed and must not be listed as wholly outstanding.
5. With those gates satisfied, obtain explicit commercial activation approval and stage the correct live restricted key, live webhook/signing secret, price, portal, final terms version and paid-launch flag coherently. Open public self-service only if that onboarding flow is accepted. Keep customer invoice email separately gated; the present retry task must not silently become a live sender.

No live launch, customer onboarding, charge, legal acceptance or paid infrastructure is claimed by this candidate.

GitHub protection attempt: configured a main-only pull-request rule requiring platform/server/browsers checks, up-to-date branches, resolved conversations and admin enforcement, with force-push/deletion disabled. Saving reached GitHub Confirm access / Verify via email. The rule is NOT saved or enforced; identity confirmation remains required. No alternate administrative route was used to bypass that challenge.
