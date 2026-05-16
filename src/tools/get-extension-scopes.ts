import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

/**
 * Inline catalog of Trusteed extension scopes.
 *
 * Canonical source: extension-manifest.schema.json `scopes_requested` enum.
 * This catalog adds human-readable purpose, data classification, and PII flags
 * to help developers request the minimum viable scope set.
 *
 * Documentation only — actual scope enforcement happens server-side at install
 * consent and at runtime token issuance.
 */

const LAST_UPDATED = "2026-05-15";

type DataClassification = "public" | "operational" | "sensitive" | "pii";
type RiskCategory = "low" | "medium" | "high";

interface ScopeDescriptor {
  scope: string;
  purpose: string;
  data_classification: DataClassification;
  pii: boolean;
  raises_risk_category_to: RiskCategory;
  example_use_case: string;
  not_for: string;
}

const SCOPES: ScopeDescriptor[] = [
  {
    scope: "events:subscribe:checkout",
    purpose:
      "Subscribe to checkout lifecycle events (created, completed, cancelled).",
    data_classification: "operational",
    pii: false,
    raises_risk_category_to: "low",
    example_use_case:
      "Send a Slack notification when a high-value agentic checkout completes.",
    not_for:
      "Reading customer identity. Use customers:read:pii (and justify it) for that.",
  },
  {
    scope: "events:subscribe:rules",
    purpose:
      "Subscribe to rule firing events (rule.triggered, checkout.blocked).",
    data_classification: "operational",
    pii: false,
    raises_risk_category_to: "low",
    example_use_case:
      "Power a merchant dashboard showing which agents are getting blocked and why.",
    not_for:
      "Modifying rule decisions — V1 extensions cannot influence the rules engine.",
  },
  {
    scope: "events:subscribe:refunds",
    purpose: "Subscribe to refund issuance events.",
    data_classification: "operational",
    pii: false,
    raises_risk_category_to: "low",
    example_use_case:
      "Sync refunds to the merchant's external accounting/ERP system.",
    not_for: "Issuing refunds — read-only stream.",
  },
  {
    scope: "events:subscribe:agents",
    purpose: "Subscribe to agent identity events (first_seen, identified).",
    data_classification: "operational",
    pii: false,
    raises_risk_category_to: "low",
    example_use_case:
      "Track which agent providers a merchant gets traffic from over time.",
    not_for:
      "Resolving agent identities to humans — agents are pseudonymised per install.",
  },
  {
    scope: "agents:read",
    purpose:
      "Look up pseudonymised agent metadata (provider, verification level).",
    data_classification: "operational",
    pii: false,
    raises_risk_category_to: "medium",
    example_use_case: "Enrich a merchant report with agent provider breakdown.",
    not_for:
      "Building cross-merchant agent dossiers — extensions are scoped to one install at a time.",
  },
  {
    scope: "agents:read:reputation",
    purpose: "Read the agent's Trusteed reputation/trust score.",
    data_classification: "sensitive",
    pii: false,
    raises_risk_category_to: "medium",
    example_use_case:
      "Surface a 'high-trust agent' badge in a merchant's analytics dashboard.",
    not_for:
      "Reselling Trusteed trust scores — see Trusteed Developer Terms §3.",
  },
  {
    scope: "checkouts:read",
    purpose:
      "Read checkout metadata (line item count, totals, status) for installs that have delivered events to this extension.",
    data_classification: "operational",
    pii: false,
    raises_risk_category_to: "medium",
    example_use_case:
      "Reconcile webhook deliveries against the current checkout state.",
    not_for:
      "Bulk export — runtime lookups are observed-object-scoped, not list-scoped.",
  },
  {
    scope: "checkouts:read:pricing",
    purpose:
      "Read full pricing breakdown (per-line, discounts, taxes, shipping).",
    data_classification: "sensitive",
    pii: false,
    raises_risk_category_to: "medium",
    example_use_case:
      "Build a tax-compliance report showing tax collected per region.",
    not_for: "Catalog price intelligence on third-party merchants.",
  },
  {
    scope: "customers:read:pii",
    purpose:
      "Read merchant-customer PII (email, shipping address) for completed checkouts.",
    data_classification: "pii",
    pii: true,
    raises_risk_category_to: "high",
    example_use_case:
      "Send post-purchase emails on behalf of the merchant (with separate consent in the merchant's mailer).",
    not_for:
      "Building a contact list across merchants. Triggers manual review + extended approval SLA. Requires DPA acceptance.",
  },
  {
    scope: "rules:read",
    purpose: "Read the merchant's R001..R010 thresholds and policy snapshot.",
    data_classification: "sensitive",
    pii: false,
    raises_risk_category_to: "medium",
    example_use_case:
      "Help the merchant tune their thresholds based on observed agent behaviour.",
    not_for:
      "Modifying thresholds — write access is reserved to the merchant dashboard.",
  },
  {
    scope: "merchant_config:read:public",
    purpose:
      "Read the public-facing portion of the merchant's configuration (display name, branding, locale).",
    data_classification: "public",
    pii: false,
    raises_risk_category_to: "low",
    example_use_case:
      "Render the merchant's brand colour in your extension's UI.",
    not_for:
      "Reading secrets, API keys, or internal config — those are never exposed.",
  },
  {
    scope: "extension_config:write",
    purpose:
      "Persist extension-specific configuration that the merchant sets in your extension's settings UI.",
    data_classification: "operational",
    pii: false,
    raises_risk_category_to: "low",
    example_use_case:
      "Store the merchant's Slack webhook URL and notification preferences.",
    not_for:
      "Storing merchant PII or PAN — use a separate compliant backend for that.",
  },
];

