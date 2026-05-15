import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DeveloperMCPServerConfig } from "../server.js";

export const AGENT_RULES_VERSION = "0.1.0";

export const AGENT_RULES = [
  {
    code: "R001",
    name: "UNKNOWN_AGENT",
    tier: 1,
    action: "BLOCK",
    configurable: false,
    needsLookup: false,
    description:
      "Blocks agents with no verifiable identity. Fires when agentId is 'unknown_agent' or when identity is present but trust score is unavailable.",
    when: "agentId === 'unknown_agent' OR (agentId !== null AND trustScore === null)",
    defaults: {},
    merchantPolicyKey: "r001",
    merchantConfig: "requireKyaLevel (1|2|3, optional)",
    examples: [
      "Anonymous HTTP client without X-Agent-ID header → BLOCK",
      "Claude.ai with valid identity → PASS",
    ],
  },
  {
    code: "R002",
    name: "LOW_TRUST_SCORE",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks agents whose Trusteed trust score falls below the merchant-configured threshold.",
    when: "agentTrustScore < threshold",
    defaults: { threshold: 30 },
    merchantPolicyKey: "r002",
    merchantConfig: "threshold (0–100, default 30)",
    examples: [
      "Agent with trustScore=25, merchant threshold=30 → BLOCK",
      "Agent with trustScore=45, merchant threshold=30 → PASS",
    ],
  },
  {
    code: "R003",
    name: "HIGH_VELOCITY_CHECKOUT",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents that attempt too many checkouts in a short time window. Requires historical event lookup.",
    when: "velocityCount(agentId, windowSeconds) > maxAttempts",
    defaults: { windowSeconds: 60, maxAttempts: 5 },
    merchantPolicyKey: "r003",
    merchantConfig: "windowSeconds (default 60), maxAttempts (default 5)",
    examples: [
      "Agent with 8 checkouts in 60s, max=5 → BLOCK",
      "Agent with 3 checkouts in 60s, max=5 → PASS",
    ],
  },
  {
    code: "R004",
    name: "PROMO_ABUSE",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks agents that probe excessive discount codes in a single order. Reads cart attribute _discount_codes_tried.",
    when: "cartAttributes._discount_codes_tried > maxAttempts",
    defaults: { maxAttempts: 5 },
    merchantPolicyKey: "r004",
    merchantConfig: "maxAttempts (default 5)",
    examples: [
      "Agent tried 8 promo codes in one cart, max=5 → BLOCK",
      "Agent tried 2 promo codes, max=5 → PASS",
    ],
  },
  {
    code: "R005",
    name: "RETURN_ABUSE",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents with an abnormally high refund ratio over the lookback window. Requires historical refund data.",
    when: "refundRatio(agentId, windowDays) > maxRatio",
    defaults: { windowDays: 90, maxRatio: 0.5 },
    merchantPolicyKey: "r005",
    merchantConfig: "windowDays (default 90), maxRatio (default 0.5)",
    examples: [
      "Agent refunded 7 of 10 orders in 90d (ratio=0.7), max=0.5 → BLOCK",
      "Agent refunded 3 of 10 orders (ratio=0.3), max=0.5 → PASS",
    ],
  },
  {
    code: "R006",
    name: "CANCEL_POST_SHIP",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents with too many post-shipment cancellations, indicating potential fraud. Requires historical order data.",
    when: "cancelCount(agentId, windowDays) > maxCancellations",
    defaults: { windowDays: 90, maxCancellations: 3 },
    merchantPolicyKey: "r006",
    merchantConfig: "windowDays (default 90), maxCancellations (default 3)",
    examples: [
      "Agent cancelled 5 orders after shipping in 90d, max=3 → BLOCK",
      "Agent cancelled 1 order after shipping, max=3 → PASS",
    ],
  },
  {
    code: "R007",
    name: "AMOUNT_SPIKE",
    tier: 1,
    action: "BLOCK",
    configurable: false,
    needsLookup: false,
    description:
      "Blocks orders from high-risk countries (OFAC sanctions list) or where the cart total is a suspicious multiple of the merchant's average order value.",
    when: "country IN highRiskList OR (cartTotal / merchantAvgOrder > spikeMultiplier)",
    defaults: {
      highRiskCountries: ["KP", "IR", "SY", "CU"],
      spikeMultiplier: 5.0,
    },
    merchantPolicyKey: "r007",
    merchantConfig:
      "spikeMultiplier (default 5.0), highRiskCountries (default OFAC list), merchantAvgOrderCents",
    examples: [
      "Order from KP (North Korea) → BLOCK",
      "Cart=$500, merchant avg=$50, spike=10x (threshold=5) → BLOCK",
      "Cart=$200, merchant avg=$100, spike=2x (threshold=5) → PASS",
    ],
  },
  {
    code: "R008",
    name: "CATEGORY_DRIFT",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents whose current cart categories are unusually dissimilar to their historical purchasing patterns. Detects account takeover or misuse.",
    when: "categorySimilarity(agentId, lineItems) < minSimilarity",
    defaults: { minSimilarity: 0.4 },
    merchantPolicyKey: "r008",
    merchantConfig: "minSimilarity (0.0–1.0, default 0.4), lookbackOrders",
    examples: [
      "Agent historically bought electronics, now buying jewelry (similarity=0.1, min=0.4) → BLOCK",
      "Agent buying books as usual (similarity=0.8, min=0.4) → PASS",
    ],
  },
  {
    code: "R009",
    name: "DISPUTE_HISTORY",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents with too many payment disputes (chargebacks) in the lookback window.",
    when: "disputeCount(agentId, windowDays) > maxDisputes",
    defaults: { windowDays: 30, maxDisputes: 2 },
    merchantPolicyKey: "r009",
    merchantConfig: "windowDays (default 30), maxDisputes (default 2)",
    examples: [
      "Agent filed 4 chargebacks in 30d, max=2 → BLOCK",
      "Agent filed 1 chargeback in 30d, max=2 → PASS",
    ],
  },
  {
    code: "R010",
    name: "STRIPE_HIGH_RISK",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks checkouts where Stripe Radar classifies the payment as 'highest' risk. Only evaluates Stripe payment methods.",
    when: "paymentMethod includes 'stripe' AND stripeRadarLevel === required",
    defaults: { stripeRiskLevel: "highest" },
    merchantPolicyKey: "r010",
    merchantConfig:
      "stripeRiskLevel ('highest'|'elevated'|'normal', default 'highest')",
    examples: [
      "Stripe Radar score = highest risk, threshold = highest → BLOCK",
      "Stripe Radar score = elevated risk, threshold = highest → PASS",
      "Non-Stripe payment method → PASS (rule skipped)",
    ],
  },
] as const;

