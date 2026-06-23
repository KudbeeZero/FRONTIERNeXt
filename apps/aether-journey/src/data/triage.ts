/**
 * Chapter 3 scenario data — the VESTA power-triage bus (see CHAPTER_3_DESIGN.md §5).
 *
 * Tuned so: demands (4+3+4 = 11) > contained bus (10−2 = 8) > mins (2+1+2 = 5).
 * You can never make all three nominal (forced sacrifice), but you can always avoid
 * all-critical (no twitch-fail) — the challenge is which strengths you give up.
 */
import type { TriageConfig } from "../lib/powerTriage";

export const VESTA_TRIAGE: TriageConfig = {
  busTotal: 10,
  vestaDrain: 3,
  containCost: 2,
  consumers: {
    lifeSupport: { demand: 4, min: 2, label: "Life-Support" },
    comms: { demand: 3, min: 1, label: "Comms" },
    aetherCore: { demand: 4, min: 2, label: "Aether's Core" },
  },
};
