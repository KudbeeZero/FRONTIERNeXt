/**
 * client/src/components/game/armory/badgeImages.ts
 *
 * Medallion art per earned badge tier (shared/weapons/types.ts's BadgeTier) — same
 * pattern as archetypeImages.ts. "none" has no medallion; the badge wall falls back
 * to its plain text chip for that case.
 */
import bronzeImg from "@assets/badge-bronze.png";
import silverImg from "@assets/badge-silver.png";
import goldImg from "@assets/badge-gold.png";
import hallOfFameImg from "@assets/badge-hall-of-fame.png";

export const BADGE_TIER_IMAGES: Partial<Record<string, string>> = {
  bronze: bronzeImg,
  silver: silverImg,
  gold: goldImg,
  hall_of_fame: hallOfFameImg,
};
