/**
 * Unit tests for `create_sandbox_key` in developer-mcp.
 *
 * Validates:
 *  - The tool registers under the expected name on a fresh McpServer.
 *  - On HTTP 200 from the upstream sandbox endpoint, the tool returns
 *    `structuredContent` with the sandbox key + base_url derived from config.
 *  - On HTTP non-2xx, the tool returns a graceful error narration without
 *    throwing (resilience contract: never crash the caller).
 *  - On `fetch` rejection (network failure), the tool returns an error
 *    narration without throwing.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCreateSandboxKey } from "../create-sandbox-key.js";

interface ToolHandler {
  (
    args: Record<string, unknown>,
    extra: Record<string, unknown>
  ): Promise<{
    content: Array<{ type: string; text: string }>;
    structuredContent: {
      api_key: string;
      expires_at: string;
      base_url: string;
      rate_limit: string;
      notes: string;
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

function buildServerWithTool(): {
  server: McpServer;
  handler: ToolHandler;
} {
  const server = new McpServer({
    name: TEST_CONFIG.name,
    version: TEST_CONFIG.version,
  });
  registerCreateSandboxKey(server, TEST_CONFIG);

  const tools = (server as unknown as { _registeredTools: RegisteredTools })
    ._registeredTools;
  expect(tools["create_sandbox_key"]).toBeDefined();

  return { server, handler: tools["create_sandbox_key"]!.handler };
}

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("create_sandbox_key", () => {
  it("registers under the expected tool name", () => {
    const { server } = buildServerWithTool();
    const tools = (server as unknown as { _registeredTools: RegisteredTools })
      ._registeredTools;
    expect(Object.keys(tools)).toContain("create_sandbox_key");
  });

  it("returns structuredContent with api_key + base_url on HTTP 200", async () => {
    const expiresIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          api_key: "sandbox_test_abc",
          expires_at: expiresIso,
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    globalThis.fetch = fetchSpy as typeof globalThis.fetch;

    const { handler } = buildServerWithTool();
    const result = await handler({}, {});

    expect(fetchSpy).toHaveBeenCalledWith(
      `${TEST_CONFIG.baseUrl}/api/v1/sandbox/key`,
      expect.objectContaining({ method: "POST" })
    );
    expect(result.structuredContent.api_key).toBe("sandbox_test_abc");
    expect(result.structuredContent.expires_at).toBe(expiresIso);
    expect(result.structuredContent.base_url).toBe(TEST_CONFIG.baseUrl);
    expect(result.structuredContent.rate_limit).toContain("20 requests/minute");
    expect(result.content[0]?.text).toContain("sandbox_test_abc");
  });

  it("returns graceful error narration when upstream returns non-2xx", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("rate limited", { status: 429 }));
    globalThis.fetch = fetchSpy as typeof globalThis.fetch;

    const { handler } = buildServerWithTool();
    const result = await handler({}, {});

    expect(result.structuredContent.api_key).toBe("");
    expect(result.structuredContent.notes).toContain("Error:");
    expect(result.content[0]?.text).toContain("Failed to generate sandbox key");
    expect(result.content[0]?.text).toContain("429");
  });

  it("returns graceful error narration when fetch rejects (network failure)", async () => {
    const fetchSpy = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    globalThis.fetch = fetchSpy as typeof globalThis.fetch;

    const { handler } = buildServerWithTool();
    const result = await handler({}, {});

    expect(result.structuredContent.api_key).toBe("");
    expect(result.structuredContent.notes).toContain("ECONNREFUSED");
    expect(result.content[0]?.text).toContain("Failed to generate sandbox key");
  });
});
