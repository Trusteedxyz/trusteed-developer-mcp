# Agent Rules Reference — R001–R062 (46 rules)

Complete reference for the Trusteed merchant rule catalog. These 46 rules are evaluated at checkout by the Trusteed enforcement layer (Shopify Function, WooCommerce hook, PrestaShop override, Odoo override, Magento plugin, or the server-side `POST /api/v1/rules/evaluate` endpoint).

**Numbering is non-contiguous.** The catalog runs `R001`–`R062` but contains 46 rules, not 62: `R033`, `R037`, `R040` and `R049`–`R061` do not exist. Do not infer a rule from a gap.

Rules do **not** require eIDAS, QTSP, Visa Verifier, or any regulated identity provider unless a merchant explicitly configures such evidence. The baseline works with order context, the agent token, merchant policies, and historical lookups.

Use the `get_agent_rules` MCP tool for machine-readable output that includes trigger conditions, examples, evaluation phases, and configurable thresholds.

---

## Two names per rule, and why it matters

Every rule has a **canonical code** of the form `R017.discount-anomaly-applied` and a
**parameter key** of the form `r017`. They are not interchangeable:

- The canonical code identifies the rule in a `merchant_trust_rules` row, in a signed
  RuleSnapshot, and in the `get_agent_rules` output.
- The lowercase `rNNN` key is where that rule's parameters live inside the engine's
  `merchantPolicies` object. `rNNN` always belongs to the **canonical** evaluator of that
  number — `r002` configures `R002.signature-spoof-block`, as you would expect.

⚠️ **A bare short code is not the same as its canonical code.** Writing `R002` (instead of
`R002.signature-spoof-block`) into a rule row does **not** select the canonical R002. The
pre-canonical short codes `R001`–`R010` are a separate, older numbering that is still live
in production data, and they run their own legacy evaluators reading their own
`legacy.rNNN` parameter namespace (the legacy `R002` reads `threshold`; the canonical
`R002.signature-spoof-block` reads `requireValidSignature`). Where those short codes
normalise to is deliberately unintuitive — `R002` → `R006.provider-confidence-tier`,
`R007` → `R018.cart-composition-guard` — so **always write the full canonical code**.
Treat rule codes as opaque strings and copy them from `get_agent_rules`.

Source: `LEGACY_RULE_CODE_ALIASES` and the `legacy` namespace comment in
`packages/shared/src/enforcement/{merchant-rule-definitions,rule-catalog}.ts`.

---

## Categories

| Range           | Category                        | Count  |
| --------------- | ------------------------------- | ------ |
| R001–R008       | KYA and agent identity          | 8      |
| R009–R018       | High-priority merchant controls | 10     |
| R019–R028       | Medium-priority controls        | 10     |
| R029–R030       | Control plane                   | 2      |
| R031–R048, R062 | Starter-kit controls            | 16     |
| **Total**       |                                 | **46** |

---

## R001–R008 — KYA and Agent Identity

### R001 · `verified-agent-required`

**Function:** Blocks checkout when no verified agent identity is present. An absent or `unknown_agent` ID triggers a BLOCK.

**Default action:** BLOCK  
**Configurable:** `requireAgentId` (default `true` — disable only for fully anonymous storefronts)  
**When it fires:** `agentId` is null, empty, or the sentinel string `"unknown_agent"`

```jsonc
// merchantPolicies
{ "r001": { "requireAgentId": false } } // opt-out (open storefront)
```

---

### R002 · `signature-spoof-block`

**Function:** Blocks when the agent token's cryptographic signature is invalid, or when a token is present but the identity cannot be verified. Catches replay and spoofing attacks.

**Default action:** BLOCK  
**Configurable:** `requireValidSignature` (default `true`)  
**Depends on:** `_agent_token_signature_invalid` cart attribute set by the plugin verifier

```jsonc
{ "r002": { "requireValidSignature": false } } // opt-out (testing only)
```

---

### R003 · `mandate-boundary-match`

