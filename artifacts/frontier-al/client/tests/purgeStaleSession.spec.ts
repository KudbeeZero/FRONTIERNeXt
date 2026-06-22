/**
 * Guards the stale-session purge that stops duplicate wallet popups from piling
 * up: a failed/aborted connect must drop any half-open WalletConnect session so
 * Pera doesn't resurface every leftover pairing on the next attempt ("extra
 * wallets keep popping up"). The purge is best-effort — it must never throw,
 * even if the wallet's own disconnect rejects.
 */
import { describe, it, expect, vi } from "vitest";
import { purgeStaleSession } from "@/contexts/WalletContext";

describe("purgeStaleSession", () => {
  it("disconnects a wallet that has a half-open session", async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined);
    await expect(purgeStaleSession({ disconnect })).resolves.toBe(true);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("never throws when the wallet's disconnect rejects (best-effort)", async () => {
    const disconnect = vi.fn().mockRejectedValue(new Error("WC relay down"));
    await expect(purgeStaleSession({ disconnect })).resolves.toBe(true);
  });

  it("no-ops safely when there is no wallet / no disconnect", async () => {
    await expect(purgeStaleSession(undefined)).resolves.toBe(false);
    await expect(purgeStaleSession(null)).resolves.toBe(false);
    await expect(purgeStaleSession({} as any)).resolves.toBe(false);
  });
});
