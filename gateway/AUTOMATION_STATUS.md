# Automation status and verification log

Last updated: 2026-11-22T00:50Z

This file separates what was **verified end to end** from what is **configured but
not delivering**. Read the conclusion before relying on unattended operation.

## Conclusion

| Capability | Status |
| --- | --- |
| Deterministic gate (authorisation, policy, dedupe, reports) | Verified, 39 tests, plus live GitHub checks |
| Agent execution (claim → branch → checks → draft PR → report) | Verified end to end on `Adverquay-launch` |
| Manual dispatch from the CLI | Verified |
| Cron polling automation (hourly) | Created and verified to start a run |
| **Webhook-triggered automation (GitHub comment starts a run)** | **Configured, not delivering. Do not claim unattended webhook operation.** |

The webhook path is blocked by event delivery, not by the gateway. Details and the
exact owner action are below.

## Live automations

| Name | Id | Trigger | State |
| --- | --- | --- | --- |
| `CCS Gateway - Adverquay-launch` | `8ebfb6b1-2ad1-41fc-bca5-f53eb8fc7806` | event `github` / `issue_comment.created`, filter on repo + non-bot + `/ccs-task` + owner login | ACTIVE, never fired from an event |
| `CCS Gateway - Adverquay-launch (hourly poll)` | `d98d728a-ea23-4536-8468-231a52eeb998` | cron `0 * * * *` UTC | ACTIVE |

Temporary probe automations were created during diagnosis and deleted afterwards.

## Verification log

### 1. Capabilities and integration (read-only)

```text
GET /api/automation/v1/capabilities
  triggerKinds: cron, event
  eventSources: azure_devops, bitbucket_data_center, github, jira_dc
  github events: check_run.*, check_suite.*, issue_comment.*, issues.*,
                 pull_request.*, pull_request_review.*, push, release.*, status, workflow_run.*

GET /apps/openhands-ai
  events: commit_comment, issues, issue_comment, pull_request, pull_request_review,
          pull_request_review_comment, push, release, status, workflow_job, workflow_run
  permissions: contents write, issues write, pull_requests write, actions write, ...

GET /user/installations/184464424/repositories
  cbprojectdesk-ship-it/projectdesk-platform1
  cbprojectdesk-ship-it/Adverquay-launch
```

The App is installed on both repositories and subscribes to `issue_comment`.

### 2. Agent execution, genuine end to end (manual dispatch)

Trigger comment: `7071636725` on `Adverquay-launch` issue #9, posted
`2026-11-22T00:34:05Z`. Because no event run arrived, the same automation was
dispatched manually (`POST /api/automation/v1/{id}/dispatch`).

Observed result:

