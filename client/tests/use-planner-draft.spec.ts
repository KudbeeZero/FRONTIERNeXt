/**
 * Tests for usePlannerDraft localStorage utility
 */

import { readDraft, writeDraft, clearDraft } from '../src/hooks/usePlannerDraft';

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