type AgentRule = (typeof AGENT_RULES)[number];

const TIER_DESCRIPTIONS = {
  1: "Kill-switch — always enforced, not merchant-configurable. These rules protect against OFAC violations and unidentifiable agents.",
  2: "Configurable — merchant can adjust thresholds or disable per their risk policy.",
} as const;

function buildRuleMarkdown(rule: AgentRule): string {
  const defaultsStr =
    Object.keys(rule.defaults).length > 0
      ? Object.entries(rule.defaults)
          .map(([k, v]) => `\`${k}\`: ${JSON.stringify(v)}`)
          .join(", ")
      : "none";

  return `### ${rule.code} — ${rule.name}

**Tier ${rule.tier}** (${TIER_DESCRIPTIONS[rule.tier as 1 | 2]})
**Default action:** ${rule.action} | **Configurable:** ${rule.configurable ? "Yes" : "No"} | **Needs historical lookup:** ${rule.needsLookup ? "Yes" : "No"}

${rule.description}

**Fires when:** \`${rule.when}\`

**Default thresholds:** ${defaultsStr}

**Merchant config key:** \`merchantPolicies.${rule.merchantPolicyKey}\` — ${rule.merchantConfig}

**Examples:**
${rule.examples.map((e) => `- ${e}`).join("\n")}`;
}

const getAgentRulesOutputSchema = z.object({
  rules: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      tier: z.number(),
      action: z.string(),
      configurable: z.boolean(),
      needsLookup: z.boolean(),
      description: z.string(),
      when: z.string(),
      defaults: z.record(z.unknown()),
      merchantPolicyKey: z.string(),
      merchantConfig: z.string(),
      examples: z.array(z.string()),
    })
  ),
  total: z.number(),
  version: z.string(),
  tier1Codes: z.array(z.string()),
  tier2Codes: z.array(z.string()),
});

