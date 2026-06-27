// Globe renderer selection. The default (flag off / unset) keeps the existing
// `PlanetGlobe` as the live globe. Setting VITE_GLOBE_V2=true opts into the v2
// lighting rebuild (`globe/v2/PlanetGlobeV2`): one world-space sun, a single
// day/night terminator, no magenta corona — see globe/v2/REBUILD_NOTES.md.
//
// Unlike VITE_TEST_GLOBE this is NOT DEV-gated: v2 is intended to eventually
// become the live globe, so the owner can enable it on a deployed build (Fly
// env) for an on-device GPU smoke-test. It ships OFF in prod until that
// smoke-test signs off — keep it unset on the production deploy.
export const GLOBE_V2 = import.meta.env.VITE_GLOBE_V2 === "true";
