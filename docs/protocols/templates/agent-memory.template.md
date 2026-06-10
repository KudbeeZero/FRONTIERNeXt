# AGENT MEMORY — <project> multi-agent runs

> Layered shared memory for `/agent-review`. All agents read this before working.
> Coordinator prunes; keep under ~150 lines, newest-first within each layer.

## L4 — Lessons & patterns (durable)

- <verification workflow, stack gotchas, rules adopted from incidents>

## L3 — Quantum (cross-run predictions)

- <dependency insights, "this will fire when X ships" predictions>

## L2 — Audited headlines (<date> <focus>, verified against code)

- <finding ID + severity + one line — only findings that survived audit>

## L1 — Run index

- **<date> <focus>** — <N> agents; <raw> findings → <verified> verified.
  Artifacts: `agent-runs/<date>-<focus>/`
