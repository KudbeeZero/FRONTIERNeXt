// Local testing helper: boot straight into the 3D globe without connecting a
// wallet. Guarded so it can NEVER take effect in a production build —
// it requires both a dev build (import.meta.env.DEV) and an explicit opt-in
// env flag (VITE_TEST_GLOBE=true in .env).
export const TEST_GLOBE =
  import.meta.env.DEV && import.meta.env.VITE_TEST_GLOBE === "true";
