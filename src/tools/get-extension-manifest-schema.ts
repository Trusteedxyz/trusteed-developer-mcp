import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

/**
 * Inline snapshot of the Trusteed Extension Manifest JSON Schema.
 *
 * Canonical source: https://developers.trusteed.xyz/schemas/extension-manifest/v1.json
 *
 * This snapshot is for developer-time guidance (IDE autocomplete, structure docs).
 * For runtime validation, fetch the canonical URL or use the SDK linter — the
 * authoritative schema may include security patches not yet mirrored here.
 */
const MANIFEST_SCHEMA_SNAPSHOT_VERSION = "1.0";
const MANIFEST_SCHEMA_LAST_UPDATED = "2026-05-15";
const MANIFEST_SCHEMA_CANONICAL_URL =
  "https://developers.trusteed.xyz/schemas/extension-manifest/v1.json";

const MANIFEST_REQUIRED_FIELDS = [
  "schema_version",
  "name",
  "vendor",
  "version",
  "description",
  "scopes_requested",
  "endpoints",
  "event_subscriptions",
  "pricing_model",
  "data_retention_days",
  "supported_regions",
  "support_url",
  "privacy_policy_url",
  "terms_url",
  "risk_category",
  "changelog",
] as const;

const MANIFEST_FIELD_GUIDE: Record<
  string,
  { type: string; constraint: string; notes: string }
> = {
  schema_version: {
    type: "string (const)",
    constraint: '"1.0"',
    notes: "Bump only on breaking manifest changes. v1 is current.",
  },
  name: {
    type: "string",
    constraint: "3–100 chars, plain text only",
    notes:
      "No markdown, no HTML, no LLM-instruction-like content. Rejected if it looks like a prompt.",
  },
  vendor: {
    type: "string",
    constraint: "^[a-z0-9-]{2,40}$",
    notes:
      "Vendor slug assigned by Trusteed during onboarding. Cannot be auto-claimed.",
  },
  version: {
    type: "string",
    constraint: "^\\d+\\.\\d+\\.\\d+$ (SemVer)",
    notes:
      "Immutable once submitted. Bumps trigger merchant re-consent if scopes change.",
  },
  description: {
    type: "string",
    constraint: "30–2000 chars, plain text only",
    notes:
      "Rendered after Unicode normalization + control-char strip. Never fed to LLM context.",
  },
  scopes_requested: {
    type: "string[] (enum)",
    constraint: "uniqueItems, minItems 1",
    notes:
      "Call get_extension_scopes for the full enum + data classification per scope.",
  },
  endpoints: {
    type: "object[]",
    constraint:
      "minItems 1, kind ∈ {webhook_receiver, health_check, erasure_callback}",
    notes:
      "All URLs MUST be https. Region constrains where Trusteed routes deliveries from (EU/US/UK/APAC/LATAM).",
  },
  event_subscriptions: {
    type: "string[] (enum)",
    constraint: "uniqueItems",
    notes:
      "Must be covered by scopes_requested. Call get_webhook_event_schema for envelope + per-event payloads.",
  },
  pricing_model: {
    type: "object",
    constraint: "type ∈ {free, flat_monthly, per_event, tiered}",
    notes:
      "V1 private beta: 0% commission. V1.5 GA: 15% platform commission, 30-day payout delay.",
  },
  data_retention_days: {
    type: "integer",
    constraint: "0–90",
    notes:
      "Maximum days the extension may retain webhook payloads. 0 = process-and-forget. Enforced via erasure_callback audit.",
  },
  supported_regions: {
    type: "string[] (enum)",
    constraint: "subset of {EU, US, UK, APAC, LATAM}",
    notes: "Merchant installs are gated to regions the extension supports.",
  },
  support_url: {
    type: "string (uri, https)",
    constraint: "valid HTTPS URL",
    notes: "Surfaced in marketplace listing + merchant install confirmation.",
  },
  privacy_policy_url: {
    type: "string (uri, https)",
    constraint: "valid HTTPS URL",
    notes:
      "Reviewed manually during submission. Must cover the scopes_requested.",
  },
  terms_url: {
    type: "string (uri, https)",
    constraint: "valid HTTPS URL",
    notes: "Merchant must agree before install.",
  },
  risk_category: {
    type: "string (enum)",
    constraint: "low | medium | high",
    notes:
      "Determines review SLA and rate limits. PII-touching extensions are at least medium.",
  },
  changelog: {
    type: "string",
    constraint: "30–4000 chars, plain text",
    notes:
      "Merchants see diff between installed version changelog and new version on update.",
  },
};

