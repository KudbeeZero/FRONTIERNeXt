# Workflow Session Updater

> **Status:** LIVE (confirmed double-green run as of 2026-07-14)

The Workflow Session Updater is the mechanism that takes KILO's **Session Update Block** and writes it into the FRONTIERNeXt Memory Layer in Drive.

---

## Purpose

After every KILO session closes out, the Session Update Block must be processed into two Drive destinations:

| Destination | Drive Location | What Gets Written |
|---|---|---|
| Memory Index | `00 — Index & Current State / CURRENT — FRONTIER Memory Index` | Current commit, latest PR, launch verdict, active blocker, owner action |
| Lane Closeout | `10 — Completed Lanes` | Full closeout record for the merged or completed lane |

This keeps the memory layer current so the next session (KILO or Perplexity) starts with verified state — not stale Drive documents.

---

## Trigger

The session updater is triggered **manually by the owner** after KILO emits the Session Update Block.

Steps:
1. KILO emits the Session Update Block at session end (see `KILO_RUNNER_PROMPT.md`).
2. Owner copies the block.
3. Owner pastes into the Workflow Session Updater prompt (Perplexity Space: `Frontier AL`).
4. Perplexity parses the block and writes:
   - Memory Index fields to Drive `00 — Index & Current State`
   - Lane closeout entry to Drive `10 — Completed Lanes`
5. Owner confirms the writes are visible in Drive.

---

## Session Updater Prompt (Copy-Paste)

Paste the following into the `Frontier AL` Perplexity Space, immediately followed by the Session Update Block:

```
Process this Session Update Block into the FRONTIERNeXt Memory Layer.

1. Update the Memory Index in Drive `00 — Index & Current State / CURRENT — FRONTIER Memory Index`:
   - Current commit
   - Latest completed PR
   - Launch verdict
   - Active blocker
   - Owner action now

2. Write a lane closeout entry to Drive `10 — Completed Lanes`:
   - Use the lane name as the document title
   - Include all fields from the Lane Closeout section of the block
   - Append the date prefix: YYYY-MM-DD

3. Confirm both writes with exact Drive file names and field values.

[PASTE SESSION UPDATE BLOCK HERE]
```

---

## Verification

After each updater run, confirm:

- [ ] Memory Index shows the correct current commit SHA
- [ ] Memory Index shows the correct latest PR number and title
- [ ] Memory Index launch verdict matches current repo state
- [ ] Memory Index active blocker is accurate or NONE
- [ ] Lane closeout entry exists in `10 — Completed Lanes` with correct date prefix
- [ ] No stale data from a prior session remains as the "current" state

---

## Known State

- **2026-07-14:** Session updater ran twice, both green. Workflow confirmed operational.
- Next verification: after the next KILO lane closes out.

---

## Failure Mode

If the updater run is red or the Drive writes do not appear:

1. Do not mark the lane as complete in the Memory Index.
2. Retain the Session Update Block — do not discard it.
3. Re-run the updater prompt with the retained block.
4. If still failing, escalate to owner for manual Drive update.

---

## Files

| File | Purpose |
|---|---|
| `docs/memory/KILO_RUNNER_PROMPT.md` | Full KILO session bootstrap and Session Update Block format |
| `docs/memory/WORKFLOW_SESSION_UPDATER.md` | This file — updater trigger, prompt, and verification |
