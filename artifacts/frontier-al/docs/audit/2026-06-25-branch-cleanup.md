# Branch cleanup — launch-baseline prune list (2026-06-25)

Repo reconciliation for a clean launch starting point. State at `main` `8cae734` (#148):
**0 open PRs**, launch gate green (typecheck ✓ · server 380/14-skip ✓ · client 174 ✓ · build ✓),
Fly + Cloudflare deploy LIVE.

## Branch audit
- **141 remote branches**; `main` + `wip/atomic-purchase` retained → **140 are prunable.**
- **73 merged** into `main` (commits fully in `main`) + **67 unmerged** (artifacts of the pre-#69
  trunk that was reset, plus baton/audit/handoff/night/design/experiment branches). A subagent triaged
  all 67: **none contain valuable un-landed work** — nothing to keep.
- **`wip/atomic-purchase` — RETAINED (OFF-LIMITS** per HARD RULES; never merge/delete off-hand).

## ⚠️ Deletion blocked in the web environment
`git push --delete` returns **GitHub HTTP 403** (consistent across branches), and the GitHub MCP
toolset exposes **no ref-delete** tool. Per the agent-proxy README, 403s are not retried/routed around.
**Action for the owner:** prune these from the GitHub UI (repo → **Branches** → delete), or run locally
with a delete-scoped token:
```
git fetch --prune origin
git branch -r --merged origin/main | grep -vE 'HEAD|origin/main$|wip/atomic-purchase' | sed 's| *origin/||' | xargs -n10 git push origin --delete
# then the 67 unmerged below (all triaged safe):
```

## Prunable branches (140)

### Merged into main (73) — safe, content is in `main`
chore/baton-refresh · ci/fly-deploy-workflow · claude/aether-ch1-repair-gate · claude/aether-ch2-build ·
claude/aether-ch2-integrate · claude/aether-ch2-visual · claude/aether-ch3-build · claude/aether-ch3-scene ·
claude/aether-ch3-store · claude/aether-ch3-store-fixes · claude/aether-ch4-build · claude/aether-ch4-scene ·
claude/aether-ch4-store · claude/aether-ch5-build · claude/aether-ch5-scene · claude/aether-ch5-store ·
claude/aether-chapter2-design · claude/aether-dock-frost · claude/aether-journey-card ·
claude/aether-mobile-hud-dock · claude/aether-nft-mint · claude/aether-polish-pass · claude/auto-deploy-on-merge ·
claude/baton-clean · claude/baton-final · claude/baton-refresh · claude/baton-refresh-postmerge ·
claude/baton-roadmap-complete · claude/battle-cinematic-camera · claude/battle-cinematics-smoketest ·
claude/battle-cinematics-toggle · claude/battle-faction-color · claude/battle-hud-callout ·
claude/battle-incoming-telegraph · claude/battle-sequence-closeout · claude/battle-sequence-richbus ·
claude/battle-sound · claude/commander-combat-record · claude/commander-leaderboard ·
claude/commander-leaderboard-ui · claude/commander-stats · claude/core-engine-architecture-617w5r ·
claude/dev-test-entry · claude/globe-v2-closeout-baton · claude/globe-v2-rebuild-notes-38mf7k ·
claude/prologue-polish · claude/refresh-story-bundle · claude/replay-persistence ·
claude/status-immediate-issues-8ltv13 · claude/veritas-battle-flow · claude/veritas-battle-proof ·
claude/weapons-strike-ui · claude/website-file-verification-3w5lg4 · design/strategic-depth-program ·
feat/comm-terminal · feat/living-map-events · flyio-new-files · flyio-scale-from-ui · phase/01-battle-clock ·
phase/01-battle-tick · phase/01-commander-drift · phase/01-cooldown-drift · phase/01-resolver-cadence ·
phase/02-battle-depth · phase/02-battle-stats · phase/03-realtime-hardening · phase/04-config-and-telemetry ·
phase/05-intel-mechanic · phase/06-earth-georef-foundation · phase/07-earth-imagery-pipeline ·
phase/08-parcel-map-viewer · phase/09-nft-imagery-gen · phase/10-mainnet-gold

### Unmerged (67) — triaged safe (pre-#69 trunk / process / abandoned experiments)
audit/pr52-chain-agent-dashboard · audit/rdpbfi-retro · chore/action-nonces-ttl ·
claude/actions-idempotency-extend-2qpwrn · claude/advisor-admin-sim · claude/aether-ch1-voice-wiring ·
claude/aether-journey-phase-1-lvgr0b · claude/aether-phase1-verify-harden · claude/aether-voice-pipeline-handoff-b92ai1 ·
claude/algorand-plugin-install-ksnm6e · claude/ascendancy-blockers-lut-2Hhao · claude/ascendancy-overnight-integration-JQUET ·
claude/bomb-squad-shift-86t0dt · claude/ci-green-light-percentage-drvneh · claude/claude-md-docs-0mblfm ·
claude/combat-upgrade-matrix-2a3gl2 · claude/frontier-globe-lighting-b4sybt · claude/frontier-hud-shell-port-1js9kp ·
claude/frontier-purchase-monitor-audit-opb6vm · claude/frontier-repo-audit-larqj6 · claude/frontier-weapon-cache-ui-c8a6bj ·
claude/game-feature-scan-bnk4ie · claude/game-guide-docs-TO3Bf · claude/handoff-audit-jwfx7a ·
claude/handoff-audit-pr-60-eg7x5h · claude/handoff-audit-t5ci91 · claude/handoff-protocol-universal-sr23ca ·
claude/kestra-automation-factory-06fr1h · claude/level-one-audio-bug-oapcka · claude/multi-agent-dev-plan-rdpbfi ·
claude/night-shift-01b8vc · claude/night/game-config · claude/night/wallet-update ·
claude/overnight-handoff-protocol-9csemq · claude/pr34-audit-ledger-recovery-m3xpvm · claude/project-next-steps-seoay7 ·
claude/repo-security-audit-ammZZ · claude/security-audit-3hwgW · claude/senior-architect-fullstack-yoQTu ·
claude/strike-system-design-spec-jan40c · claude/todo-implementation-kfVuZ · claude/transactions-plane-game-status-vu6xqr ·
claude/trustless-market-resolution-11hy35 · claude/verify-repo-state-3MUZ6 · claude/weapons-system-architecture-hl2jhs ·
claude/web-session-start-hook · docs/baton-refresh-globe-pivot · docs/refresh-handoff-baton-after-pr49 ·
feat/actions-idempotency-nonce · feat/admin-chain-agent-dashboard · feat/floating-plot-widget-clean ·
feat/idempotency-stable-nonce · feat/plot-attack-ux-cleanup · feat/route-loop-integration-test ·
feat/route-loop-server · feat/test-globe-and-remove-tutorial · fix/admin-address-failfast ·
fix/armory-claim-ui-clean · fix/client-typecheck-ci · fix/payment-replay-algod-finality · hotfix/pr44-dedup ·
local/game-online-fixes · perf/globe-pick-index-parity · session-relay-protocol ·
test/gamelayout-connected-shell · test/gamelayout-entry-state
