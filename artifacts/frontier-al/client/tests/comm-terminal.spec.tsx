/**
 * client/tests/comm-terminal.spec.tsx
 *
 * SSR smoke test for the Comm Terminal widget (same `react-dom/server`
 * `renderToStaticMarkup` harness as the rest of the client suite; no jsdom).
 *
 * The widget gates on a fetched `unlocked` flag (effect-driven), so on the server
 * it renders nothing — this asserts it imports + renders WITHOUT crashing and that
 * non-owners (no player / pre-fetch) see nothing. The deterministic whisper logic
 * is covered server-side (server/engine/narrative/whispers.spec.ts). Interactive +
 * unlocked rendering needs a DOM harness and is a documented follow-up.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommTerminal } from "@/components/game/CommTerminal";

describe("CommTerminal (SSR smoke)", () => {
  it("renders nothing (no crash) when there is no player", () => {
    expect(renderToStaticMarkup(<CommTerminal playerId={null} />)).toBe("");
  });

  it("renders nothing pre-unlock for a player (gate is fetched in an effect)", () => {
    // Effects don't run under renderToStaticMarkup, so unlocked stays false → null.
    expect(renderToStaticMarkup(<CommTerminal playerId="player-1" />)).toBe("");
  });
});
