import type { PredictionMarket } from "@shared/schema";

export function normalizeMarkets<T>(input: unknown): T[] {
  if (Array.isArray(input)) {
    return input as T[];
  }

  if (input && typeof input === "object") {
    const value = input as Record<string, unknown>;

    if (Array.isArray(value.markets)) return value.markets as T[];
    if (Array.isArray(value.data)) return value.data as T[];
    if (Array.isArray(value.items)) return value.items as T[];
    if (Array.isArray(value.results)) return value.results as T[];
  }

  return [];
}
