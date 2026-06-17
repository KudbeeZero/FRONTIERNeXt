/**
 * client/tests/university-panel.spec.tsx
 *
 * Smoke coverage for the University academy panel, using the same SSR harness as
 * the rest of the client suite (`renderToStaticMarkup`, no jsdom). The initial
 * render is the course catalog — we assert it lists every shipped module so the
 * panel stays wired to the shared curriculum. Interactive flow (stepping through
 * a walkthrough, answering a quiz, grading) is state-driven and needs a DOM
 * harness; that logic is unit-tested in shared/university/university.spec.ts and
 * is NOT claimed as covered here.
 */
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UniversityPanel } from "@/components/game/university/UniversityPanel";
import { CURRICULUM } from "@shared/university";

// renderToStaticMarkup HTML-escapes text (e.g. "&" → "&amp;"), so escape the
// expected title the same way before asserting containment.
function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

describe("UniversityPanel (course catalog)", () => {
  // The panel uses react-query (for persisted progress); rendered bare (no playerId)
  // the query is disabled, but useQuery still needs a client in context.
  const qc = new QueryClient();
  const html = renderToStaticMarkup(
    <QueryClientProvider client={qc}>
      <UniversityPanel />
    </QueryClientProvider>,
  );

  it("renders the academy header", () => {
    expect(html).toContain("FRONTIER UNIVERSITY");
  });

  it("lists every module in the shared curriculum, including the wallet how-to", () => {
    for (const m of CURRICULUM) {
      expect(html).toContain(htmlEscape(m.title));
    }
    const wallet = CURRICULUM.find((m) => m.system === "wallet")!;
    expect(html).toContain(htmlEscape(wallet.title));
  });
});
