// ESLint flat config for packages/developer-mcp
// TypeScript linting is handled by `tsc --noEmit` in the typecheck script
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
      },
    },
    rules: {},
  },
];
