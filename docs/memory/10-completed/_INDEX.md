# 10 — Completed Lanes

> Index of lanes that have reached a merged, verified state. Each completed lane
> gets its own closeout block written by KILO at closeout (see
> `SESSION_UPDATER.md`). This `_INDEX.md` is the table of contents; individual
> blocks live in sibling `<lane-name>.md` files in this directory.

## Format

Every completed-lane file follows:

```
# <lane-name> — Completed
- Branch / Base / PR / Merge SHA / Date
- What changed
- Verified (test/CI evidence, or "untested")
- Confidence: high | medium | low
- Restricted systems touched: none | <list>
- Notes
```

## Completed lanes

| Lane | PR | Merge SHA | Date | Confidence |
|---|---|---|---|---|
| mobile-globe-touch-regression | #265 | `ba2e71f` | 2026-07-14 | high |
| mobile-plot-sheet-independent-close | #264 | `eac4a2a` | 2026-07-14 | high |
| mobile-globe-touch-interaction | #263 | `18da3b9` | 2026-07-14 | high |
| nft-metadata-proxy | #260 | `36fbf6c` | — | high |
| battle-planner-outcome-preview | #266 | `affaa52` | 2026-07-14 | high |
| battle-planner-globe-attack-path | #267 | `b96f273` | 2026-07-14 | high |
| battle-planner-draft-persistence | #268 | `88ff4ff` | 2026-07-14 | high |

> Detailed per-lane closeout blocks for the above are backfilled on demand. This
> index is seeded from `docs/HANDOFF.md` (the baton's "DONE & MERGED" history)
> so the structure exists and the closeout format is demonstrable. New lanes
> write their own `<lane-name>.md` at closeout.
