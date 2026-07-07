/**
 * Guards which route drives the single shared WalletProvider's `autoAuth`
 * prop (App.tsx, P1 fix, 2026-07-07). Only in-game routes should prompt the
 * wallet signature automatically — marketing/info pages never do, so players
 * aren't asked to log into the wallet until they actually enter the game.
 * "/" mounts the game directly as of 2026-07-07 (landing moved to "/landing"),
 * so it opts in too.
 */
import { describe, it, expect } from "vitest";
import { shouldAutoAuthenticateForPath } from "@/contexts/WalletContext";

describe("shouldAutoAuthenticateForPath", () => {
  it("auto-authenticates on in-game routes", () => {
    expect(shouldAutoAuthenticateForPath("/game")).toBe(true);
    expect(shouldAutoAuthenticateForPath("/")).toBe(true);
  });

  it("does not auto-authenticate on marketing/info/other routes", () => {
    for (const path of ["/landing", "/info/economics", "/info/gameplay", "/testnet", "/battles", "/armory", "/privacy-policy", "/not-a-route"]) {
      expect(shouldAutoAuthenticateForPath(path)).toBe(false);
    }
  });
});
