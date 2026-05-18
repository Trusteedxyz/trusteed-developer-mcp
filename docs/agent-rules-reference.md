# Agent Rules Reference — R001–R030

Complete reference for the Trusteed merchant rule catalog. These 30 rules are evaluated at checkout by the Trusteed enforcement layer (Shopify Function, WooCommerce hook, PrestaShop override, Odoo override, or the server-side `POST /api/v1/rules/evaluate` endpoint).

Rules do **not** require eIDAS, QTSP, Visa Verifier, or any regulated identity provider unless a merchant explicitly configures such evidence. The baseline works with order context, the agent token, merchant policies, and historical lookups.

Use the `get_agent_rules` MCP tool for machine-readable output that includes trigger conditions, examples, evaluation phases, and configurable thresholds.

---

## Categories

| Range     | Category                        | Count |
| --------- | ------------------------------- | ----- |
| R001–R008 | KYA and agent identity          | 8     |
| R009–R018 | High-priority merchant controls | 10    |
| R019–R028 | Medium-priority controls        | 10    |
| R029–R030 | Control plane                   | 2     |

---

## R001–R008 — KYA and Agent Identity

### R001 · `verified-agent-required`

**Function:** Blocks checkout when no verified agent identity is present. An absent or `unknown_agent` ID triggers a BLOCK.

**Default action:** BLOCK  
**Configurable:** `requireAgentId` (default `true` — disable only for fully anonymous storefronts)  
**When it fires:** `agentId` is null, empty, or the sentinel string `"unknown_agent"`

```jsonc
// merchantPolicies
{ "r001": { "requireAgentId": false } }  // opt-out (open storefront)
```

---

### R002 · `signature-spoof-block`

**Function:** Blocks when the agent token's cryptographic signature is invalid, or when a token is present but the identity cannot be verified. Catches replay and spoofing attacks.

**Default action:** BLOCK  
**Configurable:** `requireValidSignature` (default `true`)  
**Depends on:** `_agent_token_signature_invalid` cart attribute set by the plugin verifier

```jsonc
{ "r002": { "requireValidSignature": false } }  // opt-out (testing only)
```

---

### R003 · `mandate-boundary-match`

**Function:** Enforces the operator mandate's spending cap and allowed product-category list. Blocks when cart total exceeds `maxAmountCents` or when a line-item category falls outside `allowedCategories`.

**Default action:** BLOCK  
**Configurable:** `maxAmountCents`, `allowedCategories`  
**Depends on:** `_product_categories` cart attribute (comma-separated list set by plugin)

```jsonc
{ "r003": { "maxAmountCents": 50000, "allowedCategories": ["electronics", "books"] } }
```

---

### R004 · `new-key-friction`

**Function:** Adds friction (requires explicit user confirmation) when a freshly-issued agent key is used for the first time. Key age is measured from the JWT `iat` claim or first-seen timestamp.

**Default action:** FRICTION (require_confirmation)  
**Configurable:** `minKeyAgeSeconds` (default 300 s), `frictionAction` (`require_confirmation` | `block`)  
**Depends on:** `_agent_key_age_hours` cart attribute

```jsonc
{ "r004": { "minKeyAgeSeconds": 600, "frictionAction": "block" } }
```

---

### R005 · `revoked-agent-block`

**Function:** Blocks revoked or suspended agents. Also fires when server-side lookup shows the agent has received ≥3 R001 BLOCK decisions in the last 7 days (repeated identity failures).

**Default action:** BLOCK  
**Configurable:** none  
**Depends on:** `_agent_revoked` / `_agent_status` cart attributes; `agentRepeatedlyBlocked` historical lookup

---

### R006 · `provider-confidence-tier`

**Function:** Enforces a minimum Trusteed agent trust score and a minimum provider-reported confidence level. Useful for stores that want to tier access by agent quality.

**Default action:** BLOCK  
**Configurable:** `minScore` (default 30), `minProviderConfidence` (default 0.6)  
**Depends on:** `agentTrustScore` from token; `_provider_confidence` cart attribute

```jsonc
{ "r006": { "minScore": 50, "minProviderConfidence": 0.75 } }
```

---

