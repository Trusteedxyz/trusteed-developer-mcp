/**
 * Developer MCP Server — Factory
 *
 * Public, unauthenticated MCP server that exposes Trusteed
 * documentation as interactive tools for IDEs (Claude Desktop, VS Code,
 * Cursor, JetBrains).
 *
 * SDK features adopted from latest @modelcontextprotocol/sdk:
 * - structuredContent + outputSchema: machine-readable JSON alongside text
 * - Tool annotations: readOnlyHint for all tools (docs are read-only)
 * - MCP resources: passive reference data (llms.txt, agent-policy, openapi)
 * - MCP prompts: guided workflows (integration-helper, troubleshoot)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerSearchDocs } from "./tools/search-docs.js";
import { registerGetOpenApiSchema } from "./tools/get-openapi-schema.js";
import { registerGetIntegrationGuide } from "./tools/get-integration-guide.js";
import { registerGetTrustFramework } from "./tools/get-trust-framework.js";
import { registerGetProtocolInfo } from "./tools/get-protocol-info.js";
import { registerCreateSandboxKey } from "./tools/create-sandbox-key.js";
import { registerGetAgentRules } from "./tools/get-agent-rules.js";
import { registerGetExtensionManifestSchema } from "./tools/get-extension-manifest-schema.js";
import { registerGetWebhookEventSchema } from "./tools/get-webhook-event-schema.js";
import { registerGetExtensionScopes } from "./tools/get-extension-scopes.js";
import { registerLlmsTxtResource } from "./resources/llms-txt.js";
import { registerAgentPolicyResource } from "./resources/agent-policy.js";
import { registerOpenApiSpecResource } from "./resources/openapi-spec.js";
import { registerIntegrationHelperPrompt } from "./prompts/integration-helper.js";
import { registerTroubleshootPrompt } from "./prompts/troubleshoot.js";

export interface DeveloperMCPServerConfig {
  readonly name?: string;
  readonly version?: string;
  readonly baseUrl?: string;
}

const DEFAULT_CONFIG: Required<DeveloperMCPServerConfig> = {
  name: "Trusteed Developer MCP",
  // Must track `package.json` `version` — this is what the MCP client shows in
  // `initialize`. Kept as a literal because `package.json` is not importable
  // from the compiled ESM output without `resolveJsonModule` + a runtime read.
  version: "0.2.0",
  baseUrl: "https://www.trusteed.xyz",
};

export function createDeveloperMCPServer(
  config: DeveloperMCPServerConfig = {}
): McpServer {
  const resolved = { ...DEFAULT_CONFIG, ...config };

  const server = new McpServer({
    name: resolved.name,
    version: resolved.version,
  });

  // --- Tools (10) ---
  registerSearchDocs(server, resolved);
  registerGetOpenApiSchema(server, resolved);
  registerGetIntegrationGuide(server, resolved);
  registerGetTrustFramework(server, resolved);
  registerGetProtocolInfo(server, resolved);
  registerGetAgentRules(server, resolved);
  registerCreateSandboxKey(server, resolved);
  // Extension marketplace docs (developer-time guidance only — not runtime validators)
  registerGetExtensionManifestSchema(server, resolved);
  registerGetWebhookEventSchema(server, resolved);
  registerGetExtensionScopes(server, resolved);

  // --- Resources (3) — passive reference data ---
  registerLlmsTxtResource(server, resolved);
  registerAgentPolicyResource(server, resolved);
  registerOpenApiSpecResource(server, resolved);

  // --- Prompts (2) — guided workflows ---
  registerIntegrationHelperPrompt(server, resolved);
  registerTroubleshootPrompt(server, resolved);

  return server;
}
