# Owner acceptance — invitation-only fictional-data pilot

This is a draft acceptance statement for the owner. It is not signed by the AI and is not human review or legal advice.

I, the authorised owner of CCS Creative Technologies, authorise an invitation-only fictional-data pilot of Quenvira using the reviewed development heads:

- PR #52: `38164d6ca13c8695451f002a961018c583d19b3e`
- PR #60: `6daaedc1e36060c7172f3a8f08b57df9d316c827` (code head `340f016`)
- Combined integration tree: `b011f96942819e4cc128830526f5a7ea95ae9e15`
- Security fallback PR #61: `5571cebab52e3b0915ca1314ebbdd16f1cbec890`

## Scope

The pilot is limited to fictional or synthetic records. It does not process real customer, staff, payment or special-category data. It is invitation-only, uses billing test mode, sends no customer invoices, activates no live payment collection and makes no public claim of production or legal compliance.

## Residual risks I accept

- Failed authenticated commands are not throttled by the application; edge/WAF protection is required or the pilot is kept small and monitored.
- The production identity-header boundary, Cloudflare Access, Stripe acceptance, independent D1/R2 backup, Resend delivery, monitoring and rollback have not been verified in the hosting environment.
- AI-assisted testing is not independent human certification and may miss defects.
- The exact GitHub branch-protection rule has not been read; any merge must respect the platform's protections and must not bypass them.
- HTTP security headers and legal/DPA/DPIA/ICO/VAT work remain outstanding for real service.

## Conditions and stop rules

1. Stop immediately if real personal data, live payment, live customer email or public sign-up is introduced without a new approval.
2. Keep the pilot private and invitation-only; do not deploy the customer-facing app publicly.
3. Use synthetic records only and delete them at pilot end.
4. Record incidents and stop the pilot if tenant isolation, authentication, deletion, backup or billing behaviour is suspected to be wrong.
5. Do not describe this acceptance or the AI report as human review, certification or legal compliance.

## Owner decision

- [ ] I authorise the invitation-only fictional-data pilot on the terms above.
- [ ] I authorise merging #52 first and rebasing #60 afterwards, subject to GitHub protections and CI.
- [ ] I retain #61 as a fallback and authorise it only if a `main` build is deployed first.
- [ ] I understand that real paying customers and real personal data require the outstanding external work.

Name: ______________________  Date: ______________________

Signature: __________________