**Function:** Enforces the operator mandate's spending cap and allowed product-category list. Blocks when cart total exceeds `maxAmountCents` or when a line-item category falls outside `allowedCategories`.

**Default action:** BLOCK  
**Configurable:** `maxAmountCents`, `allowedCategories`  
**Depends on:** `_product_categories` cart attribute (comma-separated list set by plugin)

```jsonc
{
  "r003": {
    "maxAmountCents": 50000,
    "allowedCategories": ["electronics", "books"],
  },
}
```

---

### R004 · `new-key-friction`

**Function:** Adds friction when an agent uses a key that was issued fewer than `maxKeyAgeHours` hours ago. Prevents freshly-minted keys from bypassing warming signals.

**Default action:** BLOCK  
**Configurable:** `maxKeyAgeHours` (default 24 h)  
**Depends on:** `_agent_key_age_hours` cart attribute

```jsonc
{ "r004": { "maxKeyAgeHours": 48 } }
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
**Configurable:** `minCompletedOrders` — **default `0`, i.e. the rule is a no-op until the merchant sets it**. (It was `1` historically; the default was changed to `0` so an unconfigured R010 cannot block. Enabling R010 in ENFORCE without explicit params is rejected by `checkEnforceableParams`.)  
**Depends on:** `completedOrderCount` historical lookup or `_completed_orders` cart attribute

```jsonc
{ "r010": { "minCompletedOrders": 3 } }
```

---

### R011 · `repeat-failed-checkout`

**Function:** Blocks agents that have exceeded `maxAttempts` failed checkout attempts within `windowSeconds`. Protects against brute-force checkout probing.

**Default action:** BLOCK  
**Configurable:** `windowSeconds` (default 300 s), `maxAttempts` (default 3)  
**Depends on:** `failedCheckoutCount` or `velocityCount` historical lookup

```jsonc
{ "r011": { "windowSeconds": 120, "maxAttempts": 5 } }
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
{
  "r014": {
    "highRiskCountries": ["KP", "IR"],
    "maxCancellations": 2,
    "windowDays": 30,
  },
}
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

### R017 · `discount-anomaly-applied`

> **Renamed.** The old name `coupon-discount-anomaly` was retired because it described a
> capability the rule does not have. The canonical code is
> `R017.discount-anomaly-applied`; `R017.coupon-discount-anomaly` still resolves forward
> via the alias table so existing rows and plugin snapshots keep working.

**Function:** Caps anomalous discounts **already applied to the cart** — the number of
discount codes present on it (`maxAttempts`) and the total discount depth
(`maxDiscountBps`). It does **not** detect coupon scraping or brute-force code probing
from the cart alone: a code that was tried and rejected never reaches `discountCodes`.

Failed attempts are only counted when the server-side `couponAttemptFailedCount` lookup is
wired (dedicated `coupon_attempt_failed_events` table, `windowSeconds` default 3600). That
lookup takes precedence when it returns a positive count, because an agent can under-report
the `_discount_codes_tried` cart attribute to evade the cap. In offline / plugin-side
evaluation the lookup is unavailable, so only applied discounts are seen.

