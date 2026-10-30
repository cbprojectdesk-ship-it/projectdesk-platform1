#!/usr/bin/env python3
"""Deliver a Wrangler OAuth callback to loopback in this SAME Codespace.

Keep Wrangler login running in terminal 1. Run this in terminal 2 before
authorising in the browser. Paste the failed localhost URL at the hidden prompt.
The URL stays in process memory, out of shell history and command arguments.
"""
import getpass
import http.client
import sys
import warnings
from urllib.parse import parse_qs, urlsplit


def callback_target(value):
    if any(ord(c) <= 32 or ord(c) == 127 for c in value):
        raise ValueError("Invalid callback URL")
    parsed = urlsplit(value)
    if (parsed.scheme != "http" or parsed.netloc != "localhost:8976"
            or parsed.path != "/oauth/callback" or parsed.fragment):
        raise ValueError("Expected the exact Wrangler localhost callback")
    fields = parse_qs(parsed.query, strict_parsing=True)
    if any(len(values) != 1 for values in fields.values()):
        raise ValueError("Duplicate callback fields")
    if not fields.get("code", [""])[0] or not fields.get("state", [""])[0]:
        raise ValueError("Missing authorization code or state")
    return parsed.path + "?" + parsed.query


def main():
    if not sys.stdin.isatty():
        print("Run interactively in a second terminal in the same Codespace.", file=sys.stderr)
        return 1
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", getpass.GetPassWarning)
            target = callback_target(getpass.getpass("Paste failed localhost callback URL (hidden): "))
        # Direct loopback only: no proxy, public forwarding or redirect following.
        connection = http.client.HTTPConnection("localhost", 8976, timeout=30)
        try:
            connection.request("GET", target, headers={"Host": "localhost:8976"})
            status = connection.getresponse().status
        finally:
            connection.close()
        if status != 307:
            print("Callback was not acknowledged. Restart Wrangler login; no URL was printed.")
            return 1
        print("Callback acknowledged. Check terminal 1, then run pnpm exec wrangler whoami.")
        return 0
    except (ValueError, OSError, http.client.HTTPException, EOFError, getpass.GetPassWarning):
        print("Callback could not complete. Check the URL and start a fresh Wrangler login.", file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("\nCancelled.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
