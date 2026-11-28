# Legal, data-protection and commercial readiness — 22 November 2026

This is an engineering readiness note, not legal advice, a DPO opinion, a tax opinion or
commercial approval. Items below need qualified professional review and an owner decision.

## Two different payment flows

### 1. Quenvira subscription billing

Quenvira may charge a business for access to its workspace through Stripe Checkout and a
subscription. This is Quenvira's own recurring revenue. The code is test-mode/fail-closed
and live billing is disabled.

### 2. Customer invoice payments

Quenvira can create, issue, manage and record manual payment of invoices that a cleaning
business sends to its own customers. **It does not collect those customer payments.** A
payment recorded in Quenvira is a manual bookkeeping entry; it is not proof that funds moved
through Quenvira.

Automated customer payment collection is a separate product. It is not implemented and must
not be advertised as available.

## Automated customer payment collection — options

| Option | Technical requirements | Security / provider responsibilities | Commercial implications |
|---|---|---|---|
| Stripe Payment Links or hosted Checkout per invoice | Server creates a payment link with exact amount/currency/metadata; webhook reconciliation; idempotency; refund/dispute handling; no card data in Quenvira | Stripe handles card data and SCA; Quenvira must verify webhooks, protect keys, reconcile events, avoid duplicate credits and expose a customer-safe receipt | Platform fees, payout timing, refunds, chargebacks, tax invoice wording, customer support |
| Stripe Invoicing | Provider invoice object, customer mapping, due dates, reminders, credit notes, webhook state machine | Provider holds payment credentials; Quenvira must map provider invoice IDs and never infer payment from a redirect | Monthly provider costs, dunning, reconciliation, accounting export |
| Stripe Connect (business as connected account) | Onboarding/KYC, connected-account IDs, destination charges or separate charges/transfers, application fees, liability model | Much larger security and compliance scope; platform may become responsible for connected-account onboarding and disputes | Platform/connected-account terms, reserves, negative balances, tax reporting |
| Bank transfer / manual reconciliation | No provider integration; customer pays directly and manager records receipt | Quenvira only stores a manual reference; no payment confirmation | Lowest technical scope, highest manual reconciliation and fraud risk |

### Minimum technical requirements for any option

- Exact invoice amount in integer minor units, currency and immutable invoice reference.
- Provider customer/invoice/payment identifiers stored separately from business records.
- Signed webhook verification, replay protection, event deduplication and authoritative
  provider re-query before granting or changing paid status.
- Idempotent creation and reconciliation; never create a duplicate payment link on retry.
- Refund, partial refund, dispute and chargeback state handling; manual review queue.
- Customer receipt and tax-document wording reviewed by an accountant.
- Reconciliation report and audit trail; no card data in application logs or database.
- Explicit consent/terms, cancellation and refund policy, and support contact.
- Test-mode and low-value sandbox acceptance before any live activation.
- Separate owner approval and provider account approval; no live activation from this branch.

## Data protection and legal work still required

- Controller/processor mapping for Quenvira, the hosting provider, Stripe, Resend and any
  payment-collection provider.
- DPA terms with each processor, international-transfer assessment and sub-processor list.
- DPIA/ROPA covering workspace identity, staff records, customer contact details, invoice
  data, photos, payment metadata and email delivery events.
- Retention/deletion schedule for operations, events, subscription records, invoice outbox
  events, backups and provider copies.
- Privacy notice and business terms with accurate descriptions of the service, manual
  payment tracking, email limitations, availability and support.
- ICO registration/fee assessment and UK VAT position confirmed by the owner/accountant.
- Consumer/business customer terms, cancellation/refund policy and complaints process.
- Security incident and data-subject-request procedures with named ownership.
- Accessibility and equality considerations for the public and workspace interfaces.

## Owner decisions required

1. Confirm the legal entity, trading name, business address, contact details and VAT status.
2. Approve or reject automated customer payment collection as a future feature.
3. If approved, choose the provider model and obtain professional review of the commercial,
   tax, refund/dispute and data-protection consequences.
4. Approve the retention schedule and deletion process.
5. Sign the customer order/DPA and confirm the support/incident owner before real data.
6. Keep live Quenvira subscription billing and customer invoice sending disabled until the
   separate release approval is recorded.

## Current status

- Subscription billing: implemented in test mode; live disabled.
- Invoice creation/management/manual payment tracking: implemented and tested.
- Automated customer payment collection: **not implemented**.
- Legal/DPA/DPIA/ROPA/ICO/VAT: prepared drafts only; no professional approval.
