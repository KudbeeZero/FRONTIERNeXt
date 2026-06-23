import { describe, it, expect } from "vitest";
import {
  score,
  isSolved,
  consistent,
  allCodes,
  remainingCount,
  firstConsistent,
  type Probe,
} from "./beacon";
import { NAV_BEACON } from "../data/beacon";

const { length: L, palette: P, secret } = NAV_BEACON;

describe("score", () => {
  it("scores a perfect guess as all exact, no partial", () => {
    expect(score(secret, secret)).toEqual({ exact: 4, partial: 0 });
  });

  it("scores a fully-wrong guess as zero", () => {
    // secret is [3,1,1,4]; use glyphs absent from it
    expect(score([0, 0, 0, 0], secret)).toEqual({ exact: 0, partial: 0 });
  });

  it("counts misplaced glyphs as partial", () => {
    // guess [1,3,4,1] vs secret [3,1,1,4]: no position matches; glyphs all present
    // secret multiset {3,1,1,4}; guess multiset {1,3,4,1} → 4 shared, 0 exact
    expect(score([1, 3, 4, 1], secret)).toEqual({ exact: 0, partial: 4 });
  });

  it("does NOT over-count duplicate glyphs beyond the secret's supply", () => {
    // secret has two 1s. A guess with three 1s can credit at most two.
    // guess [1,1,1,0] vs [3,1,1,4]: positions 1,2 exact (two 1s) → exact 2;
    // the third guess-1 has no remaining secret-1 to match → partial 0.
    expect(score([1, 1, 1, 0], secret)).toEqual({ exact: 2, partial: 0 });
  });

  it("mixes exact and partial correctly", () => {
    // guess [3,4,1,1] vs [3,1,1,4]: pos0 3==3 exact; pos2 1==1 exact → exact 2.
    // leftover secret {1,4}, leftover guess {4,1} → partial 2.
    expect(score([3, 4, 1, 1], secret)).toEqual({ exact: 2, partial: 2 });
  });
});

describe("isSolved", () => {
  it("is true only on a full-length exact lock", () => {
    expect(isSolved({ exact: L, partial: 0 }, L)).toBe(true);
    expect(isSolved({ exact: L - 1, partial: 1 }, L)).toBe(false);
  });
});

describe("allCodes", () => {
  it("enumerates palette^length codes", () => {
    expect(allCodes(L, P)).toHaveLength(P ** L); // 6^4 = 1296
    expect(allCodes(2, 3)).toHaveLength(9);
  });
});

describe("consistent / firstConsistent / remainingCount", () => {
  const probe = (guess: number[]): Probe => ({ guess, score: score(guess, secret) });

  it("the true secret is always consistent with any real feedback", () => {
    const history = [probe([0, 1, 2, 3]), probe([3, 3, 4, 4]), probe([5, 1, 0, 4])];
    expect(consistent(secret, history)).toBe(true);
  });

  it("a candidate that contradicts observed feedback is inconsistent", () => {
    const history = [probe([0, 1, 2, 3])]; // gives exact/partial vs secret
    // [0,0,0,0] scored against this guess won't reproduce the real feedback
    expect(consistent([0, 0, 0, 0], history)).toBe(false);
  });

  it("remainingCount shrinks toward 1 as probes accumulate, never excluding the secret", () => {
    const history: Probe[] = [];
    const before = remainingCount(history, L, P);
    expect(before).toBe(P ** L); // no info yet → whole space

    history.push(probe([0, 1, 2, 3]));
    const after1 = remainingCount(history, L, P);
    history.push(probe([3, 4, 5, 1]));
    const after2 = remainingCount(history, L, P);

    expect(after1).toBeLessThan(before);
    expect(after2).toBeLessThanOrEqual(after1);
    expect(after2).toBeGreaterThanOrEqual(1); // the secret is always a candidate
  });

  it("firstConsistent returns a code consistent with all feedback (Aether's proposal)", () => {
    const history = [probe([0, 1, 2, 3]), probe([3, 1, 4, 5])];
    const proposal = firstConsistent(history, L, P)!;
    expect(proposal).not.toBeNull();
    expect(consistent(proposal, history)).toBe(true);
  });

  it("once feedback pins a unique code, that code is the secret", () => {
    // Probe the secret-adjacent set until only one candidate remains.
    const history = [
      probe([3, 1, 1, 4]), // the secret itself → exact 4
    ];
    expect(remainingCount(history, L, P)).toBe(1);
    expect(firstConsistent(history, L, P)).toEqual(secret);
  });
});
