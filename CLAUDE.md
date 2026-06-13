# CLAUDE.md — standing instructions

This repo is worked on across many short-lived chat sessions. Follow the
**Session Relay Protocol** ([docs/SESSION_PROTOCOL.md](./docs/SESSION_PROTOCOL.md)):
**one chat = one reviewed PR**, and the handoff between chats is an audited
artifact, not trust.

## Every chat

1. **Read first.** Read the baton ([docs/HANDOFF.md](./docs/HANDOFF.md)) and
   memory before doing anything. The baton is the single source of truth for
   what's next.
2. **Start with `/handoff-audit`.** Independently audit the previous chat's PR
   (diff vs. claims, run the tests, check scope/security) and gate the merge:
   PASS → merge + start this chat's branch; CONCERNS → ask; FAIL → don't merge.
3. **Do exactly one unit of work** on this chat's branch.
4. **End with `/closeout`.** Commit, confirm tests green, open **exactly one** PR
   into `main` with an Audit checklist, and rewrite the baton. The final baton
   commit must **not** use `[skip ci]`.

## Invariants

- **One open PR at a time.** Don't start new work until the previous PR is
  audited and merged.
- **Nothing lands on `main` unreviewed.**
- **Never over-claim** — a result is not "validated" unless a test backs it. Say
  "untested" when it is.

## Reply format (keep it short)

End substantive replies with:

```
Summary: <what changed — and does it actually work, test-backed or not?>
Next:    <do I test it now, or what's the next unit / branch?>
```

## App-specific rules

This file governs the **chat loop**. For application rules (the FRONTIER-AL
Algorand game — architecture, HARD RULES on pricing/finality/atomic delivery,
the `algo-auditor` and `mainnet-gate` gates), defer to
[`artifacts/frontier-al/CLAUDE.md`](./artifacts/frontier-al/CLAUDE.md). If the two
ever conflict, the app file wins on app matters; this file wins on the chat loop.

## Mainnet readiness flow

On the road to Algorand mainnet, a workflow layer of process gates sits on top of
the chat loop — see [`docs/MAINNET_READINESS_FLOW.md`](./docs/MAINNET_READINESS_FLOW.md).
The skills: `/pr-gate` (mechanical pre-merge go/no-go), `/security-pass` (surgical
security review — fix + test + document), `/mainnet-gate` (read-only PASS/CONCERNS/
FAIL mainnet check, the concrete impl of the gate referenced above), `/test-matrix`
(visible coverage grid), and `/end-session` (safe stop + dated session note). They
are process only — they do not change game behavior. Nothing reaches mainnet
without a PASS from `/mainnet-gate` **and** an `algo-auditor` pass.
