/**
 * usePlannerDraft
 * Persists Battle Planner origin/target parcel selection to localStorage.
 * Safe in SSR/test environments (no-op when window is unavailable).
 */

const DRAFT_KEY = 'planner_draft';

export interface PlannerDraft {
  selectedParcelId: string | null;
  plannerSourceParcelId: string | null;
  selectedCommanderId?: string | null;
  savedAt: number;
}

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

export function readDraft(): PlannerDraft | null {
  if (!hasWindow()) return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlannerDraft;
    // Basic shape validation
    if (typeof parsed !== 'object' || parsed === null) return null;
    if (!('savedAt' in parsed)) return null;
    return parsed;
  } catch {
    clearDraft();
    return null;
  }
}

export function writeDraft(draft: Omit<PlannerDraft, 'savedAt'>): void {
  if (!hasWindow()) return;
  try {
    const payload: PlannerDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // Storage quota exceeded or private mode — fail silently
  }
}

export function clearDraft(): void {
  if (!hasWindow()) return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // fail silently
  }
}
