# Mainnet Readiness Flow

> A workflow layer of Claude Code skills that hardens FRONTIER-AL on the road to
> Algorand **mainnet**. It sits **on top of** the [Session Relay Protocol](./SESSION_PROTOCOL.md)
> (the per-chat audited-PR loop) and the app's [HARD RULES](../artifacts/frontier-al/CLAUDE.md).
> These are process gates — they do not change game behavior.

## The gates at a glance

| Skill | When | Mutates? | Output |
|---|---|---|---|
| [`/handoff-audit`](../.claude/skills/handoff-audit/SKILL.md) | chat START | merges prev PR on PASS | PASS / CONCERNS / FAIL + `docs/audits/<branch>.md` |
| [`/test-matrix`](../.claude/skills/test-matrix/SKILL.md) | during a unit | adds in-scope tests only | a visible coverage grid (covered/partial/missing/blocked) |
| [`/security-pass`](../.claude/skills/security-pass/SKILL.md) | touching auth/funds/admin/input | fixes + tests, no broad refactor | checklist + dated report in `artifacts/frontier-al/docs/audit/` |
| [`/pr-gate`](../.claude/skills/pr-gate/SKILL.md) | before merge / before a 2nd PR | read-only | Summary / Evidence / Blockers / Next (GO / NO-GO) |
| [`/mainnet-gate`](../.claude/skills/mainnet-gate/SKILL.md) | before mainnet config/deploy | read-only | PASS / CONCERNS / FAIL (evidence-backed) |
| `algo-auditor` | any funds/ASA/transfer change | read-only review | funds-economic verdict (referenced by CLAUDE.md) |
| [`/closeout`](../.claude/skills/closeout/SKILL.md) | chat END | one PR + baton | PR into `main` + `AWAITING_AUDIT` baton |
| [`/end-session`](../.claude/skills/end-session/SKILL.md) | session END | session note (+ closeout if needed) | dated `session-notes/` record + handoff report |

## How a unit flows

```
START ─▶ /handoff-audit          (gate the previous PR; merge on PASS, then branch)
       │
       ├─ do ONE unit of work
       │   ├─ /test-matrix        (see what this change covers / leaves uncovered)
       │   └─ /security-pass      (IF it touches auth, wallets, payments, admin, input)
       │
       ├─ /pr-gate                (mechanical go/no-go BEFORE merging — refuses duplicate/red/unknown)
       │
END ───▶ /closeout  ─▶  /end-session   (one PR, baton rewritten, dated session note)
```

## The mainnet promotion gate

Before **any** mainnet configuration or deploy, two gates must clear — and
neither may pass on assertion:

1. **`/mainnet-gate`** (read-only) → must be **PASS**, with every item backed by a
   command, test, or doc. CONCERNS or FAIL stops the promotion.
2. **`algo-auditor`** → required for anything funds/ASA/transfer-moving. No
   funds-moving phase ships without it.

Both are read-only. They never repoint config at mainnet, move funds, or opt in —
those are owner actions taken only after a clean gate.

## Standing guardrails (from CLAUDE.md — unchanged here)
- One open PR at a time; nothing lands on `main` unreviewed.
- Never over-claim — "validated" requires a test; otherwise say "untested".
- Off-limits: nothing in `ops/kestra/` points at mainnet; no funds/ASA/transfer
  code to mainnet without `mainnet-gate` **and** `algo-auditor`; do not merge
  `wip/atomic-purchase`.

## Why these exist
The transaction surface is funds-bearing. Testnet hides failure modes that cost
real ALGO on mainnet (indexer-only finality, missing replay guards, testnet
constants leaking into prod, fail-open admin gating, secrets in logs). This flow
makes those checks explicit, repeatable, and evidence-backed instead of relying
on memory between short-lived chats.
