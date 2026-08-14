// eslint-disable-next-line import/no-extraneous-dependencies
import tseslint from "typescript-eslint";

/** Config base compartilhada pelos apps NestJS/Electron. Ver docs/CODING-STANDARDS.md. */
export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "**/generated/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
