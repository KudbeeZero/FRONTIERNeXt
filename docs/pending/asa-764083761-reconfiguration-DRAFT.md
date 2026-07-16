# PENDING — consolidated ASA doc (not yet its own PR)

> Preserved here so the work is not lost. This content was written during the
> 2026-07-16 /ship run but that run pivoted to the token-leak fix before opening
> the docs PR. Re-home this into `artifacts/frontier-al/docs/audit/` in a later
> docs-only /ship unit, then delete this pending file.

---

# 2026-07-16 — ASCEND Token ASA 764083761 reconfiguration (owner-only, on-chain)

> **Status:** OWNER ACTION REQUIRED — out-of-repo, on-chain. **No signing scripts,
> keys, or transaction code are staged in this repository.** This document is a
> checklist only; it does not itself change any on-chain state.
>
> Consolidates two duplicate stranded drafts (`session/agent_d60fbfc0` and
> `session/agent_bb0af933`) into one canonical checklist. See
> `docs/HANDOFF.md` → "Owner-only follow-up" for the lane context.

## Target asset
- **Asset ID:** `764083761` (ASCEND Token / fungible ASA)
- **Network:** Algorand TestNet (per current `fly.toml`; MainNet only behind
  `/mainnet-gate` PASS + `algo-auditor` PASS — see HARD RULES).

## Why
The ASA's on-chain `assetURL` currently points at a dead Replit placeholder.
It should resolve to the live metadata endpoint:
- **New `assetURL`:** `https://frontierprotocol.app/nft/metadata/ascend`
  (the metadata route itself was shipped in PR #262 — `/nft/metadata/ascend`).

This is an **owner-signed `asset_config` transaction** by the ASA manager. It is
intentionally NOT an app-code PR and is NOT bundled with any code change.

## Pre-execution validation
- [ ] Confirm ASA `764083761` exists and inspect current config:
      `goal clerk assetinfo --assetid 764083761` (or indexer API).
- [ ] Confirm the signing wallet holds the **manager** role for the ASA.
- [ ] Record current field values (manager / reserve / freeze / clawback,
      unit-name, asset-name, total supply, decimals) before any change.
- [ ] Confirm the new `assetURL` resolves 200 before signing:
      `curl -sS https://frontierprotocol.app/nft/metadata/ascend`.

## Execution (owner-signed, out-of-repo)
- [ ] Prepare an `assetConfig` transaction changing only `assetURL` to
      `https://frontierprotocol.app/nft/metadata/ascend` (leave manager/reserve/
      freeze/clawback unchanged unless a separate, deliberate decision is made).
- [ ] Sign with the manager key (secrets manager / hardware wallet — never commit
      a mnemonic to this repo).
- [ ] Broadcast to TestNet.
- [ ] Record **Transaction ID / Hash:** `________________`
- [ ] Record **Timestamp (UTC):** `________________`

## Post-execution verification
- [ ] Re-run `goal clerk assetinfo --assetid 764083761` and confirm the new
      `assetURL` is live on-chain.
- [ ] Confirm the asset is discoverable via the indexer and appears correctly in
      wallet balance / metadata queries.
- [ ] Confirm no MainNet constants were referenced in any test/dev code.

## Rollback / failure modes
- [ ] If the config tx fails, no state changed — re-verify manager role and retry.
- [ ] If a wrong field was changed, prepare a corrective `assetConfig` tx restoring
      the recorded original value.
- [ ] Never point any `ops/kestra/` job or config at MainNet as part of this.

## Sign-off
- **Executor:** ________________
- **Date:** ________________
- **Result:** ☐ PASS  ☐ FAIL  ☐ PARTIAL
- **Notes:**
