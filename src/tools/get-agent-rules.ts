import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DeveloperMCPServerConfig } from "../server.js";
import { AGENT_RULES, AGENT_RULES_VERSION } from "../content/agent-rules.js";

export { AGENT_RULES, AGENT_RULES_VERSION };

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
${rule.examples.map((e) => `- ${e}`).join("\n")}

**Plain-language guide:** ${HELP_BASE_URL}#${rule.code}`;
}

const HELP_BASE_URL = "https://trusteed.xyz/en/agent-rules";

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
      helpUrl: z.string(),
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
        "Get the 46 merchant agent rules (R001-R062) that govern when agentic checkouts are blocked, reviewed, or allowed. They include KYA rules, merchant-friendly controls, caps on value and volume, provider allow/block lists, approval flows, and basic presets that do not require eIDAS, QTSP, Visa Verifier, or payment-network attestation.",
      inputSchema: {
        filter: z
          .enum(["all", "tier1", "tier2", "needs_lookup", "no_lookup"])
          .optional()
          .describe(
            "Filter rules. 'tier1' = strict baseline rules. 'tier2' = configurable merchant rules. 'needs_lookup' = rules requiring historical data. 'no_lookup' = stateless rules. Default: 'all'."
          ),
        code: z
          .string()
          .regex(/^R\d{3}$/)
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
              tier1Codes: AGENT_RULES.filter((r) => r.tier === 1).map(
                (r) => r.code
              ),
              tier2Codes: AGENT_RULES.filter((r) => r.tier === 2).map(
                (r) => r.code
              ),
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

      const tier1Codes = AGENT_RULES.filter((r) => r.tier === 1).map(
        (r) => r.code
      );
      const tier2Codes = AGENT_RULES.filter((r) => r.tier === 2).map(
        (r) => r.code
      );

      const markdown = `## Trusteed Merchant Agent Rules (R001–R062)

**Version:** ${AGENT_RULES_VERSION} | **Showing:** ${rules.length} of ${AGENT_RULES.length} rules

### Summary

| Code | Name | Tier | Configurable | Needs Lookup |
|------|------|------|-------------|--------------|
${summaryTable}

**Tier 1:** ${tier1Codes.join(", ")} — strict baseline controls
**Tier 2:** ${tier2Codes.join(", ")} — configurable merchant controls

These are merchant/catalog rules. They are separate from TrustReceipt conformance vectors and do not require eIDAS, QTSP, Visa Verifier, or payment-network-specific evidence.

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
          rules: rules.map((r) => ({
            ...r,
            helpUrl: `${HELP_BASE_URL}#${r.code}`,
          })),
          total: rules.length,
          version: AGENT_RULES_VERSION,
          tier1Codes,
          tier2Codes,
        },
      };
    }
  );
}
