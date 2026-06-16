import { useSyncExternalStore } from "react";
import {
  getVisualPrefs,
  subscribeVisualPrefs,
  type VisualPrefs,
} from "@/lib/globe/visualPrefs";

/** Reactive read of the globe visual preferences (territory/enemy colours). */
export function useVisualPrefs(): VisualPrefs {
  return useSyncExternalStore(subscribeVisualPrefs, getVisualPrefs, getVisualPrefs);
}
