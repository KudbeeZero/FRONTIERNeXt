/**
 * server/engine/narrative/plotTerminal.ts
 *
 * The plot-select "command terminal" briefing — a short, in-character tactical
 * readout for whichever plot the player just clicked, replacing a wall of
 * static stat text with something that reads like a live AI terminal.
 *
 * Same two-path shape as ./advisor.ts (this repo's existing LLM precedent):
 *   - Heuristic (always available, pure): deterministic lines built from the
 *     plot's real state — biome, richness, defense, ownership.
 *   - LLM (optional): if ANTHROPIC_API_KEY is set, asks Claude for a punchy
 *     2-4 line terminal briefing in the same voice. Any failure — missing
 *     key, network error, malformed response — falls back to the heuristic.
 *     No SDK dependency — plain fetch, mirroring advisor.ts.
 */

import type { BiomeType } from "@shared/schema";

export type PlotOwnership = "player" | "ai_enemy" | "human_enemy" | "unclaimed";

export interface PlotTerminalInput {
  plotId: number;
  biome: BiomeType;
  richness: number; // 0-100
  defenseLevel: number;
  ownership: PlotOwnership;
}

export interface PlotTerminalBrief {
  lines: string[];
  source: "heuristic" | "llm";
}

function richnessTier(richness: number): string {
  if (richness >= 80) return "rich";
  if (richness >= 50) return "moderate";
  return "sparse";
}

function defenseTier(defenseLevel: number): string {
  if (defenseLevel >= 7) return "heavily fortified";
  if (defenseLevel >= 3) return "lightly defended";
  return "undefended";
}

/** Deterministic terminal lines — always available. */
export function heuristicBrief(input: PlotTerminalInput): PlotTerminalBrief {
  const { biome, richness, defenseLevel, ownership } = input;
  const rTier = richnessTier(richness);
  const dTier = defenseTier(defenseLevel);

  let lines: string[];
  switch (ownership) {
    case "player":
      lines = [
        `> SCAN COMPLETE — ${biome} sector, plot ${input.plotId}.`,
        `> Held under your command. Defense: ${dTier} (${defenseLevel}). Yield: ${rTier} (${richness}).`,
        `> Status: HOLDING.`,
      ];
      break;
    case "ai_enemy":
      lines = [
        `> HOSTILE SIGNATURE — AI faction, ${biome} sector.`,
        `> Defense: ${dTier} (${defenseLevel}). Engagement risk ${defenseLevel >= 7 ? "high" : defenseLevel >= 3 ? "moderate" : "low"}.`,
        `> Recommend: ${defenseLevel >= 7 ? "reconnaissance before engagement" : "attack authorized"}.`,
      ];
      break;
    case "human_enemy":
      lines = [
        `> RIVAL COMMANDER DETECTED — ${biome} sector, plot ${input.plotId}.`,
        `> Defense: ${dTier} (${defenseLevel}). Yield: ${rTier} (${richness}).`,
        `> Recommend: ${defenseLevel >= 7 ? "reconnaissance before engagement" : "attack authorized"}.`,
      ];
      break;
    case "unclaimed":
    default:
      lines = [
        `> SCAN COMPLETE — ${biome} sector, plot ${input.plotId}. Unclaimed.`,
        `> Yield index: ${rTier} (${richness}/100).`,
        `> Recommend: seize before a rival faction does.`,
      ];
  }
  return { lines, source: "heuristic" };
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
 * Generate the terminal briefing. Uses Claude when ANTHROPIC_API_KEY is set,
 * otherwise (and on any LLM error) falls back to the deterministic heuristic.
 */
export async function plotTerminalBrief(input: PlotTerminalInput): Promise<PlotTerminalBrief> {
  const heuristic = heuristicBrief(input);
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return heuristic;

  try {
    const model = process.env.PLOT_TERMINAL_MODEL ?? "claude-haiku-4-5-20251001";
    const system =
      "You are FRONTIER's tactical AI terminal — the readout a commander sees the instant they select a map " +
      "sector. Voice: terse, military, sci-fi HUD. Respond ONLY with compact JSON: " +
      '{"lines": [<2 to 4 short strings, each starting with "> ", no line over ~70 chars>]}. ' +
      "No commentary outside the JSON.";
    const ownershipLabel =
      input.ownership === "player" ? "held by the commander (the player)"
      : input.ownership === "ai_enemy" ? "held by a hostile AI faction"
      : input.ownership === "human_enemy" ? "held by a rival human commander"
      : "unclaimed";
    const user =
      `Plot ${input.plotId}: biome=${input.biome}, richness=${input.richness}/100, ` +
      `defenseLevel=${input.defenseLevel}/10, ownership=${ownershipLabel}.`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 300, system, messages: [{ role: "user", content: user }] }),
    });
    if (!resp.ok) throw new Error(`anthropic ${resp.status}`);
    const data: any = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const parsed = JSON.parse(extractJson(text));

    const lines: string[] = Array.isArray(parsed.lines)
      ? parsed.lines.filter((l: unknown) => typeof l === "string" && l.trim()).slice(0, 4)
      : [];
    if (lines.length === 0) return heuristic;

    return { lines, source: "llm" };
  } catch {
    return heuristic; // never hard-fail on a missing/broken LLM path
  }
}
