# Novedades del MCP SDK Adoptadas en Developer MCP

**Fecha:** 2026-03-20
**SDK:** @modelcontextprotocol/sdk@^1.27.1
**Referencia:** Analisis de Context7 sobre typescript-sdk y ext-apps

---

## Novedades Adoptadas (3 de 6 identificadas)

### 1. `structuredContent` — Output Dual (Texto + JSON)

**Que es:** Los tools MCP ahora pueden retornar tanto `content` (texto markdown para el LLM) como `structuredContent` (JSON tipado para uso programatico).

**Donde lo usamos:** En los 5 tools del Developer MCP:

- `search_docs` → structuredContent con array de {id, section, title, relevance}
- `get_openapi_schema` → structuredContent con {resource, schema}
- `get_integration_guide` → structuredContent con {framework, install, code, nextSteps}
- `get_trust_framework` → structuredContent con {components, rankingFormula, merchantStates}
- `get_protocol_info` → structuredContent con {protocols: [{id, name, status, adapter}]}

**Impacto competitivo:** commercetools Commerce MCP retorna JSON transformable a tabular. Nosotros retornamos markdown legible + JSON estructurado. Los agent frameworks (LangChain, Vercel AI) pueden consumir el JSON directamente sin parsear markdown.

**Ejemplo:**

```typescript
return {
  content: [{ type: "text", text: "## Trust Framework\n..." }],  // Para el LLM
  structuredContent: { components: [...], rankingFormula: {...} }, // Para el framework
};
```

### 2. Tool Annotations (Pendiente — Preparado para SDK v2)

**Que es:** `readOnlyHint`, `destructiveHint`, `idempotentHint` son metadatos que informan al cliente MCP sobre el comportamiento del tool sin cambiar su semantica de ejecucion.

**Estado actual:** El SDK v1 (`server.tool()`) no soporta annotations directamente en el API de alto nivel. Las annotations estan definidas en la spec MCP pero se exponen via el protocol handler de bajo nivel.

**Preparacion:** Todos nuestros tools son read-only (documentacion). Cuando migremos a SDK v2 (`server.registerTool()`), agregaremos:

```typescript
annotations: { readOnlyHint: true, destructiveHint: false }
```

**Accion futura:** Migrar a SDK v2 import paths cuando sea estable, agregar annotations a los 5 tools.

### 3. Dual Transport (stdio + Streamable HTTP)

**Que es:** El SDK soporta multiples transportes. `StdioServerTransport` para uso local en IDEs, `StreamableHTTPServerTransport` para deployment remoto.

**Donde lo usamos:** En `index.ts` con flag `--http`:

- **stdio** (default): `npx @agenticmcpstores/developer-mcp` — para Claude Desktop, Cursor, VS Code
- **HTTP**: `npx @agenticmcpstores/developer-mcp --http --port=3100` — para deployment publico

**Implementacion:** HTTP usa Node.js `createServer` nativo (sin Express/Fastify) para minimas dependencias. Modo stateless: un server+transport por request.

---

## Novedades Identificadas pero NO Adoptadas (3 de 6)

### 4. MCP Apps (UI Interactivas) — Diferido

**Que es:** `@modelcontextprotocol/ext-apps` permite servir HTML interactivo desde tools MCP. Los tools declaran `_meta.ui.resourceUri` que apunta a un resource HTML que el host renderiza en iframe.

**Por que no ahora:**

- Spec publicada en enero 2026, aun experimental
- Requiere soporte del host (Claude Desktop, Cursor no lo soportan universalmente)
- Complejidad de CSP, sandboxing, bidirectional comms

**Impacto futuro: MUY ALTO.** Imaginemos:

- `search_docs` → muestra resultados como lista interactiva clicable
- Agent-Readiness Score → radar chart interactivo dentro del chat
- Product comparison → tabla visual con imagenes

**Accion:** Disenar la arquitectura del Marketplace MCP (SK-1 E3) para soportar MCP Apps en futuro. Agregar como post-SK-1 en roadmap.

### 5. Elicitation API (`ctx.mcpReq.elicitInput()`) — Para Marketplace MCP

**Que es:** API formalizada para recoger input del usuario via formularios (rating, shipping address, etc.). Reemplaza el patron de cast a unknown que usamos en checkout tools.

**Por que no en Developer MCP:** Todos los tools del Developer MCP son read-only. No necesitan input del usuario.

**Donde aplicar:** En SK-1 E3 (Marketplace MCP), refactorizar `get-shipping-rates.ts` y `complete-checkout.ts` para usar `ctx.mcpReq.elicitInput()` oficial.

### 6. SDK v2 Import Paths — Diferido

**Que es:** Migracion de `@modelcontextprotocol/sdk/server/mcp.js` a `@modelcontextprotocol/server`.

**Por que no ahora:** Romperia la compatibilidad con `packages/mcp-server/` existente que usa v1 imports. Migrar cuando todo el monorepo pueda actualizar simultaneamente.

**Accion:** Crear ticket de migracion post-SK-1 para actualizar todo el monorepo a SDK v2.

---

## Resumen de Decisiones

| Novedad           | Adoptada  | Donde                     | Razon                               |
| ----------------- | --------- | ------------------------- | ----------------------------------- |
| structuredContent | SI        | 5 tools Developer MCP     | Ventaja competitiva: dual output    |
| Tool Annotations  | PREPARADO | Cuando SDK v2             | v1 API no lo soporta nativo         |
| Dual Transport    | SI        | index.ts (stdio + HTTP)   | Maxima compatibilidad IDE           |
| MCP Apps (UI)     | DIFERIDO  | Post-SK-1                 | Experimental, sin soporte universal |
| Elicitation API   | DIFERIDO  | SK-1 E3 (Marketplace MCP) | No necesario en docs read-only      |
| SDK v2 Imports    | DIFERIDO  | Post-SK-1                 | Breaking change en monorepo         |
