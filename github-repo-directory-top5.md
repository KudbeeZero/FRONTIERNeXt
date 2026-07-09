# KudbeeZero GitHub Repo Directory — Top 5 Active

> Read-only inventory. Generated 2026-07-09 from GitHub API (authenticated as the `KudbeeZero` account token). No repos were cloned, edited, or modified.

## Ranking method

**Exact method used (evidence-based, no guessing):**

1. Pulled the full org repo list with `gh repo list KudbeeZero --limit 100` (returned **76 repos**, all `PUBLIC`).
2. For every repo I read `pushedAt` and `updatedAt` (priority 1 & 2 from the brief).
3. For the ~9 most-recently-pushed candidates I pulled **actual commit evidence** (priority 3): latest default-branch commit SHA/date + commit count in the last 90 days (`since=2026-04-10`), plus **open PR count** (priority 4) and **recent workflow run status** (success/failure).
4. Two repos had a *recent `pushedAt` but almost no real development*:
   - `devbiz-worker` — pushed 2026-07-07 but only **1 commit total** (a one-time "source repo import"). Excluded from top 5.
   - `kudbee-engine` — pushed 2026-07-05 but only **2 commits** (an archive/preserve notice). Dormant. Excluded.
   These were dropped in favor of genuinely active repos because "most active" means sustained commit cadence, not a single import timestamp.
5. Project-name relevance (priority 5, `FRONTIER`/`Grow`/`Kudbee`/`Music`/`HERMES`…) was used **only as a tie-breaker** and confirmed the evidence (e.g. `mainnet-growverse-v2.0` = GrowVerse, `kudbee-music` = the HERMES music brain).

**Private repos visible?** No private repos appeared in the listing. The token is the `KudbeeZero` account token, so if private repos existed they would normally be visible; since none were returned, either the org has no private repos or the token scope excludes them. Cannot distinguish with certainty — see *Not verified*.

**Commit counts / workflows checked?** Yes. 90-day commit counts were checked for the top 9 candidates (several returned the API cap of 100, i.e. **≥100 commits in 90 days**). Workflow run status was checked for the top 7 active candidates.

**Final ordering = sustained activity (commit volume + recency) with `pushedAt`/`updatedAt` as the primary sort among actively-developed repos.**

---

## Top 5

### Rank 1 — Kudbee-Quant-Bot-v1.0
- URL: https://github.com/KudbeeZero/Kudbee-Quant-Bot-v1.0
- Activity rank reason: Most recent push of any repo (2026-07-09 10:19), and it shows continuous automated activity — scheduled workflows run every few minutes. ≥100 commits in the last 90 days.
- Last pushed: 2026-07-09T10:19:21Z
- Last updated: 2026-07-09T10:19:36Z
- Primary language: Python
- Visibility: PUBLIC
- Archived/fork: No / No
- Open PRs: 0
- Recent workflow status: All green. Active scheduled workflows: "Paper-trade status ping (every 5 min, read-only)", "Forward paper-trade (confluence-R)", "Telegram scheduled notifications", "Telegram register webhook". Latest commit `3b797696ad35` (2026-07-09, "paper-trade: update journal [skip ci]").
- README/project summary: "An honest quantitative trading research toolkit for crypto and prediction markets — built as the deliberate inverse of the viral 'AI trading terminal' screenshots. No fake Sharpe ratios… Every signal is a hypothesis to be measured." Python engine under `kudbee_quant/` (ingestion, signals, backtest, confluence, paper loop, API).
- Suggested Figma/FigJam board title: Kudbee Quant — Trading Research & Paper-Trade Ops
- Suggested Figma sections:
  - Current status: CI + scheduled paper-trade pings green; actively trading/measuring.
  - Active lane: Signal/backtest/confluence engine work; Telegram notification loop.
  - Parked work: Marketing/"hype" terminal features (explicitly rejected by design).
  - Next owner action: Review latest paper-trade journal; confirm risk-reporting stays loud.
  - Risks/protected paths: No real funds without separate gating; honest risk reporting is a hard rule.
  - Next bigger/better lane: Live (non-paper) execution only after proven edge + guardrails.