export function registerGetAgentRules(
  server: McpServer,
  config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_agent_rules",
    {
      description:
        "Get the 10 agent control points (R001–R010) that govern when agentic checkouts are blocked, reviewed, or allowed. Each rule includes its enforcement tier, configurable thresholds, trigger condition, and examples. Use this to understand or implement the Trusteed agent enforcement model.",
      inputSchema: {
        filter: z
          .enum(["all", "tier1", "tier2", "needs_lookup", "no_lookup"])
          .optional()
          .describe(
            "Filter rules. 'tier1' = kill-switch rules (always on). 'tier2' = configurable rules. 'needs_lookup' = rules requiring historical data. 'no_lookup' = stateless rules. Default: 'all'."
          ),
        code: z
          .string()
          .regex(/^R0\d{2}$/)
          .optional()
          .describe(
            "Return a single rule by code (e.g. 'R001'). Overrides 'filter' when provided."
          ),
      },
      outputSchema: getAgentRulesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ filter = "all", code }) => {
      let rules: readonly AgentRule[];

      if (code) {
        const found = AGENT_RULES.find((r) => r.code === code.toUpperCase());
        if (!found) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Rule ${code} not found. Valid codes: ${AGENT_RULES.map((r) => r.code).join(", ")}.`,
              },
            ],
            structuredContent: {
              rules: [],
              total: 0,
              version: AGENT_RULES_VERSION,
            },
          };
        }
        rules = [found];
      } else {
        rules =
          filter === "tier1"
            ? AGENT_RULES.filter((r) => r.tier === 1)
            : filter === "tier2"
              ? AGENT_RULES.filter((r) => r.tier === 2)
              : filter === "needs_lookup"
                ? AGENT_RULES.filter((r) => r.needsLookup)
                : filter === "no_lookup"
                  ? AGENT_RULES.filter((r) => !r.needsLookup)
                  : AGENT_RULES;
      }

      const summaryTable = rules
        .map(
          (r) =>
            `| ${r.code} | ${r.name} | ${r.tier} | ${r.configurable ? "Yes" : "No"} | ${r.needsLookup ? "Yes" : "No"} |`
        )
        .join("\n");

      const detailBlocks = rules.map(buildRuleMarkdown).join("\n\n---\n\n");

      const markdown = `## Trusteed Agent Control Points (R001–R010)

**Version:** ${AGENT_RULES_VERSION} | **Showing:** ${rules.length} of ${AGENT_RULES.length} rules

### Summary

| Code | Name | Tier | Configurable | Needs Lookup |
|------|------|------|-------------|--------------|
${summaryTable}

**Tier 1 (kill-switch):** R001, R007 — always enforced
**Tier 2 (configurable):** R002–R006, R008–R010 — merchant-adjustable thresholds

---

## Rule Details

${detailBlocks}

---

## Integration

Implement these rules via the Trusteed enforcement API:

\`\`\`
POST ${config.baseUrl ?? ""}/api/v1/rules/evaluate
{
  "agentId": "string",
  "agentTrustScore": 0–100,
  "orderContext": { "cartTotalCents": number, "lineItems": [...], ... },
  "merchantPolicies": { "r002": { "threshold": 40 }, ... }
}
\`\`\`

- **Rules snapshot** (offline evaluation): \`GET ${config.baseUrl ?? ""}/:storeSlug/rules-snapshot\`
- **Agent policy contract**: \`${config.baseUrl ?? ""}/.well-known/agent-policy.json\`
- **Full spec**: \`${config.baseUrl ?? ""}/docs/architecture/checkout-enforcement\``;

      return {
        content: [{ type: "text" as const, text: markdown }],
        structuredContent: {
          rules: rules.map((r) => ({ ...r })),
          total: rules.length,
          version: AGENT_RULES_VERSION,
          tier1Codes: ["R001", "R007"],
          tier2Codes: [
            "R002",
            "R003",
            "R004",
            "R005",
            "R006",
            "R008",
            "R009",
            "R010",
          ],
        },
      };
    }
  );
}
