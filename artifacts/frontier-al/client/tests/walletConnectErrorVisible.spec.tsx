/**
 * client/tests/walletConnectErrorVisible.spec.tsx
 *
 * Owner report while live-testing: clicking "Connect Wallet" produced only a
 * red "Try Again" button with no readable reason — the actual failure text
 * was previously rendered ONLY in a hover `title` attribute (invisible on
 * touch devices, easy to miss on desktop). This guards that the error text
 * is now rendered as visible page content, and that the reset-connection
 * escape hatch is reachable from the error state too (a connect failure is
 * exactly the kind of stuck state that link exists for).
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
  error: null as string | null,
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

describe("WalletConnect — visible error text on a failed connection", () => {
  it("renders the actual error message as visible text, not just a title tooltip", () => {
    mockWalletState = { ...baseWallet, error: "User rejected the connection request" };
    const html = renderToStaticMarkup(<WalletConnect />);
    expect(html).toContain('data-testid="text-wallet-error-detail"');
    expect(html).toContain("User rejected the connection request");
  });

  it("also shows the reset-connection escape hatch on an error (a connect failure can be a stuck stale session)", () => {
    mockWalletState = { ...baseWallet, error: "Something went wrong" };
    const html = renderToStaticMarkup(<WalletConnect />);
    expect(html).toContain('data-testid="link-reset-wallet-connection"');
  });
});
