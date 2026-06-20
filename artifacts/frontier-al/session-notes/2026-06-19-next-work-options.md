# 2026-06-19 — Close out #69 + open a Next-Work Options menu

## Unit
Doc-only. Owner: "close this PR out, open a new one, and come up with several things we can work
on next." Merged #69 (faction/commander design doc), then opened one new doc PR that is a
**prioritized menu of candidate next units** across the whole project — a decision surface so the
owner can pick the next single unit.

## What happened
- **Merged #69** → `main` at **`2d55d8a`** (the faction economy & commander progression design doc).
- **`docs/NEXT_WORK_OPTIONS.md`** (NEW) — themed menu (Faction program WS-A..E · telemetry/dashboard ·
  security/hardening · globe · story mode · hygiene). Each item tagged effort (XS/S/M/L), gate
  (PR-gate / `/security-pass` / `/mainnet-gate`+`algo-auditor`), and ⚠️FUNDS where applicable.
  Cross-cutting recommendation: **commander-mint telemetry** (continue current lane) or **WS-A
  onboarding** (start faction program) — both S / no-funds.
- Baton rewrite (this PR = open, AWAITING_AUDIT) + this session note.

## Scope / safety
Docs only — `docs/**` + `session-notes/**`. No code/schema/migration/funds/wallet/treasury/ASA/
mint/deps. The menu starts nothing; owner picks. Funds items (WS-E, algod finality) flagged gated.

## Verification
Doc-only — no behavior to test. CI should stay green (`check`/`test`/`test:server` unchanged).

## Next
Owner picks one menu item → it becomes the next single PR. Recommended opener: commander-mint
telemetry or WS-A faction onboarding.
Carried: #65 globe visual click-test (owner-side); out-of-band main commit `9ce0962` (confirm intentional).
