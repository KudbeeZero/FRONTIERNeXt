import "@/lib/polyfills";

declare global {
  interface Window {
    Buffer: typeof import("buffer").Buffer;
    global: typeof globalThis;
  }
}

import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import "./index.css";
import "./components/game/hud/hud.css";

// Root-level boundary: without this, ANY render-phase crash anywhere in the
// tree (including wallet-connector init, which now happens during render —
// see createWalletManager's doc comment) unmounts the whole app to a blank
// white screen with no recovery path, invisible on a phone with no DevTools.
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