const SIGNING_INFO = {
  envelope: "JWS Compact (Ed25519)",
  signed_by: [
    "Developer key (Ed25519, registered during onboarding)",
    "Countersigned by Trusteed manifest-signing key post-review",
  ],
  canonicalization: "RFC 8785 over the manifest body before signing",
  verification:
    "Use Trust-Receipt-Verifier `trust-receipt verify --type manifest <file.jws>` once shipped, or the SDK linter for now.",
};

const getExtensionManifestSchemaOutputSchema = z.object({
  schema_version: z.string(),
  last_updated: z.string(),
  canonical_url: z.string(),
  required_fields: z.array(z.string()),
  field_guide: z.record(
    z.object({
      type: z.string(),
      constraint: z.string(),
      notes: z.string(),
    })
  ),
  signing: z.object({
    envelope: z.string(),
    signed_by: z.array(z.string()),
    canonicalization: z.string(),
    verification: z.string(),
  }),
});

export function registerGetExtensionManifestSchema(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_extension_manifest_schema",
    {
      description:
        "Returns the Trusteed extension manifest schema: required fields, per-field constraints with developer-oriented notes, and the signing envelope. Documentation only — for runtime validation, use the SDK linter or fetch the canonical schema URL.",
      inputSchema: {},
      outputSchema: getExtensionManifestSchemaOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async () => {
      const structured = {
        schema_version: MANIFEST_SCHEMA_SNAPSHOT_VERSION,
        last_updated: MANIFEST_SCHEMA_LAST_UPDATED,
        canonical_url: MANIFEST_SCHEMA_CANONICAL_URL,
        required_fields: [...MANIFEST_REQUIRED_FIELDS],
        field_guide: MANIFEST_FIELD_GUIDE,
        signing: SIGNING_INFO,
      };

      const text = [
        `# Trusteed Extension Manifest — v${MANIFEST_SCHEMA_SNAPSHOT_VERSION}`,
        ``,
        `**Canonical schema**: ${MANIFEST_SCHEMA_CANONICAL_URL}`,
        `**Snapshot date**: ${MANIFEST_SCHEMA_LAST_UPDATED}`,
        ``,
        `## Required fields`,
        ``,
        MANIFEST_REQUIRED_FIELDS.map((f) => `- \`${f}\``).join("\n"),
        ``,
        `## Field guide`,
        ``,
        Object.entries(MANIFEST_FIELD_GUIDE)
          .map(
            ([name, info]) =>
              `### \`${name}\`\n- **Type**: ${info.type}\n- **Constraint**: ${info.constraint}\n- **Notes**: ${info.notes}`
          )
          .join("\n\n"),
        ``,
        `## Signing`,
        ``,
        `- **Envelope**: ${SIGNING_INFO.envelope}`,
        `- **Canonicalization**: ${SIGNING_INFO.canonicalization}`,
        `- **Signed by**:\n${SIGNING_INFO.signed_by.map((s) => `  - ${s}`).join("\n")}`,
        `- **Verification**: ${SIGNING_INFO.verification}`,
        ``,
        `> This snapshot is for IDE-time guidance. For runtime validation, fetch the canonical URL or use \`@trusteed/sdk-extension\`'s linter — the authoritative schema may include security patches not yet mirrored here.`,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: structured,
      };
    }
  );
}
