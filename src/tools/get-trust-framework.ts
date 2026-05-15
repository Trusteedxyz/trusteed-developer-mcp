import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

const TRUST_COMPONENTS = [
  {
    name: "catalog_completeness",
    weight: 0.15,
    description:
      "Product field coverage (title, description, price, images, SKU)",
  },
  {
    name: "catalog_freshness",
    weight: 0.15,
    description:
      "Time since last sync — <1h: 1.0, <6h: 0.8, <24h: 0.6, >=24h: 0.3",
  },
  {
    name: "price_accuracy",
    weight: 0.15,
    description: "Price consistency between source platform and API",
  },
  {
    name: "availability_accuracy",
    weight: 0.1,
    description: "Stock declared vs actual availability at checkout",
  },
  {
    name: "policy_coverage",
    weight: 0.1,
    description: "Return, shipping, and cancellation policies published",
  },
  {
    name: "checkout_success_rate",
    weight: 0.15,
    description: "Percentage of initiated checkouts that complete",
  },
  {
    name: "fulfillment_rate",
    weight: 0.1,
    description: "Percentage of orders shipped on time",
  },
  {
    name: "dispute_rate",
    weight: 0.1,
    description: "Inverse of chargeback/dispute frequency",
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

      const markdown = `## AgenticMCPStores Trust Framework

### Trust Score Components (8)

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
        },
      };
    }
  );
}
