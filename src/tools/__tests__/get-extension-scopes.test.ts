import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetExtensionScopes } from "../get-extension-scopes.js";
import { getRegisteredHandler } from "./test-utils.js";

const TEST_CONFIG = {
  name: "Test Dev MCP",
  version: "0.0.0-test",
  baseUrl: "https://api.test.local",
} as const;

function buildHandler() {
  const server = new McpServer({
    name: TEST_CONFIG.name,
    version: TEST_CONFIG.version,
  });
  registerGetExtensionScopes(server, TEST_CONFIG);
  return getRegisteredHandler(server, "get_extension_scopes");
}

describe("get_extension_scopes (developer-mcp)", () => {
  it("registers under the expected tool name", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerGetExtensionScopes(server, TEST_CONFIG);
    expect(() => getRegisteredHandler(server, "get_extension_scopes")).not.toThrow();
  });

  it("returns 12 scopes covering events/agents/checkouts/customers/rules/config", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    expect(result.structuredContent.total_scopes).toBe(12);
    expect(result.structuredContent.scopes).toHaveLength(12);

    const scopeNames = result.structuredContent.scopes.map((s: any) => s.scope);
    expect(scopeNames).toEqual(
      expect.arrayContaining([
        "events:subscribe:checkout",
        "events:subscribe:rules",
        "events:subscribe:refunds",
        "events:subscribe:agents",
        "agents:read",
        "agents:read:reputation",
        "checkouts:read",
        "checkouts:read:pricing",
        "customers:read:pii",
        "rules:read",
        "merchant_config:read:public",
        "extension_config:write",
      ])
    );
  });

  it("customers:read:pii is the only scope flagged pii=true and high risk", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    const pii = result.structuredContent.scopes.filter((s: any) => s.pii);
    expect(pii).toHaveLength(1);
    expect(pii[0]?.scope).toBe("customers:read:pii");
    expect(pii[0]?.data_classification).toBe("pii");
    expect(pii[0]?.raises_risk_category_to).toBe("high");
  });

  it("every scope entry has purpose, example_use_case, and not_for populated", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    for (const scope of result.structuredContent.scopes) {
      expect(
        scope.purpose,
        `scope ${scope.scope} missing purpose`
      ).toBeTruthy();
      expect(
        scope.example_use_case,
        `scope ${scope.scope} missing example_use_case`
      ).toBeTruthy();
      expect(
        scope.not_for,
        `scope ${scope.scope} missing not_for`
      ).toBeTruthy();
    }
  });

  it("returns a single scope when scope arg matches", async () => {
    const handler = buildHandler();
    const result = await handler({ scope: "customers:read:pii" }, {});

    expect(result.structuredContent.scopes).toHaveLength(1);
    expect(result.structuredContent.scopes[0]?.scope).toBe(
      "customers:read:pii"
    );
    expect(result.content[0]?.text).toContain("customers:read:pii");
  });

  it("unknown scope returns empty scopes array and error message", async () => {
    const handler = buildHandler();
    const result = await handler({ scope: "nonexistent:scope" }, {});

    expect(result.structuredContent.scopes).toHaveLength(0);
    expect(result.content[0]?.text).toContain("Unknown scope");
  });

  it("minimum_principle text mentions PII review and re-consent", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    expect(result.structuredContent.minimum_principle).toMatch(
      /minimum|smallest|PII/i
    );
    expect(result.structuredContent.minimum_principle).toMatch(/re-consent/i);
  });

  it("markdown lists all 12 scopes with risk_category callouts", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";

    for (const scope of result.structuredContent.scopes) {
      expect(text).toContain(scope.scope);
    }
    expect(text).toContain("Data classification");
    expect(text.toLowerCase()).toContain("risk_category");
  });
});
