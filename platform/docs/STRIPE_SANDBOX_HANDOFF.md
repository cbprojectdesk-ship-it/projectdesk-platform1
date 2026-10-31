# Stripe sandbox handoff

Use existing authorized sandbox products and secure configuration. Historical catalogue proposals are superseded by `launch/FIVE_BAND_SANDBOX_HANDOFF_2026-10-30.md`. No provider object identifiers or credentials are supplied in this public example.

The backend handles authenticated Checkout, Customer Portal, signed webhooks and server-side entitlements. Never trust a return URL as payment evidence or implement client-only payment status. A connected Stripe account does not prove that the hosted restricted key has matching permissions.

Start with `.env.example`; leave live billing and self-service disabled. Populate only the isolated authorized environment through existing secure facilities. Verify fixed GBP monthly prices, sandbox binding, signature secret and compatible API version. Do not reuse an unspecified-tax price where the code requires inclusive tax behavior.

Webhook configuration must cover Checkout completion/asynchronous outcomes, subscription create/update/delete and invoice paid/failed events. Obtain the exact deployed handler URL from the authorized source/host configuration, and verify real signatures. Never put signing secrets in this document.

Release gates: hosted identity and tenant isolation, Checkout completion, renewal, failed payment/recovery, replay/late delivery, cancellation, entitlement limits, portal behavior, mobile/accessibility, approved disclosures and independent recovery. Restrict portal plan changes until plan-aware acceptance passes. Keep test mode; do not enable live collection.
