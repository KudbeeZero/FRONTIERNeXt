/**
 * server/engine/narrative/advisor.ts
 *
 * Terraforming advisor. Given a parcel's live state and the player's goal, it
 * recommends the next terraform step.
 *
 * Two paths, same output shape:
 *   - Heuristic (always available, pure): ranks biomes by the canonical battle
 *     BIOME_DEFENSE_MOD and the resource biomeBonuses, and prioritises fixing low
 *     stability / high hazard first.
 *   - LLM (optional): if ANTHROPIC_API_KEY is set, asks Claude for the biome,
 *     action and rationale (numeric scores are always recomputed locally, and any
 *     failure falls back to the heuristic). No SDK dependency — plain fetch.
 */

import { BIOME_DEFENSE_MOD } from "../battle/tuning.js";
import { biomeBonuses } from "@shared/schema";
import type { BiomeType } from "@shared/schema";

export type TerraformGoal = "defense" | "yield" | "balanced";
export type TerraformAction =
  | "convert_biome" | "increase_stability" | "reduce_hazard" | "boost_resources" | "none";

export interface TerraformAdviceInput {
  biome: BiomeType;
  stability: number;       // 0-100
  hazardLevel: number;     // 0-100
  yieldMultiplier: number; // ~1.0+
  goal: TerraformGoal;
}

export interface TerraformAdvice {
  goal: TerraformGoal;
  currentBiome: BiomeType;
  recommendedBiome: BiomeType;
  recommendedAction: TerraformAction;
  rationale: string;
  currentDefenseMod: number;
  recommendedDefenseMod: number;
  currentYieldScore: number;
  recommendedYieldScore: number;
  source: "heuristic" | "llm";
}

const BIOMES: BiomeType[] = [
  "water", "desert", "plains", "forest", "swamp", "tundra", "volcanic", "mountain",
];

const LOW_STABILITY = 30;
const HIGH_HAZARD = 50;

const defenseScore = (b: BiomeType): number => BIOME_DEFENSE_MOD[b] ?? 1.0;
const yieldScore = (b: BiomeType): number => {
  const bb = biomeBonuses[b];
  return (bb.ironMod + bb.fuelMod + bb.crystalMod) / 3;
};

const MAX_DEFENSE = Math.max(...BIOMES.map(defenseScore));
const MAX_YIELD = Math.max(...BIOMES.map(yieldScore));

function goalScore(b: BiomeType, goal: TerraformGoal): number {
  const d = defenseScore(b) / MAX_DEFENSE;
  const y = yieldScore(b) / MAX_YIELD;
  if (goal === "defense") return d;
  if (goal === "yield") return y;
  return 0.5 * d + 0.5 * y;
}

function bestBiomeFor(goal: TerraformGoal): BiomeType {
  return BIOMES.reduce((best, b) => (goalScore(b, goal) > goalScore(best, goal) ? b : best), BIOMES[0]);
}

/** Pure, deterministic recommendation — always available. */
export function heuristicAdvice(input: TerraformAdviceInput): TerraformAdvice {
  const base = {
    goal: input.goal,
    currentBiome: input.biome,
    currentDefenseMod: defenseScore(input.biome),
    currentYieldScore: Number(yieldScore(input.biome).toFixed(3)),
    source: "heuristic" as const,
  };

  // 1. Stabilise / decontaminate before re-terraforming.
  if (input.stability < LOW_STABILITY) {
    return {
      ...base,
      recommendedBiome: input.biome,
      recommendedAction: "increase_stability",
      rationale: `Stability is low (${input.stability}). Increase stability before further biome work — converting now risks tipping the plot into a degraded state.`,
      recommendedDefenseMod: defenseScore(input.biome),
      recommendedYieldScore: Number(yieldScore(input.biome).toFixed(3)),
    };
  }
  if (input.hazardLevel > HIGH_HAZARD) {
    return {
      ...base,
      recommendedBiome: input.biome,
      recommendedAction: "reduce_hazard",
      rationale: `Hazard is high (${input.hazardLevel}). Reduce hazard first to protect yield and stability.`,
      recommendedDefenseMod: defenseScore(input.biome),
      recommendedYieldScore: Number(yieldScore(input.biome).toFixed(3)),
    };
  }

  // 2. Optimise biome for the goal.
  const target = bestBiomeFor(input.goal);
  if (target === input.biome) {
    return {
      ...base,
      recommendedBiome: input.biome,
      recommendedAction: input.goal === "yield" ? "boost_resources" : "none",
      rationale:
        input.goal === "yield"
          ? `${input.biome} is already the strongest resource biome — boost_resources to push yield higher.`
          : `${input.biome} is already optimal for a ${input.goal} goal (defense ×${defenseScore(input.biome).toFixed(2)}). No conversion needed.`,
      recommendedDefenseMod: defenseScore(input.biome),
      recommendedYieldScore: Number(yieldScore(input.biome).toFixed(3)),
    };
  }
  return {
    ...base,
    recommendedBiome: target,
    recommendedAction: "convert_biome",
    rationale: `For a ${input.goal} goal, convert ${input.biome} → ${target} (defense ×${defenseScore(input.biome).toFixed(2)} → ×${defenseScore(target).toFixed(2)}, yield ${yieldScore(input.biome).toFixed(2)} → ${yieldScore(target).toFixed(2)}).`,
    recommendedDefenseMod: defenseScore(target),
    recommendedYieldScore: Number(yieldScore(target).toFixed(3)),
  };
}

