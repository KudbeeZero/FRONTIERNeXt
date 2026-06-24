import { describe, it, expect } from "vitest";
import { journeyAssetParams, explorerAssetUrl } from "./journeyAsset";
import { buildJourneyCard } from "../journeyCard";

const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s).length;

describe("journeyAssetParams", () => {
  const card = buildJourneyCard({
    ending: "bonded",
    trust: 92,
    flags: ["starved_self", "trusted_aether_blind", "vesta_contained"],
  });

  it("keeps asset name ≤ 32 bytes and unit name within 8 bytes", () => {
    const p = journeyAssetParams(card);
    expect(bytes(p.assetName)).toBeLessThanOrEqual(32);
    expect(p.assetName).toContain("BONDED");
    expect(p.unitName).toBe("AETHER");
    expect(bytes(p.unitName)).toBeLessThanOrEqual(8);
    expect(bytes(p.url)).toBeLessThanOrEqual(96);
  });

  it("emits a valid ARC-69 note carrying the run identity, under 1024 bytes", () => {
    const p = journeyAssetParams(card);
    expect(bytes(p.note)).toBeLessThanOrEqual(1024);
    const meta = JSON.parse(p.note);
    expect(meta.standard).toBe("arc69");
    expect(meta.properties.ending).toBe("BONDED");
    expect(meta.properties.trust).toBe(92);
    expect(meta.properties.rank).toBe("S");
    expect(meta.properties.seed).toMatch(/^AE-/);
    expect(meta.properties.choices.length).toBeGreaterThan(0);
  });

  it("stays under the note cap even with an oversized verdict", () => {
    const huge = buildJourneyCard({ ending: "functional", trust: 50, flags: [] });
    // Force a pathological verdict to exercise the trim path.
    const p = journeyAssetParams({ ...huge, verdict: "x".repeat(4000) });
    expect(bytes(p.note)).toBeLessThanOrEqual(1024);
    expect(JSON.parse(p.note).standard).toBe("arc69");
  });

  it("is deterministic for the same run", () => {
    expect(journeyAssetParams(card)).toEqual(journeyAssetParams(card));
  });

  it("explorerAssetUrl points at the TestNet asset page", () => {
    expect(explorerAssetUrl(12345)).toBe(
      "https://testnet.explorer.perawallet.app/asset/12345/",
    );
  });
});
