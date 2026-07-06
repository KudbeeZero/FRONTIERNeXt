/**
 * script/visual-smoke.cjs — headless screenshots of the running game.
 *
 * Prereqs (see docs/HEADLESS_VISUAL_TESTING.md for the full recipe):
 *   - server on :5000 with DEV_LOGIN_ENABLED=true
 *   - vite client on :3000 with VITE_DEV_MODE=true
 *   - Playwright + Chromium available (Claude sandbox:
 *     NODE_PATH=/opt/node22/lib/node_modules, browser /opt/pw-browsers/chromium)
 *
 * Usage:
 *   node script/visual-smoke.cjs [outDir]
 *
 * Env overrides:
 *   VS_BASE      client base URL      (default http://localhost:3000)
 *   VS_CHROMIUM  chromium executable  (default /opt/pw-browsers/chromium)
 *   VS_SETTLE_MS globe settle wait    (default 30000 — SwiftShader is slow)
 */
const { chromium } = require("playwright");

const BASE = process.env.VS_BASE ?? "http://localhost:3000";
const EXECUTABLE = process.env.VS_CHROMIUM ?? "/opt/pw-browsers/chromium";
const SETTLE_MS = Number(process.env.VS_SETTLE_MS ?? 30000);
const OUT = process.argv[2] ?? ".";

/** Clear the "Pick your faction" gate if present. Playwright's trusted clicks
 *  get intercepted by an overlay here — programmatic DOM clicks are reliable. */
async function clearFactionGate(page) {
  try {
    await page.waitForSelector("text=Pick your faction", { timeout: 15000 });
  } catch {
    return false; // gate not shown — already factioned
  }
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    btns.find((b) => b.textContent.includes("NEXUS-7"))?.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    btns.find((b) => /ENTER|JOIN|SELECT|FACTION/i.test(b.textContent) && !b.disabled)?.click();
  });
  return true;
}

(async () => {
  const browser = await chromium.launch({
    executablePath: EXECUTABLE,
    // Software WebGL — renders the 3D globe with no GPU/display.
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

  // Dev quick-auth: same three localStorage keys the landing page's dev button sets.
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const auth = await page.evaluate(async () => {
    const r = await fetch("/api/dev/quick-auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return r.json();
  });
  if (!auth?.token || !auth?.address) {
    throw new Error(`dev quick-auth failed — is DEV_LOGIN_ENABLED=true on the server? got: ${JSON.stringify(auth).slice(0, 200)}`);
  }
  await page.evaluate(({ token, address }) => {
    localStorage.setItem("frontier_auth_token", token);
    localStorage.setItem("frontier_dev_session", "1");
    localStorage.setItem("frontier_dev_address", address);
  }, auth);

  // The globe.
  await page.goto(`${BASE}/game`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const cleared = await clearFactionGate(page);
  console.log(cleared ? "faction gate cleared" : "no faction gate");
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: `${OUT}/globe.png` });
  console.log(`globe.png captured (canvases: ${await page.locator("canvas").count()})`);

  // The snap-grid widget dashboard.
  await page.goto(`${BASE}/game?dashboard=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await clearFactionGate(page);
  await page.waitForTimeout(SETTLE_MS);
  await page.screenshot({ path: `${OUT}/dashboard.png` });
  console.log(`dashboard.png captured (widget region: ${await page.locator('[data-testid="dashboard-canvas-region"]').count()})`);

  await browser.close();
})().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
