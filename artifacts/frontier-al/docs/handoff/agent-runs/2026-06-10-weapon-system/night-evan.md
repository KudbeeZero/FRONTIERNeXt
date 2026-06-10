## Evan — Night Shift Report
**Focus**: PR #9 weapon-system user surface — ArmoryPanel.tsx, pages/armory.tsx, App.tsx route wiring, WeaponSandbox.tsx; nav reachability via GameLayout.tsx desktop tabs and BottomNav.tsx mobile tabs; a11y, states, design-system consistency vs FactionPanel/PredictionMarketsPanel; fire/equip game feel.

**Findings Table**
| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
|----|----------|----------|---------|-------------|--------|---------------|-----------|
| E1 | Critical | Navigation | client/src/components/game/GameLayout.tsx:946-953; client/src/components/game/BottomNav.tsx:7,15-29; client/src/App.tsx:71-75 | `/armory` route exists in App.tsx, but NO desktop right-panel tab, NO BottomNav tab (NavTab union omits it), and zero `<Link href="/armory">` anywhere except armory.tsx's own back-link (grep verified). Memory L4 warned nav claims go stale both directions — here the route shipped but nav never did. | Flagship PR #9 feature is unreachable in-app; players will never find the Armory unless they type the URL. | Add an `armory` entry to BottomNav OVERFLOW_TABS + GameLayout desktop tab array (navigate via wouter `setLocation("/armory")` or embed ArmoryPanel as a panel like siblings). | RTL: render BottomNav + GameLayout, assert a nav control reaching `/armory` exists; e2e: tap-path from /game to Armory on mobile and desktop. |
| E2 | High | Error states | client/src/components/game/armory/ArmoryPanel.tsx:98-117 | All four mutations (build/unlock/upgrade/loadout) have `onSuccess` only. `apiRequest` throws on non-OK (lib/queryClient.ts:23-26), so insufficient-FR unlock, max-tier upgrade, invalid loadout fail silently — button un-disables, nothing happens. Siblings toast on error (PredictionMarkets.tsx:119-155). | Players spam-click buttons that silently no-op; trust-destroying for paid (FR) actions. | Add `onError` with `useToast` destructive variant on each mutation, mirroring PredictionMarkets. | Mock 400 from /api/weapons/unlock; assert destructive toast appears. |
| E3 | Med | Loading states | client/src/pages/armory.tsx:24-30; client/src/hooks/useGameState.ts:25-30 | `useCurrentPlayer` returns `null` while gameState is still fetching, so the page flashes/sticks on "Connect your wallet" even for connected users until the query resolves. No distinct loading state. | Misleading false-negative; users may bounce or re-connect wallet needlessly. | Read `isLoading` from `useGameState()` and render a Skeleton before the connect prompt. | Throttle /api/game/state; assert skeleton (not connect prompt) during load with a connected wallet. |
| E4 | Med | Game feel | client/src/components/game/armory/ArmoryPanel.tsx:246-250; server/routes.ts:2115 | No client code calls `/api/weapons/fire`, `deploy-defense`, or `mint-nft` (grep: only server + sandbox sim). Equip flow dead-ends: players equip a loadout but have no way to fire; engagements only arrive via WS (LiveWeaponLayer). UNCERTAIN whether firing is intentionally server/AI-driven this phase — flagging, not asserting. | Equip feels purposeless; minted-NFT path has no UI at all. | If intentional, label loadout "auto-engages in battles"; else wire fire into AttackModal. Confirm intent with PR #9 author. | e2e: equip a weapon, trigger an attack, verify the player perceives loadout impact. |
| E5 | Med | A11y | client/src/components/game/armory/ArmoryPanel.tsx:185,187,188-189,164,218,221 | (a) +/− steppers are bare "−"/"+" glyph buttons, no `aria-label`, value not programmatically associated; (b) attribute bar is a div, no `role="progressbar"`/aria-value*; (c) contrast: locked cards apply `opacity-60` over `text-slate-400/500` on near-black (~3:1, fails WCAG 4.5:1); badge tier "none" color `#454b5e` on `#11182b` ≈ 1.9:1. | Screen-reader users can't operate the build editor; low-vision users can't read locked/none states. | `aria-label={"Increase "+ATTR_LABEL[k]}` etc.; use shadcn `Slider` or add progressbar semantics; lift locked text to slate-300 and drop the opacity wash on text. | axe-core scan of /armory; keyboard-only: tab to steppers, hear label+value. |
| E6 | Med | Design system | client/src/components/game/armory/ArmoryPanel.tsx:64-70,81-82,153-271 vs FactionPanel.tsx:13,99,308-384 | Panel ignores the design system: raw hex colors and inline styles instead of theme tokens, raw `<button>`/`<div>` instead of shadcn Button/Card/ScrollArea/Skeleton, plain "Loading armory…" text vs siblings' skeletons, and ZERO `data-testid` (siblings are instrumented throughout). Also `h1`/light-DOM headings inside what siblings treat as a scrollable panel. | Visual drift from FactionPanel/PredictionMarkets; untestable by the existing testid-based suites; loading state feels unfinished. | Rebuild Shell on Card+ScrollArea, swap buttons to shadcn Button variants, Skeleton loader, add `data-testid` per control (`armory-attr-firepower-inc`, `armory-unlock-<id>`, …). | Visual diff against FactionPanel tokens; grep CI rule: no raw hex in game panels. |
| E7 | Low | Copy/feel | client/src/components/game/armory/ArmoryPanel.tsx:236,241-244 | Unlock shows "· {cost} FR" (currency label "FR" appears nowhere else — siblings say FRONTIER/ASCEND); Upgrade button shows no cost at all, so price discovery is via silent failure (compounds E2). | Players can't budget; inconsistent currency naming confuses economy. | Show upgrade cost from catalog payload; standardize on the canonical currency label per shared/economy-config.ts. | Snapshot: every paid button renders a cost with canonical unit. |
| E8 | Low | UX polish | client/src/components/game/armory/ArmoryPanel.tsx:233,241,246 | `disabled={unlockMut.isPending}` etc. disables EVERY card's buttons while one is in flight, with no per-item spinner; equip toggle has no optimistic update so it lags a full round-trip; no max-loadout feedback. | Whole catalog "greys out" on each click; equip feels sluggish. | Track pending specId (`unlockMut.variables`) to disable/spin only the active card; optimistic loadout update with rollback. | Click unlock on card A; assert card B's buttons stay enabled. |
| E9 | Low | A11y (dev) | client/src/components/game/weapons/WeaponSandbox.tsx:126-143 | Sandbox `<label>`s have no `htmlFor`/`id` association with their selects; inline-style focus states only. Dev-only surface (separate Vite entry, weapon-sandbox-entry.tsx), so low. | Minor; dev tooling only. | Add id/htmlFor pairs. | Manual VoiceOver pass on /weapon-sandbox.html. |
| E10 | Low | Mobile | client/src/pages/armory.tsx:20-23 | Armory is a full-page route outside the game shell: mobile users lose BottomNav entirely; only exit is a `text-xs` "← Back to globe" link (~12px target, well under 44px guideline). | Mobile dead-end; hard-to-hit escape hatch. | Either embed as a GameLayout tab (preferred, fixes E1 too) or give the back link `py-3 px-2 min-h-[44px]` and keep BottomNav mounted. | Mobile viewport e2e: navigate to Armory and back without URL editing. |

