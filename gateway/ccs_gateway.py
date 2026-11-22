#!/usr/bin/env python3
"""CCS GitHub <-> OpenHands coordination gateway.

Deterministic control plane for the CCS AI development workflow. It performs the
checks that must not depend on an LLM: authorisation, instruction policy,
idempotency, conflict detection and structured reporting. The agent that writes
code runs *after* this gate returns ``accepted``.

Standard library only. Importable, or runnable as a CLI:

    python3 gateway/ccs_gateway.py preflight --repo OWNER/REPO --comment-id 123
    python3 gateway/ccs_gateway.py report --repo OWNER/REPO --comment-id 123 \
        --status completed --body-file report.md
    python3 gateway/ccs_gateway.py poll --repo OWNER/REPO --since 2026-11-01T00:00:00Z
    python3 gateway/ccs_gateway.py doctor

Environment:
    GITHUB_TOKEN        required for live GitHub calls
    CCS_GATEWAY_STATE   optional path to the state file (default: .ccs-gateway-state.json)
    GITHUB_API_URL      optional GitHub API base (default: https://api.github.com)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TRIGGER_PHRASE = "/ccs-task"
BOT_LOGINS = frozenset({"openhands-ai[bot]", "github-actions[bot]", "dependabot[bot]"})
AUTHORIZED_ASSOCIATIONS = frozenset({"OWNER", "MEMBER", "COLLABORATOR"})

MARKER_PREFIX = "ccs-gw"
CLAIM_STATE = "claimed"
DONE_STATES = frozenset({"completed", "failed", "blocked"})
ACTIVE_STATES = frozenset({"claimed", "running"})

# Actions that are never permitted through the gateway, regardless of sender.
# Each entry is (name, compiled regex).
FORBIDDEN_ACTIONS: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (name, re.compile(pattern, re.IGNORECASE))
    for name, pattern in (
        ("merge_pull_request", r"\bmerge\b[^.\n]{0,40}\b(pull request|pr|branch|into main)\b"),
        ("push_to_default_branch", r"\bpush\b[^.\n]{0,30}\b(directly\s+)?to\s+(main|master|production)\b"),
        ("production_deploy", r"\bdeploy\b[^.\n]{0,40}\b(production|prod|live)\b"),
        ("activate_payments", r"\b(activate|enable|turn on|switch on)\b[^.\n]{0,30}\b(payment|billing|stripe|checkout)\b"),
        ("customer_email", r"\b(email|mail|message|contact)\b[^.\n]{0,30}\b(customers?|clients?|users?)\b"),
        ("read_credentials", r"\b(read|print|dump|expose|reveal|cat|echo)\b[^.\n]{0,30}\b(secret|token|credential|api[ -]?key|password|private key)\b"),
        ("modify_customer_data", r"\b(delete|drop|truncate|modify|overwrite)\b[^.\n]{0,30}\b(customer|production|live)\b[^.\n]{0,20}\b(data|records?|database|table)\b"),
        ("weaken_security", r"\b(disable|remove|bypass|weaken)\b[^.\n]{0,30}\b(branch protection|security|authentication|authori[sz]ation|rate limit|2fa|mfa)\b"),
        ("force_push", r"\bforce[ -]?push\b|\bpush\s+--force\b"),
        ("delete_repository", r"\bdelete\b[^.\n]{0,20}\b(repository|repo)\b"),
        ("rotate_credentials", r"\brotate\b[^.\n]{0,20}\b(secret|token|credential|key)s?\b"),
    )
)

# Actions allowed only after an explicit human approval comment.
APPROVAL_ACTIONS: tuple[tuple[str, re.Pattern[str]], ...] = tuple(
    (name, re.compile(pattern, re.IGNORECASE))
    for name, pattern in (
        ("staging_deploy", r"\bdeploy\b[^.\n]{0,30}\b(staging|preview|sandbox)\b"),
        ("modify_ci_secrets", r"\b(add|change|update|set)\b[^.\n]{0,25}\b(ci\s+secret|actions?\s+secret|webhook\s+secret)\b"),
        ("install_dependency", r"\b(install|add)\b[^.\n]{0,25}\b(package|dependency|dependencies)\b"),
        ("migrate_database", r"\b(run|apply|execute)\b[^.\n]{0,25}\bmigration\b"),
    )
)

_NEGATION = re.compile(
    r"\b(do\s+not|don't|never|must\s+not|should\s+not|not\s+allowed|forbidden|prohibited|without|no)\b",
    re.IGNORECASE,
)

_CLAUSE_SPLIT = re.compile(r"[.;\n]|\bbut\b", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Errors and transport
# ---------------------------------------------------------------------------


class GatewayError(Exception):
    """Base error for the gateway."""


class AuthorizationError(GatewayError):
    """The sender is not allowed to submit instructions."""


class PolicyError(GatewayError):
    """The instruction asks for something the gateway forbids."""


class RequestError(GatewayError):
    def __init__(self, status: int, message: str, url: str = ""):
        super().__init__(f"HTTP {status} for {url or 'request'}: {message}")
        self.status = status
        self.url = url
        self.message = message


Transport = Callable[[str, str, dict[str, str], bytes | None], tuple[int, dict[str, str], bytes]]


def urllib_transport(method: str, url: str, headers: dict[str, str], body: bytes | None) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, dict(response.headers), response.read()
    except urllib.error.HTTPError as error:  # 4xx/5xx still carry a body
        return error.code, dict(error.headers or {}), error.read() or b""


# ---------------------------------------------------------------------------
# Policy
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PolicyDecision:
    verdict: str  # accepted | needs_approval | blocked
    reasons: list[str] = field(default_factory=list)

    @property
    def accepted(self) -> bool:
        return self.verdict == "accepted"


def _clauses(text: str) -> list[str]:
    return [part.strip() for part in _CLAUSE_SPLIT.split(text) if part.strip()]


def _is_negated(clause: str, match_start: int) -> bool:
    prefix = clause[:match_start]
    return bool(_NEGATION.search(prefix))


def scan_instruction(text: str) -> PolicyDecision:
    """Classify free text instructions against the CCS safety policy.

    Negated mentions ("do not deploy") are ignored, so a safe instruction can
    describe a prohibition without tripping the filter.
    """
    blocked: list[str] = []
    needs_approval: list[str] = []
    for clause in _clauses(text):
        for name, pattern in FORBIDDEN_ACTIONS:
            for match in pattern.finditer(clause):
                if not _is_negated(clause, match.start()):
                    blocked.append(name)
                    break
        for name, pattern in APPROVAL_ACTIONS:
            for match in pattern.finditer(clause):
                if not _is_negated(clause, match.start()):
                    needs_approval.append(name)
                    break

    if blocked:
        return PolicyDecision("blocked", sorted(set(blocked)))
    if needs_approval:
        return PolicyDecision("needs_approval", sorted(set(needs_approval)))
    return PolicyDecision("accepted", [])


def extract_instruction(body: str, phrase: str = TRIGGER_PHRASE) -> str | None:
    """Return the instruction text after the trigger phrase, or None."""
    if not body:
        return None
    pattern = re.compile(re.escape(phrase) + r"(?:\s+|$)", re.IGNORECASE)
    match = pattern.search(body)
    if not match:
        return None
    instruction = body[match.end():].strip()
    return instruction or None


def repo_allowed(repo: str, allowed_patterns: Iterable[str]) -> bool:
    """Match OWNER/REPO against shell-style patterns such as 'cbprojectdesk-ship-it/*'."""
    patterns = list(allowed_patterns)
    if not patterns:
        return False
    from fnmatch import fnmatchcase

    target = repo.lower()
    return any(fnmatchcase(target, pattern.lower()) for pattern in patterns)


# ---------------------------------------------------------------------------
# Markers and state
# ---------------------------------------------------------------------------


def marker(kind: str, comment_id: int | str) -> str:
    return f"<!-- {MARKER_PREFIX}:{kind}:{comment_id} -->"


def has_marker(text: str, kind: str, comment_id: int | str) -> bool:
    return marker(kind, comment_id) in (text or "")


def task_key(repo: str, issue: int, comment_id: int) -> str:
    raw = f"{repo.lower()}#{issue}#{comment_id}".encode()
    return hashlib.sha256(raw).hexdigest()[:16]


class StateStore:
    """Small JSON state file with atomic replacement.

    Used for conflict detection across runs. GitHub comment markers remain the
    durable, auditable source of truth; the state file is a local accelerator.
    """

    def __init__(self, path: str | None = None):
        self.path = path or os.environ.get("CCS_GATEWAY_STATE", ".ccs-gateway-state.json")

    def load(self) -> dict[str, Any]:
        try:
            with open(self.path, encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict):
                return data
        except FileNotFoundError:
            pass
        except (json.JSONDecodeError, OSError):
            # A corrupt state file must not block the gateway; rebuild it.
            pass
        return {"tasks": {}}

    def save(self, state: dict[str, Any]) -> None:
        directory = os.path.dirname(os.path.abspath(self.path))
        os.makedirs(directory, exist_ok=True)
        temporary = f"{self.path}.tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump(state, handle, indent=2, sort_keys=True)
        os.replace(temporary, self.path)

    def get(self, key: str) -> dict[str, Any] | None:
        return self.load()["tasks"].get(key)

    def put(self, key: str, record: dict[str, Any]) -> None:
        state = self.load()
        state["tasks"][key] = record
        self.save(state)

    def prune(self, max_age_days: int = 30) -> int:
        state = self.load()
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        kept: dict[str, Any] = {}
        removed = 0
        for key, record in state["tasks"].items():
            try:
                updated = datetime.fromisoformat(record.get("updated", ""))
            except ValueError:
                removed += 1
                continue
            if updated >= cutoff:
                kept[key] = record
            else:
                removed += 1
        state["tasks"] = kept
        self.save(state)
        return removed


# ---------------------------------------------------------------------------
# GitHub client
# ---------------------------------------------------------------------------


class GitHubClient:
    def __init__(
        self,
        token: str | None = None,
        api_url: str | None = None,
        transport: Transport | None = None,
        retries: int = 3,
        sleep: Callable[[float], None] = time.sleep,
    ):
        self.token = token if token is not None else os.environ.get("GITHUB_TOKEN", "")
        self.api_url = (api_url or os.environ.get("GITHUB_API_URL", "https://api.github.com")).rstrip("/")
        self.transport = transport or urllib_transport
        self.retries = retries
        self.sleep = sleep

    def request(self, method: str, path: str, payload: Any = None) -> Any:
        url = path if path.startswith("http") else f"{self.api_url}{path}"
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "ccs-gateway/1.0",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = None
        if payload is not None:
            body = json.dumps(payload).encode()
            headers["Content-Type"] = "application/json"

        last_error: Exception | None = None
        for attempt in range(self.retries + 1):
            try:
                status, response_headers, raw = self.transport(method, url, headers, body)
            except Exception as error:  # network layer
                last_error = error
                if attempt < self.retries:
                    self.sleep(min(2 ** attempt, 8))
                    continue
                raise GatewayError(f"network error for {method} {path}: {error}") from error

            if status == 429 or 500 <= status < 600:
                last_error = RequestError(status, raw[:300].decode("utf-8", "replace"), url)
                if attempt < self.retries:
                    retry_after = response_headers.get("Retry-After") or response_headers.get("retry-after")
                    delay = float(retry_after) if retry_after and str(retry_after).isdigit() else min(2 ** attempt, 8)
                    self.sleep(delay)
                    continue
                raise last_error

            if status >= 400:
                raise RequestError(status, raw[:500].decode("utf-8", "replace"), url)

            if not raw:
                return None
            return json.loads(raw.decode("utf-8"))

        raise GatewayError(f"request failed after retries: {last_error}")

    # -- reads -------------------------------------------------------------

    def get_issue_comment(self, repo: str, comment_id: int) -> dict[str, Any]:
        return self.request("GET", f"/repos/{repo}/issues/comments/{comment_id}")

    def list_issue_comments(self, repo: str, issue: int, per_page: int = 100) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        page = 1
        while True:
            chunk = self.request(
                "GET", f"/repos/{repo}/issues/{issue}/comments?per_page={per_page}&page={page}"
            ) or []
            items.extend(chunk)
            if len(chunk) < per_page:
                return items
            page += 1

    def get_repository(self, repo: str) -> dict[str, Any]:
        return self.request("GET", f"/repos/{repo}")

    def get_branch(self, repo: str, branch: str) -> dict[str, Any] | None:
        try:
            return self.request("GET", f"/repos/{repo}/git/ref/heads/{urllib.parse.quote(branch, safe='/')}")
        except RequestError as error:
            if error.status == 404:
                return None
            raise

    def find_open_pr(self, repo: str, branch: str) -> dict[str, Any] | None:
        owner = repo.split("/")[0]
        query = urllib.parse.urlencode({"state": "open", "head": f"{owner}:{branch}"})
        items = self.request("GET", f"/repos/{repo}/pulls?{query}") or []
        return items[0] if items else None

    # -- writes ------------------------------------------------------------

    def create_comment(self, repo: str, issue: int, body: str) -> dict[str, Any]:
        return self.request("POST", f"/repos/{repo}/issues/{issue}/comments", {"body": body})

    def create_branch(self, repo: str, branch: str, from_sha: str) -> dict[str, Any]:
        return self.request("POST", f"/repos/{repo}/git/refs", {"ref": f"refs/heads/{branch}", "sha": from_sha})

    def create_pull_request(self, repo: str, title: str, head: str, base: str, body: str, draft: bool = True) -> dict[str, Any]:
        return self.request(
            "POST",
            f"/repos/{repo}/pulls",
            {"title": title, "head": head, "base": base, "body": body, "draft": draft},
        )


# ---------------------------------------------------------------------------
# Gateway orchestration
# ---------------------------------------------------------------------------


@dataclass
class PreflightResult:
    verdict: str  # accepted | duplicate | unauthorized | blocked | needs_approval | conflict | invalid
    key: str = ""
    repo: str = ""
    issue: int = 0
    comment_id: int = 0
    sender: str = ""
    instruction: str = ""
    reasons: list[str] = field(default_factory=list)
    branch: str = ""

    @property
    def accepted(self) -> bool:
        return self.verdict == "accepted"

    def to_dict(self) -> dict[str, Any]:
        return {
            "verdict": self.verdict,
            "key": self.key,
            "repo": self.repo,
            "issue": self.issue,
            "comment_id": self.comment_id,
            "sender": self.sender,
            "instruction": self.instruction,
            "reasons": self.reasons,
            "branch": self.branch,
        }


class Gateway:
    def __init__(
        self,
        client: GitHubClient,
        state: StateStore | None = None,
        allowed_repos: Iterable[str] = (),
        allowed_senders: Iterable[str] = (),
        phrase: str = TRIGGER_PHRASE,
        claim_ttl_hours: int = 24,
    ):
        self.client = client
        self.state = state or StateStore()
        self.allowed_repos = list(allowed_repos)
        self.allowed_senders = {login.lower() for login in allowed_senders}
        self.phrase = phrase
        self.claim_ttl = timedelta(hours=claim_ttl_hours)

    # -- authorisation -----------------------------------------------------

    def authorise(self, repo: str, comment: dict[str, Any]) -> list[str]:
        reasons: list[str] = []
        if not repo_allowed(repo, self.allowed_repos):
            reasons.append(f"repository {repo} is not in the allowlist")
        user = comment.get("user") or {}
        login = (user.get("login") or "").lower()
        association = (comment.get("author_association") or "").upper()
        if user.get("type") == "Bot" or login in BOT_LOGINS:
            reasons.append("comments from bots are ignored to prevent loops")
        if login and login in self.allowed_senders:
            return reasons
        if association not in AUTHORIZED_ASSOCIATIONS:
            reasons.append(f"author_association {association or 'NONE'} is not authorised")
        return reasons

    # -- preflight ---------------------------------------------------------

    def preflight(self, repo: str, comment_id: int, issue: int | None = None, post_claim: bool = False) -> PreflightResult:
        comment = self.client.get_issue_comment(repo, comment_id)
        if issue is None:
            issue = _issue_number_from_comment(comment)
        result = PreflightResult(verdict="invalid", repo=repo, issue=issue or 0, comment_id=comment_id)

        body = comment.get("body") or ""
        result.sender = ((comment.get("user") or {}).get("login") or "")
        instruction = extract_instruction(body, self.phrase)
        if not instruction:
            result.reasons.append(f"comment does not start an instruction with {self.phrase}")
            return result
        result.instruction = instruction
        result.key = task_key(repo, issue or 0, comment_id)
        result.branch = f"ccs-task/{issue}-{comment_id}" if issue else f"ccs-task/{comment_id}"

        reasons = self.authorise(repo, comment)
        if reasons:
            result.verdict = "unauthorized"
            result.reasons = reasons
            return result

        decision = scan_instruction(instruction)
        if decision.verdict == "blocked":
            result.verdict = "blocked"
            result.reasons = [f"forbidden action requested: {name}" for name in decision.reasons]
            return result
        if decision.verdict == "needs_approval":
            result.verdict = "needs_approval"
            result.reasons = [f"human approval required for: {name}" for name in decision.reasons]
            return result

        if issue:
            existing = self.client.list_issue_comments(repo, issue)
            for item in existing:
                if has_marker(item.get("body") or "", CLAIM_STATE, comment_id):
                    result.verdict = "duplicate"
                    result.reasons.append(f"claim marker already present in comment {item.get('id')}")
                    return result
            for item in existing:
                if has_marker(item.get("body") or "", "blocked", comment_id):
                    result.verdict = "blocked"
                    result.reasons.append(f"task previously blocked in comment {item.get('id')}")
                    return result

        conflict = self._active_conflict(repo, issue, comment_id)
        if conflict:
            result.verdict = "conflict"
            result.reasons.append(
                f"issue #{issue} already has an active task from comment {conflict.get('comment_id')}"
            )
            return result

        record = {
            "repo": repo,
            "issue": issue,
            "comment_id": comment_id,
            "status": CLAIM_STATE,
            "branch": result.branch,
            "sender": result.sender,
            "updated": datetime.now(timezone.utc).isoformat(),
        }
        self.state.put(result.key, record)

        if post_claim and issue:
            self.client.create_comment(repo, issue, claim_body(result))
        result.verdict = "accepted"
        return result

    def _active_conflict(self, repo: str, issue: int | None, comment_id: int) -> dict[str, Any] | None:
        if not issue:
            return None
        now = datetime.now(timezone.utc)
        for key, record in self.state.load()["tasks"].items():
            if key == task_key(repo, issue, comment_id):
                continue
            if record.get("repo") != repo or record.get("issue") != issue:
                continue
            if record.get("status") not in ACTIVE_STATES:
                continue
            try:
                updated = datetime.fromisoformat(record.get("updated", ""))
            except ValueError:
                continue
            if now - updated <= self.claim_ttl:
                return record
        return None

    # -- completion and recovery ------------------------------------------

    def complete(self, repo: str, comment_id: int, issue: int, status: str, body: str) -> dict[str, Any]:
        if status not in DONE_STATES:
            raise GatewayError(f"status must be one of {sorted(DONE_STATES)}")
        payload = f"{marker('state', comment_id)}\n{marker(status, comment_id)}\n\n{body.strip()}\n"
        comment = self.client.create_comment(repo, issue, payload)
        key = task_key(repo, issue, comment_id)
        record = self.state.get(key) or {}
        record.update(
            {
                "repo": repo,
                "issue": issue,
                "comment_id": comment_id,
                "status": status,
                "updated": datetime.now(timezone.utc).isoformat(),
            }
        )
        self.state.put(key, record)
        return comment

    def recover(self, repo: str, issue: int, comment_id: int) -> dict[str, Any]:
        """Inspect real GitHub state and reconcile a stale claim.

        A claim left active after a crashed run is released only when the
        branch/PR state shows no work in flight. The returned dict is the
        machine-readable recovery record.
        """
        key = task_key(repo, issue, comment_id)
        record = self.state.get(key) or {}
        branch = record.get("branch") or f"ccs-task/{issue}-{comment_id}"
        branch_ref = self.client.get_branch(repo, branch)
        pull = self.client.find_open_pr(repo, branch) if branch_ref else None

        if pull:
            record.update({"status": "running", "pr": pull.get("number"), "updated": datetime.now(timezone.utc).isoformat()})
        elif branch_ref:
            record.update({"status": "running", "branch_sha": (branch_ref.get("object") or {}).get("sha")})
        else:
            record.update({"status": "released", "updated": datetime.now(timezone.utc).isoformat()})
        self.state.put(key, record)
        return {"key": key, "branch": branch, "branch_exists": bool(branch_ref), "open_pr": pull, "record": record}

    # -- polling fallback --------------------------------------------------

    def poll(self, repo: str, since: str, limit: int = 50) -> list[PreflightResult]:
        """Find trigger comments newer than ``since`` across open issues.

        Used by the cron fallback when webhook delivery is unavailable. It is
        read-only: callers decide what to do with the returned task envelopes.
        """
        since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        issues = self.client.request("GET", f"/repos/{repo}/issues?state=open&sort=updated&direction=desc&per_page=50") or []
        found: list[PreflightResult] = []
        for issue in issues:
            if "pull_request" in issue:
                continue
            number = issue.get("number")
            for comment in self.client.list_issue_comments(repo, number):
                created = comment.get("created_at") or ""
                try:
                    created_dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                except ValueError:
                    continue
                if created_dt < since_dt:
                    continue
                instruction = extract_instruction(comment.get("body") or "", self.phrase)
                if not instruction:
                    continue
                sender = ((comment.get("user") or {}).get("login") or "")
                found.append(
                    PreflightResult(
                        verdict="candidate",
                        key=task_key(repo, number, comment.get("id", 0)),
                        repo=repo,
                        issue=number,
                        comment_id=comment.get("id", 0),
                        sender=sender,
                        instruction=instruction,
                        branch=f"ccs-task/{number}-{comment.get('id', 0)}",
                    )
                )
                if len(found) >= limit:
                    return found
        return found


# ---------------------------------------------------------------------------
# Reporting helpers
# ---------------------------------------------------------------------------

AI_DISCLOSURE = "This comment was generated by an AI agent (OpenHands) on behalf of CCS Creative Technologies."


def claim_body(result: PreflightResult) -> str:
    return "\n".join(
        [
            marker(CLAIM_STATE, result.comment_id),
            AI_DISCLOSURE,
            "",
            f"## Task accepted — `{result.key}`",
            "",
            f"- Repository: `{result.repo}`",
            f"- Issue: #{result.issue}",
            f"- Trigger comment: `{result.comment_id}`",
            f"- Branch: `{result.branch}`",
            f"- Requested by: @{result.sender}",
            "",
            "Policy checks passed: sender authorised, repository allowed, instruction within the",
            "approved scope, no active task on this issue, and no earlier claim for this comment.",
            "",
            "Next: implement on the branch, run the checks, open a pull request and post the",
            "evidence here. Nothing is merged or deployed by this workflow.",
        ]
    )


def report_body(result: PreflightResult, status: str, sections: dict[str, str]) -> str:
    lines = [
        AI_DISCLOSURE,
        "",
        f"## Task `{result.key}` — {status}",
        "",
        f"- Repository: `{result.repo}`",
        f"- Issue: #{result.issue}",
        f"- Trigger comment: `{result.comment_id}`",
        f"- Branch: `{result.branch}`",
    ]
    for title, content in sections.items():
        lines.extend(["", f"### {title}", "", content.strip()])
    return "\n".join(lines)


def _issue_number_from_comment(comment: dict[str, Any]) -> int | None:
    issue_url = comment.get("issue_url") or ""
    match = re.search(r"/issues/(\d+)$", issue_url)
    if match:
        return int(match.group(1))
    html_url = comment.get("html_url") or ""
    match = re.search(r"/issues/(\d+)#", html_url)
    if match:
        return int(match.group(1))
    return None


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


DEFAULT_CONFIG: dict[str, Any] = {
    "allowed_repos": [],
    "allowed_senders": [],
    "trigger_phrase": TRIGGER_PHRASE,
    "claim_ttl_hours": 24,
}


def load_config(path: str | None) -> dict[str, Any]:
    config = dict(DEFAULT_CONFIG)
    if path and os.path.exists(path):
        with open(path, encoding="utf-8") as handle:
            config.update(json.load(handle))
    return config


def build_gateway(config: dict[str, Any], client: GitHubClient | None = None) -> Gateway:
    return Gateway(
        client=client or GitHubClient(),
        state=StateStore(config.get("state_path")),
        allowed_repos=config.get("allowed_repos") or [],
        allowed_senders=config.get("allowed_senders") or [],
        phrase=config.get("trigger_phrase") or TRIGGER_PHRASE,
        claim_ttl_hours=int(config.get("claim_ttl_hours") or 24),
    )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _print(payload: Any) -> None:
    if isinstance(payload, (dict, list)):
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(payload)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="CCS GitHub <-> OpenHands coordination gateway")
    parser.add_argument("--config", default="gateway/config.json")
    sub = parser.add_subparsers(dest="command", required=True)

    preflight = sub.add_parser("preflight", help="authorise and claim a trigger comment")
    preflight.add_argument("--repo", required=True)
    preflight.add_argument("--comment-id", type=int, required=True)
    preflight.add_argument("--issue", type=int)
    preflight.add_argument("--claim", action="store_true", help="post the claim comment when accepted")

    report = sub.add_parser("report", help="post a structured completion report")
    report.add_argument("--repo", required=True)
    report.add_argument("--issue", type=int, required=True)
    report.add_argument("--comment-id", type=int, required=True)
    report.add_argument("--status", required=True, choices=sorted(DONE_STATES))
    report.add_argument("--body-file", required=True)

    recover = sub.add_parser("recover", help="reconcile a stale claim with GitHub state")
    recover.add_argument("--repo", required=True)
    recover.add_argument("--issue", type=int, required=True)
    recover.add_argument("--comment-id", type=int, required=True)

    poll = sub.add_parser("poll", help="list trigger comments newer than --since")
    poll.add_argument("--repo", required=True)
    poll.add_argument("--since", required=True)

    doctor = sub.add_parser("doctor", help="check configuration and GitHub reachability")
    doctor.add_argument("--repo")

    args = parser.parse_args(argv)
    config = load_config(args.config)
    gateway = build_gateway(config)

    try:
        if args.command == "preflight":
            result = gateway.preflight(args.repo, args.comment_id, args.issue, post_claim=args.claim)
            _print(result.to_dict())
            return 0 if result.accepted else 2
        if args.command == "report":
            with open(args.body_file, encoding="utf-8") as handle:
                body = handle.read()
            created = gateway.complete(args.repo, args.comment_id, args.issue, args.status, body)
            _print({"comment_url": created.get("html_url"), "comment_id": created.get("id")})
            return 0
        if args.command == "recover":
            _print(gateway.recover(args.repo, args.issue, args.comment_id))
            return 0
        if args.command == "poll":
            _print([item.to_dict() for item in gateway.poll(args.repo, args.since)])
            return 0
        if args.command == "doctor":
            report_data: dict[str, Any] = {
                "token_present": bool(gateway.client.token),
                "api_url": gateway.client.api_url,
                "allowed_repos": gateway.allowed_repos,
                "allowed_senders": sorted(gateway.allowed_senders),
                "trigger_phrase": gateway.phrase,
                "state_path": gateway.state.path,
            }
            if args.repo:
                repo = gateway.client.get_repository(args.repo)
                report_data["repository"] = {
                    "full_name": repo.get("full_name"),
                    "default_branch": repo.get("default_branch"),
                    "private": repo.get("private"),
                    "permissions": repo.get("permissions"),
                }
            _print(report_data)
            return 0
    except (GatewayError, RequestError) as error:
        _print({"error": str(error)})
        return 1
    return 1


if __name__ == "__main__":
    sys.exit(main())
