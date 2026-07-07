/**
 * client/tests/walletConnectResetLink.spec.tsx
 *
 * Guards the actual UI wiring for the wallet-popup-storm escape hatch (see
 * client/src/lib/walletReset.ts): the "Trouble connecting? Reset wallet
 * connection" link must render in the two pre-connected states a storm can
 * leave a player stuck in — "restoring" (the state showing WHILE resumeSession()
 * is actually running) and the plain not-connected connect-gate — and must
 * NOT render once a wallet is genuinely connected, where it would be noise.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WalletConnect } from "../src/components/game/WalletConnect";

const baseWallet = {
  isConnected: false,
  walletStatus: "disconnected" as const,
  address: null,
  displayAddress: null,
  balance: 0,
  isConnecting: false,
  error: null,
  walletType: null,
  availableWallets: [],
  connect: vi.fn(),
  disconnect: vi.fn(),
  clearError: vi.fn(),
};

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockWalletState,
}));

let mockWalletState: typeof baseWallet;

describe("WalletConnect — reset-connection escape hatch", () => {
  it("shows the reset link while restoring (the state visible during an actual popup storm)", () => {
    mockWalletState = { ...baseWallet, walletStatus: "restoring" };
    const html = renderToStaticMarkup(<WalletConnect />);
    expect(html).toContain('data-testid="link-reset-wallet-connection"');
    expect(html).toContain("Reset wallet connection");
  });

  it("shows the reset link on the plain not-connected connect-gate", () => {
    mockWalletState = { ...baseWallet, walletStatus: "disconnected" };
    const html = renderToStaticMarkup(<WalletConnect />);
    expect(html).toContain('data-testid="link-reset-wallet-connection"');
  });

  it("does NOT show the reset link once genuinely connected (would be noise)", () => {
    mockWalletState = {
      ...baseWallet,
      isConnected: true,
      walletStatus: "connected",
      address: "ABC123",
      displayAddress: "ABC1...23",
      walletType: "pera",
    };
    const html = renderToStaticMarkup(<WalletConnect />);
    expect(html).not.toContain('data-testid="link-reset-wallet-connection"');
  });
});
