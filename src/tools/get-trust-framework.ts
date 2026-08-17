import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

/**
 * 2026-08-16 audit (H1, code-review of P1-5 fix): this used to be a SECOND,
 * independent 8-component/weight table that matched no model in the codebase
 * — the same phantom methodology that `well-known.routes.ts`'s
 * `agent-commerce.json` used to hardcode, fixed there by deriving from the
 * real SSOT. This package cannot do the same: `@trusteed/developer-mcp` is
 * published standalone (no dependency on `@agenticmcpstores/database` or the
 * `apps/api` trust engine, by design — see package.json), so it cannot
 * import `TRUST_WEIGHTS` at build time. Values below are a manual copy kept
 * in sync by hand, same convention as `agent-policy-data.json`'s
 * `componentsSourceOfTruth` field.
 *
 * SOURCE OF TRUTH: apps/api/src/services/trust/trust-component-calculator.ts
 * (TRUST_WEIGHTS). Descriptions match apps/dashboard/src/data/agent-policy-data.json
 * `trustScoreInterpretation.components`. If you change one, change all three.
 */
export const COMPONENTS_SOURCE_OF_TRUTH =
  "apps/api/src/services/trust/trust-component-calculator.ts (TRUST_WEIGHTS)";

export const TRUST_COMPONENTS = [
  {
    name: "catalog_completeness",
    weight: 0.11,
    description: "Fraction of products with complete required fields",
  },
  {
    name: "catalog_freshness",
    weight: 0.11,
    description: "Fraction of product records updated within 24 hours",
  },
  {
    name: "price_accuracy",
    weight: 0.12,
    description:
      "Agreement between listed price and checkout price at settlement",
  },
  {
    name: "availability_accuracy",
    weight: 0.08,
    description: "Agreement between reported stock and actual stock at checkout",
  },
  {
    name: "policy_coverage",
    weight: 0.08,
    description:
      "Fraction of required policy fields populated (return, shipping, cancellation)",
  },
  {
    name: "checkout_success_rate",
    weight: 0.11,
    description:
      "Fraction of initiated checkouts that completed without error in the last 7 days",
  },
  {
    name: "fulfillment_rate",
    weight: 0.08,
    description: "Fraction of confirmed orders shipped within the stated handling time",
  },
  {
    name: "dispute_rate",
    weight: 0.07,
    description:
      "Inverse of the fraction of orders that generated a dispute or chargeback (lower disputes → higher score)",
  },
  {
    name: "agent_satisfaction_rate",
    weight: 0.08,
    description:
      "Agent feedback signals from completed sessions (success rate of intent fulfillment)",
  },
  {
    name: "response_latency",
    weight: 0.05,
    description: "P95 response latency on MCP tool calls vs platform target",
  },
  {
    name: "review_sentiment",
    weight: 0.05,
    description: "Aggregated sentiment of post-purchase reviews",
  },
  {
    name: "data_consistency",
    weight: 0.06,
    description:
      "Cross-channel consistency between catalog, search results, and checkout responses",
  },
] as const;

const MERCHANT_STATES = [
  {
    status: "active",
    range: ">= 0.5",
    visibility: "Full visibility in agent results",
  },
  {
    status: "deprioritized",
    range: "[0.3, 0.5)",
    visibility: "After all active merchants (hard boundary)",
  },
  {
    status: "hidden",
    range: "[0.2, 0.3)",
    visibility: "Excluded from agent API",
  },
  { status: "suspended", range: "< 0.2", visibility: "Excluded everywhere" },
] as const;

const RANKING_FORMULA = {
  formula:
    "relevanceScore = (text_relevance * 0.55) + (store_trust_score * 0.25) + (freshness * 0.10) + (in_stock * 0.10)",
  factors: [
    {
      name: "text_relevance",
      weight: 0.55,
      description:
        "Title (1.0) + description (0.5) + tag (0.3), normalized to 0-1",
    },
    {
      name: "store_trust_score",
      weight: 0.25,
      description: "Operational trust score (0-1)",
    },
    {
      name: "freshness",
      weight: 0.1,
      description: "Decay by hours since sync",
    },
    {
      name: "in_stock",
      weight: 0.1,
      description: "Binary: 1.0 if available, 0.0 if out of stock",
    },
  ],
} as const;

