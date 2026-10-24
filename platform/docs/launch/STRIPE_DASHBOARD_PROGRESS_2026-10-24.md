# Stripe Dashboard continuation — 24 October 2026

This supersedes earlier statements that the live catalog is empty.

- Owner signed into the shared Dashboard for live CCS account acct_1USzo1Qtn278HgtT and authorized Dashboard fallback after connector writes repeatedly failed with missing mcp scope.
- Created live product prod_VVAPFC4WhDEomX, Quenvira — monthly business workspace.
- Read API independently verified price price_1UUA4hQtn278HgtTHyoRbR2g: active, livemode true, GBP 1900, per_unit, monthly interval 1, licensed, inclusive tax behavior.
- No customer, Checkout Session, Payment Link, invoice, subscription, payment, runtime key or live webhook was created.
- Customer portal page inspected. Defaults show invoice history, payment-method updates and period-end cancellation enabled; plan and quantity changes disabled; public login link not activated.
- Unsaved portal draft toggled customer information editing off. Header/redirect fill attempts did not persist: direct DOM value inspection showed both fields empty. Saving was rejected by automatic approval review because it required explicit authorization for redirect/profile editing effects. No workaround or retry performed. Portal configurations list remains empty.
- Proposed portal settings awaiting explicit owner approval: invoice history/payment updates enabled; cancel at period end; plan/quantity changes and customer profile edits disabled; header Quenvira by CCS Creative Technologies; return URL https://quenvira-business-demo.sprogg1973.chatgpt.site; public login link off. Target origin independently matches Sites live deployment and runtime QUENVIRA_SITE_ORIGIN.
- Runtime revision 8 rechecked: QUENVIRA_BILLING_MODE=test, QUENVIRA_SELF_SERVE=no, no paid-launch approval flag. Sandbox runtime key, webhook secret, price and portal retained.
- Live webhook and secure live runtime credential provisioning remain outstanding. Owner-held encrypted backup remains last. No claim of paid-launch readiness.

## Portal saved after explicit approval

Owner explicitly approved the customer-portal settings in this conversation. Saved through Dashboard and independently read back via GetBillingPortalConfigurations:

- Live portal bpc_1UUA9gQtn278HgtT3sRYUugI; active/default, livemode true.
- Headline Quenvira by CCS Creative Technologies; default return https://quenvira-business-demo.sprogg1973.chatgpt.site.
- Invoice history and payment-method updates enabled.
- Cancellation enabled at_period_end, proration_behavior none.
- Customer profile edits, subscription plan/quantity updates, subscription pause and public portal login disabled.
- Existing default cancellation-reason collection retained.
- Header/redirect fill issue resolved by expanding Business information before entering the fields; saved API values confirmed.
- Automatic approval review no longer blocked the explicitly approved save.

Live webhook inspection: list is empty. Dashboard creation flow only offers API versions 2026-09-30.endive and 2026-10-07.preview, whereas current integration is pinned to 2026-08-26.dahlia. No alternative version selected for creation; draft canceled and no endpoint or signing secret created. Verify compatible version or supported API creation route before live provisioning. Restricted live runtime key provisioning and webhook remain outstanding; sandbox runtime and live-launch gate unchanged. No live billing activation or charges.
