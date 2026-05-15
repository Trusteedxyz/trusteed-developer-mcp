import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

/**
 * Exposes the llms.txt content as an MCP resource.
 * Agents can read this to understand the full platform manifest.
 */

const LLMS_TXT_CONTENT = `# Trusteed — llms.txt (summary for MCP resource)

Platform: Multi-merchant trust and execution layer for agentic commerce.
API Base: https://www.trusteed.xyz/api/v1
Auth: X-Agent-Api-Key header
Endpoints: 8 (search, detail, compare, availability, cart, checkout, orders, merchants)
Rate Limits: FREE 100/min, PRO 1000/min, ENTERPRISE unlimited
Protocols: ACP (Stripe fiat), AP2 (Google mandate), x402 (USDC stablecoin)
Trust Score: 8-component operational reliability (0.0-1.0), updated every 6h
Ranking: text_relevance*0.55 + trust*0.25 + freshness*0.10 + in_stock*0.10
Platforms: Shopify, WooCommerce, Etsy (beta)

Discovery files:
- /llms.txt (full version)
- /mcp.json (MCP manifest)
- /.well-known/agent-commerce.json (capabilities)
- /.well-known/agent-policy.json (policies)
- /api/openapi.json (OpenAPI 3.0)

For the complete llms.txt, fetch: https://www.trusteed.xyz/llms.txt`;

export function registerLlmsTxtResource(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.resource(
    "llms-txt",
    "docs://llms.txt",
    {
      description:
        "Summary of the Trusteed llms.txt manifest — platform overview, endpoints, trust score, and discovery files.",
      mimeType: "text/plain",
    },
    async () => ({
      contents: [
        {
          uri: "docs://llms.txt",
          mimeType: "text/plain" as const,
          text: LLMS_TXT_CONTENT,
        },
      ],
    })
  );
}
