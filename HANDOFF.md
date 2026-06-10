# HANDOFF

## 2026-06-10 — Bomb Squad (night shift)

**Branch:** `claude/bomb-squad-shift-86t0dt` · **Report:**
`night-reports/BOMB-SQUAD-2026-06-10.md` (full device diagrams, attacker
traces, runbooks)

No prior NIGHT-AUDIT existed; targets came from the standing list + fresh
recon. Three money-path defects defused, zero reverts, all in
`artifacts/frontier-al`:

1. **NFT delivery hijack** — public `/api/nft/deliver*` endpoints could
   transfer custody-held paid-for NFTs to any opted-in attacker. Now gated
   on exact owner-wallet match (`evaluateNftDeliveryClaim`, `security.ts`).
2. **Payment replay** — one ALGO payment could buy unlimited
   plots/commanders. Now claim-once via `redeemed_payments`
   (**⚠️ staged migration `0005_redeemed_payments.sql` must be applied
   BEFORE deploy — guard fails closed with 503 otherwise**). Bonus fix:
   `verifyAlgoPayment` tx-type check was incompatible with algosdk v3
   camelCase models (would have 402'd every real payment).
3. **resolveBattles concurrency** — double-resolution and
   purchase-erased-by-battle races closed with atomic conditional claims in
   `resolveBattles`/`deployAttack`/`purchaseLand` (+ mem parity).

Verification: tsc clean · 194 server tests green (28 new) · build green.
All chain interaction mocked; no migration executed.

**For the day shift (priority):** ungated `POST /api/orbital/trigger` +
`/api/orbital/resolve/:id` (one-line `requireAdminKey` fix);
weapon-mint caller-supplied receiver address; enforce
`WALLET_AUTH_REQUIRED` in prod at boot. Full list + long-term
recommendations in the night report.

### Recon dossier for the NEXT shift — `night-reports/RECON-DOSSIER-2026-06-10.md`

After the three defusals I ran a read-only recon pass (5 parallel agents,
every CRITICAL/HIGH hand-verified against current code — several subagent
findings were wrong and are listed as REFUTED so they aren't chased). No code
changed. It organizes the remaining work into target *packages*:

- **A — economic-writer concurrency (HIGH):** the SAME non-atomic
  read-modify-write class as tonight's resolveBattles fix recurs in
  `claimWinnings` (double payout), `placeBet`, `purchaseSubParcel`,
  `fillTradeOrder`. One cut pattern fixes all.
- **B — missing fail-closed boot guards (HIGH):** `SESSION_SECRET`,
  `WALLET_AUTH_REQUIRED`, `PUBLIC_BASE_URL` all degrade silently instead of
  refusing to boot in prod.
- **C — authz coverage gaps (CRITICAL):** `MUTATION_PATH_RE` doesn't cover
  `/api/orbital|weapons|nft|game`; orbital ungated, weapons mint receiver,
  retry-commander body playerId.
- **D — stuck-NFT / transfer-queue recovery gaps (HIGH):** manual-recovery-only
  failure paths in the fire-and-forget mint/deliver/transfer lifecycle.
- **E — tokenomics (MED, mainnet-gating):** no FRNTR supply cap, non-atomic
  treasury settlement, listing route bypasses its `min(1)` schema.

Verified SAFE (don't re-investigate): WS per-viewer scoping, economy-mode
read-once, welcome-bonus/claimFrontier atomicity, EdDSA, auth address handling.
Suggested next-shift order is at the bottom of the dossier.
