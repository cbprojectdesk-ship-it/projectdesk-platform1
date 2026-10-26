import handler from "vinext/server/fetch-handler";
import {verifyAccessIdentity} from "../server/cloudflare-access.mjs";
import {guardStandaloneRequest} from "../server/standalone-identity.mjs";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { dispatchAfterCommand } from "../server/email-background.mjs";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    // Standalone hosting is opt-in; the existing managed Sites path stays unchanged.
    if (env.QUENVIRA_HOSTING_MODE === "standalone") {
      const pathname = new URL(request.url).pathname;
      // The webhook is intentionally anonymous at the edge; its raw-body Stripe
      // signature is verified by the existing subscription webhook handler.
      const webhook = pathname === "/api/quenvira/subscription-webhook" && request.method === "POST";
      let principal = null;
      if (!webhook) {
        try {
          principal = await verifyAccessIdentity(request, {
            teamDomain: env.QUENVIRA_ACCESS_TEAM_DOMAIN,
            audience: env.QUENVIRA_ACCESS_AUDIENCE,
          });
        } catch {
          return new Response("Authentication temporarily unavailable", {status: 503});
        }
      }
      const guarded = guardStandaloneRequest(request, {verifiedPrincipal: principal});
      if (guarded.response) return guarded.response;
      request = guarded.request;
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, async () => {
      const response = await handler.fetch(request, env, ctx);
      dispatchAfterCommand(request, response, env, ctx);
      return response;
    });
  },
};
