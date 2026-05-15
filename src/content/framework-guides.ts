/**
 * Framework-specific integration guides.
 * Returned by the get_integration_guide tool with code snippets.
 */

export type FrameworkId =
  | "curl"
  | "typescript"
  | "python"
  | "langchain"
  | "vercel-ai"
  | "openai-agents"
  | "claude-desktop"
  | "cursor"
  | "vscode";

export interface FrameworkGuide {
  readonly id: FrameworkId;
  readonly name: string;
  readonly install: string;
  readonly setupTime: string;
  readonly code: string;
  readonly nextSteps: readonly string[];
}

export const FRAMEWORK_GUIDES: Record<FrameworkId, FrameworkGuide> = {
  curl: {
    id: "curl",
    name: "cURL (Quick Test)",
    install: "No installation needed",
    setupTime: "1 minute",
    code: `# Search products
curl -X POST https://www.trusteed.xyz/api/v1/agent/search \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Api-Key: agnt_your_key" \\
  -d '{"query": "wireless headphones", "limit": 5}'

# Get merchant profile with trust score
curl -H "X-Agent-Api-Key: agnt_your_key" \\
  https://www.trusteed.xyz/api/v1/agent/merchants/best-electronics

# Compare products side-by-side
curl -X POST https://www.trusteed.xyz/api/v1/agent/compare \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Api-Key: agnt_your_key" \\
  -d '{"productIds": ["prod_1", "prod_2", "prod_3"]}'`,
    nextSteps: [
      'Try filtering by trust score: add "minTrustScore": 0.7 to search',
      "Check stock: GET /agent/availability/{productId}",
      "Read the full OpenAPI spec: /api/openapi.json",
    ],
  },

  typescript: {
    id: "typescript",
    name: "TypeScript / Node.js",
    install: "npm install @agenticmcpstores/sdk",
    setupTime: "3 minutes",
    code: `import { AgenticMCPStores } from "@agenticmcpstores/sdk";

const client = new AgenticMCPStores({
  apiKey: process.env.AMCP_API_KEY!,
});

// Search products across all merchants
const results = await client.searchProducts({
  query: "organic coffee",
  filters: { inStock: true, minTrustScore: 0.7 },
  limit: 10,
});

// results.total → number of products found
for (const product of results.items) {
  // product.title, product.price, product.merchant.trustScore
}`,
    nextSteps: [
      "Compare products: client.compareProducts(['id1', 'id2'])",
      "Create cart: client.createCart({ items: [...] })",
      "Get merchant profile: client.getMerchantProfile('slug')",
    ],
  },

  python: {
    id: "python",
    name: "Python",
    install: "pip install agenticmcpstores",
    setupTime: "3 minutes",
    code: `import asyncio
from agenticmcpstores import AgenticMCPStores

async def main():
    client = AgenticMCPStores(api_key="agnt_your_key")

    # Search products
    results = await client.search_products(
        query="wireless headphones",
        filters={"in_stock": True, "min_trust_score": 0.7},
        limit=10,
    )

    for product in results.items:
        print(f"{product.title} - \${product.price} (trust: {product.merchant.trust_score})")

asyncio.run(main())`,
    nextSteps: [
      "Compare products: await client.compare_products(['id1', 'id2'])",
      "Get merchant: await client.get_merchant_profile('slug')",
      "Create cart: await client.create_cart(items=[...])",
    ],
  },

  langchain: {
    id: "langchain",
    name: "LangChain (TypeScript)",
    install: "npm install @agenticmcpstores/langchain",
    setupTime: "5 minutes",
    code: `import { AgenticMCPStoresToolkit } from "@agenticmcpstores/langchain";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createOpenAIFunctionsAgent } from "langchain/agents";

const toolkit = new AgenticMCPStoresToolkit({
  apiKey: process.env.AMCP_API_KEY!,
});

const tools = toolkit.getTools();
const llm = new ChatOpenAI({ model: "gpt-4o" });

const agent = await createOpenAIFunctionsAgent({ llm, tools, prompt });
const executor = new AgentExecutor({ agent, tools });

const result = await executor.invoke({
  input: "Find the best wireless headphones under $50 with high trust score",
});`,
    nextSteps: [
      "Tools available: search_products, get_product_detail, compare_products, create_cart, etc.",
      "Add memory: use ConversationBufferMemory for multi-turn shopping",
      "Add callbacks: track agent decisions with LangSmith",
    ],
  },

  "vercel-ai": {
    id: "vercel-ai",
    name: "Vercel AI SDK",
    install: "npm install @agenticmcpstores/vercel-ai ai",
    setupTime: "5 minutes",
    code: `import { createAgenticMCPStoresTools } from "@agenticmcpstores/vercel-ai";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const tools = createAgenticMCPStoresTools({
  apiKey: process.env.AMCP_API_KEY!,
});

const result = await generateText({
  model: openai("gpt-4o"),
  tools,
  prompt: "Search for organic coffee beans and compare the top 3 results",
});`,
    nextSteps: [
      "Use with streamText() for streaming responses",
      "Combine with other Vercel AI tools (web search, etc.)",
      "Deploy on Vercel Edge Functions for low latency",
    ],
  },

  "openai-agents": {
    id: "openai-agents",
    name: "OpenAI Agent SDK",
    install: "npm install @agenticmcpstores/openai-agents @openai/agents",
    setupTime: "5 minutes",
    code: `import { Agent } from "@openai/agents";
import { createAgenticMCPStoresTools } from "@agenticmcpstores/openai-agents";

const tools = createAgenticMCPStoresTools({
  apiKey: process.env.AMCP_API_KEY!,
});

const agent = new Agent({
  name: "Shopping Assistant",
  instructions: "Help users find and compare products across merchants.",
  tools,
});

const result = await agent.run("Find me the cheapest laptop under $500");`,
    nextSteps: [
      "Add handoffs for checkout confirmation",
      "Combine with web browsing tools",
      "Deploy as a hosted agent",
    ],
  },

  "claude-desktop": {
    id: "claude-desktop",
    name: "Claude Desktop",
    install: "Edit ~/.config/claude/claude_desktop_config.json",
    setupTime: "2 minutes",
    code: `// Add this to your Claude Desktop config:
// ~/.config/claude/claude_desktop_config.json (Linux/macOS)
// %APPDATA%\\Claude\\claude_desktop_config.json (Windows)

{
  "mcpServers": {
    "agenticmcpstores-dev": {
      "type": "http",
      "url": "https://api.trusteed.xyz/developer/mcp"
    }
  }
}

// After restart, Claude can:
// - Search documentation: "How does the trust score work?"
// - Get API schemas: "Show me the search endpoint schema"
// - Explore protocols: "Explain x402 payment flow"`,
    nextSteps: [
      "Ask Claude: 'Search for trust score documentation'",
      "Ask Claude: 'Show me the LangChain integration guide'",
      "Ask Claude: 'What payment protocols are supported?'",
    ],
  },

  cursor: {
    id: "cursor",
    name: "Cursor IDE",
    install: "Edit .cursor/mcp.json in your project",
    setupTime: "1 minute",
    code: `// .cursor/mcp.json
{
  "mcpServers": {
    "agenticmcpstores-dev": {
      "url": "https://api.trusteed.xyz/developer/mcp"
    }
  }
}

// Now Cursor's AI can access AgenticMCPStores docs directly.
// Try: "How do I integrate the Agent API with my TypeScript project?"`,
    nextSteps: [
      "Use the search_docs tool to find specific API details",
      "Ask for code examples by framework",
      "Explore the trust framework interactively",
    ],
  },

  vscode: {
    id: "vscode",
    name: "VS Code + GitHub Copilot",
    install: "Edit VS Code settings.json",
    setupTime: "1 minute",
    code: `// VS Code settings.json
{
  "mcp": {
    "servers": {
      "agenticmcpstores-dev": {
        "type": "http",
        "url": "https://api.trusteed.xyz/developer/mcp"
      }
    }
  }
}

// Copilot Chat can now access AgenticMCPStores documentation.
// Try in Copilot Chat: @agenticmcpstores how does checkout work?`,
    nextSteps: [
      "Use Copilot Chat to explore the API",
      "Generate integration code from documentation",
      "Ask about trust score components",
    ],
  },
};
