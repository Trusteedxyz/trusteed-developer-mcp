import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

export function registerIntegrationHelperPrompt(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.prompt(
    "integration_helper",
    "Guided workflow to help integrate Trusteed into your AI agent or application",
    {
      framework: z
        .string()
        .optional()
        .describe(
          "Target framework: curl, typescript, python, langchain, vercel-ai, openai-agents, claude-desktop, cursor, vscode"
        ),
      useCase: z
        .string()
        .optional()
        .describe(
          "What you want to build: shopping-assistant, price-comparison, product-search, checkout-flow"
        ),
    },
    ({ framework, useCase }) => {
      let prompt = `You are helping a developer integrate Trusteed into their project.

Trusteed is a multi-merchant trust and execution layer for agentic commerce.
It provides a single API to search, compare, and purchase products across verified
Shopify, WooCommerce, and Etsy merchants — with transparent trust scores.

Available tools you can use:
- search_docs: Find specific documentation
- get_openapi_schema: Get API endpoint schemas
- get_integration_guide: Get framework-specific code examples
- get_trust_framework: Understand trust scoring and ranking
- get_protocol_info: Learn about payment protocols (ACP, AP2, x402)

Guide the developer through:
1. Getting an API key (or sandbox key for testing)
2. Making their first API call
3. Understanding trust scores in results
4. Setting up their specific framework
5. Handling checkout flows with proper human confirmation`;

      if (framework) {
        prompt += `\n\nThe developer wants to use: ${framework}. Start by calling get_integration_guide with this framework.`;
      }

      if (useCase) {
        prompt += `\n\nTheir use case is: ${useCase}. Tailor your guidance accordingly.`;
      }

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