### R007 · `cross-merchant-abuse-signal`

**Function:** Blocks agents that have been blocked by two or more other merchants in the last 30 days. Uses a cross-merchant reputation signal from the Trusteed network.

**Default action:** BLOCK  
**Configurable:** none  
**Depends on:** `_cross_merchant_abuse` cart attribute; `crossMerchantAbuseSignal` historical lookup

---

### R008 · `scope-escalation-detection`

**Function:** Blocks requests where the agent requests scopes not explicitly authorized by the merchant. Prevents scope creep from overly-broad agent mandates.

**Default action:** BLOCK  
**Configurable:** `allowedScopes` (string array, default: no restriction)  
**Depends on:** `_requested_scopes` cart attribute (comma-separated)

```jsonc
{ "r008": { "allowedScopes": ["read:products", "write:cart"] } }
```

---

## R009–R018 — High-Priority Merchant Controls

### R009 · `agent-verification-required`

**Function:** Merchant-side mirror of R001, evaluated at the catalog/session layer. Blocks catalog and checkout operations when no agent is present.

**Default action:** BLOCK  
**Configurable:** `requireAgentId` (default `true`)

---

### R010 · `new-agent-probation`

**Function:** Requires the agent to have at least `minCompletedOrders` prior completed orders with this merchant before proceeding. First-time agents go through probation.

**Default action:** BLOCK  
**Configurable:** `minCompletedOrders` (default 3)  
**Depends on:** `completedOrderCount` historical lookup or `_completed_orders` cart attribute

```jsonc
{ "r010": { "minCompletedOrders": 5 } }
```

---

### R011 · `repeat-failed-checkout`

**Function:** Blocks agents that have exceeded `maxFailures` failed checkout attempts within `windowSeconds`. Protects against brute-force checkout probing.

**Default action:** BLOCK  
**Configurable:** `windowSeconds` (default 3600 s), `maxFailures` (default 5)  
**Depends on:** `failedCheckoutCount` or `velocityCount` historical lookup

```jsonc
{ "r011": { "windowSeconds": 1800, "maxFailures": 3 } }
```

---

### R012 · `high-risk-category`

**Function:** Blocks orders that contain a product category in the merchant's high-risk category list. Typically used for age-restricted, regulated, or dangerous goods.

**Default action:** BLOCK  
**Configurable:** `categories` (string array, default: empty — rule is no-op until configured)  
**Depends on:** `_product_categories` cart attribute

```jsonc
{ "r012": { "categories": ["alcohol", "tobacco", "firearms"] } }
```

---

### R013 · `return-policy-guard`

**Function:** Blocks checkout when the agent's return expectations conflict with the merchant's return policy (e.g., agent assumes returns allowed but item is final sale).

**Default action:** BLOCK  
**Configurable:** `disallowFinalSaleMismatch` (default `true`)  
**Depends on:** `_return_policy_mismatch` cart attribute set by plugin enrichment

---

### R014 · `delivery-risk-guard`

**Function:** Blocks delivery to high-risk countries (default: KP, IR, SY, CU) and blocks agents with too many post-shipment cancellations in a rolling window.

**Default action:** BLOCK  
**Configurable:** `highRiskCountries`, `maxCancellations` (default 3), `windowDays` (default 90)  
**Depends on:** `billingCountry` / `shippingCountry` order context; `cancelCount` historical lookup

```jsonc
{ "r014": { "highRiskCountries": ["KP","IR"], "maxCancellations": 2, "windowDays": 30 } }
```

---

### R015 · `price-change-guard`

**Function:** Blocks when the cart total has shifted more than `maxDeltaBps` basis points since the agent loaded the product price. Prevents agents from exploiting brief price windows.

**Default action:** BLOCK  
**Configurable:** `maxDeltaBps` (default 100 bps = 1%)  
**Depends on:** `_price_delta_bps` cart attribute set by plugin at cart-load time

```jsonc
{ "r015": { "maxDeltaBps": 200 } }
```

---

### R016 · `stock-confidence-guard`

**Function:** Blocks when the lowest-stock line item is below `minStock`. Prevents agents from completing orders that cannot be fulfilled.

