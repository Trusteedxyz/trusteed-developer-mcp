import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerGetAgentRules,
  AGENT_RULES,
  AGENT_RULES_VERSION,
} from "../get-agent-rules.js";
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
  registerGetAgentRules(server, TEST_CONFIG);
  return getRegisteredHandler(server, "get_agent_rules");
}

describe("get_agent_rules (developer-mcp)", () => {
  it("registers under the expected tool name", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerGetAgentRules(server, TEST_CONFIG);
    expect(() => getRegisteredHandler(server, "get_agent_rules")).not.toThrow();
  });

  it("returns all 30 rules when no filter provided", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    expect(result.structuredContent.total).toBe(30);
    expect(result.structuredContent.rules).toHaveLength(30);
    expect(result.structuredContent.version).toBe(AGENT_RULES_VERSION);
  });

  it("structuredContent tier1Codes contains R001, R002, R005 (3 non-configurable blockers)", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    expect(result.structuredContent.tier1Codes).toEqual(
      expect.arrayContaining(["R001", "R002", "R005"])
    );
    expect(result.structuredContent.tier1Codes).toHaveLength(3);
  });

  it("filter=tier1 returns 3 rules (R001, R002, R005)", async () => {
    const handler = buildHandler();
    const result = await handler({ filter: "tier1" }, {});

    expect(result.structuredContent.total).toBe(3);
    const codes = result.structuredContent.rules.map((r: any) => r.code);
    expect(codes).toEqual(expect.arrayContaining(["R001", "R002", "R005"]));
  });

  it("filter=tier2 returns 27 rules (all except R001, R002, R005)", async () => {
    const handler = buildHandler();
    const result = await handler({ filter: "tier2" }, {});

    expect(result.structuredContent.total).toBe(27);
    const codes = result.structuredContent.rules.map((r: any) => r.code);
    expect(codes).not.toContain("R001");
    expect(codes).not.toContain("R002");
    expect(codes).not.toContain("R005");
  });

  it("filter=needs_lookup returns only rules with needsLookup=true", async () => {
    const handler = buildHandler();
    const result = await handler({ filter: "needs_lookup" }, {});

    const expected = AGENT_RULES.filter((r) => r.needsLookup).length;
    expect(result.structuredContent.total).toBe(expected);
    for (const rule of result.structuredContent.rules) {
      expect(rule.needsLookup).toBe(true);
    }
  });

  it("filter=no_lookup returns only stateless rules", async () => {
    const handler = buildHandler();
    const result = await handler({ filter: "no_lookup" }, {});

    for (const rule of result.structuredContent.rules) {
      expect(rule.needsLookup).toBe(false);
    }
  });

  it("code=R007 returns a single rule with correct metadata", async () => {
    const handler = buildHandler();
    const result = await handler({ code: "R007" }, {});

    expect(result.structuredContent.total).toBe(1);
    const rule = result.structuredContent.rules[0]!;
    expect(rule.code).toBe("R007");
    expect(rule.tier).toBe(2);
    expect(result.content[0]?.text).toContain("R007");
  });

  it("unknown code returns empty rules and error message", async () => {
    const handler = buildHandler();
    const result = await handler({ code: "R099" }, {});

    expect(result.structuredContent.total).toBe(0);
    expect(result.content[0]?.text).toContain("R099");
    expect(result.content[0]?.text).toContain("not found");
  });

  it("markdown output contains all 30 rule codes", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";

    for (const rule of AGENT_RULES) {
      expect(text).toContain(rule.code);
      expect(text).toContain(rule.name);
    }
  });

  it("markdown includes integration endpoint using baseUrl from config", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";

    expect(text).toContain("https://api.test.local");
    expect(text).toContain("/api/v1/rules/evaluate");
  });
});
