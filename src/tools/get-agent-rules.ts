import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { DeveloperMCPServerConfig } from "../server.js";

export const AGENT_RULES_VERSION = "1.0.0";

export const AGENT_RULES = [
  // ── KYA & Identity ────────────────────────────────────────────────────────
  {
    code: "R001",
    name: "verified-agent-required",
    tier: 1,
    action: "BLOCK",
    configurable: false,
    needsLookup: false,
    description:
      "Blocks checkout when no verified agent identity is present. Fires when agentId is absent, 'unknown_agent', or when identity exists but verification status is unverified.",
    when: "agentId === null OR agentId === 'unknown_agent' OR verificationStatus === 'unverified'",
    defaults: {},
    merchantPolicyKey: "r001",
    merchantConfig: "requireKyaLevel (1|2|3, optional — default 1)",
    examples: [
      "Anonymous HTTP client without X-Agent-ID → BLOCK",
      "Claude.ai with valid RFC 9421 signature → PASS",
      "Agent with expired JWKS key → BLOCK",
    ],
  },
  {
    code: "R002",
    name: "signature-spoof-block",
    tier: 1,
    action: "BLOCK",
    configurable: false,
    needsLookup: false,
    description:
      "Blocks agents presenting an invalid or unverifiable token signature. Distinct from R001 (absent identity): this fires when identity is present but the cryptographic proof is wrong.",
    when: "signaturePresent === true AND signatureValid === false",
    defaults: {},
    merchantPolicyKey: "r002",
    merchantConfig: "none — not merchant-configurable",
    examples: [
      "Agent presents JWT with tampered payload → BLOCK",
      "Agent presents expired JWS token → BLOCK",
      "Agent with valid Ed25519 signature → PASS",
    ],
  },
  {
    code: "R003",
    name: "mandate-boundary-match",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Enforces the operator mandate: cart total must not exceed the mandate spending cap, and all line-item categories must appear in the mandate category allowlist.",
    when: "cartTotalCents > mandate.spendingCapCents OR lineItems.some(i => !mandate.allowedCategories.includes(i.category))",
    defaults: { enforceCategories: true, enforceSpendingCap: true },
    merchantPolicyKey: "r003",
    merchantConfig: "enforceCategories (bool, default true), enforceSpendingCap (bool, default true)",
    examples: [
      "Mandate cap $200, cart=$350 → BLOCK",
      "Mandate allows 'electronics', cart has 'jewelry' → BLOCK",
      "Cart within cap and allowed categories → PASS",
    ],
  },
  {
    code: "R004",
    name: "new-key-friction",
    tier: 2,
    action: "FRICTION",
    configurable: true,
    needsLookup: false,
    description:
      "Adds friction (requires explicit user confirmation) when a freshly-issued agent key is used for the first time. Key age is measured from the JWT 'iat' claim or the first-seen timestamp.",
    when: "keyAgeSeconds < minKeyAgeSeconds",
    defaults: { minKeyAgeSeconds: 300, frictionAction: "require_confirmation" },
    merchantPolicyKey: "r004",
    merchantConfig: "minKeyAgeSeconds (default 300), frictionAction ('require_confirmation'|'block')",
    examples: [
      "Key issued 60s ago, min=300s → FRICTION (confirmation required)",
      "Key issued 10min ago, min=300s → PASS",
    ],
  },
  {
    code: "R005",
    name: "revoked-agent-block",
    tier: 1,
    action: "BLOCK",
    configurable: false,
    needsLookup: false,
    description:
      "Blocks agents whose key has been explicitly revoked by the operator or merchant, or agents that have accumulated repeated identity verification failures.",
    when: "agent.status === 'revoked' OR agent.identityFailureCount >= 3",
    defaults: {},
    merchantPolicyKey: "r005",
    merchantConfig: "none — not merchant-configurable",
    examples: [
      "Agent key revoked via operator dashboard → BLOCK",
      "Agent failed identity check 3 times in session → BLOCK",
      "Agent in good standing → PASS",
    ],
  },
  {
    code: "R006",
    name: "provider-confidence-tier",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Enforces a minimum trust score and identity provider confidence level. Allows merchants to require a specific assurance tier (e.g. PRO-only agents).",
    when: "agentTrustScore < minTrustScore OR providerTier < minProviderTier",
    defaults: { minTrustScore: 30, minProviderTier: 1 },
    merchantPolicyKey: "r006",
    merchantConfig: "minTrustScore (0–100, default 30), minProviderTier (1|2|3, default 1)",
    examples: [
      "Merchant requires tier 2, agent is tier 1 → BLOCK",
      "Agent trustScore=25, merchant min=30 → BLOCK",
      "Agent trustScore=55, tier 2, merchant min tier 2 → PASS",
    ],
  },
  {
    code: "R007",
    name: "cross-merchant-abuse-signal",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents that have been flagged (blocked or reported) by two or more distinct merchants within the lookback window. Detects coordinated abuse across the merchant network.",
    when: "distinctMerchantFlags(agentId, windowDays) >= minMerchantFlags",
    defaults: { windowDays: 30, minMerchantFlags: 2 },
    merchantPolicyKey: "r007",
    merchantConfig: "windowDays (default 30), minMerchantFlags (default 2)",
    examples: [
      "Agent flagged by 3 merchants in 30d, min=2 → BLOCK",
      "Agent flagged by 1 merchant in 30d, min=2 → PASS",
    ],
  },
  {
    code: "R008",
    name: "scope-escalation-detection",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks requests where the agent attempts operations that exceed its authorized scopes as declared in the operator mandate or merchant configuration.",
    when: "requestedScopes.some(s => !authorizedScopes.includes(s))",
    defaults: { enforceStrictScopes: true },
    merchantPolicyKey: "r008",
    merchantConfig: "enforceStrictScopes (bool, default true)",
    examples: [
      "Agent authorized for 'catalog:read', attempts 'checkout:write' → BLOCK",
      "Agent scopes match authorized set → PASS",
    ],
  },

  // ── Merchant High-Priority Controls ───────────────────────────────────────
  {
    code: "R009",
    name: "agent-verification-required",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Merchant-side mirror of R001 for catalog and session operations (not just checkout). Merchants can require verification even for browse/search operations on sensitive catalogs.",
    when: "merchantRequiresVerification AND verificationStatus !== 'verified'",
    defaults: { applyToCatalog: false, applyToSession: true },
    merchantPolicyKey: "r009",
    merchantConfig: "applyToCatalog (bool, default false), applyToSession (bool, default true)",
    examples: [
      "Merchant requires session verification, agent unverified → BLOCK",
      "Standard catalog browse, applyToCatalog=false → PASS",
    ],
  },
  {
    code: "R010",
    name: "new-agent-probation",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Requires a minimum number of successfully completed orders before an agent is trusted for unrestricted checkout. New agents start in probation.",
    when: "completedOrders(agentId) < minCompletedOrders",
    defaults: { minCompletedOrders: 3 },
    merchantPolicyKey: "r010",
    merchantConfig: "minCompletedOrders (default 3)",
    examples: [
      "Agent has 1 completed order, min=3 → BLOCK",
      "Agent has 5 completed orders, min=3 → PASS",
    ],
  },
  {
    code: "R011",
    name: "repeat-failed-checkout",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents that exceed a threshold of failed checkout attempts within a time window. Detects payment probing and repeated cart abandonment.",
    when: "failedCheckouts(agentId, windowSeconds) > maxFailures",
    defaults: { windowSeconds: 3600, maxFailures: 5 },
    merchantPolicyKey: "r011",
    merchantConfig: "windowSeconds (default 3600), maxFailures (default 5)",
    examples: [
      "6 failed checkouts in 1h, max=5 → BLOCK",
      "2 failed checkouts in 1h, max=5 → PASS",
    ],
  },
  {
    code: "R012",
    name: "high-risk-category",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks orders containing products in merchant-defined high-risk categories (e.g. age-restricted, controlled items, high-value goods requiring human review).",
    when: "lineItems.some(i => merchant.highRiskCategories.includes(i.category))",
    defaults: { highRiskCategories: [] },
    merchantPolicyKey: "r012",
    merchantConfig: "highRiskCategories (string[], merchant-defined)",
    examples: [
      "Cart contains 'age-restricted-alcohol', in merchant's high-risk list → BLOCK",
      "Cart contains 'books', not in high-risk list → PASS",
    ],
  },
  {
    code: "R013",
    name: "return-policy-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks when the agent's declared return expectations (from cart attributes) conflict with the merchant's return policy window.",
    when: "cartAttributes._expected_return_window_days > merchant.returnWindowDays",
    defaults: {},
    merchantPolicyKey: "r013",
    merchantConfig: "enforceReturnPolicy (bool, default true)",
    examples: [
      "Agent expects 60-day returns, merchant offers 30 days → BLOCK",
      "Agent expects 14-day returns, merchant offers 30 days → PASS",
    ],
  },
  {
    code: "R014",
    name: "delivery-risk-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks orders shipping to high-risk delivery countries (OFAC-adjacent or merchant-defined) and blocks agents with a history of post-shipment cancellations.",
    when: "billingCountry IN highRiskCountries OR postShipCancels(agentId, windowDays) > maxCancels",
    defaults: { highRiskCountries: ["KP", "IR", "SY", "CU"], windowDays: 90, maxCancels: 3 },
    merchantPolicyKey: "r014",
    merchantConfig: "highRiskCountries (default OFAC list), maxCancels (default 3), windowDays (default 90)",
    examples: [
      "Order ships to KP (North Korea) → BLOCK",
      "Agent cancelled 5 orders post-ship in 90d, max=3 → BLOCK",
      "Order ships to ES, no post-ship cancel history → PASS",
    ],
  },
  {
    code: "R015",
    name: "price-change-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks when the cart's current prices have shifted beyond an allowed delta from prices at the time the cart was created. Protects against TOCTOU price manipulation.",
    when: "priceChangePct > maxPriceChangePct",
    defaults: { maxPriceChangePct: 5 },
    merchantPolicyKey: "r015",
    merchantConfig: "maxPriceChangePct (default 5, i.e. 5%)",
    examples: [
      "Product price dropped 15% since cart created, max=5% → BLOCK",
      "Price unchanged → PASS",
    ],
  },
  {
    code: "R016",
    name: "stock-confidence-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks when a line item's available stock falls below the required minimum confidence threshold. Prevents checkout on near-zero or unreliable inventory.",
    when: "lineItems.some(i => i.availableQty < minStockQty)",
    defaults: { minStockQty: 1 },
    merchantPolicyKey: "r016",
    merchantConfig: "minStockQty (default 1)",
    examples: [
      "Line item has 0 units available → BLOCK",
      "All line items in stock → PASS",
    ],
  },
  {
    code: "R017",
    name: "coupon-discount-anomaly",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Limits the number of discount code attempts per cart and caps the maximum total discount depth. Detects coupon probing.",
    when: "cartAttributes._discount_codes_tried > maxAttempts OR totalDiscountPct > maxDiscountPct",
    defaults: { maxAttempts: 5, maxDiscountPct: 50 },
    merchantPolicyKey: "r017",
    merchantConfig: "maxAttempts (default 5), maxDiscountPct (default 50)",
    examples: [
      "8 discount codes tried, max=5 → BLOCK",
      "60% total discount, max=50% → BLOCK",
      "2 codes tried, 20% discount → PASS",
    ],
  },
  {
    code: "R018",
    name: "cart-composition-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Detects order spikes, excessive item counts, and single-SKU quantity abuse by comparing the current cart against the agent's typical ordering patterns.",
    when: "cartTotal / agentAvgOrder > spikeMultiplier OR lineItems.length > maxLineItems OR singleSkuQty > maxSingleSkuQty",
    defaults: { spikeMultiplier: 5, maxLineItems: 50, maxSingleSkuQty: 100 },
    merchantPolicyKey: "r018",
    merchantConfig: "spikeMultiplier (default 5), maxLineItems (default 50), maxSingleSkuQty (default 100)",
    examples: [
      "Cart=$500, agent avg=$50, spike=10× (threshold=5) → BLOCK",
      "Cart has 200 of the same SKU, max=100 → BLOCK",
    ],
  },

  // ── Merchant Medium-Priority Controls ─────────────────────────────────────
  {
    code: "R019",
    name: "country-jurisdiction",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Restricts orders to an allowed country list, or blocks specific jurisdictions. Useful for merchants with export restrictions or regional licensing requirements.",
    when: "!merchant.allowedCountries.includes(billingCountry) OR merchant.blockedCountries.includes(billingCountry)",
    defaults: { allowedCountries: [], blockedCountries: [] },
    merchantPolicyKey: "r019",
    merchantConfig: "allowedCountries (string[], empty = all), blockedCountries (string[])",
    examples: [
      "Merchant allows EU only, order from US → BLOCK",
      "Merchant blocks RU, order from RU → BLOCK",
      "Order from allowed country → PASS",
    ],
  },
  {
    code: "R020",
    name: "business-hours",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Restricts agentic checkout to merchant business hours in the merchant's local timezone. Orders outside hours are blocked or queued depending on configuration.",
    when: "currentLocalHour < openHour OR currentLocalHour >= closeHour",
    defaults: { openHour: 8, closeHour: 22, timezone: "merchant_local" },
    merchantPolicyKey: "r020",
    merchantConfig: "openHour (default 8), closeHour (default 22), timezone (default merchant_local)",
    examples: [
      "Order at 2:00 AM merchant time, close=22 → BLOCK",
      "Order at 11:00 AM merchant time → PASS",
    ],
  },
  {
    code: "R021",
    name: "first-purchase-with-merchant",
    tier: 2,
    action: "FRICTION",
    configurable: true,
    needsLookup: true,
    description:
      "Flags first-time agent purchases with a specific merchant for review or additional confirmation. Does not block by default — adds a friction step.",
    when: "ordersWithMerchant(agentId, merchantId) === 0",
    defaults: { frictionAction: "require_confirmation" },
    merchantPolicyKey: "r021",
    merchantConfig: "frictionAction ('require_confirmation'|'block', default 'require_confirmation')",
    examples: [
      "Agent's first order with this merchant → FRICTION",
      "Agent has 3 prior orders with merchant → PASS",
    ],
  },
  {
    code: "R022",
    name: "payment-rail-restriction",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Enforces an allowlist or blocklist of payment methods. Merchants can restrict agents to specific rails (e.g. x402 only, no crypto, credit-card-only).",
    when: "!merchant.allowedPaymentMethods.includes(paymentMethod) OR merchant.blockedPaymentMethods.includes(paymentMethod)",
    defaults: { allowedPaymentMethods: [], blockedPaymentMethods: [] },
    merchantPolicyKey: "r022",
    merchantConfig: "allowedPaymentMethods (string[], empty = all), blockedPaymentMethods (string[])",
    examples: [
      "Merchant allows only 'stripe_card', agent uses x402 → BLOCK",
      "Merchant blocks 'crypto', agent uses x402 → BLOCK",
      "Agent uses an allowed payment method → PASS",
    ],
  },
  {
    code: "R023",
    name: "refund-abuse-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents with a high refund ratio over a rolling window. Detects serial return abuse and policy exploitation.",
    when: "refundRatio(agentId, windowDays) > maxRatio",
    defaults: { windowDays: 90, maxRatio: 0.5 },
    merchantPolicyKey: "r023",
    merchantConfig: "windowDays (default 90), maxRatio (default 0.5)",
    examples: [
      "7 of 10 orders refunded in 90d (ratio=0.7), max=0.5 → BLOCK",
      "2 of 10 orders refunded (ratio=0.2) → PASS",
    ],
  },
  {
    code: "R024",
    name: "dispute-history-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: true,
    description:
      "Blocks agents with too many payment disputes (chargebacks) in the lookback window.",
    when: "disputeCount(agentId, windowDays) > maxDisputes",
    defaults: { windowDays: 30, maxDisputes: 2 },
    merchantPolicyKey: "r024",
    merchantConfig: "windowDays (default 30), maxDisputes (default 2)",
    examples: [
      "4 chargebacks in 30d, max=2 → BLOCK",
      "1 chargeback in 30d, max=2 → PASS",
    ],
  },
  {
    code: "R025",
    name: "sensitive-delivery-address",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Blocks PO box addresses and known freight-forwarder addresses. Reduces reshipping fraud and high-risk delivery patterns.",
    when: "isPOBox(shippingAddress) OR isFreightForwarder(shippingAddress)",
    defaults: { blockPOBox: true, blockFreightForwarder: true },
    merchantPolicyKey: "r025",
    merchantConfig: "blockPOBox (bool, default true), blockFreightForwarder (bool, default true)",
    examples: [
      "Shipping address is 'PO Box 123' → BLOCK",
      "Address matches known freight-forwarder list → BLOCK",
      "Normal residential address → PASS",
    ],
  },
  {
    code: "R026",
    name: "subscription-autorenew-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Requires explicit consent before processing auto-renew or subscription charges. The agent must include a consent signal in the cart attributes.",
    when: "isSubscription AND !cartAttributes._subscription_consent_given",
    defaults: { requireExplicitConsent: true },
    merchantPolicyKey: "r026",
    merchantConfig: "requireExplicitConsent (bool, default true)",
    examples: [
      "Subscription order without consent flag → BLOCK",
      "Subscription with cartAttributes._subscription_consent_given=true → PASS",
    ],
  },
  {
    code: "R027",
    name: "gift-card-stored-value",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Caps stored-value and gift-card purchase amounts per transaction. Gift cards are a common vector for agent-assisted fraud.",
    when: "giftCardTotal > maxGiftCardCents",
    defaults: { maxGiftCardCents: 20000 },
    merchantPolicyKey: "r027",
    merchantConfig: "maxGiftCardCents (default 20000, i.e. $200)",
    examples: [
      "Cart contains $500 in gift cards, max=$200 → BLOCK",
      "Cart contains $50 gift card → PASS",
    ],
  },
  {
    code: "R028",
    name: "b2b-po-guard",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Requires purchase-order (PO) evidence for B2B orders above a threshold. Prevents agents from placing large B2B orders without a valid PO reference.",
    when: "isB2B AND cartTotalCents > b2bPoThresholdCents AND !cartAttributes._po_number",
    defaults: { b2bPoThresholdCents: 100000, requirePo: true },
    merchantPolicyKey: "r028",
    merchantConfig: "b2bPoThresholdCents (default 100000, i.e. $1000), requirePo (bool, default true)",
    examples: [
      "B2B order $1500, no PO number provided → BLOCK",
      "B2B order $500 (below threshold) → PASS",
      "B2B order $2000 with valid _po_number → PASS",
    ],
  },

  // ── Merchant Control Plane ────────────────────────────────────────────────
  {
    code: "R029",
    name: "merchant-preset",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Applies one of four named risk presets that bundle common threshold configurations into a single setting. Presets: abierto (open), equilibrado (balanced), estricto (strict), regulado (regulated — for licensed merchants).",
    when: "preset === 'estricto' AND agentTrustScore < 60 OR preset === 'regulado' AND !hasCompliance",
    defaults: { preset: "equilibrado" },
    merchantPolicyKey: "r029",
    merchantConfig: "preset ('abierto'|'equilibrado'|'estricto'|'regulado', default 'equilibrado')",
    examples: [
      "Preset=estricto, agent trustScore=45 → BLOCK",
      "Preset=abierto, any trusted agent → PASS",
      "Preset=regulado, agent lacks compliance evidence → BLOCK",
    ],
  },
  {
    code: "R030",
    name: "simple-controls",
    tier: 2,
    action: "BLOCK",
    configurable: true,
    needsLookup: false,
    description:
      "Amount cap and country restriction for merchants without advanced assurance rails. Designed as a lightweight safety net for simple use-cases where other rules are not needed.",
    when: "cartTotalCents > maxOrderCents OR !allowedCountries.includes(billingCountry)",
    defaults: { maxOrderCents: 50000, allowedCountries: [] },
    merchantPolicyKey: "r030",
    merchantConfig: "maxOrderCents (default 50000, i.e. $500), allowedCountries (string[], empty = all)",
    examples: [
      "Cart=$600, merchant max=$500 → BLOCK",
      "Merchant allows ES only, order from DE → BLOCK",
      "Cart=$100, allowed country → PASS",
    ],
  },
] as const;

