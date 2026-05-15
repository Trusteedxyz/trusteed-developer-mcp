import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";

interface ProtocolInfo {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly adapter: string;
  readonly description: string;
  readonly flow: readonly string[];
  readonly security: readonly string[];
}

const PROTOCOLS: Record<string, ProtocolInfo> = {
  ACP: {
    id: "ACP",
    name: "Agentic Commerce Protocol (Stripe/OpenAI)",
    status: "GA — Production ready",
    adapter: "acp-inbound-v1",
    description:
      "Primary fiat payment protocol developed by OpenAI and Stripe. Processes credit card and wallet payments through Stripe-hosted checkout.",
    flow: [
      "Agent creates cart via POST /agent/cart",
      'Agent initiates checkout: POST /agent/checkout with protocol: "ACP"',
      "Platform generates Stripe checkout session",
      "User completes payment on Stripe-hosted page",
      "Webhook confirms payment, order transitions to completed",
    ],
    security: [
      "Stripe-managed PCI compliance",
      "Webhook signature verification",
      "Agent Policy Engine evaluation on every checkout",
    ],
  },
  AP2: {
    id: "AP2",
    name: "Agent Payment Protocol v2 (Google Cart Mandate)",
    status: "Beta",
    adapter: "ap2-inbound-v0.1",
    description:
      "Google's cart mandate protocol for agent-mediated payments. Validates payment mandates through Google's infrastructure.",
    flow: [
      "Agent creates cart with product selections",
      'Agent initiates checkout: POST /agent/checkout with protocol: "AP2"',
      "Google Cart Mandate validates the payment mandate",
      "Payment processed via Google's payment infrastructure",
    ],
    security: [
      "Google-managed payment mandate validation",
      "Cart integrity verification",
      "Agent Policy Engine evaluation",
    ],
  },
  x402: {
    id: "x402",
    name: "Stablecoin Payment Protocol (Coinbase/Cloudflare USDC)",
    status: "GA — Production ready (195 tests)",
    adapter: "x402-inbound-v1",
    description:
      "USDC stablecoin payments for AI agents. The only agentic commerce gateway with x402 in production. Zero chargeback risk.",
    flow: [
      'Agent initiates checkout: POST /agent/checkout with protocol: "x402"',
      "Platform returns HTTP 402 + PAYMENT-REQUIRED header (base64 V2)",
      "Agent sends PAYMENT-SIGNATURE header with USDC transaction proof",
      "Platform verifies payment: POST /agent/checkout/x402/verify (HTTP 202)",
      "Settlement with exponential backoff (5 retries: 5s, 10s, 20s, 40s)",
      "Lifecycle: x402_pending_payment -> completed | x402_failed | expired",
    ],
    security: [
      "SSRF guard (RFC-1918 + loopback + IMDS blocking)",
      "HTTPS enforced on facilitatorUrl",
      "Float precision guard (MAX_SAFE_CENTS)",
      "Safe Zod parse on all routes",
      "Wallet address masked in all logs",
    ],
  },
};

const PROTOCOL_IDS = Object.keys(PROTOCOLS);

const getProtocolInfoOutputSchema = z.object({
  protocols: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      status: z.string(),
      adapter: z.string(),
    })
  ),
});

export function registerGetProtocolInfo(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_protocol_info",
    {
      description: `Get details about agentic payment protocols. Available: ${PROTOCOL_IDS.join(", ")}. Omit protocol to get a comparison of all three.`,
      inputSchema: {
        protocol: z
          .string()
          .optional()
          .describe(
            `Protocol ID: ${PROTOCOL_IDS.join(", ")} (or omit for all)`
          ),
      },
      outputSchema: getProtocolInfoOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ protocol }) => {
      if (protocol && !PROTOCOLS[protocol]) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown protocol "${protocol}". Available: ${PROTOCOL_IDS.join(", ")}`,
            },
          ],
          structuredContent: { protocols: [] },
        };
      }

      const protocolsToShow = protocol
        ? [PROTOCOLS[protocol]!]
        : Object.values(PROTOCOLS);

      const markdown = protocolsToShow
        .map((p) => {
          const flowSteps = p.flow.map((s, i) => `${i + 1}. ${s}`).join("\n");
          const securityList = p.security.map((s) => `- ${s}`).join("\n");

          return `## ${p.name}

**Status:** ${p.status}
**Adapter:** \`${p.adapter}\`

${p.description}

### Payment Flow

${flowSteps}

### Security

${securityList}`;
        })
        .join("\n\n---\n\n");

      const comparisonTable = !protocol
        ? `\n\n---\n\n## Quick Comparison\n\n| Aspect | ACP | AP2 | x402 |\n|--------|-----|-----|------|\n| Payment type | Fiat (cards, wallets) | Google mandate | USDC stablecoin |\n| Status | GA | Beta | GA (195 tests) |\n| Chargeback risk | Standard | TBD | Zero |\n| Human confirmation | Required | Required | Required |\n| Best for | Standard purchases | Google ecosystem | Crypto-native agents |`
        : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `# Payment Protocols\n\n${markdown}${comparisonTable}`,
          },
        ],
        structuredContent: {
          protocols: protocolsToShow.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            adapter: p.adapter,
          })),
        },
      };
    }
  );
}
