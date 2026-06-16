---
name: mainnet-gate
description: READ-ONLY mainnet-readiness gate for FRONTIER-AL. Run before anything ships to (or is configured for) Algorand mainnet. Verifies no testnet/dev constants are silently used in production, and checks Algorand network config, ASA/app IDs, treasury/admin wallet envs, mnemonic handling, opt-in flows, transaction confirmation/finality, duplicate-purchase protection, NFT/token delivery, and failure rollback behavior, plus the deployment env checklist. Emits PASS / CONCERNS / FAIL. It CANNOT mark PASS unless each checked item is backed by a concrete command, test, or doc reference (a claim without evidence is at best CONCERNS). It does not change code, move funds, or point anything at mainnet — it only inspects and reports. This is the concrete implementation of the "mainnet-gate" gate referenced in CLAUDE.md; for the deep funds-economic review it defers to the algo-auditor gate.
---

# /mainnet-gate — mainnet-readiness gate (read-only, evidence-backed)

The last gate before mainnet. It inspects configuration and the funds/NFT path
and emits **PASS / CONCERNS / FAIL**. It is **read-only**: it never edits code,
moves funds, opts in, or repoints any endpoint at mainnet. Critically, it
**cannot PASS on assertion** — every green item must cite a command, test, or doc.

## When to use
- Before deploying to mainnet, or before flipping any config from testnet to
  mainnet.
- As a recurring pre-release check while mainnet prep is in flight.

## Hard rule
This skill never performs a mainnet mutation. Per CLAUDE.md off-limits: nothing
points at mainnet without this gate, and no funds/ASA/transfer code ships without
an **`algo-auditor`** pass — `/mainnet-gate` complements, not replaces, that.

## Checklist (each → PASS/CONCERNS/FAIL + the evidence: command / test / doc:line)

1. **No testnet/dev constants in prod** — `ECONOMY_MODE` resolves to `production`
   in the deploy env (testing rates: 50 ASCEND/day, commander 10/25/50 are NOT
   live values); no hardcoded testnet algod/indexer URLs on the prod path.
   Evidence: grep `shared/economy-config.ts`, env checklist.
2. **Algorand network config** — algod/indexer point at mainnet for prod; genesis
   id/hash correct; no testnet fallback silently used.
3. **ASA / app IDs** — `$ASCEND` ASA id and any app ids are the mainnet ids, set
   via env, not testnet literals committed in code.
4. **Treasury / admin wallet envs** — admin/treasury addresses set via env and
   present; not a dev placeholder; `ADMIN_KEY` set (so `requireAdminKey` fails
   closed — see `server/security.ts`).
5. **Mnemonic handling** — admin mnemonic only via secret manager/env, never in
   repo, logs, or client; not echoed.
6. **Opt-in flows** — ASA opt-in is required/handled before transfer (claim,
   delivery); idempotent; failure surfaced not swallowed.
7. **Transaction confirmation / finality** — payment verification confirms real
   on-chain finality (algod cross-check, not indexer-`confirmed-round` only);
   rejects close-remainder/rekey riders. (Indexer-only is a CONCERNS at minimum.)
8. **Duplicate-purchase protection** — replay guard (`redeemedPayments`) active
   and migration `0005_redeemed_payments.sql` applied (else paid purchases 503);
   mints idempotent.
9. **NFT / token delivery** — mint→deliver path has retry + ownership binding;
   custody/transfer correct; no lost-NFT on partial failure.
10. **Failure rollback behavior** — on transfer/mint failure, in-game state is
    rolled back or reconciled (e.g. ASCEND restore), no double-spend or ghost grant.
11. **Deployment env checklist** — `docs/DEPLOYMENT_ENV_CHECKLIST.md` /
    `ENV_VARS.md` complete; all required secrets enumerated; `validate-env.js`
    passes.

## Verdict
- **PASS** — every item green AND backed by evidence (command/test/doc). No item
  may be green by assertion.
- **CONCERNS** — a non-blocking gap, an indexer-only finality, or an item that is
  plausibly fine but lacks evidence. Stop and surface to the owner.
- **FAIL** — a testnet constant on the prod path, a missing replay guard/migration,
  a secret in repo/logs, fail-open admin gating, or any unmitigated funds risk.

## Output
```
Verdict: PASS | CONCERNS | FAIL
Checklist: <table: item → verdict → evidence (command/test/doc:line)>
Blockers: <each FAIL/CONCERNS with what would clear it>
Next:    <algo-auditor for funds-economic depth; owner setup; re-run after fixes>
```

## Invariants
- Read-only; no mainnet mutation, ever.
- No PASS without evidence — assertions are CONCERNS at best.
- Defers funds-economic depth to `algo-auditor`; both must pass before funds move.
