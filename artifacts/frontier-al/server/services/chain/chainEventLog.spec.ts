import { describe, it, expect } from "vitest";
import {
  buildTransitionRows,
  summarizePurchaseFunnel,
  summarizeChainHealth,
  PURCHASE_STATE_ORDER,
} from "./chainEventLog";

describe("buildTransitionRows", () => {
  const base = {
    intentId: "intent-1",
    playerId: "player-1",
    kind: "plot" as const,
    refId: "parcel-9",
    txId: "TX123",
    amount: 100_000,
    now: 1_700_000_000_000,
  };

  it("maps a plot transition into matching chain_event + purchase_intent rows", () => {
    const { event, intent } = buildTransitionRows({ ...base, state: "confirmed", event: "payment_verified" });

    expect(event.event).toBe("payment_verified");
    expect(event.status).toBe("confirmed");
    expect(event.itemType).toBe("parcel");
    expect(event.itemId).toBe("parcel-9");
    expect(event.txId).toBe("TX123");
    expect(event.amount).toBe(100_000);
    expect(event.createdAt).toBe(base.now);
    expect(event.id).not.toBe(intent.id); // event id is freshly generated, not the intent id

    expect(intent.id).toBe("intent-1");
    expect(intent.state).toBe("confirmed");
    expect(intent.kind).toBe("plot");
    expect(intent.createdAt).toBe(base.now);
    expect(intent.updatedAt).toBe(base.now);
  });

  it("defaults the event label to the state when none is given", () => {
    const { event } = buildTransitionRows({ ...base, state: "submitting" });
    expect(event.event).toBe("submitting");
    expect(event.status).toBe("submitting");
  });

  it("uses item type 'commander' for commander purchases and serializes metadata", () => {
    const { event } = buildTransitionRows({
      ...base,
      kind: "commander",
      state: "complete",
      metadata: { tier: "gold", assetId: 42 },
    });
    expect(event.itemType).toBe("commander");
    expect(JSON.parse(event.metadataJson!)).toEqual({ tier: "gold", assetId: 42 });
  });

  it("carries lastError onto the intent and null metadata when absent", () => {
    const { event, intent } = buildTransitionRows({ ...base, state: "failed", lastError: "boom" });
    expect(intent.lastError).toBe("boom");
    expect(event.metadataJson).toBeNull();
  });
});

describe("summarizePurchaseFunnel", () => {
  it("zero-fills every known state in canonical order", () => {
    const out = summarizePurchaseFunnel([]);
    expect(out.map((r) => r.state)).toEqual(PURCHASE_STATE_ORDER);
    expect(out.every((r) => r.count === 0)).toBe(true);
  });

  it("counts intents by state and ignores unknown states", () => {
    const out = summarizePurchaseFunnel([
      { state: "submitting" },
      { state: "submitting" },
      { state: "confirmed" },
      { state: "complete" },
      { state: "complete" },
      { state: "complete" },
      { state: "not_a_real_state" },
    ]);
    const byState = Object.fromEntries(out.map((r) => [r.state, r.count]));
    expect(byState.submitting).toBe(2);
    expect(byState.confirmed).toBe(1);
    expect(byState.complete).toBe(3);
    expect(byState.failed).toBe(0);
  });
});

describe("summarizeChainHealth", () => {
  it("buckets in-flight vs terminal states and finds the last confirmed time", () => {
    const intents = [
      { state: "submitting" },
      { state: "confirmed" },
      { state: "inventory_syncing" },
      { state: "complete" },
      { state: "failed" },
      { state: "timeout" },
      { state: "duplicate_detected" },
    ];
    const events = [
      { status: "confirmed", createdAt: 100 },
      { status: "complete", createdAt: 300 },
      { status: "submitting", createdAt: 500 },
    ];
    const h = summarizeChainHealth(intents, events);
    expect(h.total).toBe(7);
    expect(h.pending).toBe(3); // submitting + confirmed + inventory_syncing
    expect(h.complete).toBe(1);
    expect(h.failed).toBe(1);
    expect(h.timeout).toBe(1);
    expect(h.duplicate).toBe(1);
    expect(h.lastConfirmedAt).toBe(300); // newest confirmed|complete event
  });

  it("returns null lastConfirmedAt when no confirmed/complete events exist", () => {
    const h = summarizeChainHealth([{ state: "submitting" }], [{ status: "submitting", createdAt: 1 }]);
    expect(h.lastConfirmedAt).toBeNull();
    expect(h.pending).toBe(1);
    expect(typeof h.network).toBe("string");
  });
});
