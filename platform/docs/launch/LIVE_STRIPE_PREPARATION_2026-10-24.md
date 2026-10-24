# Live Stripe preparation — 24 October 2026

Status: blocked by Stripe connector write authorization, not by app tests. No live billing activation authorized in this step.

## Verified state

- Connected live CCS account: acct_1USzo1Qtn278HgtT.
- Live products and webhook endpoint lists are empty. Active-price search is empty.
- App runtime revision 8 remains QUENVIRA_BILLING_MODE=test and QUENVIRA_SELF_SERVE=no. No paid-launch approval flag is present.
- Attempt to create the product below returned UNAUTHORIZED: missing permissions/scopes, reauthentication required (mcp). No product or price was created. Do not claim this preparation is applied.
- Existing app requires a £19 GBP monthly licensed price with inclusive tax behavior; Stripe API version 2026-08-26.dahlia. The sandbox secret/price/key/portal must remain paired.

## Prepared API payloads

These are configuration data only, not an executable migration. Read current account state before retrying to prevent duplicates.

```json
{
  "account": "acct_1USzo1Qtn278HgtT",
  "billing_activation": false,
  "product": {
    "name": "Quenvira — monthly business workspace",
    "description": "One business workspace. £19 total per month. Monthly renewal after voluntary checkout; cancel at period end. CCS Creative Technologies is not VAT registered; no VAT is added.",
    "active": true,
    "default_price_data": {
      "currency": "gbp",
      "unit_amount": 1900,
      "recurring": {
        "interval": "month",
        "interval_count": 1
      },
      "tax_behavior": "inclusive",
      "metadata": {
        "application": "quenvira",
        "release": "2026-10-22",
        "prepared_for_launch": "true"
      }
    },
    "metadata": {
      "application": "quenvira",
      "owner": "CCS Creative Technologies",
      "prepared_for_launch": "true"
    }
  },
  "webhook": {
    "api_version": "2026-08-26.dahlia",
    "url": "https://quenvira-business-demo.sprogg1973.chatgpt.site/api/quenvira/subscription-webhook",
    "enabled_events": [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.paid",
      "invoice.payment_failed"
    ],
    "description": "Quenvira live subscription endpoint — prepare disabled until launch",
    "metadata": {
      "application": "quenvira",
      "prepared_for_launch": "true"
    }
  },
  "portal": {
    "name": "Quenvira monthly workspace",
    "default_return_url": "https://quenvira-business-demo.sprogg1973.chatgpt.site",
    "features": {
      "invoice_history": {
        "enabled": true
      },
      "payment_method_update": {
        "enabled": true
      },
      "subscription_cancel": {
        "enabled": true,
        "mode": "at_period_end",
        "proration_behavior": "none"
      },
      "subscription_update": {
        "enabled": false
      },
      "customer_update": {
        "enabled": false
      }
    },
    "login_page": {
      "enabled": false
    },
    "metadata": {
      "application": "quenvira",
      "prepared_for_launch": "true"
    }
  }
}
```

## Apply after the owner grants Stripe write authorization

1. Confirm the selected live account matches the ID above. Recheck products, prices, portal configurations and endpoints before creating anything.
2. Create product/default price; verify GBP 1900, monthly interval 1, licensed usage and inclusive tax behavior. No Checkout Session, Payment Link, invoice or subscription is to be created during this preparation.
3. Prepare the portal configuration above and verify cancellation at period end, payment-method updates and invoice history; keep plan/quantity changes and public portal login disabled.
4. Before creating the live webhook, establish secure secret storage and disable it immediately after creation while the app remains in test mode. The endpoint has no disabled-on-create parameter; do not leave an enabled live endpoint pointed to the sandbox handler. Retain the one-time signing secret only in memory until encrypted secret storage succeeds; never print it or put it into repository files. Verify disabled state.
5. Store the future live webhook secret in a separate secret entry, without overwriting STRIPE_WEBHOOK_SECRET used by the sandbox. Stage non-secret live price/portal identifiers separately. Current server code does not consume staged live entries; do not claim staged configuration is active.
6. Obtain a restricted live runtime key through Stripe's supported secure key-management flow with only customers read/write, Checkout Sessions read/write, prices read, subscriptions read and Billing Portal Sessions write. No payouts, transfers or bank-management permissions. No key may be requested in chat or saved in ordinary files.
7. Keep current sandbox runtime and launch gate unchanged. Applying actual live runtime values, enabling the live endpoint, validating genuine Stripe signature delivery and enabling customer checkout belong to the later explicit launch step after the owner-held encrypted backup and other release gates.

## Separate outstanding items

Manual sandbox receipt delivery still requires sandbox access and a signed-in Dashboard. Exact provider record/backup location and retention, HMRC registration position and ICO assessment outcome remain unresolved. Per-customer legal/processing particulars require actual customer facts. Owner-held encrypted backup remains last. Do not repeat the completed synthetic hosted restore or timed recovery payments.

## Authorization retry — 24 October 2026

After the owner confirmed reconnection, account discovery still returned the correct live CCS account. Product, portal configuration and webhook endpoint lists were rechecked and remained empty. App runtime stayed at revision 8 with test mode and self-service disabled. The exact prepared PostProducts call was retried once and again returned UNAUTHORIZED / reauthentication required / missing mcp scope. No product/default price, portal, webhook, key, checkout or payment was created. Repeating the same account-selection link has not resolved write access. A Dashboard fallback requires the owner's approval under the browser connection-fallback rule; no browser sign-in or settings mutation was attempted in this retry.
