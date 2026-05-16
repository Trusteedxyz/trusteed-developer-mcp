import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetWebhookEventSchema } from "../get-webhook-event-schema.js";

interface EventDetail {
  event_type: string;
  scope_required: string;
  description: string;
}

interface EnvelopeOutput {
  envelope_version: string;
  canonical_url: string;
  last_updated: string;
  scope: "envelope" | "event";
  envelope_fields?: Record<string, { type: string; notes: string }>;
  event?: EventDetail;
  signature?: { canonical_base_string: string; freshness_window: string };
  delivery?: { retry_schedule: string[]; dlq_after_attempts: number };
}

interface ToolHandler {
  (
    args: Record<string, unknown>,
    extra: Record<string, unknown>
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    structuredContent: EnvelopeOutput;
  }>;
}

interface RegisteredTools {
  [name: string]: { handler: ToolHandler };
}

const TEST_CONFIG = {
  name: "Test Dev MCP",
  version: "0.0.0-test",
  baseUrl: "https://api.test.local",
} as const;

function buildHandler(): ToolHandler {
  const server = new McpServer({
    name: TEST_CONFIG.name,
    version: TEST_CONFIG.version,
  });
  registerGetWebhookEventSchema(server, TEST_CONFIG);
  const tools = (server as unknown as { _registeredTools: RegisteredTools })
    ._registeredTools;
  const handler = tools["get_webhook_event_schema"]?.handler;
  if (!handler) throw new Error("get_webhook_event_schema not registered");
  return handler;
}

describe("get_webhook_event_schema (developer-mcp)", () => {
  it("registers under the expected tool name", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerGetWebhookEventSchema(server, TEST_CONFIG);
    const tools = (server as unknown as { _registeredTools: RegisteredTools })
      ._registeredTools;
    expect(Object.keys(tools)).toContain("get_webhook_event_schema");
  });

  it("returns envelope structure when no event_type is given", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    expect(result.structuredContent.scope).toBe("envelope");
    expect(result.structuredContent.envelope_fields).toBeDefined();
    expect(result.structuredContent.signature).toBeDefined();
    expect(result.structuredContent.delivery).toBeDefined();
  });

  it("envelope includes all 9 required fields", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const fields = Object.keys(result.structuredContent.envelope_fields ?? {});

    expect(fields).toEqual(
      expect.arrayContaining([
        "envelope_version",
        "event_id",
        "event_type",
        "occurred_at",
        "delivered_at",
        "delivery_attempt",
        "install_id",
        "merchant_pseudonym",
        "payload",
      ])
    );
  });

  it("signature spec uses HMAC-SHA256 canonical base string v1.{ts}.{nonce}...", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const sig = result.structuredContent.signature as
      | { canonical_base_string: string }
      | undefined;

    expect(sig?.canonical_base_string).toContain("v1.{ts}.{nonce}");
    expect(sig?.canonical_base_string).toContain("sha256_hex(raw_body)");
  });

  it("retry schedule is [5s, 30s, 5min, 1h, 6h] and DLQ at attempt 6", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const delivery = result.structuredContent.delivery as
      | { retry_schedule: string[]; dlq_after_attempts: number }
      | undefined;

    expect(delivery?.retry_schedule).toEqual(["5s", "30s", "5min", "1h", "6h"]);
    expect(delivery?.dlq_after_attempts).toBe(6);
  });

  it("returns per-event detail for checkout.completed", async () => {
    const handler = buildHandler();
    const result = await handler({ event_type: "checkout.completed" }, {});

    expect(result.structuredContent.scope).toBe("event");
    expect(result.structuredContent.event?.event_type).toBe(
      "checkout.completed"
    );
    expect(result.structuredContent.event?.scope_required).toBe(
      "events:subscribe:checkout"
    );
  });

  it("unknown event_type returns an error message", async () => {
    const handler = buildHandler();
    const result = await handler({ event_type: "checkout.unknown" }, {});

    expect(result.content[0]?.text).toContain("Unknown event_type");
    expect(result.structuredContent.event).toBeUndefined();
  });

  it("markdown for envelope includes all 8 documented event names", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";

    for (const event of [
      "agent.first_seen",
      "agent.identified",
      "checkout.created",
      "checkout.completed",
      "checkout.cancelled",
      "checkout.blocked",
      "refund.issued",
      "rule.triggered",
    ]) {
      expect(text).toContain(event);
    }
  });

  it("markdown contains constant-time comparison guidance", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";

    expect(text.toLowerCase()).toContain("constant_time_equals");
  });
});
