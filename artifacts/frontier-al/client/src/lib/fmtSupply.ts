/**
 * Shared number formatter for the economics display surfaces.
 *
 * Converts large token counts into human-readable short form:
 *   1_000_000_000 → "1.00B", 999_950_000 → "999.95M", 45_000 → "45.0K"
 *
 * The formatter intentionally uses 2 decimal places at the millions/billions
 * scale so that Treasury and Total Supply — which diverge by <0.01% in early
 * game — render as distinct values instead of both rounding to "1000.0M".
 */
export function fmtSupply(
  n: number | undefined | null,
  decimals = 2,
): string {
  if (n == null || isNaN(n)) return "0";
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(decimals);
}