**Default action:** BLOCK  
**Configurable:** `minStock` (default 1)  
**Depends on:** `_lowest_stock` cart attribute

```jsonc
{ "r016": { "minStock": 2 } }
```

---

### R017 · `coupon-discount-anomaly`

**Function:** Limits the number of discount codes tried (`maxAttempts`) and the total discount depth (`maxDiscountBps`). Detects agents that systematically probe coupon codes.

**Default action:** BLOCK  
**Configurable:** `maxAttempts` (default 5), `maxDiscountBps` (default 5000 = 50%)  
**Depends on:** `orderContext.discountCodes` (preferred) or `_discount_codes_tried` / `_discount_bps` cart attributes

```jsonc
{ "r017": { "maxAttempts": 3, "maxDiscountBps": 2000 } }
```

---

### R018 · `cart-composition-guard`

**Function:** Detects anomalous carts: total value spike vs merchant average, item count exceeding max, or single-SKU quantity abuse. Catches bulk-buy bots and inventory drain attacks.

**Default action:** BLOCK  
**Configurable:** `spikeMultiplier` (default 5×), `merchantAvgOrderCents`, `maxItemCount`, `maxSingleSkuQty`  
**Depends on:** `orderContext.cartTotalCents`, `orderContext.itemCount`, `orderContext.lineItems`

```jsonc
{ "r018": { "merchantAvgOrderCents": 4000, "spikeMultiplier": 4.0, "maxItemCount": 20, "maxSingleSkuQty": 5 } }
```

---

## R019–R028 — Medium-Priority Controls

### R019 · `country-jurisdiction`

**Function:** Restricts orders to an allowlist of countries or blocks orders from a blocklist. Handles geographic compliance requirements.

**Default action:** BLOCK  
**Configurable:** `allowedCountries`, `blockedCountries` (ISO 3166-1 alpha-2 codes)

```jsonc
{ "r019": { "allowedCountries": ["ES","FR","DE","IT","PT"] } }
```

---

### R020 · `business-hours`

**Function:** Restricts agentic orders to the merchant's configured business hours in their local timezone. Orders outside the window are blocked.

**Default action:** BLOCK  
**Configurable:** `timezone` (IANA tz, default UTC), `startHour`, `endHour` (0–23, 24h)  
**Depends on:** `_merchant_local_hour` cart attribute (falls back to `Intl.DateTimeFormat` server-side)

```jsonc
{ "r020": { "timezone": "Europe/Madrid", "startHour": 8, "endHour": 20 } }
```

---

### R021 · `first-purchase-with-merchant`

**Function:** Flags agents making their first purchase with this merchant. Requires at least `minCompletedOrders` prior orders to pass. Lighter-weight variant of R010.

**Default action:** BLOCK  
**Configurable:** `minCompletedOrders` (default 1)

---

### R022 · `payment-rail-restriction`

**Function:** Enforces an allowlist or blocklist of payment methods. Useful for merchants that only accept specific rails (e.g., stripe only, no crypto).

**Default action:** BLOCK  
**Configurable:** `allowedPaymentMethods`, `blockedPaymentMethods` (case-insensitive substring match)  
**Depends on:** `orderContext.paymentMethod`

```jsonc
{ "r022": { "allowedPaymentMethods": ["stripe", "paypal"] } }
```

---

### R023 · `refund-abuse-guard`

**Function:** Blocks agents whose refund ratio (refunds / completed orders) exceeds `maxRatio` in a rolling `windowDays` period. Protects against buy-return abuse.

**Default action:** BLOCK  
**Configurable:** `windowDays` (default 90), `maxRatio` (default 0.5)  
**Depends on:** `refundRatio` historical lookup

```jsonc
{ "r023": { "windowDays": 30, "maxRatio": 0.25 } }
```

---

### R024 · `dispute-history-guard`

**Function:** Blocks agents with more than `maxDisputes` payment disputes in the last `windowDays`. Distinct from R023 — disputes are formal chargebacks, not just refunds.

**Default action:** BLOCK  
**Configurable:** `windowDays` (default 30), `maxDisputes` (default 2)  
**Depends on:** `disputeCount` historical lookup

```jsonc
{ "r024": { "windowDays": 60, "maxDisputes": 1 } }
```

