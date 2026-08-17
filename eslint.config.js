// ESLint flat config for packages/developer-mcp
// TypeScript linting is handled by `tsc --noEmit` in the typecheck script
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

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
    // Registered (not enabled — `rules` stays empty) so `eslint-disable` comments
    // that reference `@typescript-eslint/*` rule names resolve instead of
    // erroring with "Definition for rule ... was not found". tsc --noEmit
    // remains the actual type-checking gate; this plugin is not enforcing here.
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {},
  },
];
