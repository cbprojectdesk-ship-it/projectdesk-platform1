# Guided business setup and staff workspace

The default signed-in screen is now action-led. A business without staff starts
with Add your staff; the next stages are an active customer, a booked visit and
an assigned team member. The stage is derived from saved server records, with no
browser-only completion flags. Reload and another signed-in device see the same
progress. Existing records remain intact, and incomplete assignments surface as
the next step. Solo operators add themselves as staff.

The guided customer form keeps optional contact details and checklist settings
collapsed. Guided booking captures visit details before assignment, with repeat
and round settings under optional controls. Assignment uses the existing
revision-checked job.save command, including overlap/capacity validation. The
owner report remains a separate navigation destination. Existing management
routes remain available.

Staff land on My day with today's count, remaining work, assigned addresses and
the next six future appointments. A calendar date selector supports looking
further ahead. Data still comes from the existing server-enforced assigned-work
projection; no invoices, prices, other workers' customers or supplier profile
are introduced. Creating staff records is distinct from staff account invitations.

The existing mobile preview URL now starts in the guided signed-in workspace.
The example report/demo remains an explicit alternative and existing demo edits
are untouched. Testing should use fictional information.

Local verification: 140 platform tests and 57 preserved demo tests pass, including
new client/API/SQLite full-stage progression and staff address/count/privacy
checks. Browser CI adds the full owner journey, reload/resume, assignment,
invitation acceptance under a simulated staff identity, staff home and calendar
navigation across all six existing browser/viewport projects. Exact-head browser,
TypeScript, audit and build outcomes must be checked before merging/deployment.
This does not establish physical-device or hosted two-account acceptance.
