import reactHooks from "eslint-plugin-react-hooks";
import base from "@easypdv/eslint-config";

// TODO: eslint-config-next 16.3.0 (via FlatCompat) quebra com "Converting circular
// structure to JSON" nesta combinação de versões (bug conhecido do eslint-plugin-react
// com ESLint 9 flat config). Usando a config base compartilhada + react-hooks direto
// por enquanto — revisitar quando o ecossistema Next/ESLint estabilizar essa integração.
export default [
  ...base,
  {
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    ignores: ["out/**", ".next/**", "node_modules/**"],
  },
];