---

### R025 · `sensitive-delivery-address`

**Function:** Blocks delivery to PO boxes and freight-forwarder addresses. Both flags are enabled by default; disable individually if needed.

**Default action:** BLOCK  
**Configurable:** `blockPoBox` (default `true`), `blockFreightForwarder` (default `true`)  
**Depends on:** `_shipping_po_box`, `_shipping_freight_forwarder` cart attributes (set by address-validation enrichment)

---

### R026 · `subscription-autorenew-guard`

**Function:** Requires explicit consent capture before processing subscription or auto-renew charges. Blocks if the order is flagged as a subscription but consent attribute is absent.

**Default action:** BLOCK  
**Configurable:** `requireConsent` (default `true`)  
**Depends on:** `_subscription` / `_autorenew` and `_autorenew_consent` cart attributes

---

### R027 · `gift-card-stored-value`

**Function:** Caps the stored-value / gift-card amount per transaction. Prevents agents from converting large cash balances into gift cards programmatically.

**Default action:** BLOCK  
**Configurable:** `maxStoredValueCents` (default 0 — rule fires for any stored-value purchase unless configured)  
**Depends on:** `_stored_value_cents` cart attribute

```jsonc
{ "r027": { "maxStoredValueCents": 20000 } }  // allow up to $200
```

---

### R028 · `b2b-po-guard`

**Function:** Requires a purchase-order hash for orders flagged as B2B. Prevents agents from placing corporate orders without documented authorization.

**Default action:** BLOCK  
**Configurable:** `requirePurchaseOrder` (default `true`)  
**Depends on:** `_b2b_order` and `_purchase_order_hash` cart attributes

---

## R029–R030 — Control Plane

### R029 · `merchant-preset`

**Function:** Applies one of four named risk profiles to the entire checkout evaluation. A single configuration key controls overall posture.

**Default action:** varies by preset  
**Configurable:** `preset` — one of:
- `"abierto"` — no additional restrictions (rule always passes)
- `"equilibrado"` — default; standard checks apply
- `"estricto"` — requires verified agent + trust score ≥ 70
- `"regulado"` — requires `_regulated_evidence_present` cart attribute (e.g., eIDAS or QTSP token)

```jsonc
{ "r029": { "preset": "estricto" } }
```

---

### R030 · `simple-controls`

**Function:** Catch-all rule for amount caps and country restrictions that do not require agent identity or historical lookups. Designed for merchants without advanced assurance rails.

**Default action:** BLOCK  
**Configurable:** `maxAmountCents`, `allowedCountries`

```jsonc
{ "r030": { "maxAmountCents": 100000, "allowedCountries": ["ES","MX","US"] } }
```

---

## Using Rules via the API

```bash
POST https://www.trusteed.xyz/api/v1/rules/evaluate
Content-Type: application/json
X-Agent-Api-Key: <your-key>

{
  "agentId": "agent_abc123",
  "agentTrustScore": 42,
  "orderContext": {
    "cartTotalCents": 8500,
    "billingCountry": "ES",
    "lineItems": [{ "productId": "p1", "quantity": 2 }],
    "paymentMethod": "stripe_card"
  },
  "merchantPolicies": {
    "r006": { "minScore": 40 },
    "r011": { "windowSeconds": 300, "maxAttempts": 3 },
    "r019": { "allowedCountries": ["ES", "FR", "DE"] },
    "r029": { "preset": "equilibrado" }
  }
}
```

### Offline enforcement (plugin-side)

```bash
GET https://www.trusteed.xyz/:storeSlug/rules-snapshot
# Returns a JWS-signed RuleSnapshot valid for 5 minutes.
# The plugin verifies the signature offline and applies the rules
# without a network call at checkout time.
```

### Fetching a single rule

```
get_agent_rules(code="R015")
```

Returns the full rule definition including trigger conditions, evidence requirements, and integration examples.

---

## Cart Attribute Reference

Rules read platform-agnostic cart attributes injected by the Trusteed plugin during cart enrichment. Attributes use the `_` prefix convention.

