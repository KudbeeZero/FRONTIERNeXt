# Session Notes

This directory contains running notes from all development sessions.

Each file is named by date: `YYYY-MM-DD.md`

Use these notes to track decisions, context, and progress across sessions.

---

## Index

- [2026-03-16](./2026-03-16.md) — Checkly removal, session notes setup, base URL status
- [2026-03-16-faction-alignment](./2026-03-16-faction-alignment.md) — Faction alignment system (backend + frontend)
- [2026-03-16-faction-todos](./2026-03-16-faction-todos.md) — Faction bug fix, cooldown, TopBar badge, leaderboard
- [2026-03-17](./2026-03-17.md) — Find Plot button in SubParcelGrid (subdivision UI)
- [2026-03-17-frntr-emissions-test](./2026-03-17-frntr-emissions-test.md) — Centralized FRNTR emission config; testing rate raised to 50 FRNTR/day per parcel
- [2026-03-17-terraforming-state-sync](./2026-03-17-terraforming-state-sync.md) — Terraforming state sync; same land identity, no burn/remint, dynamic metadata
- [2026-03-18-commander-mint-delivery](./2026-03-18-commander-mint-delivery.md) — Commander mint delivery fix; ghost mint resolved; NFT status polling + claim UI
- [2026-06-07-provably-fair-markets](./2026-06-07-provably-fair-markets.md) — Provably-fair prediction markets: deleted admin-chosen outcome; derived/hashed resolution + proof endpoint
- [2026-06-07-veritas-grind-engine](./2026-06-07-veritas-grind-engine.md) — VERITAS verification grind engine (first increment): in-repo CLI harness; market flow re-verifies the trustless resolver
- [2026-06-13-mainnet-readiness-flow](./2026-06-13-mainnet-readiness-flow.md) — Mainnet-readiness workflow layer (PR #21): /pr-gate, /security-pass, /mainnet-gate, /test-matrix, stronger /end-session + flow doc; relay #18–#21
- [2026-06-13-route-loop-integration-test](./2026-06-13-route-loop-integration-test.md) — Client route-layer loop integration test (PR #22): real App/wouter via react-dom/server ssrPath; boot, '/', '/game' mount, 404 fallback; #21 merged, #16 closed
- [2026-06-13-gamelayout-entry-state](./2026-06-13-gamelayout-entry-state.md) — Real GameLayout entry-state coverage (PR #23): wallet-gate / game-error / wallet-restoring / shell-mount via react-dom/server; WebGL+effects out of scope; #22 merged
- [2026-06-13-gamelayout-connected-shell](./2026-06-13-gamelayout-connected-shell.md) — Connected GameLayout shell coverage (PR #24): connected wallet reaches real shell; top-bar/bottom-nav render; SSR (no jsdom); real 3D/socket/effects out of scope; #23 merged
- [2026-06-13-route-loop-server](./2026-06-13-route-loop-server.md) — Server route-loop auth/ownership hardening + tests (PR #25): extracted evaluateOwnership (single source of truth) + 6-case spec (auth/replay/malformed/safe-error); /security-pass PASS; #24 merged
- [2026-06-14-actions-idempotency-nonce](./2026-06-14-actions-idempotency-nonce.md) — Action idempotency-nonce guard (PR #26): createActionIdempotencyGuard applied to claim-frontier (player+action scoped, fail-closed) + action_nonces table/0006 + 8-case spec; /security-pass PASS; #25 merged
- [2026-06-14-actions-idempotency-extend](./2026-06-14-actions-idempotency-extend.md) — Extend idempotency guard to build & upgrade (PR #27): added target dimension to the key (player+action+target+nonce), enforced before spend (400/409/503 fail-closed) + 11-case spec; /security-pass PASS; #26 audited PASS + merged
