/**
 * client/src/components/game/armory/archetypeImages.ts
 *
 * Hero art per weapon archetype (shared/weapons/archetypes.ts) — same pattern as
 * commander/shared.ts's COMMANDER_IMAGES. Keyed by Archetype["id"], not a
 * TypeScript union, since ARCHETYPES itself is a plain Record<string, Archetype>.
 */
import siegeBaronImg from "@assets/archetype-siege-baron.png";
import artilleryMarshalImg from "@assets/archetype-artillery-marshal.png";
import hypersonicStrikerImg from "@assets/archetype-hypersonic-striker.png";
import ghostMarksmanImg from "@assets/archetype-ghost-marksman.png";
import aegisInterceptorImg from "@assets/archetype-aegis-interceptor.png";
import swarmCommodoreImg from "@assets/archetype-swarm-commodore.png";

export const ARCHETYPE_IMAGES: Record<string, string> = {
  siege_baron: siegeBaronImg,
  artillery_marshal: artilleryMarshalImg,
  hypersonic_striker: hypersonicStrikerImg,
  ghost_marksman: ghostMarksmanImg,
  aegis_interceptor: aegisInterceptorImg,
  swarm_commodore: swarmCommodoreImg,
};