type AgentRule = (typeof AGENT_RULES)[number];

const TIER_DESCRIPTIONS = {
  1: "Kill-switch — always enforced, not merchant-configurable. Protects against unverifiable identity, spoofed signatures, and revoked agents.",
  2: "Configurable — merchant can adjust thresholds, enable, or disable per their risk policy.",
} as const;

const TIER1_CODES = ["R001", "R002", "R005"] as const;
const TIER2_CODES = AGENT_RULES.filter((r) => r.tier === 2).map((r) => r.code);

function buildRuleMarkdown(rule: AgentRule): string {
  const defaultsStr =
    Object.keys(rule.defaults).length > 0
      ? Object.entries(rule.defaults)
          .map(([k, v]) => `\`${k}\`: ${JSON.stringify(v)}`)
          .join(", ")
      : "none";

  return `### ${rule.code} — ${rule.name}

**Tier ${rule.tier}** (${TIER_DESCRIPTIONS[rule.tier as 1 | 2]})
**Default action:** ${rule.action} | **Configurable:** ${rule.configurable ? "Yes" : "No"} | **Needs historical lookup:** ${rule.needsLookup ? "Yes" : "No"}

${rule.description}

**Fires when:** \`${rule.when}\`

**Default thresholds:** ${defaultsStr}

**Merchant config key:** \`merchantPolicies.${rule.merchantPolicyKey}\` — ${rule.merchantConfig}

**Examples:**
${rule.examples.map((e) => `- ${e}`).join("\n")}`;
}

