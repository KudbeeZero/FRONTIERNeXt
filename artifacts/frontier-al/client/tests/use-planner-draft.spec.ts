/**
 * Tests for usePlannerDraft localStorage utility
 */

import { describe, it, expect, beforeEach } from "vitest";
import { readDraft, writeDraft, clearDraft } from '../src/hooks/usePlannerDraft';

// Minimal localStorage + window shim for the default-node test environment.
// The hook guards with hasWindow(), so both globals must be present to
// exercise the real localStorage code path.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(key: string): string | null { return this.store.get(key) ?? null; }
  key(i: number): string | null { return Array.from(this.store.keys())[i] ?? null; }
  removeItem(key: string): void { this.store.delete(key); }
  setItem(key: string, value: string): void { this.store.set(key, value); }
}
const g = globalThis as { localStorage?: Storage; window?: object };
g.localStorage = new MemoryStorage();
g.window = g.window ?? g;

const DRAFT_KEY = 'planner_draft';

describe('usePlannerDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no draft exists', () => {
    expect(readDraft()).toBeNull();
  });

  it('writes and reads a draft correctly', () => {
    writeDraft({ selectedParcelId: 'parcel-1', plannerSourceParcelId: 'parcel-2' });
    const draft = readDraft();
    expect(draft).not.toBeNull();
    expect(draft?.selectedParcelId).toBe('parcel-1');
    expect(draft?.plannerSourceParcelId).toBe('parcel-2');
    expect(typeof draft?.savedAt).toBe('number');
  });

  it('clears the draft', () => {
    writeDraft({ selectedParcelId: 'parcel-1', plannerSourceParcelId: null });
    clearDraft();
    expect(readDraft()).toBeNull();
  });

  it('returns null and clears on corrupt JSON', () => {
    localStorage.setItem(DRAFT_KEY, '{bad json}');
    expect(readDraft()).toBeNull();
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('returns null when parsed value is not an object', () => {
    localStorage.setItem(DRAFT_KEY, '"just a string"');
    expect(readDraft()).toBeNull();
  });

  it('returns null when savedAt is missing', () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ selectedParcelId: 'x' }));
    expect(readDraft()).toBeNull();
  });

  it('handles null parcel IDs gracefully', () => {
    writeDraft({ selectedParcelId: null, plannerSourceParcelId: null });
    const draft = readDraft();
    expect(draft?.selectedParcelId).toBeNull();
    expect(draft?.plannerSourceParcelId).toBeNull();
  });

  it('persists optional selectedCommanderId', () => {
    writeDraft({ selectedParcelId: 'p1', plannerSourceParcelId: 'p2', selectedCommanderId: 'cmd-1' });
    const draft = readDraft();
    expect(draft?.selectedCommanderId).toBe('cmd-1');
  });
});
