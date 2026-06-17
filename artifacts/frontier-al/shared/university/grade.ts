/**
 * shared/university/grade.ts
 *
 * Pure logic for the academy: grade a quiz attempt and validate curriculum
 * integrity. No side effects — the UI calls grade(), the unit test calls
 * validateCurriculum(), and both can run anywhere.
 */

import type { TutorialModule, GameSystem } from "./types";

/** Fraction of questions a player must get right to pass a module. */
export const PASS_THRESHOLD = 0.7;

export interface QuestionResult {
  questionId: string;
  /** The option index the player picked (undefined = left blank). */
  picked: number | undefined;
  correct: boolean;
}

export interface QuizResult {
  moduleId: string;
  correct: number;
  total: number;
  /** 0..1 share correct. A module with no questions scores 1 (nothing to miss). */
  score: number;
  passed: boolean;
  perQuestion: QuestionResult[];
}

/**
 * Grade an attempt. `answers` maps questionId → picked option index. Missing or
 * out-of-range picks count as wrong. Pure — returns a fresh result.
 */
export function gradeQuiz(
  module: TutorialModule,
  answers: Record<string, number | undefined>,
): QuizResult {
  const perQuestion: QuestionResult[] = module.quiz.map((q) => {
    const picked = answers[q.id];
    return { questionId: q.id, picked, correct: picked === q.correctIndex };
  });
  const correct = perQuestion.filter((r) => r.correct).length;
  const total = module.quiz.length;
  const score = total === 0 ? 1 : correct / total;
  return {
    moduleId: module.id,
    correct,
    total,
    score,
    passed: score >= PASS_THRESHOLD,
    perQuestion,
  };
}

// ── Integrity ────────────────────────────────────────────────────────────────

export interface CurriculumIssue {
  moduleId: string;
  problem: string;
}

/**
 * Validate the whole curriculum. Returns [] when well-formed. Asserted by the
 * unit test and usable as a defensive runtime check before rendering.
 */
export function validateCurriculum(modules: TutorialModule[]): CurriculumIssue[] {
  const issues: CurriculumIssue[] = [];
  const seenModuleIds = new Set<string>();

  for (const m of modules) {
    if (seenModuleIds.has(m.id)) issues.push({ moduleId: m.id, problem: "duplicate module id" });
    seenModuleIds.add(m.id);

    if (m.steps.length === 0) issues.push({ moduleId: m.id, problem: "module has no steps" });
    if (m.quiz.length === 0) issues.push({ moduleId: m.id, problem: "module has no quiz questions" });
    if (m.estMinutes <= 0) issues.push({ moduleId: m.id, problem: "estMinutes must be positive" });

    const seenQ = new Set<string>();
    for (const q of m.quiz) {
      if (seenQ.has(q.id)) issues.push({ moduleId: m.id, problem: `duplicate question id ${q.id}` });
      seenQ.add(q.id);
      if (q.options.length < 2) {
        issues.push({ moduleId: m.id, problem: `question ${q.id} needs >= 2 options` });
      }
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        issues.push({ moduleId: m.id, problem: `question ${q.id} correctIndex out of range` });
      }
    }
  }
  return issues;
}

/** Modules that teach a given system. */
export function modulesBySystem(modules: TutorialModule[], system: GameSystem): TutorialModule[] {
  return modules.filter((m) => m.system === system);
}
