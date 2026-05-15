/**
 * Documentation index — searchable content for the search_docs tool.
 *
 * Each entry has an id, section, title, and markdown body.
 * The search_docs tool performs basic text matching against these entries.
 * In a future iteration this could be backed by embeddings, but for MVP
 * simple case-insensitive substring matching is fast and sufficient for
 * ~30 documentation entries.
 */

export interface DocEntry {
  readonly id: string;
  readonly section:
    | "api"
    | "trust"
    | "protocols"
    | "integration"
    | "glossary"
    | "general";
  readonly title: string;
  readonly body: string;
}

export const DOCS: readonly DocEntry[] = [
  // --- API ---
  {
    id: "api-overview",
    section: "api",
    title: "Agent API Overview",
    body: `Trusteed exposes a single authenticated REST API for AI agents.

**Base URL:** \`https://www.trusteed.xyz/api/v1\`
**Authentication:** HTTP header \`X-Agent-Api-Key: <key>\`
**Key registration:** /en/developers

| Action           | Method | Path                     |
|------------------|--------|--------------------------|
| Search products  | POST   | /agent/search            |
| Product detail   | GET    | /agent/products/{id}     |
| Compare products | POST   | /agent/compare           |
| Check stock      | GET    | /agent/availability/{id} |
| Create cart      | POST   | /agent/cart              |
| Initiate checkout| POST   | /agent/checkout          |
| Order status     | GET    | /agent/orders/{id}       |
| Merchant profile | GET    | /agent/merchants/{slug}  |

Full OpenAPI: /api/v1/agent/docs`,
  },
  {
    id: "api-search",
    section: "api",
    title: "POST /agent/search — Search Products",
    body: `Search products across all connected merchants.

**Request body:**
\`\`\`json
{
  "query": "wireless headphones",
  "filters": {
    "category": "electronics",
    "minPrice": 10,
    "maxPrice": 100,
    "inStock": true,
    "minTrustScore": 0.5
  },
  "sort": "relevance",
  "limit": 20,
  "page": 1
}
\`\`\`

**Response:** Array of products with trust signals, merchant info, pricing, and availability.

Products from deprioritized merchants (trustScore < 0.5) appear after all active merchants.`,
  },
  {
    id: "api-checkout",
    section: "api",
    title: "POST /agent/checkout — Initiate Checkout",
    body: `Initiate a checkout flow for a cart. Requires \`agent:checkout\` scope.

**Request body:**
\`\`\`json
{
  "cartId": "uuid-of-cart",
  "protocol": "ACP"
}
\`\`\`

**Supported protocols:** ACP (Stripe fiat), AP2 (Google Cart Mandate), x402 (USDC stablecoin).

**Response:** HTTP 202 with checkout URL and payment instructions.

**Agent Policy Engine** evaluates every checkout:
- ALLOW: proceed normally
- FRICTION: require additional user confirmation
- REVIEW: queue for manual review
- BLOCK: reject the checkout

Checkout ALWAYS requires human confirmation per agent-policy.json.`,
  },
  {
    id: "api-rate-limits",
    section: "api",
    title: "Rate Limits",
    body: `| Tier       | Limit        | Notes               |
|------------|--------------|----------------------|
| FREE       | 100 req/min  | Default for new keys |
| PRO        | 1,000 req/min| Paid plan            |
| ENTERPRISE | Unlimited    | Custom SLA           |

Headers: \`X-RateLimit-Limit\`, \`X-RateLimit-Remaining\`, \`X-RateLimit-Reset\`

When rate limited, the API returns HTTP 429 with \`Retry-After\` header.`,
  },
  // --- Trust ---
  {
    id: "trust-score",
    section: "trust",
    title: "Trust Score — How It Works",
    body: `Every merchant has a \`trustScore\` (0.0-1.0) computed every 6 hours.

**Components and weights:**

| Component             | Weight |
|-----------------------|--------|
| catalog_completeness  | 15%    |
| catalog_freshness     | 15%    |
| price_accuracy        | 15%    |
| availability_accuracy | 10%    |
| policy_coverage       | 10%    |
| checkout_success_rate | 15%    |
| fulfillment_rate      | 10%    |
| dispute_rate          | 10%    |

This is an operational reliability score, NOT a consumer review rating.`,
  },
  {
    id: "trust-ranking",
    section: "trust",
    title: "Ranking Formula (Published)",
    body: `\`\`\`
relevanceScore = (text_relevance * 0.55)
              + (store_trust_score * 0.25)
              + (freshness * 0.10)
              + (in_stock * 0.10)
\`\`\`

**text_relevance** (0.0-1.0): title match (1.0) + description (0.5) + tag (0.3), normalized.
**store_trust_score** (0.0-1.0): operational trust score.
**freshness** (0.0-1.0): decay by hours since sync — <1h: 1.0, <6h: 0.8, <24h: 0.6, >=24h: 0.3.
**in_stock** (0 or 1): binary — available inventory or not.

Deprioritization: trustScore < 0.5 products always appear AFTER active merchants.`,
  },
  {
    id: "trust-merchant-states",
    section: "trust",
    title: "Merchant Status States",
    body: `| Status        | Trust Score    | Visibility                          |
|---------------|----------------|--------------------------------------|
| active        | >= 0.5         | Full visibility in agent results     |
| deprioritized | [0.3, 0.5)     | After all active merchants (hard)    |
| hidden        | [0.2, 0.3)     | Excluded from agent API              |
| suspended     | < 0.2          | Excluded everywhere                  |

Minimum eligibility: BASIC verification + trustScore >= 0.3.`,
  },
  {
    id: "trust-verification",
    section: "trust",
    title: "Merchant Verification Levels",
    body: `| Level      | Requirements                                |
|------------|----------------------------------------------|
| UNVERIFIED | No verification completed                    |
| BASIC      | Email and domain control verified             |
| STANDARD   | Business review completed                    |
| PREMIUM    | Business review + operational history        |

Only BASIC or above can appear in agent search results.`,
  },
  // --- Protocols ---
  {
    id: "protocol-acp",
    section: "protocols",
    title: "ACP — Agentic Commerce Protocol (Stripe/OpenAI)",
    body: `ACP is the primary fiat payment protocol, developed by OpenAI and Stripe.

**How it works:**
1. Agent creates cart via \`POST /agent/cart\`
2. Agent initiates checkout: \`POST /agent/checkout\` with \`protocol: "ACP"\`
3. Platform generates Stripe checkout session
4. User completes payment on Stripe-hosted page
5. Webhook confirms payment, order transitions to \`completed\`

**Adapter:** \`acp-inbound-v1\` (registered in server.ts)
**Confidence detection:** X-Protocol header = 1.0, fallback body shape = 0.85`,
  },
  {
    id: "protocol-ap2",
    section: "protocols",
    title: "AP2 — Agent Payment Protocol v2 (Google Cart Mandate)",
    body: `AP2 is Google's cart mandate protocol for agent-mediated payments.

**How it works:**
1. Agent creates cart with product selections
2. Agent initiates checkout: \`POST /agent/checkout\` with \`protocol: "AP2"\`
3. Google Cart Mandate validates the payment mandate
4. Payment processed via Google's payment infrastructure

**Adapter:** \`ap2-inbound-v0.1\` (registered in server.ts)
**Status:** Beta`,
  },
  {
    id: "protocol-x402",
    section: "protocols",
    title: "x402 — Stablecoin Payment Protocol (Coinbase/Cloudflare USDC)",
    body: `x402 enables AI agents to pay with USDC stablecoins. Trusteed is the only
agentic commerce gateway with x402 support in production (195 tests).

**How it works:**
1. Agent initiates checkout: \`POST /agent/checkout\` with \`protocol: "x402"\`
2. Platform returns HTTP 402 + PAYMENT-REQUIRED header (base64 V2)
3. Agent sends PAYMENT-SIGNATURE header with USDC transaction proof
4. Platform verifies payment on-chain: \`POST /agent/checkout/x402/verify\`
5. Settlement with exponential backoff (5 retries: 5s, 10s, 20s, 40s)

**Lifecycle:** x402_pending_payment -> completed | x402_failed | expired
**Security:** SSRF guard (RFC-1918), HTTPS enforced, float precision guard (MAX_SAFE_CENTS)
**Adapter:** \`x402-inbound-v1\` (registered in server.ts)`,
  },
  // --- Integration ---
  {
    id: "integration-quickstart",
    section: "integration",
    title: "Quickstart — 5 Minutes to First Request",
    body: `**Step 1:** Get an API key at /en/developers

**Step 2:** Make your first search:
\`\`\`bash
curl -X POST https://www.trusteed.xyz/api/v1/agent/search \\
  -H "Content-Type: application/json" \\
  -H "X-Agent-Api-Key: agnt_your_key_here" \\
  -d '{"query": "wireless headphones", "limit": 5}'
\`\`\`

**Step 3:** Explore results — each product includes trustScore, merchant info, pricing.

**Auto-discovery files:**
- \`/llms.txt\` — full platform manifest for LLMs
- \`/mcp.json\` — MCP discovery with tool schemas
- \`/.well-known/agent-commerce.json\` — capabilities contract
- \`/.well-known/agent-policy.json\` — action policies and trust guidance`,
  },
  {
    id: "integration-claude-desktop",
    section: "integration",
    title: "Claude Desktop Integration",
    body: `Add to your Claude Desktop config (\`~/.config/claude/claude_desktop_config.json\`):

\`\`\`json
{
  "mcpServers": {
    "trusteed-dev": {
      "type": "http",
      "url": "https://api.trusteed.xyz/developer/mcp"
    }
  }
}
\`\`\`

This gives Claude access to search documentation, get API schemas, and explore
the trust framework — all within the chat interface.`,
  },
  {
    id: "integration-langchain",
    section: "integration",
    title: "LangChain Integration (TypeScript)",
    body: `\`\`\`typescript
import { TrusteedToolkit } from "@trusteed/langchain";

const toolkit = new TrusteedToolkit({
  apiKey: process.env.AMCP_API_KEY,
});

// Get LangChain-compatible tools
const tools = toolkit.getTools();

// Use with any LangChain agent
const agent = createOpenAIFunctionsAgent({ llm, tools, prompt });
\`\`\`

Available tools: search_products, get_product_detail, compare_products,
check_availability, create_cart, preview_checkout, complete_checkout,
get_merchant_profile.

SDK: \`npm install @trusteed/langchain\` (coming soon)`,
  },
  {
    id: "integration-vscode",
    section: "integration",
    title: "VS Code / Cursor / Copilot Integration",
    body: `Add to your VS Code settings.json:

\`\`\`json
{
  "mcp": {
    "servers": {
      "trusteed-dev": {
        "type": "http",
        "url": "https://api.trusteed.xyz/developer/mcp"
      }
    }
  }
}
\`\`\`

For Cursor, the same config works in \`.cursor/mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "trusteed-dev": {
      "url": "https://api.trusteed.xyz/developer/mcp"
    }
  }
}
\`\`\``,
  },
  {
    id: "integration-python",
    section: "integration",
    title: "Python Integration",
    body: `\`\`\`python
import httpx

client = httpx.AsyncClient(
    base_url="https://www.trusteed.xyz/api/v1",
    headers={"X-Agent-Api-Key": "agnt_your_key_here"},
)

# Search products
response = await client.post("/agent/search", json={
    "query": "organic coffee",
    "limit": 10,
})
products = response.json()
\`\`\`

SDK: \`pip install trusteed\` (coming soon)

LangChain integration:
\`\`\`python
from trusteed.integrations.langchain import TrusteedToolkit

toolkit = TrusteedToolkit(api_key="agnt_your_key")
tools = toolkit.get_tools()
\`\`\``,
  },
  // --- Glossary ---
  {
    id: "glossary-agentic-commerce",
    section: "glossary",
    title: "Agentic Commerce",
    body: `Commerce flows initiated or executed by AI agents autonomously or semi-autonomously
on behalf of users. Includes product discovery, comparison, cart management, and
checkout — mediated by trust signals and policy boundaries.`,
  },
  {
    id: "glossary-trust-score",
    section: "glossary",
    title: "Trust Score",
    body: `A platform-computed 0.0-1.0 score reflecting a merchant's operational reliability
based on 8 quantitative components. Updated every 6 hours. NOT a consumer review
rating and NOT a legal certification.`,
  },
  {
    id: "glossary-policy-engine",
    section: "glossary",
    title: "Agent Policy Engine",
    body: `A chain-of-responsibility rule engine that evaluates every agent
action against configurable policies. Produces decisions: ALLOW, FRICTION, REVIEW, BLOCK.

Rules include: agent-trust-gate, scope-authorization, spending-limit,
merchant-verification, human-presence.`,
  },
  {
    id: "glossary-mcp",
    section: "glossary",
    title: "MCP (Model Context Protocol)",
    body: `An open standard for AI agents to connect to external services. MCP defines tools
(actions an agent can take), resources (reference data), and prompts (guided workflows).

Trusteed uses MCP for:
- Store connectors (Shopify, WooCommerce, Etsy — per-merchant MCP servers)
- Developer documentation (this Developer MCP server)
- Agent marketplace (coming soon — Marketplace MCP)`,
  },
  // --- General ---
  {
    id: "general-discovery",
    section: "general",
    title: "Agent Auto-Discovery Files",
    body: `Trusteed serves machine-readable discovery files at well-known paths:

| File                              | Purpose                                    |
|-----------------------------------|--------------------------------------------|
| /llms.txt                         | Full platform manifest for LLMs            |
| /mcp.json                         | MCP discovery with tool schemas (8 tools)  |
| /.well-known/agent-commerce.json  | Capabilities contract (auth, trust, ranking)|
| /.well-known/agent-policy.json    | Action policies and trust guidance         |
| /api/openapi.json                 | OpenAPI 3.0 specification                  |

These files enable zero-config agent discovery — no IDE setup, no manual docs reading.`,
  },
  {
    id: "general-platforms",
    section: "general",
    title: "Connected Platforms",
    body: `Products indexed in real time from:
- **Shopify** — native connector (GA)
- **WooCommerce** — native connector (GA)
- **Etsy** — beta connector

Connectors sync products, pricing, inventory, and policies via MCP adapters.
Connector status per merchant: \`GET /agent/merchants/{slug}\` field: \`platformConnectors\`.`,
  },
  {
    id: "general-not",
    section: "general",
    title: "What Trusteed Is NOT",
    body: `- Not a payment processor (initiates checkout flows, does not process payments)
- Not a merchant of record
- Not a legal certification authority
- Not a consumer review platform (trust scores = operational data, not buyer reviews)
- Trust scores are decision-support tools, not guarantees`,
  },
];
