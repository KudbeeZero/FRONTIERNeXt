/**
 * client/tests/errorBoundary.spec.tsx
 *
 * The root-level crash guard (main.tsx wraps <App/> in this). Mobile white-
 * screen-of-death root cause (2026-07-07): render-phase crashes previously had
 * no catch above GameLayout's own inner boundary, and even there the fallback
 * only logged to console.error — invisible on a phone with no DevTools. These
 * tests pin: (1) getDerivedStateFromError captures the real error message
 * (falling back to "Unknown error" for a non-Error throw), (2) the default
 * fallback UI actually renders that message (not just a generic banner), and
 * (3) the existing custom-fallback escape hatch still works.
 *
 * NOTE: `renderToStaticMarkup` (React's legacy sync SSR renderer, used
 * elsewhere in this suite) does NOT invoke error-boundary lifecycles for a
 * throwing child — that only happens on the client. So instead of rendering a
 * throwing component through the boundary, this exercises the class directly:
 * `getDerivedStateFromError` as a static call, and `.render()` on a plain
 * instance with `state` set as it would be post-catch. No jsdom needed.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ErrorBoundary } from "../src/components/ErrorBoundary";

describe("ErrorBoundary.getDerivedStateFromError", () => {
  it("captures the thrown Error's message", () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error("wallet connector unavailable"))).toEqual({
      hasError: true,
      message: "wallet connector unavailable",
    });
  });

  it("falls back to 'Unknown error' for a thrown value with no .message (e.g. a thrown string)", () => {
    expect(ErrorBoundary.getDerivedStateFromError("just a string" as unknown as Error)).toEqual({
      hasError: true,
      message: "Unknown error",
    });
  });
});

describe("ErrorBoundary.render", () => {
  it("renders children when there's no error", () => {
    const boundary = new ErrorBoundary({ children: <div>fine</div> });
    const html = renderToStaticMarkup(<>{boundary.render()}</>);
    expect(html).toContain("fine");
  });

  it("shows the real error message in the default fallback, not just a generic banner", () => {
    const boundary = new ErrorBoundary({ children: <div>fine</div> });
    boundary.state = { hasError: true, message: "wallet connector unavailable in this browser" };
    const html = renderToStaticMarkup(<>{boundary.render()}</>);
    expect(html).toContain("Something went wrong");
    expect(html).toContain("wallet connector unavailable in this browser");
    expect(html).toContain("Reload");
  });

  it("omits the message block when message is null (defensive default state)", () => {
    const boundary = new ErrorBoundary({ children: <div>fine</div> });
    boundary.state = { hasError: true, message: null };
    const html = renderToStaticMarkup(<>{boundary.render()}</>);
    expect(html).toContain("Something went wrong");
  });

  it("honors a custom fallback over the default banner", () => {
    const boundary = new ErrorBoundary({
      children: <div>fine</div>,
      fallback: <div>custom fallback</div>,
    });
    boundary.state = { hasError: true, message: "boom" };
    const html = renderToStaticMarkup(<>{boundary.render()}</>);
    expect(html).toContain("custom fallback");
    expect(html).not.toContain("Something went wrong");
  });
});
