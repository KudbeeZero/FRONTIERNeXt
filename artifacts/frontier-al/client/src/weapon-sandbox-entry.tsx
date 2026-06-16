/**
 * client/src/weapon-sandbox-entry.tsx
 *
 * Standalone mount for the weapon FX sandbox. Served via client/weapon-sandbox.html
 * (a separate Vite entry) so it never touches the live app's routing or globe.
 * Run: `pnpm run sandbox:weapons` then open /weapon-sandbox.html.
 */

import { createRoot } from "react-dom/client";
import WeaponSandbox from "@/components/game/weapons/WeaponSandbox";

createRoot(document.getElementById("root")!).render(<WeaponSandbox />);