**Key Insights**
- The Armory is fully built and routed but dark-launched: both nav surfaces (desktop GameLayout tabs, mobile BottomNav) omit it and no link exists. This is the inverse of the stale-LUT lesson — code shipped, nav didn't. (E1)
- ArmoryPanel was written outside the panel design system (raw hex, raw buttons, no toasts, no testids), unlike every sibling panel; most Med findings trace to that one divergence. (E2/E5/E6)
- The equip loop has no payoff in-client — no fire UI exists anywhere — so game feel can't be judged complete; needs author intent confirmation. (E4)

**Code Suggestions**
```tsx
// E1 — BottomNav.tsx: extend NavTab + overflow (GameLayout maps "armory" -> setLocation("/armory") or renders ArmoryPanel)
export type NavTab = "map" | ... | "markets" | "armory";
const OVERFLOW_TABS = [ ..., { id: "armory", label: "Armory", icon: Crosshair } ];
```
```tsx
// E2 — ArmoryPanel.tsx mutations
const { toast } = useToast();
const unlockMut = useMutation({
  mutationFn: ...,
  onSuccess: onChanged,
  onError: (e) => toast({ title: "Unlock failed", description: String(e), variant: "destructive" }),
});
```
```tsx
// E5 — stepper buttons (lines 185/187)
<button aria-label={`Decrease ${ATTR_LABEL[k]}`} ...>−</button>
<span aria-live="polite" className="w-8 ...">{draft[k]}</span>
<button aria-label={`Increase ${ATTR_LABEL[k]}`} ...>+</button>
```
```tsx
// E3 — pages/armory.tsx
const { isLoading } = useGameState();
{isLoading ? <Skeleton className="h-48 mx-auto max-w-3xl mt-8" /> : player ? <ArmoryPanel .../> : <ConnectPrompt />}
```

**Confidence Score**: 8/10 — nav-gap, silent-error, and a11y findings verified directly in code (greps + reads on the PR #9 checkout); E4 intent and exact contrast ratios are estimates, flagged as such.
