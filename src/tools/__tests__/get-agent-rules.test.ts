import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerGetAgentRules,
  AGENT_RULES,
  AGENT_RULES_VERSION,
} from "../get-agent-rules.js";

interface ToolHandler {
  (
    args: Record<string, unknown>,
    extra: Record<string, unknown>
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    structuredContent: {
      rules: Array<{ code: string; tier: number; needsLookup: boolean }>;
      total: number;
      version: string;
      tier1Codes: string[];
      tier2Codes: string[];
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
  registerGetAgentRules(server, TEST_CONFIG);
  const tools = (server as unknown as { _registeredTools: RegisteredTools })
    ._registeredTools;
  const handler = tools["get_agent_rules"]?.handler;
  if (!handler) throw new Error("get_agent_rules not registered");
  return handler;
}

describe("get_agent_rules (developer-mcp)", () => {
  it("registers under the expected tool name", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerGetAgentRules(server, TEST_CONFIG);
    const tools = (server as unknown as { _registeredTools: RegisteredTools })
      ._registeredTools;
    expect(Object.keys(tools)).toContain("get_agent_rules");
  });

  it("returns every rule in the catalogue when no filter provided", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    // Atado al propio catálogo, no a una cifra a mano: el conteo creció de 30 a
    // 46 y una constante literal habría vuelto a quedarse atrás en silencio.
    expect(result.structuredContent.total).toBe(AGENT_RULES.length);
    expect(result.structuredContent.rules).toHaveLength(AGENT_RULES.length);
    expect(result.structuredContent.version).toBe(AGENT_RULES_VERSION);
  });

  it("structuredContent includes computed tier1 codes", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    expect(result.structuredContent.tier1Codes).toEqual(
      expect.arrayContaining(["R001", "R002", "R003", "R005", "R008", "R009"])
    );
    expect(result.structuredContent.tier1Codes).toHaveLength(
      AGENT_RULES.filter((r) => r.tier === 1).length
    );
  });

  it("filter=tier1 returns only tier 1 rules", async () => {
    const handler = buildHandler();
    const result = await handler({ filter: "tier1" }, {});

    expect(result.structuredContent.total).toBe(
      AGENT_RULES.filter((r) => r.tier === 1).length
    );
    for (const rule of result.structuredContent.rules) {
      expect(rule.tier).toBe(1);
    }
  });

  it("filter=tier2 returns only tier 2 rules", async () => {
    const handler = buildHandler();
    const result = await handler({ filter: "tier2" }, {});

    expect(result.structuredContent.total).toBe(
      AGENT_RULES.filter((r) => r.tier === 2).length
    );
    for (const rule of result.structuredContent.rules) {
      expect(rule.tier).toBe(2);
    }
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

  it("code=R030 returns a single rule with correct metadata", async () => {
    const handler = buildHandler();
    const result = await handler({ code: "R030" }, {});

    expect(result.structuredContent.total).toBe(1);
    const rule = result.structuredContent.rules[0]!;
    expect(rule.code).toBe("R030");
    expect(rule.tier).toBe(2);
    expect(result.content[0]?.text).toContain("SIMPLE_CONTROLS");
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
