import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

const OPENAPI_SUMMARY = {
  openapi: "3.0.3",
  info: {
    title: "Trusteed Agent API",
    version: "1.0.0",
    description:
      "Multi-merchant trust and execution layer for agentic commerce",
  },
  servers: [
    {
      url: "https://www.trusteed.xyz/api/v1",
      description: "Production",
    },
  ],
  paths: {
    "/agent/search": {
      post: { summary: "Search products across merchants", tags: ["search"] },
    },
    "/agent/products/{id}": {
      get: { summary: "Product detail", tags: ["products"] },
    },
    "/agent/compare": {
      post: { summary: "Compare products side-by-side", tags: ["products"] },
    },
    "/agent/availability/{id}": {
      get: { summary: "Check stock", tags: ["products"] },
    },
    "/agent/cart": { post: { summary: "Create cart", tags: ["cart"] } },
    "/agent/checkout": {
      post: { summary: "Initiate checkout", tags: ["checkout"] },
    },
    "/agent/orders/{id}": {
      get: { summary: "Order status", tags: ["orders"] },
    },
    "/agent/merchants/{slug}": {
      get: { summary: "Merchant profile", tags: ["merchants"] },
    },
  },
  components: {
    securitySchemes: {
      agentApiKey: {
        type: "apiKey",
        in: "header",
        name: "X-Agent-Api-Key",
        description: "API key with agnt_ prefix",
      },
    },
  },
  note: "This is a summary. Full spec at /api/openapi.json",
};

export function registerOpenApiSpecResource(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.resource(
    "openapi-spec",
    "api://openapi.json",
    {
      description:
        "Summary of the Trusteed OpenAPI 3.0 specification — endpoints, auth, and structure. Full spec at /api/openapi.json.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "api://openapi.json",
          mimeType: "application/json" as const,
          text: JSON.stringify(OPENAPI_SUMMARY, null, 2),
        },
      ],
    })
  );
}
