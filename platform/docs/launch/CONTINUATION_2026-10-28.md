# Quenvira continuation after Garage Manager — 28 October 2026

CCS website version 17 is published with the isolated Garage Manager demonstration at https://ccscreativetech.co.uk/garage-demo/. Quenvira demo files and Kivza concept assets were preserved. Garage has no access to Quenvira records, authentication, billing, mail or runtime configuration. Its review/source/tests live in the CCS Sites repository.

## Finished development
Reviewed and completed the existing uncommitted business-terms work after hosted Quenvira version 50/source 8e5060bfd25f0a66eb02782096f2de75af46420e. Current terms version is 2026-10-28. Live-mode enrollment requires an explicit version-matching manager declaration; existing live workspaces require it before ordinary edits. Viewing, exports and revocation/recovery remain accessible. Acceptance is a membership-rechecked database batch with named-manager event evidence, preserves first acceptance time on retries and does not create a Stripe customer, Checkout session or paid subscription. Invalid acceptance is validated before starting any trial row.

Prepared standard business/data-processing pages replace the historical draft layout, while explicitly keeping live activation closed. They are prepared text for owner approval, not an agreement accepted by the agent. No current test workspace has been asked to accept commercial terms. Existing sandbox configuration temporarily supports the prior runtime version during rollout; the live configuration requires the current version. This is compatibility for sandbox, not a security bypass for live mode.

The client keeps acceptance distinct from deliberate paid checkout and submits the exact version. Updated one stale live-webhook fixture so it continues testing the unapproved-launch gate rather than failing first at a superseded terms version. Added client coverage for the acceptance form, exact action/version, no payment redirect and checkout availability after acceptance. No Stripe payment methods, keys, webhooks, prices or subscription states changed.

## Verification and current service
237 full local server/client/security tests passed, including four new service-terms acceptance cases and one new UI adapter case. Syntax, TypeScript and production build passed. Focused rerun after the final test assertions passed. This is automated evidence, not a new physical-device or second-account acceptance exercise.

The existing signed-in hosted manager workspace opened successfully at /workspace, preserving saved records. The connected read-only email status returned mode=test, dueBefore=0, review=0. No email processor was invoked, no message was sent, no repeat test invoice was created and no payment was submitted. Existing verified-sender receipt and connected hourly retry schedule evidence in COMMERCIAL_RELEASE_2026-10-28.md remain valid; true provider-failure/hosted-retry acceptance remains unproven.

Runtime revision 13 before deployment was billing=test, email=test, self-service=no and terms version 2026-10-22. Sensitive settings were not printed or copied. Any subsequent non-secret terms-version update is recorded by deployment, not a commercial activation.

Current primary sources rechecked for the prepared disclosures:
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/accountability-and-governance/contracts-and-liabilities-between-controllers-and-processors-multi/what-needs-to-be-included-in-the-contract/
- https://openai.com/policies/chatgpt-sites-data-processing-addendum/
- https://resend.com/security/gdpr
ICO guidance itself is under review following legislative changes. A source check is not legal certification. Resend states US storage (sending region does not change it), 30-day active-plan email/log retention and seven-day backups; actual account/provider arrangements must be verified before expanding customer email. The app continues to exclude automatic customer invoice email from its proposed paid service.

## Owner-dependent launch gates
- Independent intended staff account acceptance and revocation; do not repeat the owner's already reported Android/iPhone checks as if absent.
- Actual sandbox automatic payment recovery and hosted entitlement transitions; historical decline/manual recovery is already evidenced. Do not duplicate cancelled cycle fixtures or submit a payment as an agent.
- Actual provider-failure/missed-run/retry acceptance with an explicitly authorised owned test recipient; no real customer sending.
- GitHub main protection was previously left at Verify via email; it is not enforced until owner security verification completes. Do not use another administrative route to bypass it.
- Final standard terms/order approval, customer-specific instructions/provider and retention particulars, and owner-specific HMRC/ICO facts. No registration or exemption is assumed.
- Encrypted laptop backup remains LAST before any go-live; do not fabricate file-saving evidence or start live billing first.
- Explicit commercial activation approval is still required. Current paid-launch, live-billing/customer-sending and self-service gates remain closed.
