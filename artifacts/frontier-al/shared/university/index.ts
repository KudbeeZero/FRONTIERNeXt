/**
 * shared/university/index.ts
 *
 * Public surface of the FRONTIER University (in-game tutorial academy). The
 * client UniversityPanel and any future server progress-tracking import from here.
 */

export * from "./types";
export * from "./grade";
export * from "./curriculum";

import { CURRICULUM } from "./curriculum";

/** id → module lookup. */
export function getModule(id: string) {
  return CURRICULUM.find((m) => m.id === id);
}
