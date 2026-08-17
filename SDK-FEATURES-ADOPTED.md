# Novedades del MCP SDK Adoptadas en Developer MCP

**Fecha:** 2026-03-20
**SDK:** @modelcontextprotocol/sdk@^1.29.0
**Referencia:** Analisis de Context7 sobre typescript-sdk y ext-apps

---

## Novedades Adoptadas (3 de 6 identificadas)

### 1. `structuredContent` — Output Dual (Texto + JSON)

**Que es:** Los tools MCP ahora pueden retornar tanto `content` (texto markdown para el LLM) como `structuredContent` (JSON tipado para uso programatico).

**Donde lo usamos:** En los **10** tools del Developer MCP (los 5 originales mas `get_agent_rules`, `create_sandbox_key`, `get_extension_manifest_schema`, `get_webhook_event_schema` y `get_extension_scopes`):

- `search_docs` → structuredContent con array de {id, section, title, relevance}
- `get_openapi_schema` → structuredContent con {resource, schema}
- `get_integration_guide` → structuredContent con {framework, install, code, nextSteps}
- `get_trust_framework` → structuredContent con {components, rankingFormula, merchantStates}
- `get_protocol_info` → structuredContent con {protocols: [{id, name, status, adapter}]}
- `get_agent_rules` → structuredContent con {version, rules: [...]}
- `create_sandbox_key` → structuredContent con {api_key, expires_at}
- `get_extension_manifest_schema` / `get_webhook_event_schema` / `get_extension_scopes` → structuredContent con el descriptor correspondiente

**Impacto competitivo:** commercetools Commerce MCP retorna JSON transformable a tabular. Nosotros retornamos markdown legible + JSON estructurado. Los agent frameworks (LangChain, Vercel AI) pueden consumir el JSON directamente sin parsear markdown.

**Ejemplo:**

```typescript
return {
  content: [{ type: "text", text: "## Trust Framework\n..." }],  // Para el LLM
  structuredContent: { components: [...], rankingFormula: {...} }, // Para el framework
};
```

### 2. Tool Annotations — ADOPTADO

**Que es:** `readOnlyHint`, `destructiveHint`, `idempotentHint` son metadatos que informan al cliente MCP sobre el comportamiento del tool sin cambiar su semantica de ejecucion.

**Estado actual:** ADOPTADO. Los 10 tools se registran ya con `server.registerTool()` (no con el `server.tool()` antiguo), que si acepta `annotations` en el bloque de configuracion. 9 de los 10 las declaran:

```typescript
annotations: {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
},
```

`search_docs`, `get_openapi_schema`, `get_integration_guide`, `get_trust_framework`, `get_protocol_info`, `get_agent_rules`, `get_extension_manifest_schema`, `get_webhook_event_schema` y `get_extension_scopes` — los nueve tools de documentacion pura.

**La excepcion es correcta:** `create_sandbox_key` NO lleva `readOnlyHint`, y no debe llevarlo. Es el unico tool que no es de solo lectura: hace `POST /api/v1/sandbox/key` y **crea** una credencial temporal con efecto en el servidor. Declararlo `readOnlyHint: true` seria mentirle al host MCP sobre un tool con efectos secundarios.

**Pendiente real:** decidir si `create_sandbox_key` debe declarar explicitamente `readOnlyHint: false` + `idempotentHint: false` en lugar de omitir el bloque (omitir deja al host aplicar sus propios valores por defecto, que segun la spec MCP son los conservadores).

### 3. Dual Transport (stdio + Streamable HTTP)

**Que es:** El SDK soporta multiples transportes. `StdioServerTransport` para uso local en IDEs, `StreamableHTTPServerTransport` para deployment remoto.

**Donde lo usamos:** En `index.ts` con flag `--http`:

- **stdio** (default): `npx @trusteed/developer-mcp` — para Claude Desktop, Cursor, VS Code
- **HTTP**: `npx @trusteed/developer-mcp --http --port=3100` — para deployment publico

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

**Por que no en Developer MCP:** los 9 tools de documentacion son read-only y no necesitan input del usuario; `create_sandbox_key`, el unico con efecto, tampoco lleva parametros (`inputSchema: {}`).

**Donde aplicar:** En SK-1 E3 (Marketplace MCP), refactorizar `get-shipping-rates.ts` y `complete-checkout.ts` para usar `ctx.mcpReq.elicitInput()` oficial.

### 6. SDK v2 Import Paths — Diferido

**Que es:** Migracion de `@modelcontextprotocol/sdk/server/mcp.js` a `@modelcontextprotocol/server`.

**Por que no ahora:** Romperia la compatibilidad con `packages/mcp-server/` existente que usa v1 imports. Migrar cuando todo el monorepo pueda actualizar simultaneamente.

**Accion:** Crear ticket de migracion post-SK-1 para actualizar todo el monorepo a SDK v2.

---

## Resumen de Decisiones

| Novedad           | Adoptada | Donde                     | Razon                                                                                                 |
| ----------------- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------- |
| structuredContent | SI       | 10 tools Developer MCP    | Ventaja competitiva: dual output                                                                      |
| Tool Annotations  | SI       | 9 de 10 tools (read-only) | `registerTool()` las acepta en v1; `create_sandbox_key` queda fuera a proposito (crea una credencial) |
| Dual Transport    | SI       | index.ts (stdio + HTTP)   | Maxima compatibilidad IDE                                                                             |
| MCP Apps (UI)     | DIFERIDO | Post-SK-1                 | Experimental, sin soporte universal                                                                   |
| Elicitation API   | DIFERIDO | SK-1 E3 (Marketplace MCP) | No necesario en docs read-only                                                                        |
| SDK v2 Imports    | DIFERIDO | Post-SK-1                 | Breaking change en monorepo                                                                           |
