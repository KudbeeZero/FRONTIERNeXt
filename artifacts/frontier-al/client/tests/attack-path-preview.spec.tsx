/**
 * AttackPathPreview component tests
 * Verifies the visual planning aid for Battle Planner
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { AttackPathPreview } from "@/components/game/globe/AttackPathPreview";
import type { LandParcel } from "@shared/schema";

// Mock R3F hooks that require Canvas context
vi.mock("@react-three/fiber", () => ({
  useFrame: vi.fn(),
}));

describe("AttackPathPreview", () => {
  const mockOriginParcel: LandParcel = {
    id: "origin-1",
    plotId: 100,
    lat: 45,
    lng: 90,
    ownerId: "player-1",
    biome: "forest",
    defenseLevel: 5,
    // ... other required fields would be here in a real test
  } as LandParcel;

  const mockTargetParcel: LandParcel = {
    id: "target-1",
    plotId: 200,
    lat: -30,
    lng: -60,
    ownerId: "player-2",
    biome: "desert",
    defenseLevel: 3,
    // ... other required fields would be here in a real test
  } as LandParcel;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when origin is null", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AttackPathPreview originParcel={null} targetParcel={mockTargetParcel} />
      );
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it("renders nothing when target is null", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AttackPathPreview originParcel={mockOriginParcel} targetParcel={null} />
      );
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it("renders nothing when both parcels are null", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AttackPathPreview originParcel={null} targetParcel={null} />
      );
    });
    expect(renderer!.toJSON()).toBeNull();
  });

  it("renders arc and markers when both parcels are provided", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AttackPathPreview originParcel={mockOriginParcel} targetParcel={mockTargetParcel} />
      );
    });
    const json = renderer!.toJSON();
    expect(json).not.toBeNull();
    // Should render a group with tube and markers
    expect(json!.type).toBe("group");
  });

  it("updates when parcels change", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AttackPathPreview originParcel={mockOriginParcel} targetParcel={mockTargetParcel} />
      );
    });
    
    const firstRender = renderer!.toJSON();
    
    // Change target parcel
    const newTargetParcel: LandParcel = {
      ...mockTargetParcel,
      lat: 60,
      lng: 120,
    };
    
    act(() => {
      renderer.update(
        <AttackPathPreview originParcel={mockOriginParcel} targetParcel={newTargetParcel} />
      );
    });
    
    // Geometry should be different (different positions)
    const secondRender = renderer!.toJSON();
    expect(secondRender).not.toEqual(firstRender);
  });

  it("clears path when origin changes to null", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AttackPathPreview originParcel={mockOriginParcel} targetParcel={mockTargetParcel} />
      );
    });
    
    expect(renderer!.toJSON()).not.toBeNull();
    
    // Clear origin
    act(() => {
      renderer.update(
        <AttackPathPreview originParcel={null} targetParcel={mockTargetParcel} />
      );
    });
    
    expect(renderer!.toJSON()).toBeNull();
  });

  it("clears path when target changes to null", () => {
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <AttackPathPreview originParcel={mockOriginParcel} targetParcel={mockTargetParcel} />
      );
    });
    
    expect(renderer!.toJSON()).not.toBeNull();
    
    // Clear target
    act(() => {
      renderer.update(
        <AttackPathPreview originParcel={mockOriginParcel} targetParcel={null} />
      );
    });
    
    expect(renderer!.toJSON()).toBeNull();
  });
});