**Default action:** BLOCK  
**Configurable:** `maxAttempts` (default 5), `maxDiscountBps` (default 5000 = 50%), `windowSeconds` (default 3600, dedicated lookup only)  
**Depends on:** `couponAttemptFailedCount` historical lookup (preferred), else `orderContext.discountCodes` length, else `_discount_codes_tried`; plus `_discount_bps`  
**No signal:** when none of the above is present the rule returns NO_SIGNAL rather than PASS — it does not assume the cart is clean

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
{
  "r018": {
    "merchantAvgOrderCents": 4000,
    "spikeMultiplier": 4.0,
    "maxItemCount": 20,
    "maxSingleSkuQty": 5,
  },
}
```

---

## R019–R028 — Medium-Priority Controls

### R019 · `country-jurisdiction`

**Function:** Restricts orders to an allowlist of countries or blocks orders from a blocklist. Handles geographic compliance requirements.

**Default action:** BLOCK  
**Configurable:** `allowedCountries`, `blockedCountries` (ISO 3166-1 alpha-2 codes)

```jsonc
{ "r019": { "allowedCountries": ["ES", "FR", "DE", "IT", "PT"] } }
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
{ "r027": { "maxStoredValueCents": 20000 } } // allow up to $200
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
{ "r030": { "maxAmountCents": 100000, "allowedCountries": ["ES", "MX", "US"] } }
```

---

## R031–R048, R062 — Starter-Kit Controls

The starter kit is the set a merchant can turn on without any identity infrastructure:
a kill-switch, blunt caps, provider lists, and two approval flows. Everything below was
derived from the evaluator in `packages/shared/src/enforcement/rule-catalog.ts` — "when it
fires" mirrors the branch that actually returns HIT, and "configurable" lists only values
the evaluator really falls back to.

**Most of these caps have no default.** `R035`, `R036`, `R038`, `R039`, `R041`, `R042` and
`R062` stay completely inert until the merchant sets the number. Enabling one of them and
expecting a built-in threshold is the most common mistake with this group. `R048` is the
exception: it ships with a populated blocklist.

**Shopify availability.** Shopify Functions run with no network or database access, so
every rule here that needs a historical count, a registry lookup, or a frozen cart is
unavailable in the Shopify Function and enforced only through the server-side API
(`POST /api/v1/rules/evaluate`). That applies to `R041`, `R042`, `R043`, `R044`, `R045`,
`R046`, `R047` and `R062`. WooCommerce, PrestaShop and Magento support all of them.

---

### R031 · `agent-commerce-disabled`

**Function:** Merchant kill-switch. Blocks every agent purchase while enabled; organic human checkout is unaffected.

**Default action:** BLOCK **(Tier 1)**  
**Configurable:** nothing — enabling the rule _is_ the configuration  
**When it fires:** an agent is present, on any agentic checkout  
**Precedence:** `shop-switch`. When R031 matches, it is the code reported to the agent and to the metric even if other rules also match — they are describing symptoms, R031 is the reason.

---

### R032 · `category-blocklist`

**Function:** Blocks agent purchases of products in merchant-listed categories (the usual legal restrictions: alcohol, tobacco, weapons, adult).

**Default action:** BLOCK  
**Configurable:** `blockedCategoryIds` (default `[]` — rule inert)  
**When it fires:** any cart category is in the list, matched raw first and then retried against the platform-normalised taxonomy  
**No signal:** a cart that declares no categories PASSES. Absence is never treated as a match.

```jsonc
{ "r032": { "blockedCategoryIds": ["alcohol", "tobacco"] } }
```

---

### R034 · `sku-blocklist`

**Function:** Per-SKU escape hatch for when catalogue categorisation is incomplete.

**Default action:** BLOCK  
**Configurable:** `blockedSkus` (default `[]` — rule inert)  
**When it fires:** any line-item id is in `blockedSkus`

```jsonc
{ "r034": { "blockedSkus": ["SKU-9", "SKU-14"] } }
```

---

### R035 · `max-order-value`

**Function:** Caps the total agent order amount. A merchant-side financial guard, independent of any spending cap the agent's own mandate carries.

**Default action:** BLOCK  
**Configurable:** `maxCents` — **no default; unset means the rule never fires**  
**When it fires:** `cartTotalCents > maxCents`

```jsonc
{ "r035": { "maxCents": 50000 } } // EUR 500
```

---

### R036 · `max-line-item-value`

**Function:** Caps the per-line subtotal, so one expensive item cannot hide inside a small-looking cart.

**Default action:** BLOCK  
**Configurable:** `maxCentsPerLine` — **no default**. Note the field name: it is _not_ `maxCents` (that belongs to R035). Setting `maxCents` here leaves the rule inert.  
**When it fires:** for any line, `qty * priceCents > maxCentsPerLine`

```jsonc
{ "r036": { "maxCentsPerLine": 20000 } }
```

---

### R038 · `max-items-per-order`

**Function:** Caps the total piece count per order. Anti-hoarding control. Overlaps R018 deliberately, with plain-language naming.

**Default action:** BLOCK  
**Configurable:** `maxQuantity` — **no default**  
**When it fires:** `itemCount` (sum of units, not of lines) `> maxQuantity`

```jsonc
{ "r038": { "maxQuantity": 10 } }
```

---

### R039 · `max-quantity-per-sku`

**Function:** Caps quantity per individual SKU. Anti-scalping and resale prevention.

**Default action:** BLOCK  
**Configurable:** `maxPerSku` — **no default**  
**When it fires:** any line `qty > maxPerSku`

```jsonc
{ "r039": { "maxPerSku": 2 } }
```

---

### R041 · `max-orders-per-hour-merchant`

**Function:** Caps **successful** orders at the merchant in a rolling 1 h window across **all** agents. Anti-burst protection at merchant scope; the complement of R042, which is per-agent.

**Default action:** BLOCK  
**Configurable:** `maxPerHour` — **no default**. The window is fixed at 1 h and is not configurable.  
**When it fires:** merchant-wide successful orders in the last 3600 s `> maxPerHour`  
**Signal:** `merchantOrderCountInWindow` lookup, else the `_merchant_orders_1h` cart attribute. With neither, the count is `0` and the rule degrades to PASS rather than blocking blind.  
**Needs server lookup:** yes · **Shopify Function:** not available (merchant-wide historical count)

```jsonc
{ "r041": { "maxPerHour": 20 } }
```

---

### R042 · `max-orders-per-agent-day`

**Function:** Caps successful orders per `agentId` per 24 h window. Complements R011, which counts _failures_ rather than successes.

**Default action:** BLOCK  
**Configurable:** `maxPerAgent` — **no default**. The window is fixed at 24 h.  
**When it fires:** completed orders by this agent in the last 86 400 s `> maxPerAgent`. With no agent present the rule PASSES — it is agent-scoped.  
**Signal:** `completedOrderCountInWindow` lookup, else the `_completed_orders_24h` cart attribute. With neither, the count is `0` and the rule degrades to PASS.  
**Needs server lookup:** yes · **Shopify Function:** not available (historical order count)

```jsonc
{ "r042": { "maxPerAgent": 5 } }
```

---

### R043 · `agent-checkout-approval-required`

**Function:** Routes every agent order through manual merchant approval (HITL, "copilot" instead of "autopilot" mode). The cart is **frozen, not cancelled**, and resumes when the merchant decides.

**Default action:** REVIEW (HITL)  
**Configurable:** `ttlMinutes` for the approval window (service-side default 60) and `minCents`, an amount band. **With `minCents` absent the rule fires on every agentic checkout** — which is how it is configured in production today.  
**When it fires:** an agent is present (and, if set, the cart reaches `minCents`)  
**Shopify Function:** not available (needs cart freeze + dashboard workflow)

```jsonc
{ "r043": { "ttlMinutes": 120, "minCents": 25000 } }
```

---

### R044 · `first-n-approval`

**Function:** Routes an agent's first N completed orders at this merchant through approval, then stops. Self-disarming: once the agent has history the rule lapses and never blocks again.

**Default action:** REVIEW (HITL)  
**Configurable:** `firstN` (default `1`). `firstN <= 0` disables the rule outright.  
**When it fires:** the agent's **lifetime** completed orders at this merchant `< firstN`  
**Needs server lookup:** yes · **Shopify Function:** not available (historical count + cart freeze)

```jsonc
{ "r044": { "firstN": 3 } }
```

---

### R045 · `provider-allowlist`

**Function:** Admits only buying agents from merchant-listed providers (OpenAI, Anthropic, …).

**Default action:** BLOCK  
**Configurable:** `allowedProviderIds` (default `[]` — rule inert)  
**When it fires:** the list is non-empty **and** (the provider cannot be resolved **or** it is not in the list)  
**Fail mode:** **fail-closed** — an agent whose provider is unresolvable is BLOCKED  
**Shopify Function:** not available (registry lookup)

```jsonc
{ "r045": { "allowedProviderIds": ["openai", "anthropic"] } }
```

---

### R046 · `provider-blocklist`

**Function:** Blocks buying agents from specific providers. Same shape as R045, opposite failure mode — read both before choosing.

**Default action:** BLOCK  
**Configurable:** `blockedProviderIds` (default `[]` — rule inert)  
**When it fires:** the list is non-empty **and** the resolved provider is in it  
**Fail mode:** **fail-open** — an agent whose provider is unresolvable PASSES  
**Shopify Function:** not available (registry lookup)

```jsonc
{ "r046": { "blockedProviderIds": ["acme-bot"] } }
```

---

### R047 · `customer-confirmation`

**Function:** Requires the **buyer** to confirm an agent-initiated order out of band (email or SMS link) before payment is captured. Distinct from R043, which asks the **merchant**.

**Default action:** REVIEW (out-of-band confirmation)  
**Configurable:** `channels` (`email` / `sms`), `ttlMinutes`, and `minCents` (amount band — absent means every agentic checkout)  
**When it fires:** an agent is present **and** the cart carries a customer email or phone. With neither, the rule PASSES — there is no channel to confirm through.  
**Shopify Function:** not available (cart freeze + notification dispatch)

```jsonc
{ "r047": { "channels": ["email"], "ttlMinutes": 30 } }
```

---

### R048 · `no-digital-goods-for-agents`

**Function:** Blocks gift cards, license keys, downloadables and stored-value products for agent purchases — the classic instant-resale vector. Reuses R027's signal helpers and widens the scope.

**Default action:** BLOCK  
**Configurable:** `blockedTypes` — **this one has a default**: `["gift_card", "license_key", "downloadable", "stored_value"]`. Passing an explicitly empty array disables the rule.  
**When it fires:** the cart declares a digital-good type present in `blockedTypes`. A cart declaring no type PASSES.

```jsonc
{ "r048": { "blockedTypes": ["gift_card", "license_key"] } }
```

---

### R062 · `max-spend-per-agent-window`

**Function:** Caps **cumulative** agent spend at this merchant within a rolling window. Neither R035 (one order) nor R042 (order count) stops an agent from draining a budget through many small purchases; this does. The in-flight cart counts toward the total.

**Default action:** BLOCK  
**Configurable:** `maxSpendCents` (**no default** — unset means inert) and `windowSeconds` (default 86 400 = 24 h)  
**When it fires:** spend already completed in the window **plus** the current cart total `> maxSpendCents`. The boundary is strict: spending exactly the budget is allowed.  
**Signal:** with no spend signal available, prior spend counts as `0` and the rule compares only the current cart.  
**Needs server lookup:** yes · **Shopify Function:** not available (historical amount aggregate)

```jsonc
{ "r062": { "maxSpendCents": 100000, "windowSeconds": 604800 } } // EUR 1000 / 7 days
```

---

## Using Rules via the API

⚠️ **The `rNNN` blocks shown throughout this document are merchant _configuration_, not
request fields.** There is no `merchantPolicies` field in the evaluate request schema —
sending one has no effect. The merchant configures thresholds in the Trusteed dashboard,
and the server resolves that merchant's active rule set from the authenticated
installation, then evaluates it against the `orderContext` you send.

Authentication is a per-installation HMAC over the raw request bytes, not a simple API key.
The full request contract — required headers, required fields, `platform` enum, response
codes — lives in the [README](../README.md#evaluating-rules-via-the-api); this document
does not duplicate it, so there is only one place to keep correct.

```bash
POST https://api.trusteed.xyz/v1/rules/evaluate
Content-Type: application/json
X-Trusteed-Installation-Id: <installation uuid>
X-Trusteed-Signature: t=<unix-seconds>,s=<hex-hmac-sha256>

