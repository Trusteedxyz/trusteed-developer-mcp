import { defineConfig } from "vitest/config";
import { baseConfig } from "../../vitest.config.base";

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    name: "developer-mcp",
    environment: "node",
    passWithNoTests: true,
    coverage: {
      ...(baseConfig.test?.coverage as any),
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
    } as any,
  },
});
