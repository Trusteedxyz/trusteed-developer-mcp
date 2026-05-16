import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

/**
 * Inline reference for the Trusteed webhook delivery contract.
 *
 * Canonical source:
 *  - Envelope: https://developers.trusteed.xyz/schemas/webhook-event-envelope/v1.json
 *
 * Documentation only. The webhook delivery worker validates outbound payloads
 * against the per-event-type schema before signing.
 */

const ENVELOPE_VERSION = "1.0";
const LAST_UPDATED = "2026-05-15";
const ENVELOPE_CANONICAL_URL =
  "https://developers.trusteed.xyz/schemas/webhook-event-envelope/v1.json";

const ENVELOPE_FIELDS: Record<string, { type: string; notes: string }> = {
  envelope_version: {
    type: "string (const)",
    notes: '"v1" — incremented on breaking envelope changes.',
  },
  event_id: {
    type: "string (UUID v4)",
    notes:
      "Deterministic per delivery attempt. Use for idempotency at your receiver.",
  },
  event_type: {
    type: "string (enum)",
    notes:
      "One of: agent.first_seen, agent.identified, checkout.created, checkout.completed, checkout.cancelled, checkout.blocked, refund.issued, rule.triggered.",
  },
  occurred_at: {
    type: "string (RFC 3339)",
    notes: "When the event happened in Trusteed. Authoritative timestamp.",
  },
  delivered_at: {
    type: "string (RFC 3339)",
    notes:
      "When this delivery attempt was signed and enqueued. Differs from occurred_at on retries.",
  },
  delivery_attempt: {
    type: "integer (1..6)",
    notes:
      "Retry schedule: 5s → 30s → 5min → 1h → 6h. Attempt 6 is final; failures go to DLQ.",
  },
  install_id: {
    type: "string",
    notes:
      "The install this delivery is scoped to. Use to locate per-install state in your extension.",
  },
  merchant_pseudonym: {
    type: "string",
    notes:
      "Per-install pseudonymised merchant identifier. Not stable across installs. Never the merchant's real id, email, or domain.",
  },
  payload: {
    type: "object",
    notes:
      "Event-type-specific. Validated against the matching per-event schema BEFORE signing.",
  },
};

const PER_EVENT_PAYLOADS: Record<
  string,
  { scope_required: string; description: string }
> = {
  "agent.first_seen": {
    scope_required: "events:subscribe:agents",
    description:
      "Fires once when a new agent identity is observed for the merchant. Payload: pseudonymised agent id, agent provider, first verification level.",
  },
  "agent.identified": {
    scope_required: "events:subscribe:agents",
    description:
      "Fires when an existing agent's identity is upgraded (e.g. KYA tier change). Payload: previous level, new level, timestamp.",
  },
  "checkout.created": {
    scope_required: "events:subscribe:checkout",
    description:
      "Fires when an agentic checkout session is created. Payload: pseudonymised cart hash, line item count, totals at creation (no PII, no PAN).",
  },
  "checkout.completed": {
    scope_required: "events:subscribe:checkout",
    description:
      "Fires after the underlying PSP settles. Payload: cart hash, settled totals, settlement protocol (ACP/AP2/x402/MCAP), TrustReceipt URI.",
  },
  "checkout.cancelled": {
    scope_required: "events:subscribe:checkout",
    description:
      "Fires on agent or merchant cancellation. Payload: cart hash, cancellation reason code.",
  },
  "checkout.blocked": {
    scope_required: "events:subscribe:rules",
    description:
      "Fires when a rules engine decision blocks a checkout. Payload: rule_code (R001..R010), reason summary, TrustReceipt URI of the decision.",
  },
  "refund.issued": {
    scope_required: "events:subscribe:refunds",
    description:
      "Fires when a refund is issued for an agentic order. Payload: order pseudonym, refund amount, reason category (no free-text reasons).",
  },
  "rule.triggered": {
    scope_required: "events:subscribe:rules",
    description:
      "Fires whenever an R001..R010 rule fires (allow, review, or block). Payload: rule_code, outcome, thresholds evaluated. High-volume — subscribe selectively.",
  },
};

const SIGNATURE_SPEC = {
  algorithm: "HMAC-SHA256",
  header: "X-Trusteed-Signature: v1=<hex>,ts=<unix>,nonce=<uuid>",
  canonical_base_string:
    "v1.{ts}.{nonce}.{METHOD}.{path}.{sha256_hex(raw_body)}",
  key_rotation:
    "Per-install HMAC key, rotatable from the developer portal. Old key remains valid 24 h after rotation.",
  freshness_window: "ts must be within ±5 minutes of receiver clock.",
  replay_defence:
    "Combine ts freshness + nonce de-duplication for ≥24 h to block replays.",
  verification_pseudocode: [
    "1. Parse header → extract v1, ts, nonce.",
    "2. Reject if |now − ts| > 300 seconds.",
    "3. Reject if nonce already seen for this install in the last 24 h.",
    "4. Compute base = `v1.${ts}.${nonce}.${req.method}.${req.path}.${sha256_hex(req.rawBody)}`.",
    "5. Compute expected = hmac_sha256(install_hmac_key, base).",
    "6. constant_time_equals(hex(expected), v1Value) — reject if not equal.",
    "7. Validate payload against the per-event-type schema before processing.",
  ],
};