{
  "merchantId": "acme-store",
  "platform": "TRUSTEED_MCP",
  "installationId": "<installation uuid>",
  "timestamp": "2026-08-17T10:15:30Z",
  "agentId": "did:web:agent.openai.com",
  "orderContext": {
    "cartTotalCents": 8500,
    "currency": "EUR",
    "itemCount": 2,
    "billingCountry": "ES",
    "paymentMethod": "stripe_card",
    "agentTrustScore": 42,
    "lineItems": [{ "id": "p1", "qty": 2, "priceCents": 4250 }]
  }
}
```

### Offline enforcement (plugin-side)

```bash
GET https://api.trusteed.xyz/v1/rules/snapshot/:merchantId
# Same HMAC headers; `:merchantId` must match your installation.
# Returns a JWS-signed RuleSnapshot. Honour the payload's own `validUntil`:
# 300s normally, but 60s while a Tier-1 rule or the merchant kill-switch is active.
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

| Attribute                        | Type    | Set by               | Used by                       |
| -------------------------------- | ------- | -------------------- | ----------------------------- |
| `_agent_token_signature_invalid` | boolean | Plugin verifier      | R002                          |
| `_agent_token_present`           | boolean | Plugin verifier      | R002                          |
| `_agent_revoked`                 | boolean | Plugin verifier      | R005                          |
| `_agent_status`                  | string  | Plugin verifier      | R005                          |
| `_agent_key_age_hours`           | number  | Plugin verifier      | R004                          |
| `_provider_confidence`           | number  | Plugin enrichment    | R006                          |
| `_cross_merchant_abuse`          | boolean | Server lookup        | R007                          |
| `_requested_scopes`              | CSV     | Agent token claims   | R008                          |
| `_product_categories`            | CSV     | Plugin enrichment    | R003, R012                    |
| `_return_policy_mismatch`        | boolean | Plugin enrichment    | R013                          |
| `_price_delta_bps`               | number  | Plugin (cart-load)   | R015                          |
| `_lowest_stock`                  | number  | Plugin enrichment    | R016                          |
| `_discount_codes_tried`          | number  | Shopify/WC attribute | R017                          |
| `_discount_bps`                  | number  | Plugin enrichment    | R017                          |
| `_failed_checkout_count`         | number  | Server lookup        | R011                          |
| `_completed_orders`              | number  | Server lookup        | R010, R021                    |
| `_merchant_local_hour`           | number  | Plugin (optional)    | R020                          |
| `_shipping_po_box`               | boolean | Address validation   | R025                          |
| `_shipping_freight_forwarder`    | boolean | Address validation   | R025                          |
| `_subscription`                  | boolean | Plugin enrichment    | R026                          |
| `_autorenew`                     | boolean | Plugin enrichment    | R026                          |
| `_autorenew_consent`             | boolean | Buyer-side consent   | R026                          |
| `_stored_value_cents`            | number  | Plugin enrichment    | R027                          |
| `_b2b_order`                     | boolean | Plugin enrichment    | R028                          |
| `_purchase_order_hash`           | string  | Plugin enrichment    | R028                          |
| `_regulated_evidence_present`    | boolean | Plugin verifier      | R029 (`regulado` preset)      |
| `_product_platform`              | string  | Plugin enrichment    | R032 (taxonomy normalisation) |
| `_agent_provider_id`             | string  | Agent-declared       | R045, R046                    |
| `_customer_email`                | string  | Platform projection  | R047                          |
| `_customer_phone`                | string  | Platform projection  | R047                          |
| `_digital_good_types`            | CSV     | Plugin enrichment    | R048                          |
| `_merchant_orders_1h`            | number  | Server projection    | R041 (lookup fallback)        |
| `_completed_orders_24h`          | number  | Server projection    | R042 (lookup fallback)        |

