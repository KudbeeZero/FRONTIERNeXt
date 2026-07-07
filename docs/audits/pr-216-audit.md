# PR #216 audit — fix/session-mismatch-recovery

**Scope check:** diff touches exactly `server/routeOwnership.ts`, `server/routes.ts`
(both `evaluateOwnership` call sites), `client/src/lib/queryClient.ts`, +1 new client
test file, +1 extended server test assertion, session note, baton. No funds/ASA/chain
files, no globe/cinematics files, `wip/atomic-purchase` untouched.

**Correctness:** `evaluateOwnership`'s 403 branch now carries
`code: "SESSION_MISMATCH"`; both call sites in `routes.ts` spread `code` into the JSON
body only when present (401 branch unaffected, still just `{ error }`). Client's
`throwIfResNotOk` parses the body on a 403, checks the code, and on match clears the
stale auth token, toasts once, and reloads after a deferred 1.5s (module-level flag
guards a burst of concurrent failures from double-firing). The thrown `Error` is
unchanged, so existing per-call-site `onError` toasts still fire — this is additive
recovery, not a behavior change to the error-throwing contract.

**Tests:** re-ran directly — `pnpm run check` clean, `test:server` 449/24 skipped,
`test` (client) 323 passed (+3 new), `build` clean. Matches PR claims exactly.

**Verdict: PASS.** Small, well-scoped, additive fix; no HARD RULE surface touched.
Merging.
