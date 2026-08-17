[English](README.md) | [**Español**](README.es.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

# @trusteed/developer-mcp

**Asistente de integración para las APIs de políticas de agentes del lado del comercio, trust scoring y checkout enforcement de [Trusteed](https://www.trusteed.xyz).**

Este es un servidor MCP público, de solo lectura, para **desarrollo y capacitación de desarrolladores**: responde preguntas, devuelve las reglas de agente del comercio (R001–R062), muestra los fragmentos de OpenAPI, genera código de integración para los frameworks más comunes y emite claves de sandbox de corta duración. Está pensado para convivir con tu IDE mientras construyes tu integración con Trusteed.

**No** es un runtime de checkout. El enforcement en producción ocurre a través de la API de Trusteed, los plugins de comercio (Shopify, WooCommerce, PrestaShop, Odoo, Magento, Wix) y el RuleSnapshot firmado que esos plugins obtienen offline. Las decisiones que un LLM produce a partir de las respuestas de este MCP son guía documental, no autorización.

Funciona con Claude Desktop, Cursor, VS Code y cualquier host compatible con MCP. No se requiere autenticación para las herramientas de documentación; `create_sandbox_key` tiene límite de tasa por IP.

---

## Cuándo NO usar este MCP

Este servidor es intencionalmente acotado. No lo uses para:

- **Decisiones de autorización en producción.** La salida de `get_agent_rules` describe cómo _funcionan_ R001–R062; no las _ejecuta_. Llama a `POST https://api.trusteed.xyz/v1/rules/evaluate` (o recupera el RuleSnapshot firmado para enforcement offline) para cualquier decisión real de permitir/bloquear.
- **Almacenar o rotar secretos.** Nunca pegues claves de API de larga duración, credenciales de comercio ni tokens de producción en prompts que lleguen a este MCP. Las claves de sandbox devueltas por `create_sandbox_key` están diseñadas para ser desechables (TTL de 24 h); los límites de tasa se aplican en el servidor.
- **Manejar datos PCI, PII o de pago.** Las herramientas devuelven únicamente documentación, esquemas y metadatos de configuración. Ningún PAN, PII o contenido de pedido pasa por este servidor.
- **Certificación de cumplimiento.** Las explicaciones generadas por un LLM sobre el framework de confianza o la semántica de las reglas no son legalmente vinculantes. Usa las fuentes canónicas (la [página de metodología de confianza](https://www.trusteed.xyz/en/trust/methodology), el [agent-policy.json](https://www.trusteed.xyz/.well-known/agent-policy.json), la especificación OpenAPI) para cualquier revisión de cumplimiento, auditoría o legal.
- **Acceso programático de alto volumen.** El modo HTTP tiene límite de tasa (100 req / 15 min / IP). Para ingesta masiva de documentación, replica las fuentes de OpenAPI y Markdown directamente desde el sitio público o el repositorio.

Si necesitas un servidor que _ejecute_ acciones de comercio en nombre de un agente (carritos, checkouts, pagos), eso es un asunto distinto: Trusteed expone eso mediante el servidor MCP por comercio documentado en `trusteed.xyz/:storeSlug/mcp` y mediante los plugins de comercio. Este paquete no crecerá para convertirse en eso.

---

## Inicio rápido

> ⚠️ **Aún no publicado en npm — usa [Compilar desde el código fuente](#compilar-desde-el-código-fuente).**
> `@trusteed/developer-mcp` todavía no está en el registro público, así que todas las
> recetas con `npx` / `npm install` de esta sección fallan hoy con `E404`. Compila desde el
> código fuente en su lugar. Las recetas con `npx` se conservan tal cual para que funcionen
> sin cambios en cuanto se publique la primera versión; no se anuncia fecha de publicación.

### Compilar desde el código fuente

Funciona hoy, sin depender del registro:

```bash
git clone https://github.com/Trusteedxyz/trusteed-developer-mcp
cd trusteed-developer-mcp
npm install
npm run build          # tsc → dist/
```

Después ejecútalo directamente:

```bash
node dist/index.js                        # stdio (por defecto)
node dist/index.js --http --port=3100     # modo HTTP
```

Para tener el comando `trusteed-dev-mcp` en tu `PATH` (la entrada `bin` declarada en
`package.json`), ejecuta `npm link` en la raíz del repositorio después de compilar.

En los hosts MCP, apunta `command`/`args` al punto de entrada compilado con una ruta
absoluta:

```json
{
  "mcpServers": {
    "trusteed": {
      "command": "node",
      "args": ["/ruta/absoluta/a/trusteed-developer-mcp/dist/index.js"]
    }
  }
}
```

### npx (ejecución puntual)

⚠️ Aún no publicado en npm — ver [Compilar desde el código fuente](#compilar-desde-el-código-fuente).

```bash
npx @trusteed/developer-mcp
```

### Claude Desktop

⚠️ Aún no publicado en npm — ver [Compilar desde el código fuente](#compilar-desde-el-código-fuente).

Añade a `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "trusteed": {
      "command": "npx",
      "args": ["-y", "@trusteed/developer-mcp"]
    }
  }
}
```

### Cursor / VS Code

⚠️ Aún no publicado en npm — ver [Compilar desde el código fuente](#compilar-desde-el-código-fuente).

Añade a `.cursor/mcp.json` o `.vscode/mcp.json`:

```json
{
  "servers": {
    "trusteed": {
      "command": "npx",
      "args": ["-y", "@trusteed/developer-mcp"]
    }
  }
}
```

### Modo HTTP (remoto / multi-cliente)

⚠️ Aún no publicado en npm — hasta entonces usa `node dist/index.js --http --port=3100`
después de [compilar desde el código fuente](#compilar-desde-el-código-fuente).

```bash
npx @trusteed/developer-mcp --http --port=3100
# POST http://localhost:3100/mcp
# Límite de tasa: 100 req / 15 min por IP
```

---

## Visión general de la arquitectura

```mermaid
flowchart LR
    subgraph IDE["IDE / AI Host"]
        CD["Claude Desktop\nCursor · VS Code"]
    end

    subgraph MCP["@trusteed/developer-mcp"]
        direction TB
        T1["🔧 Tools (10)"]
        R1["📄 Resources (3)"]
        P1["💬 Prompts (2)"]
    end

    subgraph API["Trusteed Platform"]
        direction TB
        AG["Agent API\n/api/v1/agent/*"]
        RP["Rules Engine\nR001–R062"]
        TS["Trust Score\n12 components"]
    end

    CD -- "stdio / Streamable HTTP" --> MCP
    T1 -- "docs · rules · sandbox" --> AG
    T1 -- "get_agent_rules" --> RP
    T1 -- "get_trust_framework" --> TS
```

---

## Herramientas (Tools)

### `search_docs`

Busca en la documentación de Trusteed por palabra clave. Devuelve resultados ordenados por relevancia del framework de confianza, la referencia de la API, las especificaciones de protocolo, las guías de integración y el glosario.

| Parámetro | Tipo         | Requerido | Descripción                                                                    |
| --------- | ------------ | --------- | ------------------------------------------------------------------------------ |
| `query`   | string       | ✅        | Términos de búsqueda (p. ej. `"trust score"`, `"x402 protocol"`)               |
| `section` | enum         | —         | Filtro: `api` · `trust` · `protocols` · `integration` · `glossary` · `general` |
| `limit`   | integer 1–20 | —         | Máximo de resultados (por defecto: 5)                                          |

---

### `get_agent_rules`

Devuelve las 46 reglas de agente del comercio (R001–R062) con niveles (tiers), umbrales configurables, condiciones de disparo y ejemplos. La referencia principal para implementar el modelo de enforcement de Trusteed. Estas reglas no requieren eIDAS, QTSP, Visa Verifier ni evidencia específica de red de pago, salvo que un comercio configure explícitamente dicha evidencia en otro lugar.

| Parámetro | Tipo   | Requerido | Descripción                                                                   |
| --------- | ------ | --------- | ----------------------------------------------------------------------------- |
| `filter`  | enum   | —         | `all` · `tier1` · `tier2` · `needs_lookup` · `no_lookup` (por defecto: `all`) |
| `code`    | string | —         | Una sola regla por código, p. ej. `R007`. Tiene prioridad sobre `filter`.     |

---

### `get_trust_framework`

Devuelve la metodología completa de trust scoring del comercio: 12 componentes ponderados, la fórmula de ranking publicada, los estados de visibilidad del comercio y los niveles de verificación.

Sin parámetros.

---

### `get_protocol_info`

Detalles sobre los tres protocolos de pago agéntico soportados: ACP (Stripe/OpenAI), AP2 (Google), x402 (stablecoin USDC). Incluye el flujo de pago, las medidas de seguridad y los identificadores de adaptador.

| Parámetro  | Tipo   | Requerido | Descripción                                                                   |
| ---------- | ------ | --------- | ----------------------------------------------------------------------------- |
| `protocol` | string | —         | `ACP` · `AP2` · `x402`. Omítelo para una comparación lado a lado de los tres. |

---

### `get_openapi_schema`

Devuelve el fragmento OpenAPI 3.0 para un endpoint específico de la Agent API.

| Parámetro  | Tipo   | Requerido | Descripción                                                                                       |
| ---------- | ------ | --------- | ------------------------------------------------------------------------------------------------- |
| `resource` | string | ✅        | `search` · `products` · `compare` · `availability` · `cart` · `checkout` · `orders` · `merchants` |

---

### `get_integration_guide`

Guía de integración paso a paso con código funcional para un framework específico.

| Parámetro   | Tipo   | Requerido | Descripción                                                                                                             |
| ----------- | ------ | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `framework` | string | ✅        | `curl` · `typescript` · `python` · `langchain` · `vercel-ai` · `openai-agents` · `claude-desktop` · `cursor` · `vscode` |

---

### `create_sandbox_key`

Genera una clave de API temporal de 24 horas para pruebas sin necesidad de registro. Los límites de tasa se aplican en el servidor.

Sin parámetros.

---

### `get_extension_manifest_schema`

Devuelve el esquema del manifiesto de extensión de Trusteed: campos requeridos, restricciones por campo con notas orientadas al desarrollador, y el sobre de firma (JWS Compact Ed25519, canonicalización RFC 8785, contrafirma del desarrollador + de Trusteed). Solo documentación; para validación en runtime, usa el linter `@trusteed/sdk-extension` o recupera la URL del esquema canónico.

Sin parámetros.

---

### `get_webhook_event_schema`

Devuelve el contrato de entrega de webhooks de Trusteed: estructura del sobre, cadena canónica HMAC-SHA256 `v1.{ts}.{nonce}.{METHOD}.{path}.{sha256_hex(raw_body)}`, calendario de reintentos `[5s, 30s, 5min, 1h, 6h]` con DLQ en el intento 6, semántica de circuit-breaker y resúmenes de payload por evento.

| Parámetro    | Tipo   | Requerido | Descripción                                                                                                                                                                                                                                             |
| ------------ | ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_type` | string | —         | Un solo evento a detallar. Uno de: `agent.first_seen`, `agent.identified`, `checkout.created`, `checkout.completed`, `checkout.cancelled`, `checkout.blocked`, `refund.issued`, `rule.triggered`. Omítelo para el sobre completo + referencia de firma. |

---

### `get_extension_scopes`

Devuelve el catálogo de valores enum de `scopes_requested` con clasificación de datos (público / operacional / sensible / PII), indicador de PII, impacto mínimo en `risk_category`, un caso de uso de ejemplo y un caso de "no uso" explícito. Ancla el principio de alcance mínimo viable: las extensiones que tocan `customers:read:pii` reciben revisión manual, `risk_category` alto y una conversión de instalación más lenta.

| Parámetro | Tipo   | Requerido | Descripción                                                                                                                                                                                                                                                                                                                                                                             |
| --------- | ------ | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scope`   | string | —         | Un solo nombre de scope en el que enfocarse. Uno de: `events:subscribe:checkout`, `events:subscribe:rules`, `events:subscribe:refunds`, `events:subscribe:agents`, `agents:read`, `agents:read:reputation`, `checkouts:read`, `checkouts:read:pricing`, `customers:read:pii`, `rules:read`, `merchant_config:read:public`, `extension_config:write`. Omítelo para el catálogo completo. |

---

## Puntos de control de agente — R001–R062

Estas 46 reglas constituyen el **catálogo de reglas de comercio de Trusteed**: una capa de política para comercio agéntico, riesgo de checkout, controles del comercio y protección del cliente. Son reglas ordinarias de comercio/catálogo. No requieren eIDAS, QTSP, Visa Verifier ni ningún proveedor de identidad regulado, salvo que un comercio configure por separado esas integraciones de mayor garantía.

> **Cobertura del catálogo.** Las **46** reglas del motor de producción (`R001`–`R062`,
> no contiguas) están documentadas aquí a fecha de `AGENT_RULES_VERSION` `2.0.0`. Las
> entradas `R031`–`R062` se derivaron de cada evaluador en `rule-catalog.ts`: `when`
> refleja la rama que realmente devuelve HIT, y `defaults` sólo lista valores a los que
> el evaluador recurre de verdad. Los topes sin valor por defecto lo indican: esas
> reglas quedan inertes hasta que el comercio las configura.
>
> La tabla resumen de abajo detalla `R001`–`R030`; para `R031`–`R062` usa
> `get_agent_rules` o el documento de referencia enlazado.

La fuente pública de verdad es la herramienta MCP `get_agent_rules`, que devuelve cada regla con código, categoría, madurez, severidad, fase de evaluación, descripción, acción por defecto, expectativas de evidencia y ejemplos.

```mermaid
flowchart TD
    ROOT["Agent Rule Catalog R001-R062"]
    ROOT --> KYA["KYA and identity\nR001-R008"]
    ROOT --> HP["Merchant high-priority controls\nR009-R018"]
    ROOT --> MP["Merchant medium-priority controls\nR019-R028"]
    ROOT --> CP["Merchant control plane\nR029-R030"]
    ROOT --> SK["Starter-kit controls\nR031-R048, R062"]

    KYA --> KYA_EX["Business identity, owner attestation,\ncredential verification, reputation,\ncart intent, policy, marketplace integrity"]
    HP --> HP_EX["Price accuracy, tax/shipping,\navailability, payments, privacy,\nreturns, support, safety, fraud, subscriptions"]
    MP --> MP_EX["Accessibility, localization,\nintegrations, webhook health,\nperformance, evidence completeness,\nconsent, disclosure, provenance, data minimization"]
    CP --> CP_EX["Evidence freshness and\nsimple controls for merchants without advanced assurance rails"]
    SK --> SK_EX["Kill-switch, category/SKU blocklists,\nhard caps on value, items and spend,\nprovider allow/blocklists,\nmerchant HITL and customer confirmation"]

    style ROOT fill:#1e293b,color:#fff
    style KYA fill:#1e40af,color:#fff
    style HP fill:#0f766e,color:#fff
    style MP fill:#7c2d12,color:#fff
    style CP fill:#334155,color:#fff
    style SK fill:#4c1d95,color:#fff
```

### Tabla resumen de reglas

> **Esta tabla es un subconjunto: solo `R001`–`R030` (30 de las 46 reglas).** Las 16
> restantes — `R031`, `R032`, `R034`–`R036`, `R038`, `R039`, `R041`–`R048`, `R062` — son
> los controles del kit de arranque (interruptor general, topes duros, listas de
> proveedores, aprobación del comerciante y confirmación del cliente) y **no** aparecen
> aquí. Obtén el catálogo completo con la herramienta MCP `get_agent_rules`, o lee
> **[docs/agent-rules-reference.md](docs/agent-rules-reference.md)**, que documenta las 46
> en detalle. La numeración no es contigua: `R033`, `R037`, `R040` y `R049`–`R061` no
> existen.

Para descripciones completas, parámetros configurables, dependencias de atributos de carrito y ejemplos de integración, consulta **[docs/agent-rules-reference.md](docs/agent-rules-reference.md)**.

| Código | Nombre                         | Función                                                                                                   |
| ------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| R001   | `verified-agent-required`      | Bloquea el checkout cuando no hay una identidad de agente verificada                                      |
| R002   | `signature-spoof-block`        | Bloquea firmas de token de agente inválidas o no verificables                                             |
| R003   | `mandate-boundary-match`       | Aplica el tope de gasto del mandato del operador y la lista de categorías permitidas                      |
| R004   | `new-key-friction`             | Añade fricción cuando se usa una clave de agente recién emitida                                           |
| R005   | `revoked-agent-block`          | Bloquea agentes revocados o con fallos de identidad repetidos                                             |
| R006   | `provider-confidence-tier`     | Aplica un trust score mínimo y una confianza de proveedor mínima                                          |
| R007   | `cross-merchant-abuse-signal`  | Bloquea agentes señalados por 2+ comercios en los últimos 30 días                                         |
| R008   | `scope-escalation-detection`   | Bloquea solicitudes que excedan los scopes de agente autorizados por el comercio                          |
| R009   | `agent-verification-required`  | Réplica, del lado del comercio, de R001 para operaciones de catálogo y sesión                             |
| R010   | `new-agent-probation`          | Requiere un número mínimo de pedidos previos completados                                                  |
| R011   | `repeat-failed-checkout`       | Bloquea agentes que superan los intentos fallidos de checkout en una ventana de tiempo                    |
| R012   | `high-risk-category`           | Bloquea pedidos que contengan categorías de producto de alto riesgo definidas por el comercio             |
| R013   | `return-policy-guard`          | Bloquea cuando las expectativas de devolución del agente entran en conflicto con la política del comercio |
| R014   | `delivery-risk-guard`          | Bloquea países de entrega de alto riesgo y cancelaciones repetidas tras el envío                          |
| R015   | `price-change-guard`           | Bloquea cuando el precio del carrito ha variado más allá de un delta permitido                            |
| R016   | `stock-confidence-guard`       | Bloquea cuando el stock de una línea de producto cae por debajo del mínimo requerido                      |
| R017   | `discount-anomaly-applied`     | Limita los descuentos **ya aplicados** al carrito y la profundidad total de descuento                     |
| R018   | `cart-composition-guard`       | Detecta picos de pedidos, abuso de cantidad de artículos y abuso de cantidad en un solo SKU               |
| R019   | `country-jurisdiction`         | Restringe los pedidos a países permitidos o bloquea jurisdicciones específicas                            |
| R020   | `business-hours`               | Restringe los pedidos agénticos al horario comercial del comercio en su zona horaria local                |
| R021   | `first-purchase-with-merchant` | Marca para revisión las primeras compras de un agente con el comercio                                     |
| R022   | `payment-rail-restriction`     | Aplica una lista de permitidos o de bloqueados de métodos de pago                                         |
| R023   | `refund-abuse-guard`           | Bloquea agentes con una proporción de reembolsos alta en una ventana móvil                                |
| R024   | `dispute-history-guard`        | Bloquea agentes con demasiadas disputas de pago recientes                                                 |
| R025   | `sensitive-delivery-address`   | Bloquea apartados postales y direcciones de reenvío de mercancía                                          |
| R026   | `subscription-autorenew-guard` | Requiere consentimiento explícito antes de procesar cargos de renovación automática                       |
| R027   | `gift-card-stored-value`       | Limita los importes de compra de valor almacenado / tarjetas regalo por transacción                       |
| R028   | `b2b-po-guard`                 | Requiere evidencia de orden de compra para pedidos B2B                                                    |
| R029   | `merchant-preset`              | Aplica uno de cuatro presets de riesgo con nombre (abierto/equilibrado/estricto/regulado)                 |
| R030   | `simple-controls`              | Tope de importe y restricción de país sin rieles de evidencia avanzados                                   |

La Checkout Enforcement Layer interna también mantiene los evaluadores legacy R001–R010 para comercios y snapshots de plugin existentes. Las integraciones nuevas deben tratar los códigos de regla como cadenas opacas y usar la salida actual de `get_agent_rules` en lugar de codificar nombres antiguos de forma fija o asumir exactamente diez reglas.

---

### Evaluar reglas vía la API

Los umbrales de las reglas **no se envían en la petición**. El comercio los configura en
el panel de Trusteed; el servidor resuelve el conjunto de reglas activo de ese comercio a
partir de la instalación autenticada y lo evalúa contra el `orderContext` que envías. No
existe ningún campo `merchantPolicies` en el esquema de la petición: enviarlo no tiene
ningún efecto.

La **autenticación** es un HMAC por instalación, no una simple clave de API. Se requieren
dos cabeceras:

| Cabecera                     | Valor                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `X-Trusteed-Installation-Id` | UUID de tu `EnforcementInstallation`                                          |
| `X-Trusteed-Signature`       | `t=<segundos-unix>,s=<hex>` — HMAC-SHA256 de `<segundos-unix>.<cuerpo-crudo>` |

La firma se calcula con el secreto HMAC de tu instalación sobre los **bytes crudos** de la
petición (estilo Stripe), así que firma exactamente el cuerpo que transmites. Se rechazan
las peticiones fuera de la tolerancia de tiempo y aquellas cuyo `merchantId` no pertenezca
a la instalación autenticada (`403 cross_merchant_access_denied`).

```bash
POST https://api.trusteed.xyz/v1/rules/evaluate
Content-Type: application/json
X-Trusteed-Installation-Id: 3f1c9a52-8d4e-4b17-9a6c-2e5b7d0c1f84
X-Trusteed-Signature: t=1755461234,s=9f8c...<hex-sha256>

{
  "merchantId": "acme-store",
  "platform": "TRUSTEED_MCP",
  "installationId": "3f1c9a52-8d4e-4b17-9a6c-2e5b7d0c1f84",
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

Campos obligatorios: `merchantId` (cadena opaca de 1 a 128 caracteres — **no**
necesariamente un UUID), `platform`, `installationId` (UUID), `timestamp` (ISO 8601 con
offset) y `orderContext` con `cartTotalCents`, `currency` (ISO 4217) e `itemCount`.
`platform` es uno de `SHOPIFY` · `WOOCOMMERCE` · `PRESTASHOP` · `ODOO` · `MAGENTO` ·
`TRUSTEED_MCP`.

`agentId` es opcional y debe ser un DID desnudo (`did:web:…` o `did:key:…`, sin fragmento
de clave). `agentTrustScore` es un entero de `0` a `100` y va **dentro** de
`orderContext`, no como hermano suyo.

Respuestas: `200` con la decisión de evaluación, `400 invalid_body` si falla el esquema,
`401` si falla el HMAC, `403 cross_merchant_access_denied`, `429 rate_limit_exceeded`
(con `Retry-After`), o `503` con un `BLOCK` fail-closed si el evaluador excede el tiempo.

Para **enforcement offline** (del lado del plugin, sin llamada de red por checkout),
recupera el snapshot de reglas firmado — mismas cabeceras HMAC, y `:merchantId` debe
coincidir con tu instalación:

```bash
GET https://api.trusteed.xyz/v1/rules/snapshot/:merchantId
# Devuelve un RuleSnapshot firmado con JWS. Respeta el `validUntil` del propio payload:
# 300 s normalmente, pero 60 s mientras una regla Tier-1 o el kill-switch estén activos.
```

---

## Flujo de trabajo del desarrollador

```mermaid
sequenceDiagram
    actor Dev as Developer
    participant IDE as IDE (Claude / Cursor)
    participant MCP as developer-mcp
    participant API as Trusteed API

    Dev->>IDE: "How do I integrate the trust framework?"
    IDE->>MCP: search_docs("trust framework")
    MCP-->>IDE: Ranked doc sections
    IDE-->>Dev: Explanation + links

    Dev->>IDE: "Show me the agent enforcement rules"
    IDE->>MCP: get_agent_rules(filter="all")
    MCP-->>IDE: R001–R062 with thresholds + examples
    IDE-->>Dev: Full enforcement spec

    Dev->>IDE: "Generate a TypeScript integration"
    IDE->>MCP: get_integration_guide(framework="typescript")
    MCP-->>IDE: Install cmd + code + next steps
    IDE-->>Dev: Ready-to-paste code

    Dev->>IDE: "I need a sandbox key"
    IDE->>MCP: create_sandbox_key()
    MCP->>API: POST /api/v1/sandbox/key
    API-->>MCP: { api_key, expires_at }
    MCP-->>IDE: Key + usage example
    IDE-->>Dev: api_key (valid 24h)

    Dev->>API: Test with sandbox key
    API->>API: Evaluate R001–R062
    API-->>Dev: Checkout response
```

---

## Recursos (Resources)

Los recursos son datos de referencia pasivos, legibles por los agentes en cualquier momento.

| URI                     | MIME               | Descripción                                                                                            |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------------------------------ |
| `docs://llms.txt`       | `text/plain`       | Manifiesto de la plataforma — endpoints, límites de tasa, resumen del trust score                      |
| `policy://agent-policy` | `application/json` | Políticas de acción del agente: rangos de trust score, requisitos de confirmación, reglas de fail-safe |
| `spec://openapi`        | `application/json` | Resumen de la especificación OpenAPI 3.0 de todos los endpoints de la Agent API                        |

---

## Prompts

| Nombre               | Descripción                       | Parámetros                                   |
| -------------------- | --------------------------------- | -------------------------------------------- |
| `integration_helper` | Flujo de integración guiado       | `framework` (opcional), `useCase` (opcional) |
| `troubleshoot`       | Depurar errores comunes de la API | `error` (opcional), `endpoint` (opcional)    |

---

## Modos de transporte

| Modo                  | Comando (desde el fuente, funciona hoy) | Comando (tras publicar en npm)                   | Caso de uso                                            |
| --------------------- | --------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `stdio` (por defecto) | `node dist/index.js`                    | `npx @trusteed/developer-mcp`                    | Claude Desktop, Cursor, VS Code — un proceso por host  |
| `HTTP`                | `node dist/index.js --http --port=3100` | `npx @trusteed/developer-mcp --http --port=3100` | Despliegue remoto, múltiples clientes, pipelines de CI |

El modo HTTP es sin estado (un servidor por solicitud). CORS está abierto (`*`). Límite de tasa: 100 solicitudes / 15 minutos por IP.

---

## Enlaces

- Plataforma: [trusteed.xyz](https://www.trusteed.xyz)
- Tienda demo — playground de reglas en vivo: [trusteed.xyz/en/demo-store](https://www.trusteed.xyz/en/demo-store)
- Política del agente: [trusteed.xyz/.well-known/agent-policy.json](https://www.trusteed.xyz/.well-known/agent-policy.json)
- Playbooks de agente: [trusteed.xyz/.well-known/agent-playbooks.json](https://www.trusteed.xyz/.well-known/agent-playbooks.json)
- Manifiesto MCP: [trusteed.xyz/.well-known/mcp.json](https://www.trusteed.xyz/.well-known/mcp.json)

---

## Agradecimientos

Este servidor MCP expone integraciones construidas sobre los siguientes protocolos y plataformas externos. Son dependencias de infraestructura, no colaboradores formales, pero hacen posible la capa de comercio agéntico.

| Partner                                                 | Rol                          | Integración                                                                                                                                                  |
| ------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Stripe](https://stripe.com)                            | Infraestructura de pago fiat | Protocolo ACP (sesiones de checkout OpenAI/Stripe); R011 repeat-failed-checkout usa las señales de riesgo de Stripe Radar cuando el método de pago es Stripe |
| [OpenAI](https://openai.com)                            | Coautor del protocolo ACP    | Agentic Commerce Protocol (ACP) para pagos fiat mediados por agente                                                                                          |
| [Google](https://developers.google.com)                 | Protocolo AP2                | Agent Payment Protocol v2 — Google Cart Mandate para pagos mediados por agente                                                                               |
| [Coinbase](https://www.coinbase.com/developer-platform) | Riel de stablecoin x402      | Infraestructura de pago USDC para el protocolo x402                                                                                                          |
| [Cloudflare](https://cloudflare.com)                    | Coautor de x402              | Estándar abierto x402 para pagos de stablecoin nativos de HTTP                                                                                               |
| [Anthropic / MCP](https://modelcontextprotocol.io)      | Protocolo de transporte      | SDK del Model Context Protocol (`@modelcontextprotocol/sdk`)                                                                                                 |

**Integraciones de mayor garantía** (disponibles en la plataforma Trusteed para comercios que lo activen opcionalmente, no requeridas por defecto):

| Partner                                         | Rol                                                                                                                     |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [HUMAN Security](https://www.humansecurity.com) | Verificación de identidad de agente vía AgenticTrust — Firmas de Mensaje HTTP RFC 9421 para agentes compradores         |
| Visa (TAP)                                      | Trusted Agent Protocol — etiquetas de firma `agent-browser-auth` / `agent-payer-auth` para agentes verificados por Visa |
| [InfoCert (QTSP)](https://infocert.eu)          | Firmas electrónicas y sellos de tiempo cualificados eIDAS para los trust receipts                                       |

Estas integraciones de mayor garantía dependen de la configuración del comercio y no son invocadas por este servidor MCP de documentación. Consulta la metodología de confianza de la plataforma para más detalles.

---

## Licencia

MIT — ver [LICENSE](LICENSE).
