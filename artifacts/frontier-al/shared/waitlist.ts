/**
 * shared/waitlist.ts
 *
 * Pure validation + reward-tier logic for the optional "play-to-waitlist" signup
 * on the faction-select entry gate. A player can come in, pick a faction, and —
 * if they want — drop a wallet address and/or email to join the early-access
 * waitlist. Nothing here moves funds: it only validates + normalizes the signup
 * and maps engagement (commit count) to a cosmetic reward-tier label. The actual
 * on-chain reward is a SEPARATE, gated unit (mainnet-gate + algo-auditor).
 *
 * Shared so the client form and the server route validate identically.
 */

/** The four factions a player can align with (mirror the AI faction names). */
export const PLAYER_FACTION_IDS = ["NEXUS-7", "KRONOS", "VANGUARD", "SPECTRE"] as const;
export type PlayerFactionId = (typeof PLAYER_FACTION_IDS)[number];

export function isValidFactionId(v: unknown): v is PlayerFactionId {
  return typeof v === "string" && (PLAYER_FACTION_IDS as readonly string[]).includes(v);
}

/** Lightweight Algorand-address shape check (58-char base32). No algosdk dep so
 *  the client form stays light; the server route additionally hard-checks it. */
export function looksLikeAlgoAddress(v: string): boolean {
  return /^[A-Z2-7]{58}$/.test(v);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(v: string): boolean {
  return EMAIL_RE.test(v) && v.length <= 254;
}

export interface WaitlistSignupInput {
  faction?: unknown;
  address?: unknown;
  email?: unknown;
}

export interface NormalizedWaitlistSignup {
  faction: PlayerFactionId;
  address: string | null;
  email: string | null;
}

export type WaitlistValidation =
  | { ok: true; value: NormalizedWaitlistSignup }
  | { ok: false; error: string };

/**
 * Validate + normalize a waitlist signup. Requires a known faction and — since a
 * signup must be reachable — at least one valid contact (wallet address or email).
 * Trims/uppercases the address and lowercases the email.
 */
export function validateWaitlistSignup(input: WaitlistSignupInput): WaitlistValidation {
  if (!isValidFactionId(input.faction)) {
    return { ok: false, error: "Pick a valid faction" };
  }

  let address: string | null = null;
  if (input.address != null && input.address !== "") {
    if (typeof input.address !== "string") return { ok: false, error: "Invalid wallet address" };
    const a = input.address.trim().toUpperCase();
    if (!looksLikeAlgoAddress(a)) return { ok: false, error: "Invalid wallet address" };
    address = a;
  }

  let email: string | null = null;
  if (input.email != null && input.email !== "") {
    if (typeof input.email !== "string") return { ok: false, error: "Invalid email" };
    const e = input.email.trim().toLowerCase();
    if (!isValidEmail(e)) return { ok: false, error: "Invalid email" };
    email = e;
  }

  if (!address && !email) {
    return { ok: false, error: "Add a wallet address or email to join the waitlist" };
  }

  return { ok: true, value: { faction: input.faction, address, email } };
}

/** Stable key a signup is stored under (wallet wins; else email). */
export function waitlistKey(s: NormalizedWaitlistSignup): string {
  return s.address ? `addr:${s.address}` : `email:${s.email}`;
}

/**
 * Cosmetic engagement tier — "the more you commit, the more you're rewarded."
 * Maps how many times a player has signed in / committed to a rank label. Pure;
 * carries NO token value (the real reward is the gated on-chain unit).
 */
export const WAITLIST_TIERS = [
  { min: 1,  label: "Recruit" },
  { min: 3,  label: "Operative" },
  { min: 7,  label: "Vanguard" },
  { min: 15, label: "Commander" },
] as const;

export function commitTier(commitCount: number): string {
  let label: string = WAITLIST_TIERS[0].label;
  for (const t of WAITLIST_TIERS) if (commitCount >= t.min) label = t.label;
  return label;
}
