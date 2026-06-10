# NIGHT SHIFT AUDIT — <date>

Shift ran <N> cycles (<ended naturally | ended early by owner at HH:MM>).

## Deliverables (review-ready — nothing merged to shared branches)

| Branch / PR | Contents | Verification |
|---|---|---|
| `<branch>` | <what + size> | <typecheck · tests · build results> |

## Guardrail compliance

- [ ] No pushes/merges to main or shared branches (base unchanged at `<commit>`)
- [ ] No deploys, no migrations, no `.env`/secret/credential files touched (diff-audited)
- [ ] No force-pushes; only branches created this shift were written to
- [ ] Every cycle ended with checks green and the board updated
- [ ] Working tree clean at shift end; all branches in sync with origin

## Incidents & lessons

1. <what happened, time lost, rule adopted — promote durable ones to agent-memory L4>

## Backlog for next shift (NIGHT_QUEUE.md is the live copy)

| Rating | Item | Note |
|---|---|---|

## Decisions waiting for the owner (also on NIGHT_BOARD)

1. <decision — options rated, Highly Recommended first>

## Next shift setup

1. Day shift: `/morning`, then review/merge night branches.
2. End of day: `/handoff`.
3. Arm the night: `/loop 30m /night-shift` from any session — state lives entirely
   in the handoff dir; nothing depends on this session surviving.
