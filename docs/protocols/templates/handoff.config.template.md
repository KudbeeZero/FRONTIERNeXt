# Handoff Config — <PROJECT NAME>

> Per-repo configuration for the Session Handoff Protocol
> (`SESSION_HANDOFF_PROTOCOL.md`). Every protocol skill reads this file first and
> takes all paths, commands, and policy from here. Fill in every key; delete
> nothing — if a key doesn't apply, say so explicitly (e.g. `ci: none`).

## Identity

- `project`: <name + one line: monorepo? where does the app live?>
- `rules_file`: <path to CLAUDE.md or equivalent conventions file>

## Artifact locations

- `handoff_dir`: <directory for NIGHT_QUEUE.md, NIGHT_BOARD.md, SHIFT_AUDIT_<date>.md, agent-runs/, agent-memory.md>
- `memory_file`: <path to the project memory / current-state document>
- `session_notes_dir`: <directory for dated session notes, or `none`>
- `plan_sources`: <where specced work lives: plan docs, backlog files, issue labels>

## Verification

- `workdir`: <directory verify commands run from>
- `baseline_command`: <command that establishes a clean dependency baseline, e.g. `pnpm install --frozen-lockfile`, `npm ci`, `cargo fetch --locked`>
- `verify_commands`: <typecheck> · <tests> · <build> — ALL must pass before a cycle ends

## Branching & PRs

- `branch_prefix`: <e.g. `claude/night` — all autonomous work stays under this prefix>
- `pr_policy`: <`branches-only` | `draft-prs` | `ready-prs` — see protocol §6>
- `ci`: <CI system and where its config lives, or `none`>

## Multi-agent review

- `stack_profile`: <one line per tier of the stack; name ONE stack seat specialty, e.g. "stack seat: payments/Stripe">
- `review_roster_size`: <breadth agents + 1 synthesizer; default 9 + 1, shrink for small repos>

## Repo-specific hard rules (in addition to protocol guardrails)

- <rules autonomous agents must never break in THIS repo>
