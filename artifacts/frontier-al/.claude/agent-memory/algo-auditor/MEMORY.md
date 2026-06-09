# Algorand Auditor Memory — FRONTIER (Ascendancy)

- [algosdk v3 indexer response shape](algosdk-v3-indexer-shape.md) — .do() returns typed class instances (camelCase, bigint), kebab keys never exist.
- [verifyAlgoPayment invariants](verify-algo-payment.md) — single verifier for plots + commander mints; server-authoritative price; replay gap.
- [Areas needing human/paid audit](human-audit-areas.md) — payment replay, oracle, treasury split not yet deep-audited.
- [txID covers all fields](txid-covers-all-fields.md) — v3 txID() hashes rekey/close/aclose/grp/sender/amt/asset; txID-match is a sound never-trust-client guarantee.
- [Atomic plot-purchase invariants + gaps](atomic-plot-purchase.md) — /prepare+/submit good patterns; HIGH mint-on-prepare DoS (no rate limit), shared-sp lastValid, WALLET_AUTH_REQUIRED caveat.
- [/submit DB-failure recovery](atomic-purchase-submit-recovery.md) — idempotent /submit retry recovers (status stays 'prepared'); real brick only post-algod-retention; no reconciler.
- [/submit confirmation hazard](submit-confirmation-hazard.md) — HIGH: 402 "funds not taken" is false when group already in pool; bare waitForConfirmation(4 rounds); in-window retry recovers, post-validity tail does not.
