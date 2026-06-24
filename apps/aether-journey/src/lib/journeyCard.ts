/**
 * journeyCard — the pure data behind the shareable end-of-run card.
 *
 * Turns a finished run (ending + trust + the flags the player accrued) into a
 * compact, deterministic "card" identity: a title, a verdict line, a rating seal,
 * the few defining choices, and a stable fingerprint code. Pure + unit-tested so the
 * shareable artifact is reproducible; the canvas rendering + share/download live in
 * ui/ShareCard.tsx.
 */
import { ENDING_COPY, type Ending } from "./descent";

export interface JourneyCard {
  /** Ending title (or a neutral fallback if the run ended pre-finale). */
  title: string;
  /** The ending's one-line verdict. */
  verdict: string;
  ending: Ending | null;
  /** Final trust in Aether, clamped 0–100. */
  trust: number;
  /** A seal/grade for the run (S/A/B/C). */
  rating: string;
  /** Up to 3 defining choices, most dramatic first. */
  highlights: string[];
  /** Stable short fingerprint of this exact run (e.g. "AE-3K7Q2"). */
  seed: string;
}

// Flags → human "defining choice" lines, in priority order (most dramatic first).
const HIGHLIGHTS: { flag: string; text: string }[] = [
  { flag: "sacrificed_aether", text: "Chose the ship over her" },
  { flag: "starved_self", text: "Went without to keep her whole" },
  { flag: "trusted_aether_blind", text: "Trusted her read in the dark" },
  { flag: "trusted_aether", text: "Trusted her judgment when it counted" },
  { flag: "solo_decode", text: "Cracked the beacon alone" },
  { flag: "comms_lost", text: "Cut the link home to survive" },
  { flag: "vesta_contained", text: "Contained VESTA by hand" },
  { flag: "lifeSupport_critical", text: "Ran life-support to the edge" },
  { flag: "vesta_loose", text: "Left VESTA loose in the dark" },
];

/** Display hue per ending — drives the card's glow + accent. */
export const ENDING_HUE: Record<Ending, string> = {
  bonded: "#7fe7ff",
  functional: "#ffd27f",
  severance: "#ff7a6a",
};

const clamp100 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const ratingFor = (ending: Ending | null, trust: number): string => {
  if (ending === "bonded") return trust >= 85 ? "S" : "A";
  if (ending === "functional") return "B";
  if (ending === "severance") return "C";
  return "—";
};

// A stable, dependency-free fingerprint of the run — its shareable "serial number".
function seedFrom(ending: Ending | null, trust: number, flags: string[]): string {
  const basis = `${ending ?? "none"}:${clamp100(trust)}:${[...flags].sort().join(",")}`;
  let h = 0;
  for (let i = 0; i < basis.length; i++) h = (h * 31 + basis.charCodeAt(i)) >>> 0;
  return "AE-" + h.toString(36).toUpperCase().padStart(5, "0").slice(0, 5);
}

export function buildJourneyCard(input: {
  ending: Ending | null;
  trust: number;
  flags: string[];
}): JourneyCard {
  const { ending, trust, flags } = input;
  const copy = ending ? ENDING_COPY[ending] : null;
  const highlights = HIGHLIGHTS.filter((h) => flags.includes(h.flag))
    .map((h) => h.text)
    .slice(0, 3);
  return {
    title: copy ? copy.title : "FIRST WATCH",
    verdict: copy
      ? copy.line
      : "The course to Mars holds, and for the first time since the storm, neither of you is alone.",
    ending,
    trust: clamp100(trust),
    rating: ratingFor(ending, trust),
    highlights,
    seed: seedFrom(ending, trust, flags),
  };
}
