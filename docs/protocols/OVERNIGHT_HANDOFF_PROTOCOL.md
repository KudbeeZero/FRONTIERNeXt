# Overnight Handoff Protocol (v1 — superseded)

> **Superseded by `SESSION_HANDOFF_PROTOCOL.md` (v2) — do not follow this document
> for new repos; use v2 §8 to replicate.** In particular, ignore this file's
> "Replicating to Another Repo" section (it predates the config file and tells you
> to edit paths inside the skills). Kept for reference: v2 generalizes this
> protocol by moving every repo-specific path, command, and policy into
> `handoff.config.md`, and adds the PR layer (`/pr-shepherd`), the formal
> `/shift-audit`, and the universalized `/agent-review` roster.

A repo-agnostic protocol for running two shifts on one codebase: a **day shift**
(human + interactive agents) and a **night shift** (an autonomous agent checking in
on a fixed interval). Nobody reads walls of text: the day ends with one command,
the night runs itself, and the morning starts with one short brief and
multiple-choice decisions.

---

## The Three Artifacts

| Artifact | Owner | Purpose |
|---|---|---|
| **NIGHT_QUEUE.md** | Day shift writes, night shift consumes | Rated backlog of safe, self-contained work items |
| **NIGHT_BOARD.md** | Night shift writes, day shift reads | Single live status board, readable in under 30 seconds |
| **Skills** (`/handoff`, `/night-shift`, `/morning`) | Both | The protocol's verbs |

In this repo the queue and board live at `artifacts/frontier-al/docs/handoff/`.
When replicating to another repo, put them wherever that repo keeps its docs.

## The Three Verbs

### `/handoff` — end of day
Run once when the day shift wraps. It:
1. Summarizes the day's commits since the last handoff.
2. Updates the project memory file (current state + next steps sections).
3. Populates **NIGHT_QUEUE.md** with rated work items drawn from the repo's plans.
4. Resets **NIGHT_BOARD.md** for tonight (date, empty cycle log, queue snapshot).

### `/night-shift` — the recurring cycle
Run on a loop (`/loop 30m /night-shift`). Each cycle:
1. Read the board and the queue. Continue the in-progress item, or pick the
   highest-rated unstarted one.
2. Build it on a dedicated `claude/night/<item>` branch.
3. Verify: the repo's check, test, and build commands must pass before stopping.
4. Push the branch and update the board (one line per cycle).
5. If blocked, log the blocker as a pre-framed multiple-choice decision on the
   board and move to the next item — never improvise around a blocker.

### `/morning` — day pickup
Run when the day shift returns. It reads the board, gives a five-line brief
(what shipped, what's in flight, what's blocked), then surfaces each waiting
decision as a multiple-choice question with rated options.

## Rating Tiers

Every queue item and every decision option carries one of three tiers:

- **Highly Recommended** — fully specced in a plan/LUT, low risk, clear verification.
- **Recommended** — solid idea, minor ambiguity the night shift can resolve sensibly.
- **Experimental** — speculative, or could conflict with day-shift work; build only
  when nothing higher-rated remains, and flag prominently on the board.

The night shift works the queue top-tier-first. The morning brief presents
decisions the same way, with the recommended option listed first.

## Night-Shift Guardrails (hard rules)

The night shift **builds autonomously** but never:
- merges to `main` or any shared branch — all work stays on `claude/night/*` branches;
- deploys, releases, or touches production infrastructure;
- edits secrets, `.env` files, or credentials;
- runs database migrations against shared environments;
- force-pushes or rewrites history on branches it didn't create;
- continues past a failing check/test/build — fix it or log it as a blocker.

Every cycle ends with the board updated, even (especially) a failed one.

## Scheduling

The cadence is a live-session loop, not a cron job: `/loop 30m /night-shift`.
If the session hosting the loop is reclaimed, nothing is lost — the board holds
all state, and restarting is the same one command from any new session.

## Replicating to Another Repo

1. Copy `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md` (this file) and the three
   skill directories from `.claude/skills/` (`handoff`, `night-shift`, `morning`).
2. In each skill, update the paths to the target repo's docs location, memory
   file, and plan documents, plus its verify commands (check/test/build).
3. Create an empty `NIGHT_QUEUE.md` and `NIGHT_BOARD.md` in the target repo's
   docs directory (the skills will populate them).
4. Add a one-paragraph pointer to this protocol in the target repo's CLAUDE.md.
5. Run `/handoff` once to seed the first queue, then `/loop 30m /night-shift`.
