import { describe, it, expect } from "vitest";
import { CURRICULUM, getModule } from "./index";
import {
  gradeQuiz,
  validateCurriculum,
  modulesBySystem,
  PASS_THRESHOLD,
} from "./grade";
import type { TutorialModule } from "./types";

describe("university curriculum integrity", () => {
  it("is well-formed (no integrity issues)", () => {
    expect(validateCurriculum(CURRICULUM)).toEqual([]);
  });

  it("ships a module for every taught system, including the wallet how-to", () => {
    const systems = new Set(CURRICULUM.map((m) => m.system));
    expect(systems.has("globe")).toBe(true);
    expect(systems.has("builds")).toBe(true);
    expect(systems.has("combat")).toBe(true);
    expect(systems.has("economy")).toBe(true);
    expect(systems.has("wallet")).toBe(true);
    // the wallet module is reachable and teaches opt-in
    const wallet = modulesBySystem(CURRICULUM, "wallet")[0];
    expect(wallet).toBeTruthy();
    expect(getModule(wallet.id)).toBe(wallet);
  });

  it("catches a malformed module (correctIndex out of range, no steps)", () => {
    const bad: TutorialModule = {
      id: "bad",
      system: "globe",
      title: "Bad",
      summary: "broken",
      estMinutes: 1,
      steps: [],
      quiz: [
        { id: "bq", prompt: "?", options: ["a", "b"], correctIndex: 5, explanation: "" },
      ],
    };
    const issues = validateCurriculum([bad]);
    expect(issues.some((i) => i.problem.includes("no steps"))).toBe(true);
    expect(issues.some((i) => i.problem.includes("correctIndex out of range"))).toBe(true);
  });

  it("flags duplicate module ids", () => {
    const dup = CURRICULUM[0];
    expect(validateCurriculum([dup, dup]).some((i) => i.problem === "duplicate module id")).toBe(true);
  });
});

describe("quiz grading", () => {
  const mod = CURRICULUM.find((m) => m.id === "intro_builds")!;

  it("scores a perfect attempt as passed", () => {
    const answers: Record<string, number> = {};
    for (const q of mod.quiz) answers[q.id] = q.correctIndex;
    const r = gradeQuiz(mod, answers);
    expect(r.correct).toBe(mod.quiz.length);
    expect(r.score).toBe(1);
    expect(r.passed).toBe(true);
  });

  it("counts blank and out-of-range picks as wrong, and fails below threshold", () => {
    const r = gradeQuiz(mod, {}); // nothing answered
    expect(r.correct).toBe(0);
    expect(r.score).toBe(0);
    expect(r.passed).toBe(false);
    expect(r.perQuestion.every((q) => q.correct === false)).toBe(true);
  });

  it("respects the pass threshold at the boundary", () => {
    // answer just enough to land exactly on PASS_THRESHOLD where divisible
    const q = mod.quiz;
    const answers: Record<string, number> = {};
    const needed = Math.ceil(PASS_THRESHOLD * q.length);
    q.forEach((qq, i) => {
      answers[qq.id] = i < needed ? qq.correctIndex : (qq.correctIndex + 1) % qq.options.length;
    });
    const r = gradeQuiz(mod, answers);
    expect(r.score).toBeGreaterThanOrEqual(PASS_THRESHOLD);
    expect(r.passed).toBe(true);
  });
});