### Rank 2 — FRONTIERNeXt
- URL: https://github.com/KudbeeZero/FRONTIERNeXt
- Activity rank reason: Second most recent push (2026-07-09 10:06), same-day as #1, and a large active codebase (the flagship game monorepo). ≥100 commits in 90 days, 0 open PRs, CI + Deploy green.
- Last pushed: 2026-07-09T10:06:13Z
- Last updated: 2026-07-09T09:27:30Z
- Primary language: TypeScript
- Visibility: PUBLIC
- Archived/fork: No / No
- Open PRs: 0
- Recent workflow status: All green. "CI" + "Deploy to Fly" on push (2026-07-09 09:27), "CI" on PRs. Latest commit `64c22a8cb53e` (2026-07-09, "docs: collapse relay into /ship orchestrator + split baton").
- README/project summary: FRONTIERNeXt — documentation home / "Mission Control" front door. pnpm monorepo: flagship FRONTIER-AL game (Express + WebSocket server, React + three.js client), blockchain (Algorand TestNet) economy, 21k-plot globe, session-relay dev loop.
- Suggested Figma/FigJam board title: FRONTIERNeXt / FRONTIER-AL — Game Build & Mainnet Readiness
- Suggested Figma sections:
  - Current status: CI + Fly deploy green; active docs/relay refactor.
  - Active lane: Globe/combat/server work; /ship session-relay loop.
  - Parked work: Mainnet funds/ASA paths (gated — not until /mainnet-gate + algo-auditor PASS).
  - Next owner action: Keep CI green; do not merge `wip/atomic-purchase`; verify `VITE_TEST_GLOBE=false` before deploy.
  - Risks/protected paths: No funds code to mainnet without audit; migrations 0000–0008 must be applied; don't reintroduce mock data.
  - Next bigger/better lane: Algorand mainnet readiness (PASS-gated) + globe UX expansion.

### Rank 3 — kudbee-music
- URL: https://github.com/KudbeeZero/kudbee-music
- Activity rank reason: Pushed 2026-07-07 22:23; ≥100 commits in 90 days; 1 open PR; CI workflow present (mostly green, a couple of recent failures fixed). Matches the owner-named "Kudbee Music" / "HERMES" check.
- Last pushed: 2026-07-07T22:23:59Z
- Last updated: 2026-07-07T22:24:05Z
- Primary language: TypeScript
- Visibility: PUBLIC
- Archived/fork: No / No
- Open PRs: 1
- Recent workflow status: "ci" workflow — latest runs green after two transient failures at 22:15 (push + PR). Latest commit `0cdf1f0e1f20` (2026-07-07, "Merge pull request #238 from KudbeeZero/claude/lightning-ai-…").
- README/project summary: Branded **"HERMES"** — "A local, deterministic songwriting brain — write original songs and see exactly how it thought. No API key. Runs in your browser." Roster of specialized agents that cross-check each other; $0, no GPU, deterministic. MIT-licensed, has a CI badge.
- Suggested Figma/FigJam board title: Kudbee Music / HERMES — Songwriting Brain
- Suggested Figma sections:
  - Current status: Active; PR #238 merged (lightning-ai); CI green.
  - Active lane: Agent cross-check / deterministic songwriting loop.
  - Parked work: Paid/cloud model integrations (explicitly $0 design).
  - Next owner action: Triage the 1 open PR; resolve any remaining CI flakes.
  - Risks/protected paths: Keep it local/deterministic & free (design promise); MIT license.
  - Next bigger/better lane: Broader agent roster / in-browser UX polish.

### Rank 4 — Devbiz
- URL: https://github.com/KudbeeZero/Devbiz
- Activity rank reason: Pushed 2026-07-07 20:22; ≥100 commits in 90 days; 1 open PR; two green workflows. The Kudbee creative dev-studio / games site.
- Last pushed: 2026-07-07T20:22:15Z
- Last updated: 2026-07-07T20:22:31Z
- Primary language: HTML
- Visibility: PUBLIC
- Archived/fork: No / No
- Open PRs: 1
- Recent workflow status: All green. "Quality guardrails" + "Leaderboard shared/ coverage" on push (2026-07-07 20:22) and PRs. Latest commit `acf7dff05b3b` (2026-07-07, "Merge pull request #144 from KudbeeZero/claude/darts-pinball").
- README/project summary: "Kudbee — A creative dev studio site (web design, live AI agent training, original game development), zero-build static site on Cloudflare Pages." Includes `games/kudbee-contra/` (2.5D run-and-gun) and other games.
- Suggested Figma/FigJam board title: Devbiz / Kudbee Studio — Site & Games
- Suggested Figma sections:
  - Current status: Active; PR #144 merged (darts-pinball); guardrails + leaderboard workflows green.
  - Active lane: Static-site updates, games studio (kudbee-contra, darts/pinball).
  - Parked work: Build-step/tooling migrations (intentionally zero-build).
  - Next owner action: Triage the 1 open PR; watch coverage leaderboard.
  - Risks/protected paths: Keep zero-build Cloudflare Pages deploy simple.
  - Next bigger/better lane: More games studio titles / agent-training showcase.

