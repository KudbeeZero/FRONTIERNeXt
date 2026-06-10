# Night Shift — Alex (React Architect)

## Alex — Night Shift Report
**Focus**: PR #9 weapon-system frontend (head `33e4dd6`, reviewed via worktree): ArmoryPanel, weapons/* (WeaponSandbox, WeaponScene, WeaponProjectile, ImpactBurst, fxUtils), LiveWeaponLayer, pages/armory, App.tsx wiring, useGameSocket, weapon-sandbox entry/html. All file:line refs are `client/src/…` at PR #9 head.

**Findings Table**

| ID | Severity | Category | File(s) | Description | Impact | Suggested Fix | Test Idea |
|----|----------|----------|---------|-------------|--------|---------------|-----------|
| A1 | High | Hook cleanup / WS lifecycle | hooks/useGameSocket.ts:173-179, 184-188; components/game/GameLayout.tsx:70 | Effect cleanup calls `ws.close()` but leaves `onclose` attached, and `onclose` always schedules `setTimeout(connect, 3000)`. PR #9 added the `authTrigger` dep (line 188) and an `/armory` route that unmounts GameLayout, so cleanup now fires mid-session: each auth flip / game↔armory navigation spawns a zombie reconnect loop alongside the new effect's socket. | Duplicate WebSockets → duplicate `world_event`/`weapon_engagement` dispatches (double FX, double feed entries); leaked sockets after unmount. | In cleanup set a `disposed` flag and `ws.onclose = null` before `close()`; guard `connect()` on `disposed`. | Mount hook, flip `authTrigger`, assert only 1 open socket after close events settle (mock WebSocket). |
| A2 | Med | Mutation UX / error handling | components/game/armory/ArmoryPanel.tsx:98-117 | All four mutations (`build/unlock/upgrade/loadout`) have `onSuccess: onChanged` only; `apiRequest` throws on non-2xx (lib/queryClient.ts:23-28) but no `onError` → failures (insufficient FRNTR, max tier) are swallowed. | Buttons silently do nothing on server rejection; player gets no feedback despite Toaster being mounted (App.tsx:28). | Shared `onError: (e) => toast({ variant: "destructive", description: e.message })`. | Mock 400 from `/api/weapons/unlock`, assert toast rendered. |
| A3 | Med | Stale server-state write | components/game/armory/ArmoryPanel.tsx:137-142, 246-250 | `toggleEquip` derives the next loadout from `profile.loadout` (last fetch snapshot). Two toggles before the invalidated refetch lands → second POST is computed from stale data and reverts the first. No optimistic update, so the button label also lags. | Lost equip/unequip updates under fast clicks; flickery UI. | Optimistic `queryClient.setQueryData` on the catalog key + rollback in `onError`, or disable other equip buttons while `loadoutMut.isPending` (currently per-button only). | RTL test: click two Equip buttons quickly with delayed fetch mock; assert both persist. |
| A4 | Med | State init-from-prop | components/game/armory/ArmoryPanel.tsx:84, 91 | `ArmoryInner` seeds `draft` from `profile.attributes` in `useState` and is rendered without a key. If `playerId` changes while mounted, or the profile changes server-side (badge progression in another tab), the draft never resyncs. | Stale/wrong attribute draft shown for the new player; `dirty` mis-computed (line 96). | `<ArmoryInner key={playerId} …/>` (cheap) or key by `profile.updatedAt`. | Render with player A, swap prop to player B, assert sliders show B's build. |
| A5 | Low | Stale closure | components/game/armory/ArmoryPanel.tsx:128-135 | `step`'s functional updater guards with render-scope `remaining` instead of recomputing from `d`. Rapid `+` clicks can transiently exceed `ATTRIBUTE_BUDGET` (Save stays disabled via `remaining < 0`, line 199, so server is protected). | Draft can briefly over-spend; relies on Save guard as backstop. | Compute `const rem = ATTRIBUTE_BUDGET - totalSpent(d)` inside the updater. | Unit-test the updater with a draft at budget; `+1` must be a no-op. |
| A6 | Low | Query-key convention | components/game/armory/ArmoryPanel.tsx:73-79 vs lib/queryClient.ts:47-69 | Catalog query uses ad-hoc key `["weapons-catalog", playerId]` + inline queryFn; the rest of the app uses URL-as-key with the default queryFn. Works, but invisible to URL-prefix invalidation patterns and a second convention to remember. | Consistency/maintainability; future invalidations may miss it. | Key as `["/api/weapons/catalog", playerId]` or document the exception; keep one `apiRequest` wrapper. | Grep-style lint: query keys must start with `/api`. |
| A7 | Low | Render-loop perf (sandbox) | components/game/weapons/WeaponSandbox.tsx:31-32, 94; components/game/weapons/ImpactBurst.tsx:45-61 | Sandbox retains the last 16 shots forever; each shot mounts an `ImpactBurst` whose `useFrame` runs every frame with no settle guard (unlike `WeaponProjectile`'s `settledRef`, WeaponProjectile.tsx:42, 96-99). Live layer is bounded by `RETAIN_MS` (LiveWeaponLayer.tsx:21), so dev-only. | Up to ~32 dead per-frame callbacks in long sandbox sessions; minor. | Add the same `settled` early-return to ImpactBurst once `elapsed > durationMs`. | Profile frame callbacks after 20 shots; count should plateau. |
| A8 | Low | Latent timing fragility | components/game/globe/LiveWeaponLayer.tsx:39, 43; components/game/weapons/WeaponProjectile.tsx:42-43 | Dedupe path (`prev.filter(s => s.id !== shot.id)`) anticipates re-broadcasts per engagement, but a same-id update would rebase `launchTs` to the new receipt time (restarting the missile from origin), and the keyed `WeaponProjectile` instance keeps stale `settledRef`/`writeIdx`/buffers. Currently unreachable — server resolves interception at fire time and broadcasts once (server/weapons/engagementStore.ts:148-153; server/routes.ts:2130). | None today; FX break the day the server starts sending status updates. | On same-id update, preserve the existing shot's rebased `launchTs`; reset `settledRef` when `shot.id` or `intercept` changes. | Dispatch two events with one id; assert `launchTs` unchanged on the 2nd. |
| A9 | Low | Design-system consistency | components/game/armory/ArmoryPanel.tsx:64-70, 163-167, 185-187, 198-204 | Armory uses raw `<button>`s, hard-coded hex (`TIER_COLOR`, `#11182b`) and inline styles instead of the shadcn `Button`/`Badge` + theme tokens used app-wide (components/ui/*). WeaponSandbox's inline CSS (WeaponSandbox.tsx:166-180) is fine — standalone dev entry outside Tailwind/app shell. | Visual drift, no focus/disabled a11y states from the DS. | Swap to `Button` variants; move tier colors to CSS vars or a `badgeTier` variant map. | Storybook/visual snapshot of ArmoryPanel vs DS buttons. |

**Key Insights**
- The clock-skew rebase in LiveWeaponLayer.tsx:29-45 is correct and well-reasoned (preserves `tof` + intercept fraction); timer cleanup (lines 54-58) is leak-free. Good baseline.
- `WeaponProjectile`'s `settledRef` settle guard (WeaponProjectile.tsx:96-99) is a nice perf pattern — it just wasn't applied to `ImpactBurst` (A7).
- The sandbox is properly isolated: separate Vite entry (`weapon-sandbox.html` + weapon-sandbox-entry.tsx), no rollup input in vite.config.ts → excluded from production builds; `pnpm run sandbox:weapons` is dev-only (package.json:14). Verified, not assumed.
- Server resolves interception at launch and broadcasts the full engagement once — the client FX model (single immutable shot) matches today's protocol but is one server refactor away from breaking (A8).
- ArmoryPanel's data flow (Query for reads, 4 mutations + invalidate) is structurally sound; the gaps are all on the failure/concurrency edges (A2-A5), not architecture.
- A1 predates PR #9 in latent form, but the PR's `authTrigger` re-run + the new `/armory` navigation path make it fire in normal play — flagged here because the PR activates it.

**Code Suggestions**

A1 — useGameSocket.ts effect:
```ts
useEffect(() => {
  reconnectCount.current = 0;
  let disposed = false;
  function connect() {
    if (disposed || reconnectCount.current >= WS_MAX_RECONNECTS) return;
    // …existing body…
    ws.onclose = () => {
      wsRef.current = null;
      if (disposed) return;                       // ← stop zombie loop
      reconnectCount.current += 1;
      reconnectTimer.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
    };
  }
  connect();
  return () => {
    disposed = true;
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
  };
}, [authTrigger]);
```

A2 — ArmoryPanel.tsx shared mutation options:
```ts
const opts = { onSuccess: onChanged, onError: (e: Error) =>
  toast({ variant: "destructive", title: "Armory", description: e.message }) };
const unlockMut = useMutation({ mutationFn: …, ...opts });
```

A4 — ArmoryPanel.tsx:84:
```tsx
return <ArmoryInner key={playerId} playerId={playerId} data={query.data} onChanged={invalidate} />;
```

**Confidence Score**: 8/10 (all claims verified against PR #9 head incl. server broadcast path; A3/A5 are race-timing findings reasoned from code, not reproduced)
