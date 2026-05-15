import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

/**
 * Inline OpenAPI fragments per resource.
 * In production, these would be extracted from the real OpenAPI spec.
 * For the Developer MCP MVP, we maintain them here for zero external deps.
 */
const OPENAPI_FRAGMENTS: Record<string, object> = {
  search: {
    path: "/api/v1/agent/search",
    method: "POST",
    summary: "Search products across all connected merchants",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["query"],
            properties: {
              query: { type: "string", description: "Search query" },
              filters: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  minPrice: { type: "number" },
                  maxPrice: { type: "number" },
                  inStock: { type: "boolean" },
                  minTrustScore: { type: "number", minimum: 0, maximum: 1 },
                },
              },
              sort: {
                type: "string",
                enum: ["relevance", "price_asc", "price_desc", "newest"],
              },
              limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
              page: { type: "integer", minimum: 1, default: 1 },
            },
          },
        },
      },
    },
    responses: {
      "200": { description: "Array of products with trust signals" },
      "401": { description: "Invalid or missing API key" },
      "429": { description: "Rate limit exceeded" },
    },
  },
  products: {
    path: "/api/v1/agent/products/{id}",
    method: "GET",
    summary: "Get detailed product information",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
    responses: {
      "200": {
        description: "Product detail with merchant info, trust score, pricing",
      },
      "404": { description: "Product not found" },
    },
  },
  compare: {
    path: "/api/v1/agent/compare",
    method: "POST",
    summary: "Compare up to 10 products side-by-side",
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["productIds"],
            properties: {
              productIds: {
                type: "array",
                items: { type: "string" },
                maxItems: 10,
              },
            },
          },
        },
      },
    },
  },
  availability: {
    path: "/api/v1/agent/availability/{id}",
    method: "GET",
    summary: "Check real-time stock availability",
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
  },
  cart: {
    path: "/api/v1/agent/cart",
    method: "POST",
    summary: "Create a cart with product selections",
    security: [{ agentApiKey: ["agent:cart"] }],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: ["productId", "quantity"],
                  properties: {
                    productId: { type: "string" },
                    quantity: { type: "integer", minimum: 1 },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  checkout: {
    path: "/api/v1/agent/checkout",
    method: "POST",
    summary: "Initiate checkout flow (requires human confirmation)",
    security: [{ agentApiKey: ["agent:checkout"] }],
    requestBody: {
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["cartId"],
            properties: {
              cartId: { type: "string", format: "uuid" },
              protocol: { type: "string", enum: ["ACP", "AP2", "x402"] },
            },
          },
        },
      },
    },
    responses: {
      "202": { description: "Checkout initiated, payment URL returned" },
      "402": { description: "Payment required (x402 protocol)" },
    },
  },
  orders: {
    path: "/api/v1/agent/orders/{id}",
    method: "GET",
    summary: "Get order status and tracking",
    security: [{ agentApiKey: ["agent:read"] }],
    parameters: [
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ],
  },
  merchants: {
    path: "/api/v1/agent/merchants/{slug}",
    method: "GET",
    summary: "Get merchant profile with trust score and policies",
    parameters: [
      { name: "slug", in: "path", required: true, schema: { type: "string" } },
    ],
  },
};

const RESOURCE_NAMES = Object.keys(OPENAPI_FRAGMENTS);

const getOpenApiSchemaOutputSchema = z.object({
  resource: z
    .string()
    .describe("The requested resource name, or empty string if not found"),
  schema: z
    .record(z.unknown())
    .describe(
      "OpenAPI fragment for the resource, or empty object if not found"
    ),
});

export function registerGetOpenApiSchema(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_openapi_schema",
    {
      description: `Get the OpenAPI schema fragment for a specific Agent API endpoint. Available resources: ${RESOURCE_NAMES.join(", ")}.`,
      inputSchema: {
        resource: z
          .string()
          .describe(`API resource name: ${RESOURCE_NAMES.join(", ")}`),
      },
      outputSchema: getOpenApiSchemaOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ resource }) => {
      const fragment = OPENAPI_FRAGMENTS[resource];

      if (!fragment) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown resource "${resource}". Available: ${RESOURCE_NAMES.join(", ")}`,
            },
          ],
          structuredContent: { resource: "", schema: {} },
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `## OpenAPI Schema: ${resource}\n\n\`\`\`json\n${JSON.stringify(fragment, null, 2)}\n\`\`\``,
          },
        ],
        structuredContent: {
          resource,
          schema: fragment as Record<string, unknown>,
        },
      };
    }
  );
}
