# Future live Stripe preparation — historical record

This is preparation, **not permission to activate live billing**. Use the current tracker and approved five-band catalogue; historical catalogue amounts must not be used for new commercial orders.

Before any separately approved live configuration, verify all mandatory sandbox and hosted acceptance, accurate commercial disclosures and the owner's independent encrypted backup. Preserve existing live/sandbox separation. Never overwrite the test secret or test webhook binding with a live value.

Use the existing approved secure secret-management workflow. Restricted keys need only the resource permissions actually used by the reviewed code. The current map is in `STRIPE_RESTRICTED_KEY_DIAGNOSIS.md`, including invoice and charge reads required by settlement/risk checks. Verify actual grants and account/mode binding privately; do not infer them from a different connector credential.

Portal cancellation, invoice history and payment-method management must match approved disclosures. Plan changes need tested proration and entitlement enforcement before enablement. Verify compatible API versions and signed webhook delivery. Do not create or enable a live endpoint, Checkout, subscription, invoice, payment link or charge merely to prepare documentation.

Provider/customer/retention particulars, notification coverage and any required legal or financial decisions remain owner approval gates. No restricted-key, webhook, account or hosting identifiers are included here. No live activation or additional expenditure is authorized.