function extractJson(text: string): string {
  // Strip ```json / ``` code fences, then take the first balanced { ... } object.
  const unfenced = text.replace(/```(?:json)?/gi, "").trim();
  const start = unfenced.indexOf("{");
  if (start < 0) return unfenced;
  let depth = 0;
  for (let i = start; i < unfenced.length; i++) {
    if (unfenced[i] === "{") depth++;
    else if (unfenced[i] === "}" && --depth === 0) return unfenced.slice(start, i + 1);
  }
  return unfenced.slice(start);
}

/**
 * Recommend a terraform step. Uses Claude when ANTHROPIC_API_KEY is set,
 * otherwise (and on any LLM error) falls back to the deterministic heuristic.
 */
export async function recommendTerraform(input: TerraformAdviceInput): Promise<TerraformAdvice> {
  const heuristic = heuristicAdvice(input);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristic;

  try {
    const model = process.env.ADVISOR_MODEL ?? "claude-haiku-4-5-20251001";
    const system =
      "You are the Ascendancy terraforming advisor. Recommend ONE next terraform step for a land parcel. " +
      `Battle defense modifiers by biome: ${JSON.stringify(BIOME_DEFENSE_MOD)}. ` +
      `Resource yield mods by biome (iron/fuel/crystal): ${JSON.stringify(biomeBonuses)}. ` +
      "Higher defense modifier = harder to capture. Respond ONLY with compact JSON: " +
      '{"recommendedBiome": <one of ' + JSON.stringify(BIOMES) + '>, "recommendedAction": <one of ["convert_biome","increase_stability","reduce_hazard","boost_resources","none"]>, "rationale": <one sentence>}.';
    const user =
      `Parcel: biome=${input.biome}, stability=${input.stability}, hazard=${input.hazardLevel}, ` +
      `yieldMultiplier=${input.yieldMultiplier}. Player goal: ${input.goal}.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 400, system, messages: [{ role: "user", content: user }] }),
    });
    if (!resp.ok) throw new Error(`anthropic ${resp.status}`);
    const data: any = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(extractJson(text));

    const recommendedBiome: BiomeType = BIOMES.includes(parsed.recommendedBiome)
      ? parsed.recommendedBiome
      : heuristic.recommendedBiome;
    const recommendedAction: TerraformAction =
      ["convert_biome", "increase_stability", "reduce_hazard", "boost_resources", "none"].includes(parsed.recommendedAction)
        ? parsed.recommendedAction
        : heuristic.recommendedAction;

    return {
      ...heuristic,
      recommendedBiome,
      recommendedAction,
      rationale: typeof parsed.rationale === "string" && parsed.rationale.trim() ? parsed.rationale.trim() : heuristic.rationale,
      recommendedDefenseMod: defenseScore(recommendedBiome),
      recommendedYieldScore: Number(yieldScore(recommendedBiome).toFixed(3)),
      source: "llm",
    };
  } catch {
    return heuristic; // never hard-fail on a missing/broken LLM path
  }
}