---

## Tier Matrix

The tier column below follows the single source of truth,
`packages/shared/src/enforcement/merchant-rule-definitions.ts`, from which
`TIER_1_RULE_CODES` is derived. **Exactly three rules are Tier 1: `R001`, `R007` and
`R031`** (plus the two pre-canonical short codes `R001` / `R007`, kept for live production
rows). `src/content/agent-rules.ts` and `get_agent_rules(filter="tier1")` were reconciled
to this SSOT on 2026-08-17 (previously wrongly declared `R002`/`R003`/`R005`/`R008`/`R009`
as Tier 1 and omitted `R007`) — the tool's output now matches this table.

| Rule | Tier 1 (kill-switch) | Tier 2 (standard) | Needs server lookup |
| ---- | :------------------: | :---------------: | :-----------------: |
| R001 |          ✅          |                   |                     |
| R002 |                      |        ✅         |                     |
| R003 |                      |        ✅         |                     |
| R004 |                      |        ✅         |                     |
| R005 |                      |        ✅         |         ✅          |
| R006 |                      |        ✅         |                     |
| R007 |          ✅          |                   |         ✅          |
| R008 |                      |        ✅         |                     |
| R009 |                      |        ✅         |                     |
| R010 |                      |        ✅         |         ✅          |
| R011 |                      |        ✅         |         ✅          |
| R012 |                      |        ✅         |                     |
| R013 |                      |        ✅         |                     |
| R014 |                      |        ✅         |         ✅          |
| R015 |                      |        ✅         |                     |
| R016 |                      |        ✅         |                     |
| R017 |                      |        ✅         |                     |
| R018 |                      |        ✅         |                     |
| R019 |                      |        ✅         |                     |
| R020 |                      |        ✅         |                     |
| R021 |                      |        ✅         |         ✅          |
| R022 |                      |        ✅         |                     |
| R023 |                      |        ✅         |         ✅          |
| R024 |                      |        ✅         |         ✅          |
| R025 |                      |        ✅         |                     |
| R026 |                      |        ✅         |                     |
| R027 |                      |        ✅         |                     |
| R028 |                      |        ✅         |                     |
| R029 |                      |        ✅         |                     |
| R030 |                      |        ✅         |                     |
| R031 |          ✅          |                   |                     |
| R032 |                      |        ✅         |                     |
| R034 |                      |        ✅         |                     |
| R035 |                      |        ✅         |                     |
| R036 |                      |        ✅         |                     |
| R038 |                      |        ✅         |                     |
| R039 |                      |        ✅         |                     |
| R041 |                      |        ✅         |         ✅          |
| R042 |                      |        ✅         |         ✅          |
| R043 |                      |        ✅         |                     |
| R044 |                      |        ✅         |         ✅          |
| R045 |                      |        ✅         |          °          |
| R046 |                      |        ✅         |          °          |
| R047 |                      |        ✅         |                     |
| R048 |                      |        ✅         |                     |
| R062 |                      |        ✅         |         ✅          |

