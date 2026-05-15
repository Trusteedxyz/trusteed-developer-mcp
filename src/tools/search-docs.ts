import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";
import { DOCS, type DocEntry } from "../content/docs-index.js";

const SECTION_ENUM = [
  "api",
  "trust",
  "protocols",
  "integration",
  "glossary",
  "general",
] as const;

const searchDocsOutputSchema = z.object({
  query: z.string(),
  section: z.string().nullable(),
  totalResults: z.number(),
  results: z.array(
    z.object({
      id: z.string(),
      section: z.string(),
      title: z.string(),
      relevance: z.number(),
    })
  ),
});

export function registerSearchDocs(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "search_docs",
    {
      description:
        "Search AgenticMCPStores documentation by keyword. Returns matching sections with relevance ranking. Use this to find API endpoints, trust framework details, protocol specs, integration guides, or glossary terms.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe(
            "Search query (e.g. 'trust score', 'checkout flow', 'x402 protocol')"
          ),
        section: z
          .enum(SECTION_ENUM)
          .optional()
          .describe(
            "Filter by section: api, trust, protocols, integration, glossary, general"
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("Maximum results to return (default: 5)"),
      },
      outputSchema: searchDocsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ query, section, limit }) => {
      const queryLower = query.toLowerCase();
      const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 1);

      const scored: Array<{
        readonly entry: DocEntry;
        readonly score: number;
      }> = [];

      for (const entry of DOCS) {
        if (section && entry.section !== section) continue;

        const searchable = `${entry.title} ${entry.body}`.toLowerCase();
        let score = 0;

        for (const term of queryTerms) {
          if (entry.title.toLowerCase().includes(term)) score += 3;
          score += searchable.split(term).length - 1;
        }

        if (score > 0) scored.push({ entry, score });
      }

      scored.sort((a, b) => b.score - a.score);
      const results = scored.slice(0, limit);

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No documentation found for "${query}"${section ? ` in section "${section}"` : ""}.\n\nAvailable sections: ${SECTION_ENUM.join(", ")}\n\nTry broader terms or remove the section filter.`,
            },
          ],
          structuredContent: {
            query,
            section: section ?? null,
            totalResults: 0,
            results: [],
          },
        };
      }

      const formatted = results
        .map(
          ({ entry, score }, i) =>
            `---\n### ${i + 1}. ${entry.title}\n**Section:** ${entry.section} | **Relevance:** ${score}\n\n${entry.body}`
        )
        .join("\n\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${results.length} result(s) for "${query}":\n\n${formatted}`,
          },
        ],
        structuredContent: {
          query,
          section: section ?? null,
          totalResults: results.length,
          results: results.map(({ entry, score }) => ({
            id: entry.id,
            section: entry.section,
            title: entry.title,
            relevance: score,
          })),
        },
      };
    }
  );
}
