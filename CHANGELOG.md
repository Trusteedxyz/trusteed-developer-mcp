# Changelog — `@trusteed/developer-mcp`

All notable changes to the public developer MCP server are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [SemVer](https://semver.org/).

> This package is a **documentation/integration assistant**, not a runtime
> authorisation surface. Tool additions are additive by design — they never
> execute commerce actions, never modify tenant state, and never validate
> production artifacts. Treat every entry below as documentation surface
> changes, not behaviour changes in the platform.

## Unreleased — Extension Marketplace docs surface

Adds three read-only tools that explain the Trusteed Extension Marketplace
contracts (manifest schema, webhook envelope + per-event payloads, scope
catalog) directly inside an IDE. Tool count goes **7 → 10**. The new tools
are documentation snapshots with canonical-URL pointers — they are not
runtime validators. Proposed SemVer bump on release: **0.2.0** (additive,
non-breaking).

### Added — tools

- **`get_extension_manifest_schema`** (`src/tools/get-extension-manifest-schema.ts`)
  - Returns the Trusteed extension manifest schema (v1.0) with the 16 required
    fields, a per-field guide (type, constraint, developer-oriented notes),
    and the signing envelope description (JWS Compact Ed25519, RFC 8785
    canonicalization, developer signature + Trusteed countersignature on
    approved versions).
  - Snapshot includes `canonical_url` + `last_updated` so callers can confirm
    freshness. Always recommends fetching the canonical schema or using the
    `@trusteed/sdk-extension` linter for runtime validation.
  - No parameters.

- **`get_webhook_event_schema`** (`src/tools/get-webhook-event-schema.ts`)
  - Returns the webhook envelope structure (`envelope_version`, `event_id`,
    `event_type`, `occurred_at`, `delivered_at`, `delivery_attempt`,
    `install_id`, `merchant_pseudonym`, `payload`), the HMAC-SHA256 canonical
    base string `v1.{ts}.{nonce}.{METHOD}.{path}.{sha256_hex(body)}`, the
    retry schedule `[5s, 30s, 5min, 1h, 6h]` → DLQ at attempt 6, the
    circuit-breaker semantics, the kill-switch propagation chain
    (global → extension → version → install → endpoint, ≤10s via Redis
    pub/sub), and per-event payload summaries for the 8 V1 event types.
  - Includes step-by-step verification pseudocode (timestamp freshness window,
    nonce de-duplication ≥24h, constant-time comparison).
  - Optional parameter: `event_type` (string) — narrows the response to a
    single event-type detail. Available: `agent.first_seen`,
    `agent.identified`, `checkout.created`, `checkout.completed`,
    `checkout.cancelled`, `checkout.blocked`, `refund.issued`,
    `rule.triggered`.

- **`get_extension_scopes`** (`src/tools/get-extension-scopes.ts`)
  - Returns the 12 `scopes_requested` enum values with structured metadata
    per scope: purpose, `data_classification` (public / operational /
    sensitive / pii), `pii` boolean, the minimum `risk_category` the scope
    raises the manifest to, an example use case, and an explicit "not for"
    anti-use case.
  - Anchors a minimum-viable-scope principle: only `customers:read:pii`
    triggers manual review and `risk_category: high`; all others stay at
    `low` or `medium`.
  - Optional parameter: `scope` (string) — narrows the response to a single
    scope descriptor.

### Added — tests

- `src/tools/__tests__/get-extension-manifest-schema.test.ts` — 7 tests
  (registration, required-field count, signing envelope claims, markdown
  output, developer-time-guidance disclaimer).
- `src/tools/__tests__/get-webhook-event-schema.test.ts` — 9 tests (envelope
  field set, signature canonical base string, retry/DLQ values, per-event
  detail, unknown event handling, markdown content invariants).
- `src/tools/__tests__/get-extension-scopes.test.ts` — 8 tests (12-scope
  enumeration, PII isolation to `customers:read:pii`, every scope has
  populated metadata, single-scope lookup, unknown-scope error, minimum
  principle text, markdown content).

Full test suite: **39/39 green** (24 new + 15 existing). `pnpm typecheck`
clean.

### Changed — docs

- `README.md` tagline now explicitly positions the server as an
  **integration assistant** for "any Trusteed adoption path: direct API,
  merchant plugins, agent-policy.json, **and** developer marketplace" —
  decoupling identity from the marketplace release cadence.
- `README.md` adds **"When NOT to use this MCP"** section near the top
  (5 bullets: no production auth, no secrets, no PCI/PII, no compliance
  attestation, no high-volume access). Points readers to the
  per-merchant MCP / plugins for transactional needs.
- Architecture diagram updated: `🔧 Tools (7)` → `🔧 Tools (10)`.
- New entries in the Tools section with parameter tables for the three
  additions. Each entry repeats the "documentation only, not runtime
  validation" disclaimer.

### Hard rules carried forward

These remain non-negotiable for the package and are restated in each new
tool's description so an LLM consuming this MCP cannot rationalise around
them:

- No code generation. Manifest / extension scaffolding belongs to
  `@trusteed/sdk-extension` templates — single source of truth for emission.
- No runtime validation. Production validation lives in the SDK linter, the
  marketplace conformance suite, and the server-side review pipeline.
- No tenant state. Review queue, install state, billing state, audit chain
  contents are all inaccessible from this MCP by design.
- No marketplace gate. A successful response from any tool here is
  documentation, not approval.

### Related

- Sibling package: `trust-receipt-verifier` — the
  evidence-verification counterpart. See its CHANGELOG `Unreleased` entry
  for the matching CLI surface (`trust-receipt verify --type
erasure|manifest|jwks-history`).

## 0.1.0 — 2026-04-29 — Initial public release

Initial publication of the developer MCP server. 7 read-only tools
(`search_docs`, `get_openapi_schema`, `get_integration_guide`,
`get_trust_framework`, `get_protocol_info`, `get_agent_rules`,
`create_sandbox_key`), 3 resources (`docs://llms.txt`,
`policy://agent-policy`, `spec://openapi`), and 2 prompts
(`integration_helper`, `troubleshoot`). stdio + Streamable HTTP
transports. No authentication required for documentation tools;
`create_sandbox_key` rate-limited to 3 keys / IP / 24h.
