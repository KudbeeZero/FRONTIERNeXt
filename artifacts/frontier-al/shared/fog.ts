/**
 * Fog-of-war visibility — pure math, no rendering dependencies so it can be
 * unit-tested and shared. A plot is "visible" if the current player owns it or
 * it lies within `radius` of one of their owned plots; everything else is
 * hidden (rendered dimmed by the globe). Opt-in: the globe only applies this
 * when the player enables fog of war.
 */

/** Brightness multiplier applied to hidden tiles when fog of war is on. */
export const FOG_DIM_HIDDEN = 0.16;

/**
 * @param positions flat [x,y,z, x,y,z, ...] array of every plot's 3D position
 * @param ownedIndices indices (into the positions array / plot list) the player owns
 * @param radius euclidean reveal radius around each owned plot
 * @returns set of plot indices that are visible
 */
export function computeVisiblePlotIndices(
  positions: ArrayLike<number>,
  ownedIndices: number[],
  radius: number,
): Set<number> {
  const visible = new Set<number>();
  if (ownedIndices.length === 0) return visible;
  const n = Math.floor(positions.length / 3);
  const r2 = radius * radius;
  for (const oi of ownedIndices) {
    if (oi < 0 || oi >= n) continue;
    visible.add(oi);
    const ox = positions[oi * 3], oy = positions[oi * 3 + 1], oz = positions[oi * 3 + 2];
    for (let i = 0; i < n; i++) {
      if (visible.has(i)) continue;
      const dx = positions[i * 3] - ox;
      const dy = positions[i * 3 + 1] - oy;
      const dz = positions[i * 3 + 2] - oz;
      if (dx * dx + dy * dy + dz * dz <= r2) visible.add(i);
    }
  }
  return visible;
}
