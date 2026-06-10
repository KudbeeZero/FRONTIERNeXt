/**
 * server/security.spec.ts
 *
 * Decision table for evaluateNftDeliveryClaim — the ownership gate on the
 * public NFT delivery endpoints. The attacker model: anyone can opt in to a
 * 1-of-1 plot/commander ASA and previously could pull it out of admin custody
 * by POSTing their own address. The gate must only ever allow the exact
 * registered wallet of the in-game owner.
 */
import { describe, it, expect } from "vitest";
import { evaluateNftDeliveryClaim } from "./security";

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
