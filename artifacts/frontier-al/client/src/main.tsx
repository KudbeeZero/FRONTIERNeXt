import "@/lib/polyfills";

declare global {
  interface Window {
    Buffer: typeof import("buffer").Buffer;
    global: typeof globalThis;
  }
}

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./components/game/hud/hud.css";

createRoot(document.getElementById("root")!).render(<App />);
