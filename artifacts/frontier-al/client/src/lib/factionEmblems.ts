/**
 * client/src/lib/factionEmblems.ts
 *
 * Hero emblem art per faction (client/src/lib/factions.ts) — same pattern as
 * armory/archetypeImages.ts and commander/shared.ts's COMMANDER_IMAGES.
 */
import nexus7Img from "@assets/faction-emblem-nexus7.png";
import kronosImg from "@assets/faction-emblem-kronos.png";
import vanguardImg from "@assets/faction-emblem-vanguard.png";
import spectreImg from "@assets/faction-emblem-spectre.png";
import type { PlayerFactionId } from "@shared/waitlist";

export const FACTION_EMBLEMS: Record<PlayerFactionId, string> = {
  "NEXUS-7": nexus7Img,
  KRONOS: kronosImg,
  VANGUARD: vanguardImg,
  SPECTRE: spectreImg,
};
