# Algorand developer tooling — July 2026 snapshot

Researched 2026-07-05 (web, primary sources). What's current, and what it means for this repo.

## Where we stand

- **algosdk `^3.5.2`** — already on the v3 major (latest is 3.6.0, covered by our caret). v2 has been
  unmaintained since March 2025. **No migration needed.**
- We do **not** use `@algorandfoundation/algokit-utils`. Stable is **9.2.0** (algosdk-v3 compatible);
  **v10 is beta** (the May-2026 "decoupling" release — unified `AlgorandClient`, HD wallets, ARC-56).
  Optional adoption if the chain service is ever reworked; stay off the v10 beta for production.
- NFTs are pure **ARC-3** 1-of-1 ASAs. Still fully valid. Foundation guidance now recommends
  **ARC-3 + ARC-19** (template-ipfs reserve address) only if *mutable* metadata is wanted; **ARC-69 is
  being phased out**. No action required.

## The new "AI developer tools" (what the announcement was)

- **VibeKit** (Algorand DevRel, Feb 2026) — "the agentic stack for Algorand builders".
  `vibekit init` detects Claude Code / Cursor / VS Code and installs: Agent Skills, documentation
  MCPs, and development MCPs (chain access for accounts/assets/contracts). Keys stay in an OS
  keyring/Vault — never reach the LLM. https://www.getvibekit.ai/ · MIT.
- **Official docs MCP** (Kapa): `https://algorand-docs.mcp.kapa.ai/` — add as an HTTP server in
  `.mcp.json` for in-editor Algorand docs.
- **Agent skills**: https://github.com/algorand-devrel/algorand-agent-skills
- **llms.txt**: `https://dev.algorand.co/llms-small.txt` / `llms-full.txt`.
- Umbrella releases: AlgoKit 3.0 (2025: TypeScript smart contracts, debugger) → **AlgoKit 4.0**
  (H1 2026: AI-optimized tooling, native SDKs via `algokit-core`). AlgoKit CLI itself is v2.10.x.
- **Lora** (`https://lora.algokit.io`) is the standard explorer (AlgoExplorer is dead); it can also
  fund TestNet accounts.

## Endpoints & faucets (TestNet)

- Our defaults (`server/services/chain/client.ts`): `testnet-api.algonode.cloud` /
  `testnet-idx.algonode.cloud` — still work; the currently *documented* Nodely free-tier hosts are
  `testnet-api.4160.nodely.dev` / `testnet-idx.4160.nodely.dev` (override via `ALGOD_URL` /
  `INDEXER_URL`, no code change needed).
- Faucets: `https://bank.testnet.algorand.network` (Google sign-in) · Lora "fund account" ·
  programmatic `algokit dispenser fund`.

## TestNet NFT smoke test (this repo)

`pnpm --filter @workspace/frontier-al run smoke:testnet` (`script/testnet-nft-smoke.ts`) mints one
plot NFT, one commander NFT, one weapon NFT through the real chain service and records a sub-parcel
upgrade note, printing Lora/allo.info links. Needs `ALGORAND_ADMIN_MNEMONIC` +
`ALGORAND_ADMIN_ADDRESS` + `ALGORAND_NETWORK=testnet` and ≥1 TestNet ALGO; it refuses to run on
mainnet and writes nothing to the database. Sub-plots have no NFT by design — they live in game
state, anchored on-chain via the upgrade-note transaction (`recordUpgradeOnChain`).
