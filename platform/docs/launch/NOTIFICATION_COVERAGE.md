# Notification ownership and acceptance coverage

No new notification pipeline or scheduler was enabled. Test mode and existing approved recipients remain the boundary.

| Trigger | Current ownership/behaviour | Evidence | Unresolved |
| --- | --- | --- | --- |
| Account registration, sign-in verification, password reset | Managed ChatGPT identity; Quenvira stores no passwords | Application identity adapter/source review | Actual provider messages and independent session recovery acceptance; do not build a competing reset mechanism |
| Business onboarding | Saved in-app guided setup and terms acceptance | API/UI/browser acceptance | No custom welcome email implemented; no verified promise of email onboarding |
| Subscription purchase/renewal invoice | Stripe Billing plus current-state in-app status | Historical paid invoice/receipt; fresh five-plan provider Checkout creation only | Dashboard customer-email settings and actual billing-email receipt not visible through available API tools |
| Failed subscription payment/recovery | Authoritative Stripe read blocks/restores writes; manager retains read/export and portal path | Local SDK-transport lifecycle acceptance and historical owner manual decline/recovery | Actual automatic retry + hosted entitlement transition and provider dunning-email configuration/receipt |
| Trial expiry/cancellation | App status/read/export; explicit paid Checkout required | Existing tests; current state remains test | No custom trial-reminder/cancellation email implemented or advertised; confirm service scope and provider coverage first |
| Customer job invoices | Durable transactional outbox; acceptance, delivery, bounce/complaint tracked separately from document/payment status | Four existing hosted delivered rows; local retry/idempotency/suppression tests | Live sending remains unapproved; new actual provider-failure/missed-run/bounce acceptance requires isolated hosted support |
| Website business enquiry | Fixed business inbox; existing Resend path | Historical 29 October inbox receipt | No repeated mail sent by this continuation |
| Website enquirer acknowledgement | New explicit test flag + approved recipient allowlist only; separate durable receipt | Local failure/concurrency/lost-receipt/quota tests | Flag is not enabled, no new inbox receipt, arbitrary-recipient production acknowledgements not implemented/approved |

## Failure/retry acceptance boundary

Existing tests cover uncertain provider acceptance, lease reclamation after a crash, concurrent dispatcher calls, missed due runs, stable message keys, bounded attempts, idempotency-retention cutoff, suppression after bounce/complaint, mode/recipient changes and duplicate signed callbacks. A local mock outage is not an actual Resend outage or proof that a linked hourly task ran unattended.

Fresh read-only hosted audit found four delivered outbox rows, sixteen email event rows and no due/retry/review rows. There is no pending approved message to process. Do not resend delivered invoices, add another scheduler, disable a verified sender, rotate a key or inject faults into production to fabricate retry evidence.

To close the real-provider gap, reconcile current source into an already authorised isolated test deployment; retain test mode and owner-approved recipients. Create one explicitly labelled synthetic invoice, exercise controlled transport failure without sending to real customers, allow the **existing** due processor to retry, and correlate outbox attempts/stable key, provider acceptance, signed delivery event and inbox receipt. Bound the scenario to the existing free allowance. Verify bounce/complaint through provider-supported test facilities rather than sending unsolicited mail to real addresses. This session cannot run that hosted scenario: supported source deployment/browser access and provider credentials are unavailable; secret values are write-only.

Do not mark an invoice paid from an email event or mark delivery from HTTP acceptance. Do not duplicate Stripe dunning/billing emails until actual provider configuration and the approved communication scope are known.