**Tier 1** rules use a fast-path kill-switch with fail-closed semantics. **Tier 2** rules use standard fail-open semantics (alert on >5% block rate / hour). Rules marked "Needs server lookup" require a database or Redis call at evaluation time.

**°** — `R045` / `R046` resolve the agent's provider from the `_agent_provider_id` cart
attribute first and only fall back to the provider-registry lookup when that attribute is
absent. They therefore work offline _if_ the plugin projects the attribute, but their
Shopify-Function support is still marked unavailable in the SSOT because the fallback
cannot run there.

Every rule in the R031+ block that needs a lookup, a registry, or a frozen cart is
**unavailable in the Shopify Function** and enforced only via the server-side API:
`R041`, `R042`, `R043`, `R044`, `R045`, `R046`, `R047`, `R062`. Per-rule reasons live in
`platformSupport` in `packages/shared/src/enforcement/merchant-rule-definitions.ts`.

---

_Source of truth for rule identity, tier and platform support:_
`packages/shared/src/enforcement/merchant-rule-definitions.ts`.  
_Source of truth for evaluator logic and parameter defaults:_
`packages/shared/src/enforcement/rule-catalog.ts`
(`apps/api/src/services/enforcement/rule-catalog.ts` is only a re-export barrel).  
_Machine-readable output: `get_agent_rules` MCP tool._  
_Runtime evaluation: `POST /api/v1/rules/evaluate`._
