/**
 * client/tests/gamertag-authenticated-submit.spec.tsx
 *
 * Regression test for the production defect: a newly-connected player who
 * purchased land could not set a gamertag — the POST /api/actions/set-name
 * request failed every time.
 *
 * Root cause: GamerTagModal used a BARE `fetch` with no `credentials` and no
 * `Authorization: Bearer` header. Every other authenticated call goes through
 * `apiRequest` (client/src/lib/queryClient.ts), which attaches both. The
 * /api/actions/* routes sit behind the server's global mutation ownership
 * guard (server/routes.ts) → evaluateOwnership → 401 "Authentication required"
 * when the request carries no session. On the split-host production deploy
 * (Cloudflare frontend → Fly backend) the bare fetch therefore always failed.
 *
 * This test pins the FIX: GamerTagModal must route its set-name request through
 * `apiRequest` (the transport that carries the wallet session). If anyone
 * reverts to a bare `fetch`, `apiRequest` stops being called and this test fails.
 *
 * Harness: react-test-renderer (headless, no jsdom — same as
 * BattleWatchModal.hooks.spec.tsx). We render the real component, drive the
 * input + Confirm button, and assert on the request that was issued.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import TestRenderer, { act } from "react-test-renderer";
import { GamerTagModal } from "@/components/game/GamerTagModal";

// react-test-renderer's act() expects this flag set in a test environment.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// `apiRequest` is the authenticated transport. We mock it so we can assert the
// exact request GamerTagModal issues — and so a revert to bare fetch is caught.
const apiRequestMock = vi.fn();

vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

// A successful response shape (apiRequest returns the raw Response on 2xx).
function okResponse(name: string) {
  return {
    ok: true,
    json: async () => ({ name }),
  };
}

const BASE_PROPS = {
  playerId: "player-test-1",
  walletAddress: "TESTWALLETADDRESS",
  onComplete: () => {},
  onSkip: () => {},
};

describe("GamerTagModal — set-name request is authenticated (regression)", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("sends the gamertag through apiRequest (authenticated) with the right payload", async () => {
    apiRequestMock.mockResolvedValue(okResponse("Nova"));

    const onComplete = vi.fn();
    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(<GamerTagModal {...BASE_PROPS} onComplete={onComplete} />);
    });

    // Type a valid tag.
    const input = root.root.findByType("input");
    await act(async () => {
      input.props.onChange({ target: { value: "Nova" } });
    });

    // Click "Confirm Tag".
    const button = root.root.findByProps({ children: "Confirm Tag" });
    await act(async () => {
      button.props.onClick();
    });

    // The request MUST go through the authenticated transport.
    expect(apiRequestMock).toHaveBeenCalledTimes(1);
    const [method, url, body] = apiRequestMock.mock.calls[0];
    expect(method).toBe("POST");
    expect(url).toBe("/api/actions/set-name");
    expect(body).toEqual({
      playerId: "player-test-1",
      name: "Nova",
      address: "TESTWALLETADDRESS",
    });

    // Success surfaces the saved name to the caller.
    await act(async () => {
      /* flush microtasks */
    });
    expect(onComplete).toHaveBeenCalledWith("Nova");
  });

  it("is single-flight — rapid double submit issues exactly one request", async () => {
    // Resolve on a tick so a second click can land before the first settles.
    let release!: () => void;
    apiRequestMock.mockReturnValue(
      new Promise((res) => {
        release = () => res(okResponse("Nova"));
      }),
    );

    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(<GamerTagModal {...BASE_PROPS} />);
    });

    const input = root.root.findByType("input");
    await act(async () => {
      input.props.onChange({ target: { value: "Nova" } });
    });

    const button = root.root.findByProps({ children: "Confirm Tag" });
    await act(async () => {
      button.props.onClick();
      button.props.onClick(); // rapid second click
    });

    expect(apiRequestMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      release();
    });
  });

  it("surfaces the server's readable error instead of a raw JSON blob", async () => {
    // apiRequest throws with a "<status>: <body>" message (see queryClient.ts).
    apiRequestMock.mockRejectedValue(
      new Error('401: {"error":"Authentication required — connect your wallet"}'),
    );

    const onComplete = vi.fn();
    let root!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      root = TestRenderer.create(<GamerTagModal {...BASE_PROPS} onComplete={onComplete} />);
    });

    const input = root.root.findByType("input");
    await act(async () => {
      input.props.onChange({ target: { value: "Nova" } });
    });

    const button = root.root.findByProps({ children: "Confirm Tag" });
    await act(async () => {
      button.props.onClick();
    });

    // The request was still attempted via the authenticated transport.
    expect(apiRequestMock).toHaveBeenCalledTimes(1);

    // The UI shows the server's human-readable message, not "401: {...}".
    const errorEls = root.root.findAllByProps({ className: "text-xs text-destructive" });
    const texts = errorEls.map((n) => n.children?.[0]).filter(Boolean);
    expect(texts).toContain("Authentication required — connect your wallet");

    // The button is re-enabled so the player can retry.
    const confirmBtn = root.root.findByProps({ children: "Confirm Tag" });
    expect(confirmBtn.props.disabled).toBe(false);

    // And we never reported a false success.
    expect(onComplete).not.toHaveBeenCalled();
  });
});
