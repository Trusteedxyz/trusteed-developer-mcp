/**
 * create_sandbox_key — Developer MCP tool.
 *
 * Generates a temporary 24h sandbox API key via REST. Output schema is
 * machine-readable (structuredContent + outputSchema) per latest MCP SDK.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

const createSandboxKeyOutputSchema = z.object({
  api_key: z.string().describe("Temporary sandbox API key (valid 24h)"),
  expires_at: z.string().describe("ISO 8601 expiration timestamp"),
  base_url: z.string().describe("API base URL for testing"),
  rate_limit: z.string().describe("Rate limit for this key"),
  notes: z.string().describe("Usage notes and restrictions"),
});

export function registerCreateSandboxKey(
  server: McpServer,
  config: Required<DeveloperMCPServerConfig>
): void {
  server.registerTool(
    "create_sandbox_key",
    {
      description:
        "Generate a temporary sandbox API key for testing Trusteed without registering. Key valid for 24 hours, max 3 keys per IP per 24h. Perfect for evaluating the platform and running quick demos.",
      inputSchema: {},
      outputSchema: createSandboxKeyOutputSchema,
    },
    async () => {
      const apiBaseUrl = config.baseUrl;

      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/sandbox/key`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`API error: ${response.status} — ${error}`);
        }

        const data = (await response.json()) as {
          api_key: string;
          expires_at: string;
        };

        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        const hoursRemaining = Math.round(
          (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        const narration = `# Sandbox API Key Generated ✓

Your temporary API key is ready for 24-hour testing:

\`\`\`
${data.api_key}
\`\`\`

**How to use it:**

1. Include in HTTP header: \`X-Agent-Api-Key: ${data.api_key}\`
2. Base URL: \`${apiBaseUrl}/api/v1\`
3. Try the demo tools:
   - \`POST /agent/search\` — search products (with filters)
   - \`GET /agent/merchants/{slug}\` — get merchant profile
   - \`POST /agent/cart\` — create a shopping cart

**Example request:**
\`\`\`bash
curl -X POST ${apiBaseUrl}/api/v1/agent/search \\
  -H "X-Agent-Api-Key: ${data.api_key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "sneakers",
    "limit": 5
  }'
\`\`\`

**Limits:**
- Valid: ${hoursRemaining} hours
- Rate limit: 20 requests/min (FREE tier)
- Max 3 keys per IP per 24h

**Next steps:**
- Read docs at https://www.trusteed.xyz/en/developers
- Check trust framework at /.well-known/agent-commerce.json
- See MCP discovery at /demo-store/mcp

🎉 Ready to explore agentic commerce!`;

        return {
          content: [{ type: "text" as const, text: narration }],
          structuredContent: {
            api_key: data.api_key,
            expires_at: data.expires_at,
            base_url: apiBaseUrl,
            rate_limit: "20 requests/minute (FREE tier)",
            notes:
              "Sandbox keys are temporary. Register at https://www.trusteed.xyz/register for production API keys.",
          },
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return {
          content: [
            {
              type: "text" as const,
              text: `❌ Failed to generate sandbox key: ${message}\n\nTroubleshooting:\n- Check your internet connection\n- Rate limit? Wait 1 hour and try again (max 3 keys per IP per 24h)\n- For production keys, register at https://www.trusteed.xyz/register`,
            },
          ],
          structuredContent: {
            api_key: "",
            expires_at: "",
            base_url: apiBaseUrl,
            rate_limit: "20 requests/minute",
            notes: `Error: ${message}`,
          },
        };
      }
    }
  );
}
