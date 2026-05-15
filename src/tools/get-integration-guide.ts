import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DeveloperMCPServerConfig } from "../server.js";
import {
  FRAMEWORK_GUIDES,
  type FrameworkId,
} from "../content/framework-guides.js";

const FRAMEWORK_IDS = Object.keys(FRAMEWORK_GUIDES) as FrameworkId[];

const getIntegrationGuideOutputSchema = z.object({
  framework: z.string().describe("Framework ID, or empty string if not found"),
  name: z.string().describe("Display name of the framework"),
  install: z.string().describe("Install command"),
  setupTime: z.string().describe("Estimated setup time"),
  code: z.string().describe("Integration code example"),
  nextSteps: z.array(z.string()).describe("Ordered list of next steps"),
});

export function registerGetIntegrationGuide(
  server: McpServer,
  _config: DeveloperMCPServerConfig
): void {
  server.registerTool(
    "get_integration_guide",
    {
      description: `Get a step-by-step integration guide with code examples for a specific framework. Available: ${FRAMEWORK_IDS.join(", ")}.`,
      inputSchema: {
        framework: z
          .string()
          .describe(`Framework ID: ${FRAMEWORK_IDS.join(", ")}`),
      },
      outputSchema: getIntegrationGuideOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    async ({ framework }) => {
      const guide = FRAMEWORK_GUIDES[framework as FrameworkId];

      if (!guide) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown framework "${framework}". Available: ${FRAMEWORK_IDS.join(", ")}`,
            },
          ],
          structuredContent: {
            framework: "",
            name: "",
            install: "",
            setupTime: "",
            code: "",
            nextSteps: [],
          },
        };
      }

      const markdown = `## Integration Guide: ${guide.name}

**Install:** \`${guide.install}\`
**Setup time:** ${guide.setupTime}

### Code

\`\`\`
${guide.code}
\`\`\`

### Next Steps

${guide.nextSteps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

      return {
        content: [{ type: "text" as const, text: markdown }],
        structuredContent: {
          framework: guide.id,
          name: guide.name,
          install: guide.install,
          setupTime: guide.setupTime,
          code: guide.code,
          nextSteps: [...guide.nextSteps],
        },
      };
    }
  );
}