### Rank 5 — mainnet-growverse-v2.0
- URL: https://github.com/KudbeeZero/mainnet-growverse-v2.0
- Activity rank reason: Pushed 2026-07-07 10:20; ≥100 commits in 90 days; 1 open PR; CI workflow (mostly green). This is the **GrowVerse** project the owner expected — confirmed by name + content (growth-chamber/arcade game). Included over `devbiz-worker` (1 commit) and `kudbee-engine` (2 commits, archived) because it is genuinely active.
- Last pushed: 2026-07-07T10:20:38Z
- Last updated: 2026-07-07T09:13:32Z
- Primary language: TypeScript
- Visibility: PUBLIC
- Archived/fork: No / No
- Open PRs: 1
- Recent workflow status: "CI" — green on latest push/PR (2026-07-07 10:20 & 09:45); one transient failure at 09:31 self-resolved; "Ask Grok" workflow (issue_comment) skipped. Latest commit `83b6bdad9c00` (2026-07-07, "fix(chamber): remove the Arcade page's preview-growth scrubber").
- README/project summary: No README file present (repository description also empty). Code evidence (commit messages, paths like `chamber`/`Arcade`/`preview-growth`) indicates a GrowVerse growth-chamber / arcade game targeting mainnet.
- Suggested Figma/FigJam board title: GrowVerse v2.0 — Growth Chamber & Arcade (Mainnet)
- Suggested Figma sections:
  - Current status: Active; CI green; 1 open PR.
  - Active lane: Chamber/arcade gameplay; preview-growth scrubber work.
  - Parked work: Mainnet launch specifics pending readiness.
  - Next owner action: Triage the 1 open PR; add a README (currently missing).
  - Risks/protected paths: Mainnet naming implies funds/chain surface — gate like FRONTIER (audit before mainnet).
  - Next bigger/better lane: Mainnet growth-economy expansion.

---

## Other active candidates

- **Rank 6 — dom-operations-dashboard** (https://github.com/KudbeeZero/dom-operations-dashboard) — JavaScript, pushed 2026-07-01 22:04, ≥100 commits/90d, 1 open PR, no workflows configured. "Visual project status dashboard for Dominick Ziola's empire building initiatives — Live Now Recovery, FRONTIERNeXt, etc." (README text actually describes an "I Got A Dom" doc-cleanup site built on the HERMES vault architecture.)
- **Rank 7 — Live-Now-LLC** (https://github.com/KudbeeZero/Live-Now-LLC) — JavaScript, pushed 2026-07-01 22:05, 10 commits/90d, 1 open PR, CI green. "Real time" (live-now recovery / streaming).
- **Rank 8 — devbiz-worker** (https://github.com/KudbeeZero/devbiz-worker) — HTML, pushed 2026-07-07 13:27 but only **1 commit** (one-time source import). Excluded from top 5 — not actively developed.
- **Rank 9 — kudbee-engine** (https://github.com/KudbeeZero/kudbee-engine) — no primary language, pushed 2026-07-05 but only **2 commits** (archive/preserve notice). "Archived Kudbee/HERMES planning and research seed repo… Preserved for historical architecture notes." Dormant by design.
- **Rank 10 — chicago-handyman-plumbing-website** — TypeScript, pushed 2026-06-28. Far below the active tier.

## Not verified

- **Private repos:** The `gh repo list` returned 76 repos, all `PUBLIC`. No private repos were present. Because the token is the `KudbeeZero` account token, this likely means the org has no private repos — but it cannot be *guaranteed* the token scope exposes private repos if any exist. Treat private-repo visibility as "none observed, not positively confirmed."
- **Exact commit counts > 100:** Six repos returned the API page cap of 100 commits in 90 days; I report these as "≥100" rather than an exact figure (exact count not retrieved to stay cheap/within scope).
- **Forks of upstream projects** (e.g. `spark`, `kirki`, `vercel`, `DeepSeek-Coder`, `frontend`, `Algorand-dApp-Quick-Start-Template-TypeScript`, `CnC_Generals_Zero_Hour`, `fork--dogecoin-ordinals…`) were excluded from the active-repo ranking — they are not KudbeeZero's own active development. Available in the raw list if needed.
- **Issue counts** were not pulled (only open PR counts) — activity ranking relied on push recency + commit volume + PRs + workflows per the brief's priority order.
- **README content** was fetched only for the top 8 candidates, as instructed (not for every repo).