const DELIVERY_BEHAVIOUR = {
  retry_schedule: ["5s", "30s", "5min", "1h", "6h"],
  dlq_after_attempts: 6,
  circuit_breaker:
    "5-minute Redis sliding window: ≥50% delivery failures pauses the endpoint for 5 minutes with auto-recovery.",
  kill_switch_scopes:
    "global → extension → version → install → endpoint. Propagates in ≤10 s via Redis pub/sub fanout.",
  ordering:
    "No global ordering. Within an install, deliveries are best-effort time-ordered but receivers MUST treat order as advisory and use occurred_at + event_id for reconciliation.",
};

const EVENT_NAMES = Object.keys(PER_EVENT_PAYLOADS);

const getWebhookEventSchemaInputSchema = {
  event_type: z
    .string()
    .optional()
    .describe(
      `Optional event type to return details for. One of: ${EVENT_NAMES.join(", ")}. Omit to return the full envelope + signature reference.`
    ),
};

const getWebhookEventSchemaOutputSchema = z.object({
  envelope_version: z.string(),
  canonical_url: z.string(),
  last_updated: z.string(),
  scope: z.enum(["envelope", "event"]),
  envelope_fields: z
    .record(z.object({ type: z.string(), notes: z.string() }))
    .optional(),
  event: z
    .object({
      event_type: z.string(),
      scope_required: z.string(),
      description: z.string(),
    })
    .optional(),
  signature: z.unknown().optional(),
  delivery: z.unknown().optional(),
});

export function registerGetWebhookEventSchema(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_webhook_event_schema",
    {
      description: `Returns the Trusteed webhook delivery contract: envelope structure, HMAC-SHA256 signature canonical base string, retry/DLQ behaviour, and per-event payload summaries. Pass an event_type to focus on one event. Available events: ${EVENT_NAMES.join(", ")}.`,
      inputSchema: getWebhookEventSchemaInputSchema,
      outputSchema: getWebhookEventSchemaOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ event_type }) => {
      if (event_type) {
        const event = PER_EVENT_PAYLOADS[event_type];
        if (!event) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown event_type "${event_type}". Available: ${EVENT_NAMES.join(", ")}`,
              },
            ],
            structuredContent: {
              envelope_version: ENVELOPE_VERSION,
              canonical_url: ENVELOPE_CANONICAL_URL,
              last_updated: LAST_UPDATED,
              scope: "event" as const,
            },
          };
        }
        const text = [
          `# Webhook event: \`${event_type}\``,
          ``,
          `- **Scope required**: \`${event.scope_required}\``,
          `- **Description**: ${event.description}`,
          ``,
          `Per-event payload schemas are published at https://developers.trusteed.xyz/schemas/event-payloads/${event_type.replace(".", "-")}/v1.json (canonical) — fetch the URL or use the SDK linter for runtime validation.`,
        ].join("\n");
        return {
          content: [{ type: "text" as const, text }],
          structuredContent: {
            envelope_version: ENVELOPE_VERSION,
            canonical_url: ENVELOPE_CANONICAL_URL,
            last_updated: LAST_UPDATED,
            scope: "event" as const,
            event: { event_type, ...event },
          },
        };
      }

      const text = [
        `# Trusteed Webhook Envelope — v${ENVELOPE_VERSION}`,
        ``,
        `**Canonical schema**: ${ENVELOPE_CANONICAL_URL}`,
        `**Snapshot date**: ${LAST_UPDATED}`,
        ``,
        `## Envelope fields`,
        ``,
        Object.entries(ENVELOPE_FIELDS)
          .map(
            ([name, info]) =>
              `- **\`${name}\`** _(${info.type})_ — ${info.notes}`
          )
          .join("\n"),
        ``,
        `## Available event types`,
        ``,
        EVENT_NAMES.map((e) => `- \`${e}\``).join("\n"),
        ``,
        `## Signature (HMAC-SHA256)`,
        ``,
        `- **Header**: \`${SIGNATURE_SPEC.header}\``,
        `- **Canonical base string**: \`${SIGNATURE_SPEC.canonical_base_string}\``,
        `- **Freshness window**: ${SIGNATURE_SPEC.freshness_window}`,
        `- **Replay defence**: ${SIGNATURE_SPEC.replay_defence}`,
        `- **Key rotation**: ${SIGNATURE_SPEC.key_rotation}`,
        ``,
        `### Verification pseudocode`,
        ``,
        SIGNATURE_SPEC.verification_pseudocode.join("\n"),
        ``,
        `## Delivery behaviour`,
        ``,
        `- **Retry schedule**: ${DELIVERY_BEHAVIOUR.retry_schedule.join(" → ")}`,
        `- **DLQ after**: attempt ${DELIVERY_BEHAVIOUR.dlq_after_attempts}`,
        `- **Circuit breaker**: ${DELIVERY_BEHAVIOUR.circuit_breaker}`,
        `- **Kill switch**: ${DELIVERY_BEHAVIOUR.kill_switch_scopes}`,
        `- **Ordering**: ${DELIVERY_BEHAVIOUR.ordering}`,
      ].join("\n");

      return {
        content: [{ type: "text" as const, text }],
        structuredContent: {
          envelope_version: ENVELOPE_VERSION,
          canonical_url: ENVELOPE_CANONICAL_URL,
          last_updated: LAST_UPDATED,
          scope: "envelope" as const,
          envelope_fields: ENVELOPE_FIELDS,
          signature: SIGNATURE_SPEC,
          delivery: DELIVERY_BEHAVIOUR,
        },
      };
    }
  );
}
