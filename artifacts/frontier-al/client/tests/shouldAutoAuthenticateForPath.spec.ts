/**
 * Guards which route drives the single shared WalletProvider's `autoAuth`
 * prop (App.tsx, P1 fix, 2026-07-07). Only the in-game route should prompt the
 * wallet signature automatically — marketing/info pages never do, so players
 * aren't asked to log into the wallet until they actually enter the game.
 */
import { describe, it, expect } from "vitest";
import { shouldAutoAuthenticateForPath } from "@/contexts/WalletContext";

describe("shouldAutoAuthenticateForPath", () => {
  it("auto-authenticates on the in-game route", () => {
    expect(shouldAutoAuthenticateForPath("/game")).toBe(true);
  });

  it("does not auto-authenticate on marketing/info/other routes", () => {
    for (const path of ["/", "/info/economics", "/info/gameplay", "/testnet", "/battles", "/armory", "/privacy-policy", "/not-a-route"]) {
      expect(shouldAutoAuthenticateForPath(path)).toBe(false);
    }
  });
});