const getAgentRulesOutputSchema = z.object({
  rules: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      tier: z.number(),
      action: z.string(),
      configurable: z.boolean(),
      needsLookup: z.boolean(),
      description: z.string(),
      when: z.string(),
      defaults: z.record(z.unknown()),
      merchantPolicyKey: z.string(),
      merchantConfig: z.string(),
      examples: z.array(z.string()),
    })
  ),
  total: z.number(),
  version: z.string(),
  tier1Codes: z.array(z.string()),
  tier2Codes: z.array(z.string()),
});

export function registerGetAgentRules(
  server: McpServer,
  config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_agent_rules",
    {
      description:
        "Get the 30 merchant agent control points (R001–R030) that govern when agentic checkouts are blocked, flagged, or allowed. Rules are grouped into four categories: KYA & identity (R001–R008), merchant high-priority controls (R009–R018), merchant medium-priority controls (R019–R028), and merchant control plane (R029–R030). Each rule includes its enforcement tier, configurable thresholds, trigger condition, and examples. Use this to understand or implement the Trusteed agent enforcement model.",
      inputSchema: {
        filter: z
          .enum(["all", "tier1", "tier2", "needs_lookup", "no_lookup"])
          .optional()
          .describe(
            "Filter rules. 'tier1' = kill-switch rules (always on). 'tier2' = configurable rules. 'needs_lookup' = rules requiring historical data. 'no_lookup' = stateless rules. Default: 'all'."
          ),
        code: z
          .string()
          .regex(/^R0\d{2}$/)
          .optional()
          .describe(
            "Return a single rule by code (e.g. 'R001'). Overrides 'filter' when provided."
          ),
      },
      outputSchema: getAgentRulesOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ filter = "all", code }) => {
      let rules: readonly AgentRule[];

      if (code) {
        const found = AGENT_RULES.find((r) => r.code === code.toUpperCase());
        if (!found) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Rule ${code} not found. Valid codes: ${AGENT_RULES.map((r) => r.code).join(", ")}.`,
              },
            ],
            structuredContent: {
              rules: [],
              total: 0,
              version: AGENT_RULES_VERSION,
              tier1Codes: [...TIER1_CODES],
              tier2Codes: [...TIER2_CODES],
            },
          };
        }
        rules = [found];
      } else {
        rules =
          filter === "tier1"
            ? AGENT_RULES.filter((r) => r.tier === 1)
            : filter === "tier2"
              ? AGENT_RULES.filter((r) => r.tier === 2)
              : filter === "needs_lookup"
                ? AGENT_RULES.filter((r) => r.needsLookup)
                : filter === "no_lookup"
                  ? AGENT_RULES.filter((r) => !r.needsLookup)
                  : AGENT_RULES;
      }

      const summaryTable = rules
        .map(
          (r) =>
            `| ${r.code} | ${r.name} | ${r.tier} | ${r.configurable ? "Yes" : "No"} | ${r.needsLookup ? "Yes" : "No"} |`
        )
        .join("\n");

      const detailBlocks = rules.map(buildRuleMarkdown).join("\n\n---\n\n");

      const markdown = `## Trusteed Agent Control Points (R001–R030)

**Version:** ${AGENT_RULES_VERSION} | **Showing:** ${rules.length} of ${AGENT_RULES.length} rules

### Summary

| Code | Name | Tier | Configurable | Needs Lookup |
|------|------|------|-------------|--------------|
${summaryTable}

**Tier 1 (kill-switch):** R001, R002, R005 — always enforced (identity, signature, revocation)
**Tier 2 (configurable):** all others — merchant-adjustable thresholds

---

## Rule Details

${detailBlocks}

---

## Integration

Implement these rules via the Trusteed enforcement API:

\`\`\`
POST ${config.baseUrl ?? ""}/api/v1/rules/evaluate
{
  "agentId": "string",
  "agentTrustScore": 0–100,
  "orderContext": { "cartTotalCents": number, "lineItems": [...], ... },
  "merchantPolicies": { "r006": { "minTrustScore": 40 }, ... }
}
\`\`\`

- **Rules snapshot** (offline evaluation): \`GET ${config.baseUrl ?? ""}/:storeSlug/rules-snapshot\`
- **Agent policy contract**: \`${config.baseUrl ?? ""}/.well-known/agent-policy.json\`
- **Full spec**: \`${config.baseUrl ?? ""}/docs/architecture/checkout-enforcement\``;

      return {
        content: [{ type: "text" as const, text: markdown }],
        structuredContent: {
          rules: rules.map((r) => ({ ...r })),
          total: rules.length,
          version: AGENT_RULES_VERSION,
          tier1Codes: [...TIER1_CODES],
          tier2Codes: [...TIER2_CODES],
        },
      };
    }
  );
}