const SCOPE_NAMES = SCOPES.map((s) => s.scope);

const getExtensionScopesInputSchema = {
  scope: z
    .string()
    .optional()
    .describe(
      `Optional scope name to return a single descriptor for. Omit to return the full catalog. Available scopes: ${SCOPE_NAMES.join(", ")}.`
    ),
};

const ScopeDescriptorSchema = z.object({
  scope: z.string(),
  purpose: z.string(),
  data_classification: z.enum(["public", "operational", "sensitive", "pii"]),
  pii: z.boolean(),
  raises_risk_category_to: z.enum(["low", "medium", "high"]),
  example_use_case: z.string(),
  not_for: z.string(),
});

const getExtensionScopesOutputSchema = z.object({
  last_updated: z.string(),
  total_scopes: z.number(),
  minimum_principle: z.string(),
  scopes: z.array(ScopeDescriptorSchema),
});

function renderScopeMarkdown(s: ScopeDescriptor): string {
  return [
    `### \`${s.scope}\``,
    `- **Purpose**: ${s.purpose}`,
    `- **Data classification**: ${s.data_classification}${s.pii ? " (PII)" : ""}`,
    `- **Raises extension risk_category to at least**: ${s.raises_risk_category_to}`,
    `- **Example use case**: ${s.example_use_case}`,
    `- **Not for**: ${s.not_for}`,
  ].join("\n");
}

export function registerGetExtensionScopes(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_extension_scopes",
    {
      description:
        "Returns the catalog of Trusteed extension scopes with data classification, PII flag, risk category impact, and per-scope guidance on appropriate vs inappropriate use. Pass a scope name to focus on one entry. Helps developers request the minimum viable scope set to improve review SLA and merchant install conversion.",
      inputSchema: getExtensionScopesInputSchema,
      outputSchema: getExtensionScopesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ scope }) => {
      const MINIMUM_PRINCIPLE =
        "Request the smallest set of scopes that delivers your core use case. Extensions touching PII (customers:read:pii) face manual review, a high risk_category, and slower install conversion. Adding a scope post-publish requires every installed merchant to re-consent.";

      if (scope) {
        const match = SCOPES.find((s) => s.scope === scope);
        if (!match) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown scope "${scope}". Available: ${SCOPE_NAMES.join(", ")}`,
              },
            ],
            structuredContent: {
              last_updated: LAST_UPDATED,
              total_scopes: SCOPES.length,
              minimum_principle: MINIMUM_PRINCIPLE,
              scopes: [],
            },
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: [
                `# Trusteed extension scope: \`${match.scope}\``,
                ``,
                renderScopeMarkdown(match),
                ``,
                `> ${MINIMUM_PRINCIPLE}`,
              ].join("\n"),
            },
          ],
          structuredContent: {
            last_updated: LAST_UPDATED,
            total_scopes: SCOPES.length,
            minimum_principle: MINIMUM_PRINCIPLE,
            scopes: [match],
          },
        };
      }

      const text = [
        `# Trusteed Extension Scopes — ${SCOPES.length} total`,
        ``,
        `**Snapshot date**: ${LAST_UPDATED}`,
        ``,
        `> ${MINIMUM_PRINCIPLE}`,
        ``,
        SCOPES.map(renderScopeMarkdown).join("\n\n"),
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          last_updated: LAST_UPDATED,
          total_scopes: SCOPES.length,
          minimum_principle: MINIMUM_PRINCIPLE,
          scopes: SCOPES,
        },
      };
    }
  );
}
