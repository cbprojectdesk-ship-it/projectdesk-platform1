# Independent-account hosted acceptance pack

Status: **prepared, not executed**. No new hosted business, account, invitation, invoice email or payment is created by this document. Existing owner-reported acceptance remains recorded separately; do not repeat consumed email/payment approvals or call simulated sessions independent acceptance.

## Isolated setup

Use an already authorized isolated deployment reconciled with current hosted source, existing sandbox billing and test email. No new paid resource. Keep live billing and public self-service off. Obtain explicit access for two genuinely different managed identities using their normal sign-in flow, in separate browser profiles/devices. Do not create tokens, substitute headers, reuse one identity or modify production memberships to simulate independence.

Create two fictional businesses only through the supported UI once access is available: **Quenvira Acceptance A** owned by tester A and **Quenvira Acceptance B** owned by tester B. Give both distinct fictional customers and jobs. In A, create **Fictional Staff One** and invite tester B through the existing supported invitation flow, with the actual approved email entered privately. Tester B can then exercise staff access in A and manager access in B. Keep real names, emails, workspace IDs and links outside public evidence. If approved pilot access prevents either identity or business from being created, record BLOCKED; do not loosen the gate.

Use three future weekly visits, a 09:00 start and 60-minute duration, a three-item fictional checklist and zero-value draft invoice records initially. Choose dates relative to the site's current business date. Keep customer email blank unless an existing approved test recipient and sender configuration are available. This is a setup specification, not a production fixture import. Do not seed production D1 or overwrite an existing business.

## Required checks and evidence

| Check | Expected result | Evidence to retain privately |
| --- | --- | --- |
| Separate sign-in and account recovery | Each tester signs into their own managed account; provider recovery returns that same identity. No application password reset is invented. | Tester confirmation, time, host/release and redacted screenshot; no recovery codes or cookies. |
| Business onboarding | Each manager creates only their own isolated fictional business and accepts the displayed terms deliberately. | Actual terms version and separate business receipts. |
| Tenant isolation | A cannot read/change B; B's staff view in A cannot use A's manager actions. Rejected requests disclose no other-business content. | Redacted response/status for each direction; no identifiers in public Git. |
| Manager versus staff | Staff cannot open billing, backups, invitations, supplier/admin settings or unassigned customer/job records; manager controls work normally. | Both UI and server rejection evidence. |
| Staff lifecycle | Edit profile/hours, test approved photo; open visits prevent deactivation. Resolve visits, deactivate, confirm old invitation and current staff access fail. Reactivation requires fresh access links. | Before/after with retained history/photos and new identity check; do not restore old links. |
| Customers and scheduling | Create/edit/search a fictional customer, create three weekly visits, assign staff, reject overlaps and show availability conflicts. | Saved state after reload in both profiles. |
| Work execution | Assigned staff completes the checklist, notes and permitted photo workflow; unrelated staff/manager data remain hidden. | Completed state, redacted photo count and customer history. |
| Invoicing | Create/review/issue fictional zero-value invoice and credit where allowed; numbering is unique, totals/itemization and status persist. | Record/document comparison; no claim that creation or provider acceptance equals delivery/payment. |
| Sandbox billing | After the authorization blocker is fixed, complete each approved plan's Checkout, portal actions, renewal, cancellation, failure/recovery and over-limit downgrade scenarios. | Real provider events matched to hosted entitlement transitions; use existing fixtures before creating more. |
| Signed webhooks | Genuine sandbox delivery is accepted; invalid/tampered and duplicate messages cannot grant access or duplicate effects. | Signature/delivery and replay receipts; secrets excluded. |
| Controlled email | Only an already approved test recipient; demonstrate acceptance, failure, retry, duplicate prevention and recovery using isolated fault controls. | Provider and outbox audit reconciliation. Never replay historical delivered messages or fault production. |
| Sessions | Logout/expiry denies the old session; reauthentication recovers the correct identity/role without changing tenant access. | Genuine independent session results, not database membership counts. |
| Devices and accessibility | Desktop and Android Chrome at representative phone/tablet widths: navigation, forms, error focus, keyboard operation, readable cards and no blocked actions/overflow. | Actual device/browser versions and redacted screenshots. CI viewports remain separate evidence. |
| Persistence and recovery | Reload/restart in isolation retains expected state. Complete supported consistent export; validate and restore only into a third authorized empty isolated destination with dispatch disabled. | Counts/schema/photo checks, integrity results and explicit export limitations. No production overwrite. |

## Result discipline and cleanup

Record each check as NOT RUN, PASS, FAIL or BLOCKED, with host/release, timestamp, tester identities referenced privately, expected/actual result and redacted evidence location. Fix a confirmed failure and repeat only its affected checks. A partial pass does not certify the full journey. Stop a scenario before unapproved sending, collection, live mode or real-data changes.

Reconcile any synthetic provider objects and queued work before cleanup. No automatic workspace deletion, subscription cancellation or notification replay is authorized by this pack. Preserve evidence and use separately approved cleanup through normal controls. The owner's actual independent encrypted backup remains a separate final activity.
