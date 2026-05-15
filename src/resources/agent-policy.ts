import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

const AGENT_POLICY = {
  type: "agent-policy-contract",
  version: "1.0",
  trustScoreRanges: [
    {
      min: 0.9,
      max: 1.0,
      label: "EXCELLENT",
      guidance: "High confidence. Proceed normally.",
    },
    { min: 0.8, max: 0.9, label: "GOOD", guidance: "Reliable. Standard flow." },
    {
      min: 0.7,
      max: 0.8,
      label: "ACCEPTABLE",
      guidance: "Meets minimum. Show score in summary.",
    },
    {
      min: 0.5,
      max: 0.7,
      label: "CAUTION",
      guidance: "Inform user, state score, ask confirmation.",
    },
    {
      min: 0.0,
      max: 0.5,
      label: "RESTRICTED",
      guidance: "Do NOT checkout. Suggest alternatives.",
    },
  ],
  confirmationPolicy: {
    alwaysRequire: [
      "complete_checkout",
      "create_cart",
      "place_order",
      "submit_payment_method",
    ],
    neverRequire: [
      "search_products",
      "get_product_detail",
      "compare_products",
      "check_availability",
    ],
  },
  failSafeRules: [
    { condition: "merchant.trustScore < 0.5", action: "DO_NOT_PROCEED" },
    {
      condition: "checkout_response.status == 'error'",
      action: "ABORT_AND_INFORM",
    },
    { condition: "availability_freshness > 24h", action: "WARN_USER" },
  ],
  ticketLimits: { defaultMaxOrderValue: { amount: 500, currency: "USD" } },
  consent: {
    policyUrl: "/{storeSlug}/consent-policy",
    spec: "NIST-AISI-2026",
    description:
      "GET the consent-policy endpoint for a store to discover its data access requirements before performing operations.",
  },
  dataRetention: {
    policyUrl: "/{storeSlug}/data-retention",
    spec: "NIST-AISI-2026",
    summary: {
      mcpToolEvents: "90 days",
      oauthAuditLogs: "90 days",
      agentEvents: "90 days",
      orderEvents: "180 days",
      syncLogs: "30 days",
    },
    description:
      "GET the data-retention endpoint for specific retention periods. Data is purged automatically after the stated retention window.",
  },
};

export function registerAgentPolicyResource(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.resource(
    "agent-policy",
    "policy://agent-policy",
    {
      description:
        "Agent action policies: trust score ranges with guidance, confirmation requirements, fail-safe rules, and ticket limits.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "policy://agent-policy",
          mimeType: "application/json" as const,
          text: JSON.stringify(AGENT_POLICY, null, 2),
        },
      ],
    })
  );
}
