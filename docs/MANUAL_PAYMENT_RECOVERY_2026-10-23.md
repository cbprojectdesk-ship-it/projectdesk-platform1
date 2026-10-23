# Sandbox payment recovery and accessible errors — 23 October 2026

Only CCS Creative Technologies sandbox acct_1USzoBJMLR8T7SSt was used. Live billing remains off.

## Authoritative recovery evidence

For fictional failure fixture sub_1UTfsmJMLR8T7SStNZfKWADJ and its GBP 1900 subscription_cycle invoice in_1UTfvqJMLR8T7SStqHRPYN4C:

1. Charles submitted Stripe's insufficient-funds test card ending 9995 on the Hosted Invoice Page. The page displayed card declined. Native Stripe reads then returned invoice open, attempted=true, attempt_count=1, amount_paid=0, and subscription past_due.
2. The agent prepared the documented success test card ending 4242. Charles performed the payment click; the agent did not submit the payment or bypass the earlier automatic-approval handoff requirement.
3. Charles's screenshot showed Invoice paid, GBP 19, sandbox and Visa 4242. Native reads independently returned invoice status=paid and amount_paid=1900, and subscription status=active.
4. InvoicePayment inpay_1UTfwiJMLR8T7SStnngyoMWm independently returned status=paid, amount_paid=1900 GBP, paid_at=1792753402, linked PaymentIntent pi_3UTfwiJMLR8T7SSt1IgIq31u.

This proves owner-submitted payment recovery for an actual scheduled-cycle invoice in the sandbox. It does not prove automatic retry execution, mapped real-business hosted entitlements or real-money collection. The independent success fixture still awaits its original automatic collection around 11:43 UTC. Existing owner trial and business memberships were untouched. Cleanup remains with the existing bounded billing follow-up after the pending result; do not repeat this completed recovery test.

## Accessible error release

Quenvira Sites version 33, source 71ed845677e1a4ca99c21d704851b1258964d406, deployed successfully with unchanged environment revision 8. App-owned validation and general errors use 18px bold dark-red text, a pale-red panel, a 2px border with 6px left edge, wrapping and spacing. General error alerts remain until dismissed and are announced assertively. Demo form errors receive focus and scroll into view. Failed-save status is highlighted too. Success notifications retain timed dismissal, with stale timers prevented from hiding newer errors.

Stripe-hosted page error styling is outside application CSS control; this release does not claim that the small Stripe decline message was restyled.

Hosted-source validation: 186 tests, syntax, TypeScript and production build passed. Actual preview browser check observed 18px, weight 700, dark red, pale red background, focus, scroll visibility and no horizontal page overflow for a form validation error. GitHub PR #35 preserves the changes in the repository and standalone demo. The first repository run exposed an incomplete standalone DOM test adapter; its missing setAttribute stub was added without weakening assertions. Final CI status is recorded on that pull request.
