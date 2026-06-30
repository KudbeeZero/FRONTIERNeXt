/**
 * client/tests/BattleWatchModal.hooks.spec.tsx
 *
 * Regression test for the "battle view goes black" crash (sprint-84).
 *
 * Root cause: `useMemo` (+ the cinematics prefs hooks) were called AFTER an
 * early `if (!battle) return null`. When the always-mounted modal's `battle`
 * prop transitioned null → resolved on the SAME fiber, the hook count changed
 * and React threw "Rendered more hooks than during the previous render." With
 * no error boundary, that unmounted the whole tree → black screen.
 *
 * This needs a STATEFUL client reconciler that reuses one fiber across two
 * renders — the rest of the client suite's `renderToStaticMarkup` harness does
 * two independent renders and structurally cannot reproduce it. We use
 * react-test-renderer (headless, no jsdom; version-matched to react 18.3.1):
 * `create()` then `update()` reuse the same fiber, exactly the crash path.
 *
 * `open={false}` keeps the Radix Dialog portal unmounted (no `document` in the
 * Node env) while the render-phase hooks still run — which is all that's needed
 * to trip the hook-count invariant.
 *
 * Fails before the hooks reorder (throws on update); passes after.
 */
import { describe, it, expect } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { BattleWatchModal } from "@/components/game/BattleWatchModal";
import type { Battle, Player } from "@shared/schema";

// react-test-renderer's act() expects this flag in a test environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Minimal resolved battle — only the fields the render path reads. Cast through
// `unknown` so we don't have to spell out every schema field for a render smoke.
const resolvedBattle = {
  id: "battle-1",
  attackerId: "player-attacker",
  defenderId: "player-defender",
  commanderId: null,
  status: "resolved",
  outcome: "attacker_wins",
  troopsCommitted: 100,
  startTs: 1_000,
  resolveTs: 2_000,
  targetParcelId: "parcel-0001",
} as unknown as Battle;

const baseProps = {
  open: false, // keep the Radix portal unmounted; the hook crash is render-phase
  onOpenChange: () => {},
  players: [] as Player[],
  targetParcel: null,
};

describe("BattleWatchModal — hooks order (black-screen regression)", () => {
  it("does not throw when battle transitions from null to resolved", () => {
    let root!: TestRenderer.ReactTestRenderer;

    // First render with no battle (modal idle) — establishes the fiber.
    act(() => {
      root = TestRenderer.create(<BattleWatchModal {...baseProps} battle={null} />);
    });

    // The exact failure path: SAME fiber re-renders with a resolved battle.
    // Pre-fix this throws "Rendered more hooks than during the previous render".
    expect(() => {
      act(() => {
        root.update(<BattleWatchModal {...baseProps} battle={resolvedBattle} />);
      });
    }).not.toThrow();

    act(() => {
      root.unmount();
    });
  });
});
