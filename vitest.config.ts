import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "developer-mcp",
    environment: "node",
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.config.ts",
        "**/*.test.ts",
        "**/*.spec.ts",
        "src/index.ts",
      ],
    },
  },
});
