# CCS AI coordination gateway

A GitHub-to-OpenHands control plane for CCS software projects. Instructions arrive
as GitHub issue comments, an OpenHands automation picks them up, work happens on a
branch, and the evidence goes back to the same issue as an auditable comment and a
draft pull request.

The gateway is deliberately split in two:

| Layer | Runs where | Responsibility |
| --- | --- | --- |
| Deterministic gate (`ccs_gateway.py`) | Anywhere Python 3 runs | Authorisation, instruction policy, idempotency, conflict detection, structured reports |
| Agent execution (OpenHands automation) | OpenHands Cloud sandbox | Read the instruction, claim it, implement on a branch, run checks, open a draft PR, report |

The gate is plain Python with no third-party dependencies, so its behaviour is
testable and reviewable without an LLM. The agent never decides who is allowed to
ask for work: that decision is policy code or the explicit gate in the prompt.

## How a task flows

```text
ChatGPT / owner
      |
      |  issue comment: "/ccs-task <instruction>"
      v
GitHub issue  ---webhook--->  OpenHands GitHub App  ---event--->  automation run
      ^                                                                 |
      |                                                                 |
      |  1. gate: repo, sender, phrase, policy                          |
      |  2. dedupe: claim marker + state file                           |
      |  3. claim comment with marker                                   |
      |  4. branch ccs-task/<issue>-<comment>                           |
      |  5. implement + run checks                                      |
      |  6. draft pull request                                          |
      |  7. report: state/completed markers, evidence, risks            |
      +-----------------------------------------------------------------+
```

Nothing in the flow merges, deploys, activates payments or touches customer data.
Those actions are refused by policy and are outside the automation's instructions.

## Repository layout

| File | Purpose |
| --- | --- |
| `ccs_gateway.py` | Deterministic gate and CLI: preflight, report, recover, poll, doctor |
| `automation_prompt.md` | The prompt the OpenHands automation runs. Placeholders are filled per project |
| `provision_automation.py` | Creates or inspects the OpenHands event automation for one repository |
| `automation.adverquay.json` | Live configuration for `cbprojectdesk-ship-it/Adverquay-launch` |
| `config.example.json` | Configuration for the deterministic gate |
| `tests/test_ccs_gateway.py` | 36 tests over real gateway code paths with an in-process GitHub emulator |

## Quick start (deterministic gate)

```sh
export GITHUB_TOKEN=...          # never commit this
python3 gateway/ccs_gateway.py doctor --repo cbprojectdesk-ship-it/Adverquay-launch
python3 gateway/ccs_gateway.py preflight \
  --repo cbprojectdesk-ship-it/Adverquay-launch --comment-id 7071494082
```

`preflight` prints a JSON verdict and exits non-zero unless it returns `accepted`.
Verdicts: `accepted`, `duplicate`, `conflict`, `unauthorized`, `blocked`,
`needs_approval`, `invalid`.

Add `--claim` to post the claim comment. Add `--config` to point at a different
policy file.

```sh
python3 gateway/ccs_gateway.py report --repo OWNER/REPO --issue 9 \
  --comment-id 123 --status completed --body-file report.md

python3 gateway/ccs_gateway.py recover --repo OWNER/REPO --issue 9 --comment-id 123
python3 gateway/ccs_gateway.py poll --repo OWNER/REPO --since 2026-11-22T00:00:00Z
```

## Provisioning a project

1. Copy `automation.adverquay.json` to `automation.<project>.json` and change
   `name`, `repository`, `default_branch`, and `allowed_senders`.
2. Review `automation_prompt.md`. The rendered prompt is what the agent receives.
3. Preview without writing:

   ```sh
   python3 gateway/provision_automation.py plan --config gateway/automation.<project>.json
   ```

4. Create the automation:

   ```sh
   python3 gateway/provision_automation.py apply --config gateway/automation.<project>.json
   ```

5. Confirm status and runs:

   ```sh
   python3 gateway/provision_automation.py status --config gateway/automation.<project>.json
   ```

`apply` is idempotent by name. Use `--recreate` to replace an existing automation
after a prompt change. The trigger filter is:

```text
repository.full_name == '<repo>'
&& sender.type != 'Bot'
&& icontains(comment.body, '<phrase>')
[&& lower(sender.login) == '<allowed sender>']
```

## Using the system

Post an issue comment:

```text
/ccs-task Add a docs page describing the release checklist. Documentation only.
```

The automation replies with a claim comment, opens a draft pull request and posts a
report with test evidence. To follow up, post a new comment with a new instruction.
To stop a task, post a comment containing `stop` and no trigger phrase.

### Deduplication rules

- One claim marker per trigger comment id. A redelivered webhook, a restarted
  worker or a lost local state file still produces at most one claim.
- One active task per issue. A second instruction while a task is active returns
  `conflict` rather than running in parallel.
- Deterministic branch names (`ccs-task/<issue>-<comment>`) make resumes idempotent.

### Authorisation rules

- Repository must match the allowlist.
- Bot senders are always rejected, which is what prevents reply loops.
- `author_association` must be `OWNER`, `MEMBER` or `COLLABORATOR`, or the login
  must be in `allowed_senders`.
- The instruction is scanned for forbidden actions. A request to merge, deploy,
  email customers, read credentials or touch production data is refused before any
  write.

## Running the tests

```sh
cd gateway && python3 -m unittest discover -s tests -v
```

The tests use an in-process emulation of the GitHub REST API. They cover
authorisation, policy scanning, deduplication across state loss, conflict detection,
retry and failure recovery, stale-claim reconciliation and report formatting.

## Limits and honest status

See `AUTOMATION_STATUS.md` for the verified state of the live automation and
`SECURITY.md` for the threat model and residual risks.
