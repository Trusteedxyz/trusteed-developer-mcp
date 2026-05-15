import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

export function registerTroubleshootPrompt(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.prompt(
    "troubleshoot",
    "Debug common integration issues with AgenticMCPStores Agent API",
    {
      error: z
        .string()
        .optional()
        .describe("The error message or HTTP status code you received"),
      endpoint: z
        .string()
        .optional()
        .describe(
          "Which endpoint you were calling (e.g. /agent/search, /agent/checkout)"
        ),
    },
    ({ error, endpoint }) => {
      let prompt = `You are troubleshooting an AgenticMCPStores integration issue.

Common issues and solutions:

**HTTP 401 — Unauthorized**
- Missing or invalid X-Agent-Api-Key header
- Key must start with "agnt_" prefix
- Check key is not expired (sandbox keys expire in 24h)

**HTTP 403 — Forbidden**
- Insufficient scopes (e.g. trying checkout with agent:read scope)
- Tier restriction (e.g. x402 protocol requires PRO tier)
- Agent Policy Engine blocked the action (check response body for decision)

**HTTP 429 — Rate Limited**
- FREE tier: 100 req/min, PRO: 1000 req/min
- Check X-RateLimit-Remaining header
- Retry after X-RateLimit-Reset timestamp

**HTTP 402 — Payment Required (x402)**
- This is expected for x402 protocol
- Read the PAYMENT-REQUIRED header (base64 V2 format)
- Send payment proof via PAYMENT-SIGNATURE header

**Empty search results**
- Check if merchants are active (trustScore >= 0.5)
- Try broader query terms
- Verify merchant has synced products recently

**Trust score seems wrong**
- Trust score updates every 6 hours
- Check individual components via merchant profile
- Score is operational reliability, NOT consumer reviews

Use available tools to find relevant documentation:
- search_docs: Find docs about the error
- get_openapi_schema: Check correct request format
- get_protocol_info: For payment protocol issues`;

      if (error) {
        prompt += `\n\nThe developer reports this error: "${error}"`;
      }
      if (endpoint) {
        prompt += `\nThey were calling: ${endpoint}`;
      }

      prompt += `\n\nDiagnose the issue step by step. Use tools to find relevant documentation.`;

      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: prompt,
            },
          },
        ],
      };
    }
  );
}
