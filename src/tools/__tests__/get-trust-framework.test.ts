import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerGetTrustFramework,
  TRUST_COMPONENTS,
  COMPONENTS_SOURCE_OF_TRUTH,
} from "../get-trust-framework.js";

interface ToolHandler {
  (
    args: Record<string, unknown>,
    extra: Record<string, unknown>
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    structuredContent: {
      components: Array<{ name: string; weight: number; description: string }>;
      componentsSourceOfTruth: string;
    };
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
  registerGetTrustFramework(server, TEST_CONFIG);
  const tools = (server as unknown as { _registeredTools: RegisteredTools })
    ._registeredTools;
  const handler = tools["get_trust_framework"]?.handler;
  if (!handler) throw new Error("get_trust_framework not registered");
  return handler;
}

/**
 * 2026-08-16 audit (H1): this table used to duplicate a DIFFERENT (fake)
 * 8-component model than the real one in
 * apps/api/src/services/trust/trust-component-calculator.ts (TRUST_WEIGHTS).
 * This package can't import that file (published standalone, no dependency
 * on apps/api — see package.json), so this test can't detect drift against
 * the live SSOT automatically. It pins the 12 real values by hand instead:
 * anyone editing TRUST_COMPONENTS without also updating this list — or
 * without re-copying from TRUST_WEIGHTS — fails loudly instead of silently
 * reintroducing a third phantom model.
 */
const EXPECTED_TRUST_WEIGHTS: Record<string, number> = {
  catalog_completeness: 0.11,
  catalog_freshness: 0.11,
  price_accuracy: 0.12,
  availability_accuracy: 0.08,
  policy_coverage: 0.08,
  checkout_success_rate: 0.11,
  fulfillment_rate: 0.08,
  dispute_rate: 0.07,
  agent_satisfaction_rate: 0.08,
  response_latency: 0.05,
  review_sentiment: 0.05,
  data_consistency: 0.06,
};

describe("get_trust_framework (developer-mcp)", () => {
  it("registers under the expected tool name", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerGetTrustFramework(server, TEST_CONFIG);
    const tools = (server as unknown as { _registeredTools: RegisteredTools })
      ._registeredTools;
    expect(Object.keys(tools)).toContain("get_trust_framework");
  });

  it("TRUST_COMPONENTS matches the real 12-component v2 model, not a phantom one", () => {
    expect(TRUST_COMPONENTS).toHaveLength(
      Object.keys(EXPECTED_TRUST_WEIGHTS).length
    );
    for (const component of TRUST_COMPONENTS) {
      expect(EXPECTED_TRUST_WEIGHTS).toHaveProperty(component.name);
      expect(component.weight).toBe(EXPECTED_TRUST_WEIGHTS[component.name]);
    }
  });

  it("weights sum to 1.0", () => {
    const sum = TRUST_COMPONENTS.reduce((acc, c) => acc + c.weight, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });

  it("structuredContent declares componentsSourceOfTruth", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    expect(result.structuredContent.componentsSourceOfTruth).toBe(
      COMPONENTS_SOURCE_OF_TRUTH
    );
    expect(result.structuredContent.componentsSourceOfTruth).toContain(
      "trust-component-calculator.ts"
    );
  });

  it("structuredContent.components matches TRUST_COMPONENTS exactly", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    expect(result.structuredContent.components).toHaveLength(
      TRUST_COMPONENTS.length
    );
    expect(result.structuredContent.components).toEqual(
      TRUST_COMPONENTS.map((c) => ({ ...c }))
    );
  });

  it("markdown declares the component count and source of truth", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";
    expect(text).toContain(
      `Trust Score Components (${TRUST_COMPONENTS.length})`
    );
    expect(text).toContain(COMPONENTS_SOURCE_OF_TRUTH);
  });
});