| Artifact | Evidence |
| --- | --- |
| Run | `5abcaab4-d4ac-438c-9c7b-3b0b72fe2da3`, status `COMPLETED` |
| Conversation | `53ecf01f-af80-4d51-8515-fd25f289b7be` |
| Claim comment | `7071679486`, contains `<!-- ccs-gw:claimed:7071636725 -->` |
| Branch | `ccs-task/9-7071636725` |
| Draft pull request | [Adverquay-launch#10](https://github.com/cbprojectdesk-ship-it/Adverquay-launch/pull/10), one file, `docs/OPENHANDS_HANDSHAKE.md` (+85) |
| Report comment | `7071686859`, contains `<!-- ccs-gw:state:7071636725 -->` and `<!-- ccs-gw:completed:7071636725 -->`, with test evidence and risks |

The agent followed the prompt: claim, branch, docs-only change, repository checks,
draft PR, structured report. It did not merge, deploy or touch anything else.

### 3. Deduplication against live GitHub state

```text
$ python3 gateway/ccs_gateway.py preflight \
    --repo cbprojectdesk-ship-it/Adverquay-launch --comment-id 7071636725
{"verdict": "duplicate",
 "reasons": ["claim marker already present in comment 7071679486"], ...}
exit=2
```

### 4. Policy boundary against live GitHub state

A `/ccs-task` comment asking to merge and deploy was posted to the probe issue
`projectdesk-platform1#63` and passed through the gate:

```text
{"verdict": "blocked",
 "reasons": ["forbidden action requested: merge_pull_request",
             "forbidden action requested: production_deploy"]}
exit=2
```

No branch, comment or pull request was created by the gate.

### 5. Event delivery tests (all negative)

| Test | Sender | Automation filter | Result |
| --- | --- | --- | --- |
| `/ccs-task` comment on issue #9 | `cbprojectdesk-ship-it`, performed via the `openhands-ai` app | repo + non-bot + phrase + login | no run |
| `/ccs-probe` comment on `projectdesk-platform1#63` | `github-actions[bot]` | repo + phrase | no run |
| same probe comment | `github-actions[bot]` | repo + phrase, no bot exclusion | no run |
| same probe comment | `github-actions[bot]` | **no filter at all** | no run |
| empty commit pushed to `ccs-probe-push` | `github-actions[bot]` | `push`, **no filter** | no run |

The unfiltered automations remove the filter from the equation. A `push` event was
also tested because it is a different event type with a different payload shape.
Neither produced a run, so the failure is at event delivery to this deployment, not
in the gateway filter or the bot-exclusion rule.

## Exact missing dependency

GitHub webhook events for this account are not reaching the OpenHands automation
service. The GitHub App is installed and subscribed, and the deployment advertises
`github` as an event source, but no `issue_comment` or `push` event produced a run.

This is not something the gateway code can fix. It needs one of:

1. **Owner action in OpenHands:** open Settings → Integrations → GitHub and
   (re)connect the GitHub App through the OpenHands flow. That flow registers the
   installation and webhook with the account. An installation created directly on
   GitHub can be visible to GitHub yet not registered for event delivery.
2. **Vendor confirmation:** if the integration already shows connected, ask All
   Hands support to confirm the App webhook is delivering to this account
   (`ccscreativetech@gmail.com`).

After either fix, re-run the check below. Do not assume it works.

## Re-verification procedure (after the fix)

1. Post a comment on `Adverquay-launch` issue #9 from a human account or from
   ChatGPT's connector (not through the OpenHands app):

   ```text
   /ccs-task Documentation-only check: reply with the claim marker and stop.
   ```

2. Watch for a run created with `trigger_source` other than `manual`:

   ```sh
   python3 gateway/provision_automation.py runs --config gateway/automation.adverquay.json
   ```

3. Confirm the automation replies with `<!-- ccs-gw:claimed:<comment-id> -->`.

Only after a run appears with a non-manual trigger source may the system be
described as webhook-driven or unattended.

## The working unattended path today

The hourly cron automation does not need webhooks:

- Every hour it starts an OpenHands run with the same prompt.
- The prompt's discovery section scans open issues for a `/ccs-task` comment with no
  claim marker, takes the oldest one, and applies the same gates.
- If there is nothing to do it stops without writing.

This gives up to one hour of latency and consumes one short LLM run per hour. To
change the cadence, edit `gateway/automation.adverquay.poller.json`, then:

```sh
python3 gateway/provision_automation.py apply --config gateway/automation.adverquay.poller.json --recreate
```

To stop unattended runs completely, disable both automations:

```sh
curl -X PATCH "https://app.all-hands.dev/api/automation/v1/<id>" \
  -H "Authorization: Bearer $OPENHANDS_API_KEY" \
  -H "Content-Type: application/json" -d '{"enabled": false}'
```

## Manual operation (always available)

```sh
# inspect a trigger comment and claim it
python3 gateway/ccs_gateway.py preflight --repo OWNER/REPO --comment-id N --claim

# run the agent now, without waiting for the poller
python3 gateway/provision_automation.py dispatch --config gateway/automation.adverquay.json

# check what happened
python3 gateway/provision_automation.py status --config gateway/automation.adverquay.json
```

## What is not claimed

- The webhook path is not proven. No unattended webhook operation is claimed.
- Branch protection on `main` could not be read with the available token, so
  "the agent cannot push to main" is advisory plus prompt policy, not a verified
  server-side control.
- The claim marker check and the claim comment are not atomic. Concurrent runs
  converge on one branch and one pull request, but both may start.
