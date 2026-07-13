import { describe, it, expect } from "vitest";
import React from "react";
import { act, create } from "react-test-renderer";
import { ModalProvider, useModalManager } from "./useModalManager";

function Consumer({ onReady }: { onReady: (api: ReturnType<typeof useModalManager>) => void }) {
  const api = useModalManager();
  onReady(api);
  return null;
}

describe("useModalManager", () => {
  it("starts with all modals closed", () => {
    let api: ReturnType<typeof useModalManager> | null = null;
    create(
      <ModalProvider>
        <Consumer onReady={(a) => { api = a; }} />
      </ModalProvider>
    );
    expect(api).not.toBeNull();
    const types = ["parcelSheet", "fullLandSheet", "battleWatch", "gamerTag", "strikePanel"] as const;
    for (const t of types) {
      expect(api!.isOpen(t)).toBe(false);
    }
  });

  it("opens and closes a modal", () => {
    let api: ReturnType<typeof useModalManager> | null = null;
    const tree = create(
      <ModalProvider>
        <Consumer onReady={(a) => { api = a; }} />
      </ModalProvider>
    );
    expect(api).not.toBeNull();

    act(() => api!.open("parcelSheet"));
    tree.update(
      <ModalProvider>
        <Consumer onReady={(a) => { api = a; }} />
      </ModalProvider>
    );
    expect(api!.isOpen("parcelSheet")).toBe(true);

    act(() => api!.close("battleWatch"));
    tree.update(
      <ModalProvider>
        <Consumer onReady={(a) => { api = a; }} />
      </ModalProvider>
    );
    expect(api!.isOpen("battleWatch")).toBe(false);
    expect(api!.isOpen("parcelSheet")).toBe(true);
  });

  it("prevents duplicate opens by reusing the same slot", () => {
    let api: ReturnType<typeof useModalManager> | null = null;
    create(
      <ModalProvider>
        <Consumer onReady={(a) => { api = a; }} />
      </ModalProvider>
    );
    expect(api).not.toBeNull();

    act(() => api!.open("parcelSheet"));
    act(() => api!.open("parcelSheet"));
    expect(api!.isOpen("parcelSheet")).toBe(true);
  });

  it("closeAll clears every modal", () => {
    let api: ReturnType<typeof useModalManager> | null = null;
    create(
      <ModalProvider>
        <Consumer onReady={(a) => { api = a; }} />
      </ModalProvider>
    );
    expect(api).not.toBeNull();

    act(() => api!.open("parcelSheet"));
    act(() => api!.open("fullLandSheet"));
    act(() => api!.closeAll());
    expect(api!.isOpen("parcelSheet")).toBe(false);
    expect(api!.isOpen("fullLandSheet")).toBe(false);
  });

  it("toggle switches state", () => {
    let api: ReturnType<typeof useModalManager> | null = null;
    create(
      <ModalProvider>
        <Consumer onReady={(a) => { api = a; }} />
      </ModalProvider>
    );
    expect(api).not.toBeNull();

    act(() => api!.toggle("battleWatch"));
    expect(api!.isOpen("battleWatch")).toBe(true);

    act(() => api!.toggle("battleWatch"));
    expect(api!.isOpen("battleWatch")).toBe(false);
  });
});
