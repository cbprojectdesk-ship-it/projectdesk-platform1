# PR #52 / #60 integration order and review handoff — 21 November 2026

This document is an AI-prepared handoff. It is not independent human approval.

## Heads

| PR | Branch | Head | State |
| --- | --- | --- | --- |
| #52 | `pr52` | `822e69f` | Open, not draft, `CLEAN`, 7/7 checks green, 299 platform tests |
| #60 | `fix/recovery-and-command-defaults-20261121` | `3f694cd` (code head `340f016`) | Open, not draft, checks green, 286 platform tests, 138 browser tests, dependency audit gates |

#60 contains the critical React Server Components correction (GHSA-xqc2-xf4c-x3h3, `react-server-dom-webpack` 19.2.8 → 19.2.9) and the Next.js 16.4.6 correction. It is the isolated security patch for any deployment built from `main` or #52.

## Recommended order

**Merge #52 first, then rebase #60.**

Reasons:

- #52 is the larger, older change (63 files, ~3,044 insertions, 16 commits). Re-reviewing it after #60 would be substantially more expensive.
- #60 is small (13 files, 4 commits) and its 11 targeted tests directly exercise the combined recovery/command semantics.
- A scratch merge of both heads produced **310/310 platform tests**, TypeScript, production build and a clean production audit.

If a deployment must receive the critical RSC/Next patch before #52 is approved, use the isolated patch procedure below and merge #60 first; the final combined resolution is the same.

## Conflicts and exact resolutions

The second merge conflicts in exactly three files.

### 1. `platform/server/api.mjs`

Keep both behaviours:

```js
// Recovery and access-removal maintenance must stay available after a trial
// or paid period lapses, or while the provider is unreachable, so records and
// access are never trapped behind billing. Normal commands remain gated.
const maintenanceBody=(path[2]==='invitations'||path[2]==='commands'&&path.length===3)?await readBody(request.clone()):null;
const permittedMaintenance=path[2]==='invitations'&&maintenanceBody?.revoke||path.length===3&&path[2]==='commands'&&maintenanceBody?.action==='staff.active'&&maintenanceBody?.data?.active===false;
recovery=path[2]==='commands'&&(path[3]==='backup'||maintenanceBody?.action==='backup.restore');
```

Keep the plan post-check exempting recovery and staff deactivation:

```js
if(config?.plans&&!recovery&&!(body.action==='staff.active'&&data.active===false)){
 const a=await access(),plan=selectPlan(config,a.plan);
 const members=await db.prepare("SELECT COUNT(*) AS n FROM memberships WHERE workspace_id=? AND role='staff'").bind(workspace).first();
 if(!plan||!fitsPlan(state,members.n,plan))problem(409,plan?.staffAccess?LARGE_TEAM_MESSAGE:'Solo includes one owner-operator. Choose Team before adding more people. No records were changed.');
}
```

`permittedMaintenance` is #52's invitation-revocation and staff-deactivation exception. `recovery` is #60's backup and revision-restore exception. Both must remain.

### 2. `platform/server/domain.mjs`

`saveJob` must keep #60's optional-field defaults and #52's active-staff check:

```js
const staffId=typeof data.staffId==='string'?data.staffId:'';
const round=text(data.round||'',80);
if(staffId&&!state.staff.some(s=>s.id===staffId&&s.active!==false))fail('Choose an active staff member.');
```

Do not restore the old `data.staffId||null` form or the old `text(data.round)` form.

### 3. `platform/pnpm-lock.yaml`

Take either side, then regenerate from the resolved `package.json` and `pnpm-workspace.yaml`:

```bash
cd platform
npx --yes pnpm@11.25.0 install
```

The resolved dependency policy must keep:

- `next` 16.4.6
- `react`, `react-dom`, `react-server-dom-webpack` 19.2.9
- `vite` 8.1.6 (from #52)
- `undici` 7.30.1 (from #52)
- `satori` 0.33.5 (from #52)

## Verification after resolution

```bash
cd platform
npm test                       # expect 310/310
npm run check                  # expect 0
node node_modules/typescript/bin/tsc --noEmit
npm run build
npx --yes pnpm@11.25.0 audit --prod --audit-level high   # expect no known vulnerabilities
npx --yes pnpm@11.25.0 audit --audit-level critical      # expect no critical advisory
grep -ro '19\.2\.8' dist | wc -l                         # expect 0
grep -ro '19\.2\.9' dist | wc -l                         # expect 14
```

Expected final audit: one moderate development-only `minimatch` finding, no high or critical findings.

## Isolated security patch for an affected deployment

Any build from `main` (`47d4eda`) or `pr52` (`822e69f`) still contains `react-server-dom-webpack@19.2.8` and Next.js 16.4.1. Because the RSC package is a devDependency but is bundled into the production Worker, `pnpm audit --prod` does not report it. **An isolated patch is required if such a build is or will be serving traffic before #60 is merged.**

Apply the security changes without taking #60's recovery changes:

1. On the deployed revision, set these exact versions in `platform/package.json`:
   - `next`: `16.4.6`
   - `react`: `19.2.9`
   - `react-dom`: `19.2.9`
   - `react-server-dom-webpack`: `19.2.9`
2. Copy `platform/tests/dependency-security.test.mjs` from #60.
3. Preserve the deployment's existing `pnpm-workspace.yaml` overrides. If the deployment is built from `main`, also apply #52's `vite: 8.1.6`, `undici: 7.30.1` and `satori: 0.33.5` changes to remove the remaining high development-toolchain advisories.
4. Regenerate the lockfile and verify:

```bash
cd platform
npx --yes pnpm@11.25.0 install
npm test
npm run build
npx --yes pnpm@11.25.0 audit --prod --audit-level high
npx --yes pnpm@11.25.0 audit --audit-level critical
grep -ro '19\.2\.8' dist | wc -l   # must be 0
```

Commit `340f016` in #60 contains the RSC package.json and test changes; its parent `57b0b1a` contains the Next 16.4.6 change. Do not cherry-pick the recovery code into a security-only deployment.

## Review packet

- Full assessment: `platform/docs/launch/RELEASE_ASSURANCE_2026-11-21.md`.
- Earlier state assessment: `platform/docs/launch/INDEPENDENT_REVIEW_2026-11-21.md`.
- Issue #56 status comment: AI-disclosed; records findings, not approval.
- #54: 4/4 Python tests independently re-run.
- #55: 3/3 packaging tests independently re-run.
- #58: 39/39 relay tests independently re-run.

## Human approval still required

Issue #56 requires an authorised repository collaborator/maintainer to review the exact heads and record approval or requested changes. This document, the PR bodies and the issue comment cannot grant that approval. No merge, deploy, live charge, customer email or credential change was performed.