const getTrustFrameworkOutputSchema = z.object({
  components: z.array(
    z.object({
      name: z.string(),
      weight: z.number(),
      description: z.string(),
    })
  ),
  rankingFormula: z.object({
    formula: z.string(),
    factors: z.array(
      z.object({
        name: z.string(),
        weight: z.number(),
        description: z.string(),
      })
    ),
  }),
  merchantStates: z.array(
    z.object({
      status: z.string(),
      range: z.string(),
      visibility: z.string(),
    })
  ),
  verificationLevels: z.array(z.string()),
  updateCadence: z.string(),
  range: z.object({ min: z.number(), max: z.number() }),
  componentsSourceOfTruth: z.string(),
});

export function registerGetTrustFramework(
  server: McpServer,
  config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_trust_framework",
    {
      description:
        "Get the complete trust scoring framework: components, weights, ranking formula, merchant states, and verification levels. This is the public, transparent methodology used to rank merchants in agent search results.",
      inputSchema: {},
      outputSchema: getTrustFrameworkOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      const componentsTable = TRUST_COMPONENTS.map(
        (c) =>
          `| ${c.name} | ${(c.weight * 100).toFixed(0)}% | ${c.description} |`
      ).join("\n");

      const statesTable = MERCHANT_STATES.map(
        (s) => `| ${s.status} | ${s.range} | ${s.visibility} |`
      ).join("\n");

      const formulaFactors = RANKING_FORMULA.factors
        .map(
          (f) =>
            `| ${f.name} | ${(f.weight * 100).toFixed(0)}% | ${f.description} |`
        )
        .join("\n");

      const markdown = `## Trusteed Trust Framework

### Trust Score Components (${TRUST_COMPONENTS.length})

Source of truth: ${COMPONENTS_SOURCE_OF_TRUTH}

| Component | Weight | Description |
|-----------|--------|-------------|
${componentsTable}

**Total:** 100% | **Update cadence:** Every 6 hours | **Range:** 0.0 - 1.0

### Ranking Formula (Published)

\`\`\`
${RANKING_FORMULA.formula}
\`\`\`

| Factor | Weight | Description |
|--------|--------|-------------|
${formulaFactors}

**Deprioritization:** Products from merchants with trustScore < 0.5 appear AFTER all active-store products (hard two-tier sort).

### Merchant Status States

| Status | Trust Score | Visibility |
|--------|------------|------------|
${statesTable}

**Minimum eligibility:** BASIC verification + trustScore >= 0.3

### Verification Levels

| Level | Requirements |
|-------|-------------|
| UNVERIFIED | No verification completed |
| BASIC | Email and domain control verified |
| STANDARD | Business review completed |
| PREMIUM | Business review + operational history |

### Machine-Readable References

- Trust methodology: ${config.baseUrl ?? ""}/en/trust
- Agent commerce contract: ${config.baseUrl ?? ""}/.well-known/agent-commerce.json
- Agent policy contract: ${config.baseUrl ?? ""}/.well-known/agent-policy.json`;

      return {
        content: [{ type: "text" as const, text: markdown }],
        structuredContent: {
          components: TRUST_COMPONENTS.map((c) => ({ ...c })),
          rankingFormula: {
            formula: RANKING_FORMULA.formula,
            factors: RANKING_FORMULA.factors.map((f) => ({ ...f })),
          },
          merchantStates: MERCHANT_STATES.map((s) => ({ ...s })),
          verificationLevels: ["UNVERIFIED", "BASIC", "STANDARD", "PREMIUM"],
          updateCadence: "6h",
          range: { min: 0, max: 1 },
          componentsSourceOfTruth: COMPONENTS_SOURCE_OF_TRUTH,
        },
      };
    }
  );
}
