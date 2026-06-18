/**
 * pickIndex.ts — deterministic spatial nearest-plot lookup for globe selection.
 *
 * Replaces the O(n) linear scan that `GlobeParcels` ran on every pointer move /
 * click (21k distance² compares per event) with a uniform 3D voxel-hash grid +
 * expanding-ring search.
 *
 * CORRECTNESS CONTRACT: `nearest()` returns the EXACT same index the brute-force
 * scan would (`for i: if (d2 < min) ...`), including its lowest-index tie-break,
 * so selection behavior is byte-identical — only faster. This is proven against
 * the brute force in globe-pickindex.spec.ts.
 *
 * Pure: no THREE, no DOM — node-testable. Built once from the plot positions
 * (memoize the result; do not rebuild per render).
 */

export interface PickIndex {
  /** Index (into the positions array) of the plot nearest to (x,y,z). */
  nearest(x: number, y: number, z: number): number;
}

/**
 * Build a spatial index over a flat `[x0,y0,z0, x1,y1,z1, ...]` positions array
 * (the same `plotPositions3D` Float32Array GlobeParcels already maintains).
 *
 * @param positions flat xyz triples; length must be a multiple of 3.
 * @param cellSize  optional grid cell edge length. Defaults to a value sized so
 *                  the expanding-ring search visits only a handful of cells.
 */
export function buildPickIndex(positions: ArrayLike<number>, cellSize?: number): PickIndex {
  const n = Math.floor(positions.length / 3);

  // Degenerate: no points → nearest is always 0 (matches a brute scan that
  // initializes best=0 and never enters the loop).
  if (n <= 0) {
    return { nearest: () => 0 };
  }

  // Axis-aligned bounds of the point cloud.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  const extent = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  // Default: extent / cbrt(n) keeps a few points per occupied cell so a query
  // resolves in ~2 rings. Guard against a zero/NaN extent (all points equal).
  let cs = cellSize && cellSize > 0
    ? cellSize
    : (extent > 0 ? extent / Math.cbrt(n) : 1);
  // Clamp the minimum cell size so a (mis)supplied tiny cellSize can't explode
  // the grid dimensions — that would waste memory AND overflow the packed cell
  // key `(cx*ny+cy)*nz+cz` past Number.MAX_SAFE_INTEGER, causing key collisions
  // and wrong results. Capping cells/axis keeps the key well within 2^53.
  const MAX_CELLS_PER_AXIS = 2048;
  if (extent > 0) cs = Math.max(cs, extent / MAX_CELLS_PER_AXIS);

  const nx = Math.max(1, Math.floor((maxX - minX) / cs) + 1);
  const ny = Math.max(1, Math.floor((maxY - minY) / cs) + 1);
  const nz = Math.max(1, Math.floor((maxZ - minZ) / cs) + 1);

  const cellOf = (x: number, y: number, z: number): [number, number, number] => [
    Math.min(nx - 1, Math.max(0, Math.floor((x - minX) / cs))),
    Math.min(ny - 1, Math.max(0, Math.floor((y - minY) / cs))),
    Math.min(nz - 1, Math.max(0, Math.floor((z - minZ) / cs))),
  ];
  const key = (cx: number, cy: number, cz: number): number => (cx * ny + cy) * nz + cz;

  // Bucket point indices by cell. Push in ascending index order so each bucket
  // list is sorted — that makes the tie-break (lowest index wins) free.
  const grid = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const [cx, cy, cz] = cellOf(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    const k = key(cx, cy, cz);
    const bucket = grid.get(k);
    if (bucket) bucket.push(i);
    else grid.set(k, [i]);
  }

  const maxRing = Math.max(nx, ny, nz);

  function nearest(qx: number, qy: number, qz: number): number {
    const [cx, cy, cz] = cellOf(qx, qy, qz);
    let best = 0;
    let bestD2 = Infinity;

    const scanCell = (gx: number, gy: number, gz: number): void => {
      if (gx < 0 || gx >= nx || gy < 0 || gy >= ny || gz < 0 || gz >= nz) return;
      const bucket = grid.get(key(gx, gy, gz));
      if (!bucket) return;
      for (let b = 0; b < bucket.length; b++) {
        const i = bucket[b];
        const dx = positions[i * 3] - qx;
        const dy = positions[i * 3 + 1] - qy;
        const dz = positions[i * 3 + 2] - qz;
        const d2 = dx * dx + dy * dy + dz * dz;
        // Strict < keeps the first-seen (lowest index, since buckets are sorted
        // and rings are scanned with ascending bucket order overall). On an exact
        // tie we keep the lower index explicitly to mirror the brute-force scan.
        if (d2 < bestD2 || (d2 === bestD2 && i < best)) {
          bestD2 = d2;
          best = i;
        }
      }
    };

    for (let r = 0; r <= maxRing; r++) {
      if (r === 0) {
        scanCell(cx, cy, cz);
      } else {
        // Chebyshev shell at distance r: cells where max(|dx|,|dy|,|dz|) === r.
        for (let dx = -r; dx <= r; dx++) {
          for (let dy = -r; dy <= r; dy++) {
            for (let dz = -r; dz <= r; dz++) {
              if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== r) continue;
              scanCell(cx + dx, cy + dy, cz + dz);
            }
          }
        }
      }
      // Any point in an unscanned ring (>= r+1) is at least r*cs from the query.
      // Stop only when the best found is STRICTLY closer than that bound, so a
      // farther point sitting exactly on the bound (a tie a brute scan might
      // prefer by lower index) is never skipped.
      if (bestD2 !== Infinity && Math.sqrt(bestD2) < r * cs) break;
    }

    return best;
  }

  return { nearest };
}
