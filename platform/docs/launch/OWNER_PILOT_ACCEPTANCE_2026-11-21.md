# Owner acceptance — invitation-only fictional-data pilot

This is a draft acceptance statement for the owner. It is not signed by the AI and is not human review or legal advice.

## Owner conditional authorisation

I, the authorised owner of CCS Creative Technologies, approve progressing towards an invitation-only, fictional-data-only Quenvira pilot, subject to the conditions and restrictions in this document.

I authorise the application-level persistent failed-command limiter and its regression tests. I authorise integration preparation for PR #52 followed by PR #60. I require all existing GitHub branch protections and required checks to be respected. I retain PR #61 as the security-only fallback. I understand that no production deployment is authorised without separate approval.

For this restricted fictional-data pilot only, I waive the previous requirement for an independent human code review, provided no external obligation or enforced repository rule requires it. This waiver does not apply to real customer use and does not waive any legal, security or operational requirement.

## Reviewed heads

- PR #52: `a1e189f9ff1b93050155e932d4e846ead882f7d3` — RSC/Next security patch plus persistent failed-command limiter.
- PR #60: `6209ae20b8db544c540f60e4b77e344bb541ba3d` (code head `340f016`) — recovery and command-default corrections plus launch documentation.
- Rebased integration candidate: `integration/pr52-pr60-rate-limit-20261121`, prepared from #52 and rebased #60.
- Security fallback PR #61: `5571cebab52e3b0915ca1314ebbdd16f1cbec890`.

## Scope and pilot restrictions

The pilot is limited to fictional or synthetic records. It does not process real customer, staff, payment or special-category data.

- Fictional data only.
- Invitation-only access.
- No real customer or staff records.
- No live billing, live checkout or customer emails.
- No public commercial launch or public customer-facing deployment.
- No new paid infrastructure.
- No bypassing branch protections.
- No production deployment without separate approval.

## Residual risks I accept

- The application-level failed-command limiter is implemented and tested, but malformed JSON and unsupported content types are rejected before the counter; edge/WAF protection remains recommended defence-in-depth.
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
6. Do not bypass any GitHub protection or required check. If a merge is blocked, obtain the required approval or change the rule through the owner's authorised repository administration.

## Owner decision

- [ ] I authorise the invitation-only fictional-data pilot on the terms above.
- [ ] I authorise merging #52 first and rebasing #60 afterwards, subject to GitHub protections and CI.
- [ ] I retain #61 as a fallback and authorise it only if a `main` build is deployed first.
- [ ] I understand that real paying customers and real personal data require the outstanding external work.
- [ ] I confirm that no production deployment is authorised by this document.

Name: ______________________  Date: ______________________

Signature: __________________
