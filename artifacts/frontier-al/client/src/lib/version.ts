/**
 * Single source of truth for the user-facing build version badge.
 *
 * Kept in lockstep with the package's `version` field. The TopBar badge used to
 * hard-code "V1.1" independently of `package.json` (which had drifted to 2.0.0),
 * so the version a player saw never matched the actual build. Bump both together.
 */
export const APP_VERSION = "2.0.1";

/** Network the build targets — shown alongside the version in the HUD badge. */
export const NETWORK_LABEL = "TESTNET";

/** Convenience: "TESTNET V2.0.1" for compact single-line displays. */
export const VERSION_LABEL = `${NETWORK_LABEL} V${APP_VERSION}`;
