import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type AnyHandler = (
  args: Record<string, unknown>,
  extra: Record<string, unknown>
) => Promise<any>;

interface PrivateServer {
  _registeredTools: Record<string, { handler: AnyHandler }>;
}

/**
 * Extracts a registered tool handler from an McpServer for unit testing.
 *
 * This accesses a private SDK field. If the SDK changes this internal API,
 * only this file needs updating — not individual test files.
 */
export function getRegisteredHandler(
  server: McpServer,
  toolName: string
): AnyHandler {
  const tools = (server as unknown as PrivateServer)._registeredTools;
  const entry = tools[toolName];
  if (!entry) {
    throw new Error(
      `Tool "${toolName}" not registered. Available: ${Object.keys(tools).join(", ")}`
    );
  }
  return entry.handler;
}
