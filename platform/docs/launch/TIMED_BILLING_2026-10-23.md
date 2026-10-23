# Timed sandbox billing acceptance — 23 October 2026

The connector does not expose test-clock advancement, immediate invoice payment, SetupIntent creation or PaymentMethod attachment. Card Tokens are disabled as end-of-life; that policy was not weakened. Existing owner billing was left untouched.

As a supported alternative, two separate fictional sandbox subscriptions used real-time future billing-cycle anchors with the approved GBP £19 monthly price, flexible billing and no initial proration. Both automatically generated £19 invoices with billing_reason=subscription_cycle at their scheduled anchors. The invoices were finalized successfully through the available native API. Stripe scheduled collection for approximately 11:43 UTC; collection had not yet occurred when this record was prepared. One customer has the Visa success test method; the other has the saved-card charge-decline test method. Neither has an email address, a test clock or an application membership.

Success subscription: sub_1UTfsiJMLR8T7SStOr9DRNgq; invoice in_1UTfwBJMLR8T7SStBgVFhfPW.
Failure subscription: sub_1UTfsmJMLR8T7SStNZfKWADJ; invoice in_1UTfvqJMLR8T7SStqHRPYN4C.

An hourly, bounded follow-up starts after the scheduled provider attempt. It checks real payment/failure evidence, attempts recovery only through supported modern APIs, records a concrete Dashboard blocker if required, and cleans up only these disposable fixtures. No recovery success is claimed before matching paid-invoice evidence. The app's deterministic lifecycle/permission regressions already pass, but they do not replace the real provider outcome.

Live mode, public self-service, automatic tax and the paid-launch approval flag remain off. CCS is not VAT registered. No real money has been collected.