| Attribute                        | Type    | Set by              | Used by                |
| -------------------------------- | ------- | ------------------- | ---------------------- |
| `_agent_token_signature_invalid` | boolean | Plugin verifier     | R002                   |
| `_agent_token_present`           | boolean | Plugin verifier     | R002                   |
| `_agent_revoked`                 | boolean | Plugin verifier     | R005                   |
| `_agent_status`                  | string  | Plugin verifier     | R005                   |
| `_agent_key_age_hours`           | number  | Plugin verifier     | R004                   |
| `_provider_confidence`           | number  | Plugin enrichment   | R006                   |
| `_cross_merchant_abuse`          | boolean | Server lookup       | R007                   |
| `_requested_scopes`              | CSV     | Agent token claims  | R008                   |
| `_product_categories`            | CSV     | Plugin enrichment   | R003, R012             |
| `_return_policy_mismatch`        | boolean | Plugin enrichment   | R013                   |
| `_price_delta_bps`               | number  | Plugin (cart-load)  | R015                   |
| `_lowest_stock`                  | number  | Plugin enrichment   | R016                   |
| `_discount_codes_tried`          | number  | Shopify/WC attribute| R017                   |
| `_discount_bps`                  | number  | Plugin enrichment   | R017                   |
| `_failed_checkout_count`         | number  | Server lookup       | R011                   |
| `_completed_orders`              | number  | Server lookup       | R010, R021             |
| `_merchant_local_hour`           | number  | Plugin (optional)   | R020                   |
| `_shipping_po_box`               | boolean | Address validation  | R025                   |
| `_shipping_freight_forwarder`    | boolean | Address validation  | R025                   |
| `_subscription`                  | boolean | Plugin enrichment   | R026                   |
| `_autorenew`                     | boolean | Plugin enrichment   | R026                   |
| `_autorenew_consent`             | boolean | Buyer-side consent  | R026                   |
| `_stored_value_cents`            | number  | Plugin enrichment   | R027                   |
| `_b2b_order`                     | boolean | Plugin enrichment   | R028                   |
| `_purchase_order_hash`           | string  | Plugin enrichment   | R028                   |
| `_regulated_evidence_present`    | boolean | Plugin verifier     | R029 (`regulado` preset) |

---

## Tier Matrix

| Rule  | Tier 1 (kill-switch) | Tier 2 (standard) | Needs server lookup |
| ----- | :------------------: | :---------------: | :-----------------: |
| R001  | ✅                   |                   |                     |
| R002  | ✅                   |                   |                     |
| R003  |                      | ✅                |                     |
| R004  |                      | ✅                |                     |
| R005  |                      | ✅                | ✅                  |
| R006  |                      | ✅                |                     |
| R007  | ✅                   |                   | ✅                  |
| R008  |                      | ✅                |                     |
| R009  |                      | ✅                |                     |
| R010  |                      | ✅                | ✅                  |
| R011  |                      | ✅                | ✅                  |
| R012  |                      | ✅                |                     |
| R013  |                      | ✅                |                     |
| R014  |                      | ✅                | ✅                  |
| R015  |                      | ✅                |                     |
| R016  |                      | ✅                |                     |
| R017  |                      | ✅                |                     |
| R018  |                      | ✅                |                     |
| R019  |                      | ✅                |                     |
| R020  |                      | ✅                |                     |
| R021  |                      | ✅                | ✅                  |
| R022  |                      | ✅                |                     |
| R023  |                      | ✅                | ✅                  |
| R024  |                      | ✅                | ✅                  |
| R025  |                      | ✅                |                     |
| R026  |                      | ✅                |                     |
| R027  |                      | ✅                |                     |
| R028  |                      | ✅                |                     |
| R029  |                      | ✅                |                     |
| R030  |                      | ✅                |                     |

**Tier 1** rules use a fast-path kill-switch with fail-closed semantics. **Tier 2** rules use standard fail-open semantics (alert on >5% block rate / hour). Rules marked "Needs server lookup" require a database or Redis call at evaluation time.

---

*Source of truth for rule logic: `apps/api/src/services/enforcement/rule-catalog.ts`.*  
*Machine-readable output: `get_agent_rules` MCP tool.*  
*Runtime evaluation: `POST /api/v1/rules/evaluate`.*
