import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerGetExtensionManifestSchema } from "../get-extension-manifest-schema.js";
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
  registerGetExtensionManifestSchema(server, TEST_CONFIG);
  return getRegisteredHandler(server, "get_extension_manifest_schema");
}

describe("get_extension_manifest_schema (developer-mcp)", () => {
  it("registers under the expected tool name", () => {
    const server = new McpServer({ name: "t", version: "0" });
    registerGetExtensionManifestSchema(server, TEST_CONFIG);
    expect(() =>
      getRegisteredHandler(server, "get_extension_manifest_schema")
    ).not.toThrow();
  });

  it("returns schema_version 1.0 and canonical URL", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    expect(result.structuredContent.schema_version).toBe("1.0");
    expect(result.structuredContent.canonical_url).toMatch(
      /^https:\/\/developers\.trusteed\.xyz\/schemas\/extension-manifest\/v1\.json$/
    );
  });

  it("includes all 16 required manifest fields", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const fields = result.structuredContent.required_fields;

    expect(fields).toHaveLength(16);
    expect(fields).toEqual(
      expect.arrayContaining([
        "schema_version",
        "name",
        "vendor",
        "version",
        "scopes_requested",
        "endpoints",
        "event_subscriptions",
        "pricing_model",
        "data_retention_days",
        "supported_regions",
        "privacy_policy_url",
        "risk_category",
        "changelog",
      ])
    );
  });

  it("field_guide entries each have type, constraint, notes", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});

    for (const [name, info] of Object.entries(
      result.structuredContent.field_guide as Record<string, any>
    )) {
      expect(info.type, `field ${name} missing type`).toBeTruthy();
      expect(info.constraint, `field ${name} missing constraint`).toBeTruthy();
      expect(info.notes, `field ${name} missing notes`).toBeTruthy();
    }
  });

  it("signing envelope is JWS Compact Ed25519 with RFC 8785", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const signing = result.structuredContent.signing;

    expect(signing.envelope).toMatch(/JWS Compact.*Ed25519/);
    expect(signing.canonicalization).toMatch(/RFC 8785/);
    expect(signing.signed_by.length).toBeGreaterThanOrEqual(2);
    expect(signing.signed_by.join(" ")).toMatch(/countersigned/i);
  });

  it("markdown output references the canonical URL", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";

    expect(text).toContain(
      "https://developers.trusteed.xyz/schemas/extension-manifest/v1.json"
    );
    expect(text).toContain("Required fields");
    expect(text).toContain("Field guide");
    expect(text).toContain("Signing");
  });

  it("warns explicitly that this is developer-time guidance, not runtime validation", async () => {
    const handler = buildHandler();
    const result = await handler({}, {});
    const text = result.content[0]?.text ?? "";

    expect(text).toMatch(
      /IDE-time|developer-time|not.*runtime|linter|canonical URL/i
    );
  });
});
