# Mobile Globe Touch — E2E Investigation

## Existing tools

| Tool | Present? | Notes |
|---|---|---|
| Vitest | Yes | Client + server. Node environment for client tests (SSR/headless, no DOM). |
| `@vitest/browser` | No | Would require installing a new dependency. |
| Playwright | No | No `playwright` or `@playwright/test` in the workspace. |
| Cypress | No | No `cypress` package or config. |
| jsdom / happy-dom | No | Client tests intentionally run in Node for SSR safety. |
| E2E directory | No | `artifacts/frontier-al/e2e` does not exist. |

## Feasibility of multi-touch E2E without new dependencies

### Playwright

Not feasible without adding `@playwright/test` and a Chromium binary. If added in the future, the approach would be:

1. Install Playwright and configure a single `playwright.config.ts`.
2. Add a small `tests/e2e/mobile-globe-touch.spec.ts`.
3. Use `page.evaluate(() => { /* dispatch PointerEvent with pointerId + isPrimary */ })` to simulate a pinch.
4. Assert no plot panel is visible after the synthetic pinch.
5. Assert a single synthetic tap opens the panel.

### Vitest Browser Mode

Not feasible without adding `@vitest/browser` and a provider (webdriverio, playwright, etc.). The workspace currently lacks both.

### Cypress

Not feasible without installing `cypress` and its binary.

### jsdom + user-event

Not recommended. R3F pointer events require WebGL context and R3F's internal event system. A jsdom test would need to mock `WebGLRenderingContext`, `Canvas`, `createXRFrame`, and most of `@react-three/fiber`. The resulting test would mostly verify mocks, not production behavior.

## Recommendation

Keep the manual QA checklist as the regression surface. Do not add E2E for this unless the project already plans to adopt Playwright for broader UI coverage.

## If E2E is adopted later

Add one focused spec to `tests/e2e/mobile-globe-touch.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("mobile globe touch", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/game");
    // assumes dev quick-auth or a test account login helper
  });

  test("single tap selects a plot", async ({ page }) => {
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      const rect = canvas!.getBoundingClientRect();
      const center = { clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      const down = new PointerEvent("pointerdown", { pointerId: 1, isPrimary: true, bubbles: true, ...center });
      const up = new PointerEvent("pointerup", { pointerId: 1, isPrimary: true, bubbles: true, ...center });
      canvas!.dispatchEvent(down);
      canvas!.dispatchEvent(up);
    });
    await expect(page.locator("[data-testid='selected-plot-panel']")).toBeVisible();
  });

  test("pinch does not select a plot", async ({ page }) => {
    await page.evaluate(() => {
      const canvas = document.querySelector("canvas")!;
      const rect = canvas.getBoundingClientRect();
      const a = { clientX: rect.left + rect.width * 0.45, clientY: rect.top + rect.height * 0.45 };
      const b = { clientX: rect.left + rect.width * 0.55, clientY: rect.top + rect.height * 0.55 };

      const aDown = new PointerEvent("pointerdown", { pointerId: 1, isPrimary: true, bubbles: true, ...a });
      const bDown = new PointerEvent("pointerdown", { pointerId: 2, isPrimary: false, bubbles: true, ...b });
      const bUp = new PointerEvent("pointerup", { pointerId: 2, isPrimary: false, bubbles: true, ...b });
      const aUp = new PointerEvent("pointerup", { pointerId: 1, isPrimary: true, bubbles: true, ...a });

      canvas.dispatchEvent(aDown);
      canvas.dispatchEvent(bDown);
      canvas.dispatchEvent(bUp);
      canvas.dispatchEvent(aUp);
    });
    await expect(page.locator("[data-testid='selected-plot-panel']")).not.toBeVisible();
  });
});
```

This is documented as a future plan only.
