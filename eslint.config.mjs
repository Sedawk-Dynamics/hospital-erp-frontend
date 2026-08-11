import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // An underscore prefix means "declared on purpose, not read" — the
      // convention this codebase already uses to DROP a field rather than
      // ignore one:
      //
      //     shifts.map(({ _key, ...rest }) => rest)
      //
      // `_key` is a client-only React key that must not reach the API, so the
      // binding is what does the work even though nothing reads it. Flagging
      // that as dead invites someone to delete it and start posting `_key` to
      // the server. Same for a callback argument that only exists to reach the
      // one after it.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
