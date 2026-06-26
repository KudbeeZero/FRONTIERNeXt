/**
 * Pins the pure waitlist validation + reward-tier logic used by both the client
 * faction-select form and the server route (identical rules on both sides).
 */
import { describe, it, expect } from "vitest";
import {
  validateWaitlistSignup,
  isValidFactionId,
  isValidEmail,
  looksLikeAlgoAddress,
  waitlistKey,
  commitTier,
} from "./waitlist";

// A syntactically valid 58-char Algorand-style address (base32 A-Z2-7).
const ADDR = "A".repeat(58);

describe("isValidFactionId", () => {
  it("accepts the four factions, rejects anything else", () => {
    for (const f of ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"]) {
      expect(isValidFactionId(f)).toBe(true);
    }
    expect(isValidFactionId("DEV-TEST-COMMANDER")).toBe(false);
    expect(isValidFactionId("")).toBe(false);
    expect(isValidFactionId(7 as unknown)).toBe(false);
  });
});

describe("address + email shape checks", () => {
  it("address must be 58-char base32", () => {
    expect(looksLikeAlgoAddress(ADDR)).toBe(true);
    expect(looksLikeAlgoAddress("A".repeat(57))).toBe(false);
    expect(looksLikeAlgoAddress("a".repeat(58))).toBe(false); // lowercase
    expect(looksLikeAlgoAddress("1".repeat(58))).toBe(false); // 0/1/8/9 not in base32
  });

  it("email must look like an email", () => {
    expect(isValidEmail("pilot@frontier.app")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
  });
});

describe("validateWaitlistSignup", () => {
  it("requires a valid faction", () => {
    expect(validateWaitlistSignup({ faction: "BOGUS", email: "p@x.io" }).ok).toBe(false);
  });

  it("requires at least one contact (address or email)", () => {
    const r = validateWaitlistSignup({ faction: "KRONOS" });
    expect(r.ok).toBe(false);
  });

  it("accepts a faction + wallet address; normalizes to upper", () => {
    const r = validateWaitlistSignup({ faction: "NEXUS-7", address: ADDR.toLowerCase() });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.address).toBe(ADDR);
      expect(r.value.email).toBeNull();
      expect(r.value.faction).toBe("NEXUS-7");
    }
  });

  it("accepts a faction + email; normalizes to lower + trims", () => {
    const r = validateWaitlistSignup({ faction: "SPECTRE", email: "  Pilot@Frontier.APP " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.email).toBe("pilot@frontier.app");
      expect(r.value.address).toBeNull();
    }
  });

  it("rejects a malformed address / email", () => {
    expect(validateWaitlistSignup({ faction: "KRONOS", address: "tooshort" }).ok).toBe(false);
    expect(validateWaitlistSignup({ faction: "KRONOS", email: "nope" }).ok).toBe(false);
  });
});

describe("waitlistKey", () => {
  it("prefers wallet address over email", () => {
    expect(waitlistKey({ faction: "KRONOS", address: ADDR, email: "p@x.io" })).toBe(`addr:${ADDR}`);
    expect(waitlistKey({ faction: "KRONOS", address: null, email: "p@x.io" })).toBe("email:p@x.io");
  });
});

describe("commitTier", () => {
  it("rises with engagement, monotonic, carries no token value", () => {
    expect(commitTier(1)).toBe("Recruit");
    expect(commitTier(2)).toBe("Recruit");
    expect(commitTier(3)).toBe("Operative");
    expect(commitTier(7)).toBe("Vanguard");
    expect(commitTier(15)).toBe("Commander");
    expect(commitTier(999)).toBe("Commander");
  });
});
