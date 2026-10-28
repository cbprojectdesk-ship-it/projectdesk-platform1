# Hosting provider evidence — 23 October 2026

This records public provider documentation; it does not certify the complete Quenvira deployment or accept a new agreement.

## Hosted-data DPA

OpenAI's ChatGPT Sites DPA, published 9 July 2026, applies to personal data collected by published Sites on Plus/Pro. It distinguishes hosted visitor data from the conversations used to build a Site. Its UK-data section specifies SCCs amended by the UK Addendum. Sections 2.9–2.11 address subprocessors, comparable obligations and data return/deletion. The document does not establish a UK-only location or a fixed retention period for this deployment.

Source: https://openai.com/policies/chatgpt-sites-data-processing-addendum/

## Current subprocessor list

The accessible canonical list is https://openai.com/policies/sub-processor-list/ (updated 14 October 2026). The platform.openai.com/subprocessors address exposed no readable content in this review. The canonical list expressly covers Plus/Pro Sites in its dedicated section. It lists Cloudflare, Ltd. for web hosting in the United States and separately for CDN processing near the end user. This is provider-level disclosure, not proof of the exact D1/R2 placement of Quenvira's stored records. The list identifies other potential infrastructure, support and moderation providers; it should not be reduced to Cloudflare alone.

## Still unresolved

Exact application-record and provider-backup locations/retention, actual provider chain for this deployment, notification subscriptions and customer-facing processing instructions must be recorded before real customer onboarding. No UK-only residency, zero-retention or immediate provider-wide erasure promise is made. No legal agreement, paid service or notification subscription was accepted by this review.

## Resend review — 28 October 2026

The signed-in provider dashboard shows mail.ccscreativetech.co.uk Verified (verification event 28 October, 00:15), sending region eu-west-1. The existing Sending-access API key is scoped to all domains. No new key, account or subscription was created.

Runtime revision 13 now uses invoices@mail.ccscreativetech.co.uk as the sender. Billing=test, email=test and self-service=no remain unchanged. The due/review queue was empty before this configuration change. QV-1005's earlier single approved delivery used onboarding@resend.dev; it does not establish delivery from the new sender. Do not repeat that invoice or send another test without a specifically approved recipient/content.

Resend's current GDPR documentation states that email content, logs, webhook and account information are stored in the United States; choosing a European sending region does not change storage location. For Free/Pro/Scale, the stated retention for email content/logs is 30 days, with database backups retained for 7 days. Account-termination deletion is described as within 90 days. These are provider-level policies, not proof of a particular record's immediate removal. The DPA and current subprocessor list must accompany the customer processing review, including UK international-transfer provisions.

Official sources reviewed 28 October:
- https://resend.com/security/gdpr
- https://resend.com/security
- https://resend.com/legal/dpa
- https://resend.com/legal/subprocessors
- https://resend.com/pricing

The published free tier lists 3,000 emails/month and 100/day; Quenvira's application daily cap is 90. Neither proves remaining account quota, exempts an overage or authorises a paid upgrade. No expenditure was made. Exact hosted-record locations/retention and customer-specific processing instructions remain unresolved. This review does not accept a new agreement or open customer onboarding.
