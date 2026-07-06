# FRONTIER Branch Machine — execution rules

> How work moves through branches and PRs. This encodes the owner's execution model on top of
> the Session Relay Protocol ([SESSION_PROTOCOL.md](./SESSION_PROTOCOL.md)). Where the two
> overlap, they agree; where this is stricter (funds paths), this wins.

## The machine

```
pick unit (baton → FIRST_10_PRS → MASTER_ROADMAP)
   → branch N (one active implementation branch)
      → build + tests green
         → ONE PR, with audit checklist
            → gate (see below)
               → merge → baton rewritten → next unit
```

## Rules (absolute)

1. **One active implementation branch at a time.** The next branch does not start until the
   current PR is merged or closed.
2. **Scouts may inspect ahead — read-only.** Subagents may audit/explore the N+1 and N+2
   units' territory while branch N is active, but produce reports only: no edits, no branches,
   no commits.
3. **No recursive subagents.** The session spawns subagents; subagents never spawn their own.
4. **No live wallet/transaction changes without the security gates**: TestNet click-test +
   transaction watcher capture + `/security-pass` review + explicit owner approval — all four.
5. **No auto-merge for funds/wallet/claim/ASA paths.** PRs touching
   `server/services/chain/**`, purchase/claim/waitlist-payout handlers, `client/src/lib/algorand.ts`,
   `contexts/WalletContext.tsx`, or `ops/kestra/**` always wait for the owner, regardless of CI.
6. **Low-risk lanes may merge on green** (when the owner's standing merge-on-green directive is
   active): docs, UI mock panels, type-only changes, test-only changes — provided CI is green on
   the head commit and the diff stays inside the declared scope.
7. **Facts ripple.** Any branch that changes architecture facts must update
   `FRONTIER_ARCHITECTURE_TRUTH.md` / `FRONTIER_AGENT_REGISTRY.md` in the same PR.
8. **Never**: merge `wip/atomic-purchase` · point `ops/kestra/` at mainnet · rewrite history on
   `main` · delete branches without a triage entry · commit secrets or print `.env`.
9. **Every PR carries**: branch name, files touched, acceptance criteria, test evidence,
   merge gate (auto-on-green vs owner), owner action needed, rollback plan (revert commit is the
   default; state a manual plan when a revert isn't clean, e.g. migrations).

## Branch naming

- `docs/<topic>` — documentation/spec only
- `feat/<area>-<thing>` — features (UI panels, agents, systems)
- `fix/<area>-<bug>` — behavior fixes (always with a fails-before/passes-after test)
- `chore/<thing>` — mechanical (deps, config, CI)
- Session-designated `claude/...` branches remain valid when a session is bound to one.

## Gate matrix

| Change type | CI green | Owner review | Extra gates |
|---|---|---|---|
| Docs / specs | required | merge-on-green OK | — |
| UI panel (mock/read-only data) | required | merge-on-green OK | no mock data on live plot/HUD surfaces |
| Types / tests only | required | merge-on-green OK | — |
| Game logic (non-combat) | required | owner | unit tests for new logic |
| Combat / globe / economy math | required | owner | scoped audited unit only |
| Chain read paths | required | owner | `/security-pass` if auth-adjacent |
| Chain write paths (mint/transfer/claim) | required | **owner, explicit** | TestNet click-test + txn watcher capture + `/security-pass` |
| Anything mainnet-shaped | required | **owner, explicit** | `/mainnet-gate` PASS + `algo-auditor` pass |
