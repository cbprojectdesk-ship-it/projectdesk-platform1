#!/usr/bin/env python3
"""Create or inspect the OpenHands event automation that backs the gateway.

One automation per repository. The automation is triggered by GitHub
``issue_comment.created`` events delivered through the OpenHands GitHub App and
runs the coordination prompt in ``automation_prompt.md``.

Usage:
    python3 gateway/provision_automation.py plan --config gateway/automation.json
    python3 gateway/provision_automation.py apply --config gateway/automation.json
    python3 gateway/provision_automation.py status --config gateway/automation.json
    python3 gateway/provision_automation.py dispatch --config gateway/automation.json
    python3 gateway/provision_automation.py runs --config gateway/automation.json

``apply`` is idempotent: an existing automation with the same name is left
alone unless ``--recreate`` is passed. ``plan`` never writes.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any

DEFAULT_HOST = "https://app.all-hands.dev"

# The prompt always carries the canonical refusals, even if a config omits them.
CANONICAL_FORBIDDEN_ACTIONS = (
    "merge any pull request",
    "push or commit to main, master or production",
    "force-push",
    "deploy, release or publish to production or staging",
    "activate payments, billing, Stripe or checkout",
    "send email, newsletters or messages to customers or advertisers",
    "read, print or expose credentials, tokens or .env files",
    "delete, drop, truncate or overwrite customer or production data",
    "change branch protection, authentication, authorisation or rate limits",
    "create paid resources or accounts",
)
API = "/api/automation/v1"
CREATE_API = "/api/automation/v1/preset/prompt"


class ApiError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"HTTP {status}: {body[:500]}")
        self.status = status


def request(method: str, path: str, payload: Any = None, host: str | None = None) -> Any:
    base = (host or os.environ.get("OPENHANDS_HOST") or DEFAULT_HOST).rstrip("/")
    url = f"{base}{path}"
    token = os.environ.get("OPENHANDS_API_KEY") or os.environ.get("OPENHANDS_CLOUD_API_KEY")
    if not token:
        raise ApiError(401, "OPENHANDS_API_KEY is not set")
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    body = None
    if payload is not None:
        body = json.dumps(payload).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as error:
        raise ApiError(error.code, error.read().decode("utf-8", "replace")) from error


def load_config(path: str) -> dict[str, Any]:
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def render_prompt(config: dict[str, Any]) -> str:
    template_path = config.get("prompt_template") or os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "automation_prompt.md"
    )
    with open(template_path, encoding="utf-8") as handle:
        template = handle.read()
    senders = config.get("allowed_senders") or []
    actions = list(dict.fromkeys([*CANONICAL_FORBIDDEN_ACTIONS, *(config.get("forbidden_actions") or [])]))
    replacements = {
        "{{REPO}}": config["repository"],
        "{{PHRASE}}": config.get("trigger_phrase", "/ccs-task"),
        "{{ALLOWED_SENDERS}}": ", ".join(f"@{name}" for name in senders) if senders else "(none: rely on author_association)",
        "{{AUTOMATION_NAME}}": config["name"],
        "{{FORBIDDEN_ACTIONS}}": ", ".join(actions),
        "{{MAX_RUNTIME_MINUTES}}": str(config.get("max_runtime_minutes", 30)),
    }
    for placeholder, value in replacements.items():
        template = template.replace(placeholder, value)
    return template


def validate_automation_config(config: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    repo = config.get("repository", "")
    if not isinstance(repo, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo):
        errors.append("repository must be owner/name")
    phrase = config.get("trigger_phrase", "/ccs-task")
    if not isinstance(phrase, str) or not phrase.startswith("/") or any(character.isspace() for character in phrase):
        errors.append("trigger_phrase must start with / and contain no whitespace")
    for sender in config.get("allowed_senders") or []:
        if not isinstance(sender, str) or not re.fullmatch(r"[A-Za-z0-9-]+(?:\[bot\])?", sender):
            errors.append(f"allowed sender {sender!r} is invalid")
    if config.get("allow_bot_senders") and not config.get("acknowledge_loop_risk"):
        errors.append("allow_bot_senders requires acknowledge_loop_risk=true")
    if config.get("raw_filter"):
        errors.append("raw_filter is not supported; the repository, bot and sender gates are mandatory")
    if not config.get("name"):
        errors.append("name is required")
    return errors


def build_automation_payload(config: dict[str, Any]) -> dict[str, Any]:
    errors = validate_automation_config(config)
    if errors:
        raise ValueError("; ".join(errors))
    repo = config["repository"]
    phrase = config.get("trigger_phrase", "/ccs-task")
    senders = [name.lower() for name in (config.get("allowed_senders") or [])]
    sender_clause = ""
    if senders:
        quoted = " || ".join(f"lower(sender.login) == '{name}'" for name in senders)
        sender_clause = f" && ({quoted})"
    bot_clause = "" if config.get("allow_bot_senders") else " && sender.type != 'Bot'"
    trigger_filter = (
        f"repository.full_name == '{repo}'"
        f"{bot_clause}"
        f" && icontains(comment.body, '{phrase}')"
        f"{sender_clause}"
    )
    if config.get("cron"):
        trigger: dict[str, Any] = {
            "type": "cron",
            "schedule": config["cron"]["schedule"],
            "timezone": config["cron"].get("timezone", "UTC"),
        }
    else:
        trigger = {
            "type": "event",
            "source": "github",
            "on": config.get("event_key", "issue_comment.created"),
        }
    if trigger["type"] == "event":
        trigger["filter"] = trigger_filter
    return {
        "name": config["name"],
        "prompt": render_prompt(config),
        "trigger": trigger,
        "timeout": int(config.get("max_runtime_minutes", 30)) * 60,
        "repos": [{"url": f"https://github.com/{repo}", "ref": config.get("default_branch", "main")}],
    }


def find_by_name(name: str) -> dict[str, Any] | None:
    listing = request("GET", f"{API}?limit=100") or {}
    for automation in listing.get("automations", []):
        if automation.get("name") == name:
            return automation
    return None


def cmd_plan(config: dict[str, Any]) -> int:
    payload = build_automation_payload(config)
    print(json.dumps({"would_create": payload["name"], "payload": payload}, indent=2))
    existing = find_by_name(config["name"])
    print(
        json.dumps(
            {
                "existing_automation": existing.get("id") if existing else None,
                "action": "none (already exists)" if existing else "create",
            },
            indent=2,
        )
    )
    return 0


def cmd_apply(config: dict[str, Any], recreate: bool) -> int:
    existing = find_by_name(config["name"])
    if existing and not recreate:
        print(json.dumps({"status": "exists", "id": existing["id"], "action": "none"}, indent=2))
        return 0
    if existing and recreate:
        request("DELETE", f"{API}/{existing['id']}")
        print(json.dumps({"deleted": existing["id"]}))
    payload = build_automation_payload(config)
    created = request("POST", CREATE_API, payload)
    print(json.dumps({"status": "created", "id": created.get("id"), "trigger": created.get("trigger")}, indent=2))
    return 0


def _resolve_id(config: dict[str, Any]) -> str:
    automation_id = config.get("automation_id")
    if automation_id:
        return automation_id
    existing = find_by_name(config["name"])
    if not existing:
        raise SystemExit(f"no automation named {config['name']!r}; run apply first")
    return existing["id"]


def cmd_status(config: dict[str, Any]) -> int:
    automation_id = _resolve_id(config)
    detail = request("GET", f"{API}/{automation_id}")
    runs = request("GET", f"{API}/{automation_id}/runs?limit=10") or {}
    print(
        json.dumps(
            {
                "automation": {
                    "id": detail.get("id"),
                    "name": detail.get("name"),
                    "enabled": detail.get("enabled"),
                    "trigger": detail.get("trigger"),
                    "created_at": detail.get("created_at"),
                },
                "runs": [
                    {
                        "id": run.get("id"),
                        "status": run.get("status"),
                        "created_at": run.get("created_at"),
                        "conversation_id": run.get("conversation_id"),
                        "error": run.get("error_detail"),
                    }
                    for run in runs.get("runs", runs.get("items", []))
                ],
            },
            indent=2,
        )
    )
    return 0


def cmd_dispatch(config: dict[str, Any]) -> int:
    automation_id = _resolve_id(config)
    print(json.dumps(request("POST", f"{API}/{automation_id}/dispatch"), indent=2))
    return 0


def cmd_runs(config: dict[str, Any]) -> int:
    automation_id = _resolve_id(config)
    print(json.dumps(request("GET", f"{API}/{automation_id}/runs?limit=20"), indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["plan", "apply", "status", "dispatch", "runs"])
    parser.add_argument("--config", required=True)
    parser.add_argument("--recreate", action="store_true", help="delete and recreate an existing automation")
    args = parser.parse_args(argv)

    config = load_config(args.config)
    try:
        if args.command == "plan":
            return cmd_plan(config)
        if args.command == "apply":
            return cmd_apply(config, args.recreate)
        if args.command == "status":
            return cmd_status(config)
        if args.command == "dispatch":
            return cmd_dispatch(config)
        if args.command == "runs":
            return cmd_runs(config)
    except (ApiError, ValueError) as error:
        print(json.dumps({"error": str(error)}))
        return 1
    return 1


if __name__ == "__main__":
    sys.exit(main())
