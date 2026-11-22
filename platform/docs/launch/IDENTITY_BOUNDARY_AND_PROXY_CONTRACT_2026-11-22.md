# Identity boundary and hosting proxy contract — 22 November 2026

This document records the current identity boundary and the conditions that must be
proven in the hosting environment. It is not evidence that the hosted boundary has been
verified.

## Current application behaviour

The private API requires both managed identity headers:

- `oai-authenticated-user-id`
- `oai-authenticated-user-email`

The application validates their shape, rejects malformed or oversized values, and then
uses them for membership lookup. The application cannot determine whether those headers
were supplied by the hosting edge or by a browser. That decision belongs to the hosting
proxy.

The standalone path already strips caller-supplied `oai-authenticated-user-*` headers and
requires a server-verified principal. It is not the managed hosting path and is not
deployed.

## Optional signed proof

The API now supports an optional HMAC proof:

- Environment: `QUENVIRA_IDENTITY_PROOF_SECRET`
- Header: `x-quenvira-identity-proof`
- Value: lowercase hex HMAC-SHA256 of `user_id + "\n" + email`, keyed by the secret.

When the secret is configured, a request without a valid proof is treated as
unauthenticated. The secret must never be sent to the browser or stored in the repository.
The proof is defence in depth, not a replacement for the host stripping inbound identity
headers.

The secret is optional until the hosting contract is confirmed. Enabling it without the
proxy change will lock every private request out by design.

## Required hosting contract

Before any private or real-data pilot, the hosting owner must provide evidence that:

1. The edge removes any caller-supplied `oai-authenticated-user-id` and
   `oai-authenticated-user-email` headers.
2. The edge derives identity from the authenticated session and injects the two headers
   only after authentication.
3. The Worker origin is private and cannot be reached directly by the public.
4. The optional proof secret is configured in the edge and Worker if proof mode is used.
5. Session expiry, sign-out and account revocation are tested with two real accounts.
6. A forged-header request reaches the API as anonymous and returns `401`.

Cloudflare Access is an alternative only if the deployment is moved to the standalone
path, Access is configured, the JWT verifier is called, and the Access policy is tested.
The existing verifier checks RS256, issuer, audience, expiry, `exp > iat`, `nbf`, and the
key set. It is not wired into the managed hosting route.

## Read-only probe

Run only against an approved staging origin:

```bash
cd platform
node scripts/verify-hosted-identity.mjs https://staging.example
```

The probe sends forged identity headers to `/api/quenvira/session` and expects `401`, then
checks the public response headers. It does not read business records or send credentials.
It has not been run against production.

## Current status

- Application-level malformed identity rejection: tested.
- Optional HMAC proof: tested locally.
- Hosted header stripping and private origin: **not verified**.
- Real-account MFA/session/revocation: **not verified**.
- Cloudflare Access: code exists; not configured or deployed.

Do not claim the hosted boundary is verified until the staging probe and a real-account
acceptance record exist.
