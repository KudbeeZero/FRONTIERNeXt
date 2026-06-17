/**
 * shared/university/types.ts
 *
 * FRONTIER University — the in-game "how to play" academy. Pure types for an
 * interactive, replayable tutorial system: each game SYSTEM (the globe, combat,
 * builds, the economy, your Algorand wallet…) gets a module the player can take
 * at any time — a short guided walkthrough followed by a quick knowledge check.
 *
 * Types only — imported by client (the UniversityPanel UI), the curriculum data,
 * and the pure grading/integrity logic. No React, no server.
 */

/** The game systems the academy can teach. One module may cover one system. */
export type GameSystem =
  | "globe"      // the planet, plots, biomes
  | "builds"     // weapon attribute builds + archetypes
  | "combat"     // strikes, defense, interception
  | "economy"    // ASCEND + pricing
  | "wallet"     // the Algorand wallet: connect, opt-in, claim
  | "factions"   // the four AI factions
  | "commanders" // commander tiers, special attacks, NFT mint
  | "trade"      // the trade station: resource & sub-parcel swaps
  | "markets"    // prediction markets + provable fairness
  | "terraform"  // reshaping biomes: hazard/stability/resources
  | "seasons"    // the persistent season cycle + rewards
  | "orbital"    // satellites (yield) + recon drones
  | "nft"        // how plots/commanders/weapons mint as Algorand ASAs
  | "basics";    // first-10-minutes onboarding path

/** One screen of a guided walkthrough. */
export interface TutorialStep {
  title: string;
  /** Plain prose (rendered as simple paragraphs — no markdown engine needed). */
  body: string;
  /** Optional highlighted call-out shown beneath the body. */
  tip?: string;
}

/** A single multiple-choice knowledge-check question. */
export interface QuizQuestion {
  id: string;
  prompt: string;
  /** 2+ answer choices. */
  options: string[];
  /** Index into `options` of the correct answer. */
  correctIndex: number;
  /** Shown after the player answers, right or wrong. */
  explanation: string;
}

/** A complete, self-contained lesson the player can take any time. */
export interface TutorialModule {
  id: string;
  system: GameSystem;
  title: string;
  /** One-line teaser shown in the catalog. */
  summary: string;
  /** Rough time to complete, in minutes (display only). */
  estMinutes: number;
  steps: TutorialStep[];
  quiz: QuizQuestion[];
}
