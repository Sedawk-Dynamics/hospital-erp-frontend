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

  // ── Legacy backlog ──────────────────────────────────────────────────────
  //
  // `npm run build` now fails on any ESLint *error* before `next build` runs,
  // so that a rules-of-hooks violation can never ship again. A hook declared
  // below an early return is only a console warning in dev, but in a
  // production build React throws "Rendered more hooks than during the
  // previous render" and the page dies as "Application error: a client-side
  // exception has occurred" — which is exactly how the IP bill dialog reached
  // dev.cenaps.in.
  //
  // The gate only works if the error count starts at zero, and these seven
  // rules account for all 437 errors this codebase had on the day it went in.
  // They are DOWNGRADED, not switched off: they still print on every lint run,
  // they just do not block a deploy.
  //
  // This is a ratchet. Clear a rule's warnings, then delete its line here and
  // it becomes blocking forever after. Never add a line to this block to get a
  // build green — fix the code.
  {
    rules: {
      // 384 — `any` is untidy, it does not white-screen a page.
      "@typescript-eslint/no-explicit-any": "warn",
      // 1
      "react/no-unescaped-entities": "warn",

      // The rest are eslint-plugin-react-hooks v6 (React Compiler) rules that
      // arrived with Next 16 and landed on existing code. These ARE crash- and
      // infinite-loop-class, so they are the ones worth clearing first — the
      // 30 set-state-in-effect hits especially.
      "react-hooks/set-state-in-effect": "warn",         // 30
      "react-hooks/purity": "warn",                      // 9
      "react-hooks/preserve-manual-memoization": "warn", // 8
      "react-hooks/refs": "warn",                        // 4
      "react-hooks/globals": "warn",                     // 1
    },
  },
]);

export default eslintConfig;
