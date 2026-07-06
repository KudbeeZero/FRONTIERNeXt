/**
 * client/tests/command-center-panel.spec.tsx
 *
 * Regression coverage for a real duplicate-render bug: selecting an unclaimed
 * or enemy-owned parcel used to render <SelectedParcelActions> (and its
 * "Claim Territory" button) TWICE — once from an unconditional
 * `{selectedParcel && player && (...)}` block, and again from a second block
 * gated on "parcel isn't in the player's owned list", whose condition was
 * always a subset of the first. Caught from a user screenshot showing two
 * identical plot cards stacked in the left rail.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandCenterPanel } from "@/components/game/CommandCenterPanel";
import type { Player, LandParcel } from "@shared/schema";

const player: Player = {
  id: "player-1",
  address: "TESTADDR",
  name: "Commander",
  iron: 0,
  fuel: 0,
  crystal: 0,
  ascend: 0,
  ownedParcels: [],
  isAI: false,
  totalIronMined: 0,
  totalFuelMined: 0,
  totalCrystalMined: 0,
  totalAscendEarned: 0,
  totalAscendBurned: 0,
  attacksWon: 0,
  attacksLost: 0,
  territoriesCaptured: 0,
  commander: null,
  commanders: [],
  activeCommanderIndex: 0,
  specialAttacks: [],
  drones: [],
  satellites: [],
  welcomeBonusReceived: true,
  testnetProgress: [],
};

const unclaimedParcel: LandParcel = {
  id: "parcel-1",
  plotId: 11055,
  lat: 0.5,
  lng: -91.1,
  biome: "plains",
  richness: 66,
  ownerId: null,
  ownerType: null,
  defenseLevel: 1,
  ironStored: 0,
  fuelStored: 0,
  crystalStored: 0,
  storageCapacity: 100,
  lastMineTs: 0,
  activeBattleId: null,
  yieldMultiplier: 1,
  improvements: [],
  purchasePriceAlgo: 0.1,
  ascendAccumulated: 0,
  lastAscendClaimTs: 0,
  ascendPerDay: 0,
  influence: 0,
  influenceRepairRate: 0,
  capturedFromFaction: null,
  capturedAt: null,
  handoverCount: 0,
};

const noop = () => {};

describe("CommandCenterPanel — selected parcel actions", () => {
  it("renders the claim-territory action exactly once for an unclaimed selected parcel", () => {
    const html = renderToStaticMarkup(
      <CommandCenterPanel
        player={player}
        parcels={[]}
        selectedParcel={unclaimedParcel}
        onSelectParcel={noop}
        onCollectAll={noop}
        onMine={noop}
        onUpgrade={noop}
        onAttack={noop}
        isMining={false}
        isUpgrading={false}
        isCollecting={false}
      />,
    );
    const matches = html.match(/data-testid="button-claim-cc"/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
