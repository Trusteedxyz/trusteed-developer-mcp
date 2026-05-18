#!/usr/bin/env node

/**
 * Developer MCP Server — Entry Point
 *
 * Supports dual transport:
 *   - stdio (default): `npx @trusteed/developer-mcp`
 *   - HTTP:            `npx @trusteed/developer-mcp --http`
 *                      `npx @trusteed/developer-mcp --http --port=3100`
 *
 * Rate limiting: 100 requests / 15 minutes per IP (HTTP mode only).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createDeveloperMCPServer } from "./server.js";

// ---------------------------------------------------------------------------
// CLI arg parsing (minimal, no deps)
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const isHttpMode = args.includes("--http");
const portArg = args.find((a) => a.startsWith("--port="));
const HTTP_PORT = portArg
  ? parseInt(portArg.split("=")[1] ?? "3100", 10)
  : 3100;

// ---------------------------------------------------------------------------
// Rate limiter (in-memory, per IP — HTTP mode only)
// ---------------------------------------------------------------------------

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 100;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return false;
  }

  rateBuckets.set(ip, { ...bucket, count: bucket.count + 1 });
  return true;
}

// Cleanup stale buckets every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [ip, bucket] of rateBuckets) {
      if (now >= bucket.resetAt) {
        rateBuckets.delete(ip);
      }
    }
  },
  5 * 60 * 1000
).unref();

// ---------------------------------------------------------------------------
// Transport: stdio
// ---------------------------------------------------------------------------

async function startStdio(): Promise<void> {
  const server = createDeveloperMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    "[developer-mcp] Running in stdio mode. Send MCP messages via stdin.\n"
  );
}

// ---------------------------------------------------------------------------
// Transport: Streamable HTTP (stateless, one server per request)
// ---------------------------------------------------------------------------

async function startHttp(): Promise<void> {
  const httpServer = createServer(
    async (req: IncomingMessage, res: ServerResponse) => {
      // CORS preflight
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
          "Access-Control-Max-Age": "86400",
        });
        res.end();
        return;
      }

      // Only /mcp endpoint
      const url = new URL(
        req.url ?? "/",
        `http://${req.headers.host ?? "localhost"}`
      );
      if (url.pathname !== "/mcp") {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found. Use POST /mcp" }));
        return;
      }

      // Rate limit
      const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ??
        req.socket.remoteAddress ??
        "unknown";

      if (!checkRateLimit(ip)) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": "900",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(
          JSON.stringify({
            error: "Rate limit exceeded. Max 100 requests per 15 minutes.",
          })
        );
        return;
      }

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");

      // Read body (max 256 KB — MCP requests are never large)
      const MAX_BODY_BYTES = 256 * 1024;
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      for await (const chunk of req) {
        totalBytes += (chunk as Buffer).length;
        if (totalBytes > MAX_BODY_BYTES) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Request body too large (max 256 KB)" }));
          return;
        }
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString("utf-8");
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON" }));
        return;
      }

      // Stateless: new server + transport per request
      const mcpServer = createDeveloperMCPServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless — no sessions
      });

      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, parsedBody);
      } finally {
        await transport.close();
      }
    }
  );

  httpServer.listen(HTTP_PORT, "0.0.0.0", () => {
    process.stderr.write(
      `[developer-mcp] HTTP server listening on http://0.0.0.0:${HTTP_PORT}/mcp\n` +
        `[developer-mcp] Rate limit: ${RATE_LIMIT_MAX} req / ${RATE_LIMIT_WINDOW_MS / 60000} min per IP\n` +
        `[developer-mcp] Stateless mode (no sessions). CORS: *\n`
    );
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (isHttpMode) {
  startHttp().catch((err) => {
    process.stderr.write(`[developer-mcp] Fatal: ${String(err)}\n`);
    process.exit(1);
  });
} else {
  startStdio().catch((err) => {
    process.stderr.write(`[developer-mcp] Fatal: ${String(err)}\n`);
    process.exit(1);
  });
}
