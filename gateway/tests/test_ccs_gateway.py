"""Tests for the CCS coordination gateway.

All tests exercise real gateway code paths through an injected HTTP transport
that emulates the GitHub REST API. No network access and no mocks of gateway
logic itself.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import ccs_gateway as gw  # noqa: E402


class FakeGitHub:
    """Minimal stateful emulation of the GitHub REST endpoints the gateway uses."""

    def __init__(self):
        self.comments: dict[int, dict] = {}
        self.issue_comments: dict[tuple[str, int], list[dict]] = {}
        self.branches: dict[tuple[str, str], dict] = {}
        self.pulls: list[dict] = []
        self.requests: list[tuple[str, str, dict | None]] = []
        self.fail_next: list[tuple[int, int]] = []  # (status, times)
        self._next_id = 9000

    def add_comment(self, repo: str, issue: int, body: str, login: str = "owner", association: str = "OWNER", comment_id: int | None = None, user_type: str = "User"):
        self._next_id += 1
        cid = comment_id or self._next_id
        comment = {
            "id": cid,
            "body": body,
            "user": {"login": login, "type": user_type},
            "author_association": association,
            "issue_url": f"https://api.github.com/repos/{repo}/issues/{issue}",
            "html_url": f"https://github.com/{repo}/issues/{issue}#issuecomment-{cid}",
            "created_at": "2026-11-22T00:00:00Z",
        }
        self.comments[cid] = comment
        self.issue_comments.setdefault((repo, issue), []).append(comment)
        return cid

    def transport(self, method, url, headers, body):
        self.requests.append((method, url, json.loads(body) if body else None))
        parsed = urllib.parse.urlparse(url)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        if self.fail_next:
            status, times = self.fail_next[0]
            if times <= 1:
                self.fail_next.pop(0)
            else:
                self.fail_next[0] = (status, times - 1)
            return status, {}, b'{"message":"transient"}'

        parts = path.strip("/").split("/")

        # GET /repos/{owner}/{repo}/issues/comments/{id}
        if method == "GET" and len(parts) == 6 and parts[3] == "issues" and parts[4] == "comments":
            cid = int(parts[5])
            if cid not in self.comments:
                return 404, {}, b'{"message":"Not Found"}'
            return 200, {}, json.dumps(self.comments[cid]).encode()

        # GET/POST /repos/{owner}/{repo}/issues/{n}/comments
        if len(parts) == 6 and parts[3] == "issues" and parts[5] == "comments":
            repo = f"{parts[1]}/{parts[2]}"
            issue = int(parts[4])
            if method == "GET":
                page = int(query.get("page", ["1"])[0])
                per_page = int(query.get("per_page", ["30"])[0])
                items = self.issue_comments.get((repo, issue), [])
                chunk = items[(page - 1) * per_page : page * per_page]
                return 200, {}, json.dumps(chunk).encode()
            if method == "POST":
                payload = json.loads(body)
                cid = self.add_comment(repo, issue, payload["body"])
                return 201, {}, json.dumps(self.comments[cid]).encode()

        # GET /repos/{owner}/{repo}
        if method == "GET" and len(parts) == 3:
            repo = f"{parts[1]}/{parts[2]}"
            return 200, {}, json.dumps(
                {"full_name": repo, "default_branch": "main", "private": True, "permissions": {"push": True}}
            ).encode()

        # GET /repos/{owner}/{repo}/git/ref/heads/{branch...}
        if method == "GET" and len(parts) >= 6 and parts[3] == "git" and parts[4] == "ref" and parts[5] == "heads":
            repo = f"{parts[1]}/{parts[2]}"
            branch = "/".join(parts[6:])
            ref = self.branches.get((repo, branch))
            if not ref:
                return 404, {}, b'{"message":"Not Found"}'
            return 200, {}, json.dumps(ref).encode()

        # POST /repos/{owner}/{repo}/git/refs
        if method == "POST" and len(parts) == 5 and parts[3] == "git" and parts[4] == "refs":
            repo = f"{parts[1]}/{parts[2]}"
            payload = json.loads(body)
            branch = payload["ref"].replace("refs/heads/", "")
            self.branches[(repo, branch)] = {"ref": payload["ref"], "object": {"sha": payload["sha"]}}
            return 201, {}, json.dumps(self.branches[(repo, branch)]).encode()

        # GET /repos/{owner}/{repo}/pulls
        if method == "GET" and len(parts) == 4 and parts[3] == "pulls":
            repo = f"{parts[1]}/{parts[2]}"
            head = query.get("head", [""])[0].split(":")[-1]
            matches = [p for p in self.pulls if p["base"]["repo"]["full_name"] == repo and p["head"]["ref"] == head]
            return 200, {}, json.dumps(matches).encode()

        # POST /repos/{owner}/{repo}/pulls
        if method == "POST" and len(parts) == 4 and parts[3] == "pulls":
            repo = f"{parts[1]}/{parts[2]}"
            payload = json.loads(body)
            number = len(self.pulls) + 1
            pull = {
                "number": number,
                "title": payload["title"],
                "draft": payload.get("draft", False),
                "head": {"ref": payload["head"]},
                "base": {"ref": payload["base"], "repo": {"full_name": repo}},
                "html_url": f"https://github.com/{repo}/pull/{number}",
            }
            self.pulls.append(pull)
            return 201, {}, json.dumps(pull).encode()

        # GET /repos/{owner}/{repo}/issues?state=open
        if method == "GET" and len(parts) == 4 and parts[3] == "issues":
            repo = f"{parts[1]}/{parts[2]}"
            numbers = sorted({issue for (r, issue) in self.issue_comments if r == repo})
            return 200, {}, json.dumps([{"number": n, "title": f"Issue {n}"} for n in numbers]).encode()

        return 404, {}, b'{"message":"unhandled route"}'


class GatewayTestCase(unittest.TestCase):
    REPO = "cbprojectdesk-ship-it/Adverquay-launch"

    def setUp(self):
        self.fake = FakeGitHub()
        self.tmp = tempfile.TemporaryDirectory()
        self.state_path = os.path.join(self.tmp.name, "state.json")
        self.client = gw.GitHubClient(token="test-token", transport=self.fake.transport, sleep=lambda _: None)
        self.gateway = gw.Gateway(
            client=self.client,
            state=gw.StateStore(self.state_path),
            allowed_repos=["cbprojectdesk-ship-it/*"],
            allowed_senders=["cbprojectdesk-ship-it"],
        )

    def tearDown(self):
        self.tmp.cleanup()

    def trigger(self, issue=9, instruction="Add a docs page describing the workflow.", **kwargs):
        body = f"{gw.TRIGGER_PHRASE} {instruction}"
        return self.fake.add_comment(self.REPO, issue, body, **kwargs)


class PolicyTests(unittest.TestCase):
    def test_safe_instruction_is_accepted(self):
        decision = gw.scan_instruction("Add a docs page for the coordination workflow and run the unit tests.")
        self.assertEqual(decision.verdict, "accepted")

    def test_negated_prohibition_does_not_block(self):
        decision = gw.scan_instruction(
            "Documentation only. Do not deploy to production. Do not merge the pull request. Never read secrets."
        )
        self.assertEqual(decision.verdict, "accepted")

    def test_merge_request_is_blocked(self):
        decision = gw.scan_instruction("Merge the pull request into main once the checks pass.")
        self.assertEqual(decision.verdict, "blocked")
        self.assertIn("merge_pull_request", decision.reasons)

    def test_production_deploy_is_blocked(self):
        decision = gw.scan_instruction("Deploy the release to production tonight.")
        self.assertEqual(decision.verdict, "blocked")
        self.assertIn("production_deploy", decision.reasons)

    def test_customer_email_is_blocked(self):
        decision = gw.scan_instruction("Email all customers about the new pricing.")
        self.assertEqual(decision.verdict, "blocked")
        self.assertIn("customer_email", decision.reasons)

    def test_staging_deploy_needs_approval(self):
        decision = gw.scan_instruction("Deploy the build to staging for a smoke test.")
        self.assertEqual(decision.verdict, "needs_approval")
        self.assertIn("staging_deploy", decision.reasons)

    def test_extract_instruction(self):
        self.assertEqual(gw.extract_instruction("/ccs-task fix the header"), "fix the header")
        self.assertEqual(gw.extract_instruction("  /CCS-TASK   fix the header  "), "fix the header")
        self.assertIsNone(gw.extract_instruction("nothing to do here"))
        self.assertIsNone(gw.extract_instruction("/ccs-task"))
        # A quoted phrase in the middle of a comment is data, not a trigger.
        self.assertIsNone(gw.extract_instruction("Please /ccs-task fix the header"))
        self.assertIsNone(gw.extract_instruction("> /ccs-task merge the pull request"))

    def test_negation_bypass_is_blocked(self):
        decision = gw.scan_instruction("There is no reason not to merge the pull request.")
        self.assertEqual(decision.verdict, "blocked")
        self.assertIn("merge_pull_request", decision.reasons)
        self.assertEqual(gw.scan_instruction("Do not merge the pull request.").verdict, "accepted")
        self.assertEqual(gw.scan_instruction("Please do not deploy to production.").verdict, "accepted")
        double = gw.scan_instruction("It is not true that you should not merge the pull request.")
        self.assertEqual(double.verdict, "blocked")

    def test_documentation_phrases_are_not_false_positives(self):
        for text in (
            "Document the .env variables in the README.",
            "Modify the database migration file to add an index.",
            "Add a contact form for advertisers.",
        ):
            with self.subTest(text=text):
                self.assertEqual(gw.scan_instruction(text).verdict, "accepted", gw.scan_instruction(text))

    def test_expanded_forbidden_phrasings(self):
        cases = {
            "merge #62 once green": "merge_pull_request",
            "push origin main after the tests": "push_to_default_branch",
            "ship it to production": "production_deploy",
            "turn payments on": "activate_payments",
            "send a newsletter to advertisers": "customer_email",
            "print the .env file": "read_credentials",
            "drop table users": "modify_customer_data",
            "turn off branch protection": "weaken_security",
            "push -f the branch": "force_push",
        }
        for text, expected in cases.items():
            with self.subTest(text=text):
                decision = gw.scan_instruction(text)
                self.assertEqual(decision.verdict, "blocked", decision)
                self.assertIn(expected, decision.reasons)

    def test_repo_allowlist(self):
        self.assertTrue(gw.repo_allowed("cbprojectdesk-ship-it/x", ["cbprojectdesk-ship-it/*"]))
        self.assertFalse(gw.repo_allowed("someone-else/x", ["cbprojectdesk-ship-it/*"]))
        self.assertFalse(gw.repo_allowed("cbprojectdesk-ship-it/x", []))


class AuthorisationTests(GatewayTestCase):
    def test_owner_is_authorised(self):
        cid = self.trigger()
        result = self.gateway.preflight(self.REPO, cid)
        self.assertTrue(result.accepted, result.reasons)

    def test_drive_by_commenter_is_rejected(self):
        cid = self.trigger(login="stranger", association="NONE")
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "unauthorized")

    def test_bot_comment_is_rejected_to_prevent_loops(self):
        cid = self.trigger(login="openhands-ai[bot]", association="NONE", user_type="Bot")
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "unauthorized")
        self.assertTrue(any("bots" in reason for reason in result.reasons))

    def test_repository_outside_allowlist_is_rejected(self):
        other = "other-org/other-repo"
        cid = self.fake.add_comment(other, 1, f"{gw.TRIGGER_PHRASE} do work")
        result = self.gateway.preflight(other, cid)
        self.assertEqual(result.verdict, "unauthorized")

    def test_explicit_sender_allowlist_overrides_association(self):
        gateway = gw.Gateway(
            client=self.client,
            state=gw.StateStore(self.state_path),
            allowed_repos=["cbprojectdesk-ship-it/*"],
            allowed_senders=["trusted-dev"],
        )
        cid = self.trigger(login="trusted-dev", association="NONE")
        result = gateway.preflight(self.REPO, cid)
        self.assertTrue(result.accepted, result.reasons)


class PreflightTests(GatewayTestCase):
    def test_accepted_task_records_state_and_branch(self):
        cid = self.trigger(issue=9)
        result = self.gateway.preflight(self.REPO, cid)
        self.assertTrue(result.accepted)
        self.assertEqual(result.issue, 9)
        self.assertEqual(result.branch, f"ccs-task/9-{cid}")
        record = self.gateway.state.get(result.key)
        self.assertEqual(record["status"], "claimed")

    def test_duplicate_comment_is_not_executed_twice(self):
        cid = self.trigger(issue=9)
        first = self.gateway.preflight(self.REPO, cid, post_claim=True)
        self.assertTrue(first.accepted)
        second = self.gateway.preflight(self.REPO, cid, post_claim=True)
        self.assertEqual(second.verdict, "duplicate")
        claims = [c for c in self.fake.issue_comments[(self.REPO, 9)] if gw.has_marker(c["body"], "claimed", cid)]
        self.assertEqual(len(claims), 1)

    def test_redelivered_event_after_state_loss_is_still_deduplicated(self):
        cid = self.trigger(issue=9)
        self.gateway.preflight(self.REPO, cid, post_claim=True)
        # Simulate a fresh worker with an empty state file (event redelivery).
        fresh = gw.Gateway(
            client=self.client,
            state=gw.StateStore(os.path.join(self.tmp.name, "other.json")),
            allowed_repos=["cbprojectdesk-ship-it/*"],
        )
        result = fresh.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "duplicate")

    def test_second_task_on_same_issue_conflicts(self):
        first = self.trigger(issue=9, instruction="First task")
        second = self.trigger(issue=9, instruction="Second task")
        self.assertTrue(self.gateway.preflight(self.REPO, first).accepted)
        result = self.gateway.preflight(self.REPO, second)
        self.assertEqual(result.verdict, "conflict")
        self.assertIn("active task", result.reasons[0])

    def test_forbidden_instruction_is_blocked_before_any_write(self):
        cid = self.trigger(issue=9, instruction="Merge the pull request and deploy to production.")
        result = self.gateway.preflight(self.REPO, cid, post_claim=True)
        self.assertEqual(result.verdict, "blocked")
        self.assertEqual(len(self.fake.issue_comments[(self.REPO, 9)]), 1)

    def test_approval_instruction_is_held(self):
        cid = self.trigger(issue=9, instruction="Deploy the build to staging.")
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "needs_approval")

    def test_missing_issue_number_is_invalid(self):
        cid = self.trigger(issue=9)
        self.fake.comments[cid].pop("issue_url")
        self.fake.comments[cid].pop("html_url")
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "invalid")
        self.assertIn("issue number", result.reasons[0])

    def test_comment_without_trigger_phrase_is_invalid(self):
        cid = self.fake.add_comment(self.REPO, 9, "Just a normal comment")
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "invalid")

    def test_claim_comment_contains_marker_and_disclosure(self):
        cid = self.trigger(issue=9)
        self.gateway.preflight(self.REPO, cid, post_claim=True)
        claim = self.fake.issue_comments[(self.REPO, 9)][-1]["body"]
        self.assertIn(gw.marker("claimed", cid), claim)
        self.assertIn(gw.AI_DISCLOSURE, claim)


class CompletionTests(GatewayTestCase):
    def test_completion_posts_marked_report(self):
        cid = self.trigger(issue=9)
        result = self.gateway.preflight(self.REPO, cid)
        body = gw.report_body(result, "completed", {"Test evidence": "5 passed", "Pull request": "#10"})
        created = self.gateway.complete(self.REPO, cid, 9, "completed", body)
        self.assertIn(gw.marker("state", cid), created["body"])
        self.assertIn(gw.marker("completed", cid), created["body"])
        self.assertEqual(self.gateway.state.get(result.key)["status"], "completed")

    def test_invalid_completion_status_is_rejected(self):
        with self.assertRaises(gw.GatewayError):
            self.gateway.complete(self.REPO, 1, 9, "merged", "text")


class RecoveryTests(GatewayTestCase):
    def test_stale_claim_with_branch_and_pr_is_marked_running(self):
        cid = self.trigger(issue=9)
        result = self.gateway.preflight(self.REPO, cid)
        self.fake.branches[(self.REPO, result.branch)] = {"ref": f"refs/heads/{result.branch}", "object": {"sha": "abc"}}
        self.fake.pulls.append(
            {"number": 12, "head": {"ref": result.branch}, "base": {"repo": {"full_name": self.REPO}}}
        )
        recovered = self.gateway.recover(self.REPO, 9, cid)
        self.assertTrue(recovered["branch_exists"])
        self.assertEqual(recovered["record"]["status"], "running")
        self.assertEqual(recovered["record"]["pr"], 12)

    def test_fresh_claim_is_not_released(self):
        cid = self.trigger(issue=9)
        self.gateway.preflight(self.REPO, cid)
        recovered = self.gateway.recover(self.REPO, 9, cid)
        self.assertFalse(recovered["released"])
        self.assertEqual(recovered["record"]["status"], "claimed")
        self.assertIn("TTL", recovered["reason"])

    def test_claim_without_any_work_is_released_with_force(self):
        cid = self.trigger(issue=9)
        self.gateway.preflight(self.REPO, cid)
        recovered = self.gateway.recover(self.REPO, 9, cid, force=True)
        self.assertTrue(recovered["released"])
        self.assertEqual(recovered["record"]["status"], "released")

    def test_release_posts_a_marker_and_allows_the_same_comment_to_retry(self):
        cid = self.trigger(issue=9)
        self.gateway.preflight(self.REPO, cid, post_claim=True)
        self.gateway.recover(self.REPO, 9, cid, force=True)
        release = self.fake.issue_comments[(self.REPO, 9)][-1]["body"]
        self.assertIn(gw.marker("released", cid), release)
        self.assertIn(gw.AI_DISCLOSURE, release)
        before = len(self.fake.issue_comments[(self.REPO, 9)])
        self.gateway.recover(self.REPO, 9, cid, force=True)
        self.assertEqual(len(self.fake.issue_comments[(self.REPO, 9)]), before)
        retry = self.gateway.preflight(self.REPO, cid, post_claim=True)
        self.assertTrue(retry.accepted, retry.reasons)

    def test_active_claim_blocks_a_second_task_after_state_loss(self):
        first = self.trigger(issue=9, instruction="First task")
        self.gateway.preflight(self.REPO, first, post_claim=True)
        fresh = gw.Gateway(
            client=self.client,
            state=gw.StateStore(os.path.join(self.tmp.name, "fresh.json")),
            allowed_repos=["cbprojectdesk-ship-it/*"],
        )
        second = self.trigger(issue=9, instruction="Second task")
        result = fresh.preflight(self.REPO, second)
        self.assertEqual(result.verdict, "conflict")
        self.assertIn("active task", result.reasons[0])

    def test_released_task_allows_a_new_task(self):
        cid = self.trigger(issue=9)
        self.gateway.preflight(self.REPO, cid)
        self.gateway.recover(self.REPO, 9, cid, force=True)
        second = self.trigger(issue=9, instruction="Second attempt")
        self.assertTrue(self.gateway.preflight(self.REPO, second).accepted)


class ClientTests(GatewayTestCase):
    def test_writes_are_not_replayed_after_a_server_error(self):
        self.fake.fail_next = [(502, 5)]
        with self.assertRaises(gw.RequestError):
            self.client.create_comment(self.REPO, 9, "body")
        self.assertEqual(len([request for request in self.fake.requests if request[0] == "POST"]), 1)

    def test_retries_transient_server_error(self):
        self.fake.fail_next = [(502, 2)]
        repo = self.client.get_repository(self.REPO)
        self.assertEqual(repo["full_name"], self.REPO)
        self.assertEqual(len([r for r in self.fake.requests if r[0] == "GET"]), 3)

    def test_raises_after_retries_exhausted(self):
        self.fake.fail_next = [(503, 10)]
        with self.assertRaises(gw.RequestError):
            self.client.get_repository(self.REPO)

    def test_missing_branch_returns_none(self):
        self.assertIsNone(self.client.get_branch(self.REPO, "does-not-exist"))

    def test_branch_and_pull_request_round_trip(self):
        self.client.create_branch(self.REPO, "ccs-task/9-1", "deadbeef")
        self.assertIsNotNone(self.client.get_branch(self.REPO, "ccs-task/9-1"))
        pull = self.client.create_pull_request(self.REPO, "Title", "ccs-task/9-1", "main", "Body")
        self.assertEqual(pull["number"], 1)
        self.assertTrue(self.client.find_open_pr(self.REPO, "ccs-task/9-1"))

    def test_404_is_not_retried(self):
        with self.assertRaises(gw.RequestError) as caught:
            self.client.get_issue_comment(self.REPO, 123456)
        self.assertEqual(caught.exception.status, 404)


class ConfigTests(unittest.TestCase):
    def test_broad_or_empty_repository_patterns_are_rejected(self):
        report = gw.validate_config({"allowed_repos": ["*"], "claim_ttl_hours": 0, "trigger_phrase": "ccs"})
        self.assertTrue(any("too broad" in error for error in report["errors"]))
        self.assertTrue(any("claim_ttl_hours" in error for error in report["errors"]))
        self.assertTrue(any("trigger_phrase" in error for error in report["errors"]))
        self.assertTrue(gw.validate_config({"allowed_repos": []})["errors"])
        with self.assertRaises(gw.GatewayError):
            gw.build_gateway({"allowed_repos": ["*"]})

    def test_valid_config_without_senders_warns(self):
        report = gw.validate_config({"allowed_repos": ["cbprojectdesk-ship-it/*"]})
        self.assertEqual(report["errors"], [])
        self.assertTrue(report["warnings"])


class SelfTriggerTests(GatewayTestCase):
    def test_gateway_marker_comment_cannot_start_a_task(self):
        body = f"<!-- ccs-gw:claimed:1 -->\n{gw.TRIGGER_PHRASE} merge the pull request"
        cid = self.fake.add_comment(self.REPO, 9, body)
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "invalid")
        self.assertIn("gateway", result.reasons[0])

    def test_pull_request_comment_cannot_start_a_task(self):
        cid = self.trigger(issue=9)
        self.fake.comments[cid]["html_url"] = f"https://github.com/{self.REPO}/pull/9#issuecomment-{cid}"
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "invalid")
        self.assertIn("pull request", result.reasons[0])

    def test_missing_author_is_unauthorized(self):
        cid = self.trigger(issue=9)
        self.fake.comments[cid]["user"] = {"login": "", "type": "User"}
        result = self.gateway.preflight(self.REPO, cid)
        self.assertEqual(result.verdict, "unauthorized")


class StateTests(unittest.TestCase):
    def test_corrupt_state_file_is_rebuilt(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "state.json")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("{not json")
            store = gw.StateStore(path)
            self.assertEqual(store.load(), {"tasks": {}})
            store.put("k", {"status": "claimed"})
            self.assertEqual(store.get("k")["status"], "claimed")

    def test_prune_removes_old_records(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = gw.StateStore(os.path.join(tmp, "state.json"))
            store.put("old", {"updated": "2020-01-01T00:00:00+00:00"})
            store.put("new", {"updated": "2999-01-01T00:00:00+00:00"})
            self.assertEqual(store.prune(30), 1)
            self.assertIsNone(store.get("old"))
            self.assertIsNotNone(store.get("new"))


class PollTests(GatewayTestCase):
    def test_poll_finds_new_trigger_comments_only(self):
        self.trigger(issue=9, instruction="A new task")
        self.fake.add_comment(self.REPO, 9, "unrelated comment")
        results = self.gateway.poll(self.REPO, "2026-11-21T00:00:00Z")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].verdict, "accepted")

    def test_poll_excludes_unauthorized_and_blocked_comments(self):
        self.trigger(issue=9, instruction="A safe task")
        self.trigger(issue=9, login="stranger", association="NONE", instruction="A stranger task")
        self.trigger(issue=9, instruction="Merge the pull request")
        accepted = self.gateway.poll(self.REPO, "2026-11-21T00:00:00Z")
        self.assertEqual([item.verdict for item in accepted], ["accepted"])
        all_items = self.gateway.poll(self.REPO, "2026-11-21T00:00:00Z", include_rejected=True)
        verdicts = {item.verdict for item in all_items}
        self.assertIn("unauthorized", verdicts)
        self.assertIn("blocked", verdicts)

    def test_poll_ignores_comments_before_since(self):
        self.trigger(issue=9)
        results = self.gateway.poll(self.REPO, "2026-11-23T00:00:00Z")
        self.assertEqual(results, [])


class CliTests(GatewayTestCase):
    def test_invalid_config_exits_with_an_error_not_a_traceback(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump({"allowed_repos": ["*"]}, handle)
            config_path = handle.name
        try:
            self.assertEqual(gw.main(["--config", config_path, "doctor"]), 1)
        finally:
            os.unlink(config_path)

    def test_cli_doctor_reports_configuration(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump(
                {"allowed_repos": ["cbprojectdesk-ship-it/*"], "allowed_senders": ["cbprojectdesk-ship-it"]},
                handle,
            )
            config_path = handle.name
        try:
            original = gw.GitHubClient

            class Patched(gw.GitHubClient):
                def __init__(self, *args, **kwargs):
                    kwargs["transport"] = self_transport
                    kwargs["token"] = "test-token"
                    super().__init__(*args, **kwargs)

            self_transport = self.fake.transport
            gw.GitHubClient = Patched
            try:
                code = gw.main(["--config", config_path, "doctor", "--repo", self.REPO])
            finally:
                gw.GitHubClient = original
            self.assertEqual(code, 0)
        finally:
            os.unlink(config_path)


class AutomationCliTests(unittest.TestCase):
    def test_invalid_automation_config_exits_with_an_error(self):
        import provision_automation as pa

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
            json.dump({"name": "bad", "repository": "owner/repo' || true"}, handle)
            config_path = handle.name
        try:
            self.assertEqual(pa.main(["plan", "--config", config_path]), 1)
        finally:
            os.unlink(config_path)


class AutomationPayloadTests(unittest.TestCase):
    def config(self):
        return {
            "name": "CCS Gateway - Test",
            "repository": "cbprojectdesk-ship-it/example",
            "default_branch": "main",
            "trigger_phrase": "/ccs-task",
            "allowed_senders": ["cbprojectdesk-ship-it"],
            "max_runtime_minutes": 30,
            "forbidden_actions": ["merge any pull request"],
        }

    def test_filter_requires_repo_phrase_and_sender(self):
        import provision_automation as pa

        payload = pa.build_automation_payload(self.config())
        trigger_filter = payload["trigger"]["filter"]
        self.assertTrue(trigger_filter.startswith("repository.full_name == 'cbprojectdesk-ship-it/example'"))
        self.assertIn("sender.type != 'Bot'", trigger_filter)
        self.assertIn("icontains(comment.body, '/ccs-task')", trigger_filter)
        # The sender allowlist must be grouped so it cannot bypass the other gates.
        self.assertIn("&& (lower(sender.login) == 'cbprojectdesk-ship-it')", trigger_filter)

    def test_prompt_renders_all_placeholders(self):
        import provision_automation as pa

        prompt = pa.render_prompt(self.config())
        self.assertNotIn("{{", prompt)
        self.assertIn("cbprojectdesk-ship-it/example", prompt)
        self.assertIn("/ccs-task", prompt)
        self.assertIn("@cbprojectdesk-ship-it", prompt)
        self.assertIn("ccs-gw:", prompt)
        self.assertIn("preflight --repo", prompt)
        self.assertIn("starts with", prompt)

    def test_payload_is_event_triggered_and_timeout_bounded(self):
        import provision_automation as pa

        payload = pa.build_automation_payload(self.config())
        self.assertEqual(payload["trigger"]["type"], "event")
        self.assertEqual(payload["trigger"]["source"], "github")
        self.assertEqual(payload["trigger"]["on"], "issue_comment.created")
        self.assertEqual(payload["timeout"], 1800)
        self.assertEqual(payload["repos"][0]["url"], "https://github.com/cbprojectdesk-ship-it/example")

    def test_cron_config_produces_cron_trigger_without_filter(self):
        import provision_automation as pa

        config = self.config()
        config["cron"] = {"schedule": "0 * * * *", "timezone": "UTC"}
        trigger = pa.build_automation_payload(config)["trigger"]
        self.assertEqual(trigger, {"type": "cron", "schedule": "0 * * * *", "timezone": "UTC"})

    def test_raw_filter_is_rejected(self):
        import provision_automation as pa

        config = self.config()
        config["raw_filter"] = "true"
        with self.assertRaises(ValueError):
            pa.build_automation_payload(config)

    def test_filter_values_cannot_inject_expression_syntax(self):
        import provision_automation as pa

        config = self.config()
        config["repository"] = "owner/repo' || true || '"
        with self.assertRaises(ValueError):
            pa.build_automation_payload(config)

    def test_bot_exclusion_can_be_disabled_only_with_acknowledgement(self):
        import provision_automation as pa

        config = self.config()
        config["allow_bot_senders"] = True
        with self.assertRaises(ValueError):
            pa.build_automation_payload(config)
        config["acknowledge_loop_risk"] = True
        trigger_filter = pa.build_automation_payload(config)["trigger"]["filter"]
        self.assertNotIn("sender.type", trigger_filter)
        self.assertIn("icontains(comment.body, '/ccs-task')", trigger_filter)

    def test_canonical_refusals_are_always_in_the_prompt(self):
        import provision_automation as pa

        config = self.config()
        config["forbidden_actions"] = []
        prompt = pa.render_prompt(config)
        self.assertIn("merge any pull request", prompt)
        self.assertIn("read, print or expose credentials", prompt)

if __name__ == "__main__":
    unittest.main(verbosity=2)
