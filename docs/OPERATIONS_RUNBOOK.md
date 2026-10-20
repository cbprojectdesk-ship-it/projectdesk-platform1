# Quenvira operations — development candidate

20 October 2026. Internal procedure, not an SLA or legal approval.

## Release record

Owner-only Site version 8 incorporates the dropdown accessible-name correction
verified by the 30-case GitHub browser run. The deployed source passed the 111-test
suite, syntax, type and build checks before publication. The added recovery tests
are a later source change and require their own checks before merging/deployment.

Hosted D1 schema was inspected through the supported read-only database viewer:
events, history, invitations, memberships, operations and workspaces were present.
The workspaces table was empty. This proves schema availability, not a completed
signed-in write/reload or a populated production restore. Do not create accounts
by spoofing identity or weaken the owner-only boundary to enable testing.

## Sign-in and persistence acceptance

Have the owner open the private app in an actual browser and sign in normally.
Create fictional workspace/customer/staff/job records, reload, then open another
device under the same authorised account. Compare revision and values. Sign out
and confirm denial. A separately authorised staff test account must verify an
email-bound invitation, assigned-work projection, expiry/revocation and denial of
manager/other-tenant operations. Do not share credentials. Check top-level sign-in
and sign-out; crawler/service requests without visitor identity do not establish
that real-user sign-in works. Native logs included crawler 401/404 responses;
those must not be reported as observed human-account failures or passes.

## Backup and isolated restore

`platform/scripts/workspace-recovery.mjs` is a Node-only operator module, not an
HTTP endpoint or an automated production backup service. It snapshots the six
tables, validates workspace/history state, encrypts with AES-256-GCM and authenticates
the envelope. The 32-byte key must be stored separately from the encrypted backup.
Never commit either production data or its key, or put them in public CI logs.

The restore function only accepts a fresh, empty, migrated SQLite database.
It restores all six tables in one transaction and checks foreign keys/integrity.
It refuses nonempty targets, wrong keys, corrupted/incomplete snapshots and
unsupported state. A real recovery must also reconcile schema, deployed code,
membership identities, links, audit history and request replay records.

The automated drill populates all six tables through real API handlers, encrypts
to a separate temporary file, closes the source database, decrypts into an isolated
fresh database and compares API state, invoice pence, paused visits and tenant
denial. Keys and temporary fixtures are discarded after the drill. This is useful
synthetic disaster-recovery evidence; it is not durable backup coverage for D1.

Before real data: confirm a supported complete D1 export/recovery mechanism,
arrange encrypted storage in a separate failure domain and separate key custody,
schedule backups, assign an operator and retention, then restore an actual export
into an isolated managed database. Record start/end, backup timestamp, row counts,
integrity checks, business-level comparison and RPO/RTO achieved. Proposed targets
are 24-hour RPO and 8-hour RTO, not customer promises. No production restore was run.

## Monitoring and incidents

Use supported Site Worker error logs and deployment status. Existing daily project
reviews should inspect exceptions, non-ok Worker outcomes and unexplained 5xx.
Expected unauthenticated 401s and missing crawler icons/routes need separate triage;
do not treat every 4xx as an outage. Record route, time, status and request ID,
without copying cookies, identity headers or complete request bodies into reports.
There is no 24/7 paging or uptime guarantee; daily review is not continuous alerting.

For suspected leakage: stop real-data onboarding and affected writes, preserve a
minimal incident timeline, assess impact, restrict access where necessary and obtain
legal advice on notification duties. A processor must escalate to its controller;
the controller assesses regulator/data-subject notification. Keep customer notices
factual and approved. Never delete evidence to hide a fault.

## Rollback drill and release stop

Do not blindly revert to a validator that rejects Paused visits. Retain a tested
forward-compatible candidate and a separately verified recovery plan. The synthetic
restore drill validates current code against paused data; it does not validate an
older hosted binary. Before a real rollback, capture an independent backup, freeze
writes, restore into isolation and run browser/API acceptance against the intended
rollback source. Then approve the exact saved version; preserve private access.

Stop a pilot for tenant leakage, lost records, duplicate financial records, inability
to recover, or unexplained access failures. No real customer pilot or paid launch
may be labelled complete until identity, recovery, legal and approval gates pass.
