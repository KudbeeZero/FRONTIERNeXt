# 2026-06-11 — fix/client-typecheck-ci: restore `pnpm run check` to green

**Symptom:** 255 client tsc errors on `main` (CI typecheck step red). Two error
classes: `Property 'group' does not exist on JSX.IntrinsicElements` across every
react-three-fiber component, and `Type 'bigint' is not assignable to ReactNode`
in plain components.

**Root cause:** the workspace ships two React type graphs — frontier-al pins
`@types/react@18` (react 18.3 runtime), while other workspace packages use the
catalog's `@types/react@19`. Libraries that do `import "react"` in their `.d.ts`
**without declaring an `@types/react` peer** (`wouter`, `@tanstack/react-query`,
`lucide-react`, `framer-motion`) resolve types by walking up to pnpm's hidden
hoist (`node_modules/.pnpm/node_modules`), where **19 had won the hoist**. One
program, two `ReactNode`s; and React 19 types drop the global `JSX` namespace,
so R3F's global JSX augmentation no longer applied. Verified with
`tsc --explainFiles` (shows `@types+react@19.2.14` entering via those four
packages). Hoist winner is install-order dependent — which is why earlier
branches saw green with the same lockfile.

**Fix (tsconfig-only):** pin all react type entry points in
`artifacts/frontier-al/tsconfig.json` `paths` to this package's own
`node_modules/@types/react[-dom]` (react, react/jsx-runtime,
react/jsx-dev-runtime, react-dom, react-dom/client). Deterministic regardless
of hoist order; no dependency changes.

**Verified:** `pnpm run check` 0 errors · `test:server` 194/194 ·
client `test` 31/31 · `pnpm run build` green.

**Durable lesson:** if mixed-React-types errors reappear in another workspace
package, apply the same `paths` pin there; the real long-term fix is converging
the workspace on one React major.
