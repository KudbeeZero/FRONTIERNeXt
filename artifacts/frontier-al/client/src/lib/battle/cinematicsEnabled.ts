/**
 * client/src/lib/battle/cinematicsEnabled.ts
 *
 * Single chokepoint deciding whether the battle cinematics (globe resolution
 * cinematic, incoming-attack telegraph, HUD callout, animated modal timeline)
 * should play. They play only when the player hasn't disabled them AND the OS
 * isn't asking to reduce motion — flashing combat FX can be a vestibular /
 * photosensitivity problem, so reduced-motion users get the static fallbacks
 * (the live-event boxes + the textual replay log still convey every outcome).
 *
 * CONTRACT: pure.
 */
export function shouldPlayBattleCinematics(
  enabled: boolean,
  prefersReducedMotion: boolean,
): boolean {
  return enabled && !prefersReducedMotion;
}
