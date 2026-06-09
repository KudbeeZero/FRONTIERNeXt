---
name: human-audit-areas
description: Areas in FRONTIER chain code explicitly NOT deep-audited and where a human/paid audit is still required
metadata:
  type: project
---

Areas flagged as needing human / paid professional audit (not yet covered by an automated review pass):

- **Payment replay protection** — verifyAlgoPayment does not consume txIds; needs a designed dedup/UNIQUE-constraint solution. See [[verify-algo-payment]].
- **CoinGecko oracle** — USD→ALGO conversion staleness/bounds/zero-handling NOT reviewed in this pass. Where is plot USD price converted to ALGO, and is there a max-age + sanity bound + zero/negative guard?
- **Treasury split (25/25/50)** — `forwardLiquiditySplit` referenced in routes import but rounding/dust/sum-to-total NOT verified.
- **ASA params** — supply=10B, decimals=2 convention claimed in brief; NOT yet confirmed against asa.ts/schema.ts in a review.
- **Group transaction validation** — verifyAlgoPayment validates a SINGLE indexed txn, not an atomic group; if any flow relies on group composition, GroupSize/index checks were not reviewed.

**How to apply:** When asked whether the chain payment path is safe end-to-end, state these are unverified and require their own review or a paid audit. Do not imply full coverage from a single-function review.
