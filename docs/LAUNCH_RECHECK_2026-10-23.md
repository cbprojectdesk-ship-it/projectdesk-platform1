# Quenvira launch recheck — 23 October 2026

## Verified during this session

- GitHub repository is cbprojectdesk-ship-it/projectdesk-platform1. The similarly named projectdesk-platform endpoint returned 404; it is not evidence that the actual repository is unavailable.
- The latest checked main commit 7768836dce2d5942e5e3c4196619eadbef125946 has successful Quality checks, Quenvira checks, Server workspace checks and Free browser acceptance. Browser job 120374244804 explicitly reports 114 passed in 3.2 minutes. No in-progress or queued workflow runs were returned at the time of inspection.
- Hosted Quenvira version 32, source 0e58960255e77d62de9bbf6be87a3330bca96c5b, deployment appgdep_6adb3b7e33c08191903f243dd3482b6c succeeded with environment revision 8.
- Fresh checkout of that hosted source: 186 automated tests passed, zero failed/skipped; syntax checks, TypeScript noEmit and production build passed. Initial missing local Stripe dependency was resolved using the standard dependency installer; no application change was required.
- Browser preview opened the landing page and fictional demo. It was stopped after QA. The existing 114-test browser run is stronger regression evidence than this smoke check; neither substitutes for real hosted account acceptance already recorded by the owner.
- Runtime billing mode is test. Self-service and paid-launch settings were not changed. Secret values are redacted by the service; null in the read response was not treated as proof that a secret is absent.
- The hosted synthetic recovery receipt in docs/launch/HOSTED_RECOVERY_2026-10-23.md records a successful isolated D1/R2 restore. The real owner backup remains deferred to laptop access.

## Ongoing provider tests

The two fictional timed billing fixtures still had open GBP 1900 subscription_cycle invoices, amount_paid=0, attempted=false, attempt_count=0 at this session's inspection:

- success: sub_1UTfsiJMLR8T7SStOr9DRNgq / in_1UTfwBJMLR8T7SStBgVFhfPW; next_payment_attempt 1792755783 (23 October 2026 11:43:03 UTC / 12:43:03 Europe/London).
- failure: sub_1UTfsmJMLR8T7SStNZfKWADJ / in_1UTfvqJMLR8T7SStqHRPYN4C; next_payment_attempt 1792755762 (11:42:42 UTC / 12:42:42 Europe/London).

Existing billing follow-up automation is enabled and has not yet run. No paid renewal, failure or recovery pass is claimed.

The native Stripe connector did not expose invoice payment, PaymentIntent confirmation or clock advancement. The failure fixture's Stripe-hosted invoice page opened successfully and visibly showed Sandbox, GBP 19 and the expected fictional customer/invoice. A documented insufficient-funds test card ending 9995, future expiry, synthetic postcode and CVC were entered; save-card and Link enrolment were left unchecked/empty. The attempted Pay action was rejected before execution by automatic approval review, which explicitly requires user handoff even for sandbox payments. No alternate API/tool path was used to bypass that rejection. The page is prepared for the owner to submit the decline test; recovery still requires an actual matching successful payment and provider state evidence. The owner's original trial subscription was untouched.

## Remaining verification limits

Fresh direct HTTP checks to the production Sites origins returned 403 from this execution environment; these are not treated as application failures or successful endpoint checks. The most recent GitHub public monitor succeeded, but this session did not independently certify a new published-origin enquiry receipt. Historical enquiry delivery, non-VAT commercial wording and customer-specific processing/order prerequisites remain as described in the current launch documents.

Live billing remains OFF. This record does not declare all release gates passed or enable real payments.
