/**
 * server/security.spec.ts
 *
 * Decision table for evaluateNftDeliveryClaim — the ownership gate on the
 * public NFT delivery endpoints. The attacker model: anyone can opt in to a
 * 1-of-1 plot/commander ASA and previously could pull it out of admin custody
 * by POSTing their own address. The gate must only ever allow the exact
 * registered wallet of the in-game owner.
 */
import { describe, it, expect, vi } from "vitest";
import {
  evaluateNftDeliveryClaim,
  createPaymentReplayGuard,
  type PaymentRedemptionStore,
  type PaymentRedemption,
} from "./security";

const OWNER = "OWNERWALLETADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const ATTACKER = "ATTACKERWALLETADDRESSAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("evaluateNftDeliveryClaim", () => {
  it("allows delivery to the owner's registered wallet", () => {
    expect(
      evaluateNftDeliveryClaim({ ownerAddress: OWNER, requestedAddress: OWNER })
    ).toEqual({ allow: true });
  });

  it("denies any address that is not the owner's registered wallet (theft path)", () => {
    expect(
      evaluateNftDeliveryClaim({ ownerAddress: OWNER, requestedAddress: ATTACKER })
    ).toEqual({ allow: false, reason: "not_owner" });
  });

  it("denies when the parcel/commander has no resolvable owner", () => {
    for (const ownerAddress of [null, undefined, ""]) {
      expect(
        evaluateNftDeliveryClaim({ ownerAddress, requestedAddress: ATTACKER })
      ).toEqual({ allow: false, reason: "no_registered_owner" });
    }
  });

  it("denies placeholder identities — they can never take delivery", () => {
    expect(
      evaluateNftDeliveryClaim({ ownerAddress: "PLAYER_WALLET", requestedAddress: "PLAYER_WALLET" })
    ).toEqual({ allow: false, reason: "no_registered_owner" });
    expect(
      evaluateNftDeliveryClaim({ ownerAddress: "AI_NEXUS7", requestedAddress: "AI_NEXUS7" })
    ).toEqual({ allow: false, reason: "no_registered_owner" });
  });

  it("requires an exact match — prefixes/suffixes/case variants are denied", () => {
    expect(
      evaluateNftDeliveryClaim({ ownerAddress: OWNER, requestedAddress: OWNER.slice(0, -1) })
    ).toEqual({ allow: false, reason: "not_owner" });
    expect(
      evaluateNftDeliveryClaim({ ownerAddress: OWNER, requestedAddress: `${OWNER}A` })
    ).toEqual({ allow: false, reason: "not_owner" });
    expect(
      evaluateNftDeliveryClaim({ ownerAddress: OWNER, requestedAddress: OWNER.toLowerCase() })
    ).toEqual({ allow: false, reason: "not_owner" });
  });
});

// ── Payment replay guard ──────────────────────────────────────────────────────
// Attacker model: one confirmed ALGO payment, replayed across requests
// (sequentially or concurrently) to buy unlimited plots/commanders.

const META: PaymentRedemption = { purpose: "plot_purchase", refId: "42", playerId: "p1" };

/** In-memory store with real claim-once semantics (mirrors the tx_id PK). */
function fakeStore(): PaymentRedemptionStore & { rows: Map<string, PaymentRedemption> } {
  const rows = new Map<string, PaymentRedemption>();
  return {
    rows,
    async tryInsert(txId, meta) {
      if (rows.has(txId)) return false;
      rows.set(txId, meta);
      return true;
    },
    async remove(txId) {
      rows.delete(txId);
    },
  };
}

describe("createPaymentReplayGuard", () => {
  it("allows the first claim and denies every replay", async () => {
    const guard = createPaymentReplayGuard(fakeStore());
    expect(await guard.claim("TX1", META)).toEqual({ ok: true });
    expect(await guard.claim("TX1", META)).toEqual({ ok: false, reason: "already_redeemed" });
    expect(await guard.claim("TX1", { ...META, purpose: "commander_mint" })).toEqual({
      ok: false,
      reason: "already_redeemed",
    });
    // a different payment is unaffected
    expect(await guard.claim("TX2", META)).toEqual({ ok: true });
  });

  it("a released claim (failed purchase) can be redeemed again", async () => {
    const guard = createPaymentReplayGuard(fakeStore());
    expect(await guard.claim("TX1", META)).toEqual({ ok: true });
    await guard.release("TX1");
    expect(await guard.claim("TX1", META)).toEqual({ ok: true });
  });

  it("only one concurrent claimant wins for the same txid", async () => {
    const guard = createPaymentReplayGuard(fakeStore());
    const results = await Promise.all([
      guard.claim("TX1", META),
      guard.claim("TX1", META),
      guard.claim("TX1", META),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toHaveLength(2);
  });

  it("fails CLOSED when the store errors — no purchase on a broken ledger", async () => {
    const guard = createPaymentReplayGuard({
      tryInsert: vi.fn().mockRejectedValue(new Error("db down")),
      remove: vi.fn(),
    });
    expect(await guard.claim("TX1", META)).toEqual({ ok: false, reason: "store_unavailable" });
  });

  it("release never throws, even when the store errors", async () => {
    const guard = createPaymentReplayGuard({
      tryInsert: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockRejectedValue(new Error("db down")),
    });
    await guard.claim("TX1", META);
    await expect(guard.release("TX1")).resolves.toBeUndefined();
  });

  it("storeless (dev/mem) mode still enforces claim-once within the process", async () => {
    const guard = createPaymentReplayGuard(null);
    expect(await guard.claim("TX1", META)).toEqual({ ok: true });
    expect(await guard.claim("TX1", META)).toEqual({ ok: false, reason: "already_redeemed" });
    await guard.release("TX1");
    expect(await guard.claim("TX1", META)).toEqual({ ok: true });
  });
});
