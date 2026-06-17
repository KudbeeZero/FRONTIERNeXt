/**
 * client/src/components/game/university/UniversityPanel.tsx
 *
 * FRONTIER University — the in-game academy. A self-contained, replayable
 * "how to play" tutorial the player can open at any time: pick a module, walk
 * through its steps, then take a short knowledge check and see the result.
 *
 * Pure client state (no server, no globe/three dependency) — the curriculum and
 * grading come from the shared @shared/university module, so the logic is unit
 * tested separately. Drop it anywhere a player is present.
 */

import { useMemo, useState } from "react";
import {
  CURRICULUM,
  gradeQuiz,
  type TutorialModule,
  type GameSystem,
  type QuizResult,
} from "@shared/university";

const SYSTEM_LABEL: Record<GameSystem, string> = {
  globe: "Planet",
  builds: "Builds",
  combat: "Combat",
  economy: "Economy",
  wallet: "Wallet",
  factions: "Factions",
  commanders: "Commanders",
  trade: "Trade",
  markets: "Markets",
  terraform: "Terraform",
  seasons: "Seasons",
  orbital: "Orbital",
  nft: "NFT Minting",
  basics: "First Steps",
};

const SYSTEM_COLOR: Record<GameSystem, string> = {
  globe: "#6ad1ff",
  builds: "#22d3ee",
  combat: "#fb7185",
  economy: "#fbbf24",
  wallet: "#a78bfa",
  factions: "#34d399",
  commanders: "#fb923c",
  trade: "#2dd4bf",
  markets: "#eab308",
  terraform: "#84cc16",
  seasons: "#e879f9",
  orbital: "#8b5cf6",
  nft: "#f472b6",
  basics: "#f97316",
};

export function UniversityPanel() {
  const [openId, setOpenId] = useState<string | null>(null);
  const openModule = useMemo(
    () => (openId ? CURRICULUM.find((m) => m.id === openId) ?? null : null),
    [openId],
  );

  if (openModule) {
    return <ModuleView module={openModule} onExit={() => setOpenId(null)} />;
  }
  return <Catalog onOpen={setOpenId} />;
}

// ── Catalog ──────────────────────────────────────────────────────────────────

function Catalog({ onOpen }: { onOpen: (id: string) => void }) {
  return (
    <Shell>
      <h1 className="text-xl font-bold tracking-wide text-slate-100">FRONTIER UNIVERSITY</h1>
      <p className="mt-1 text-xs text-slate-400">
        Interactive how-to-play courses. Take any of them, any time — repeat as often as you like.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CURRICULUM.map((m) => (
          <button
            key={m.id}
            onClick={() => onOpen(m.id)}
            className="rounded-lg border border-slate-700/60 bg-slate-900/40 p-3 text-left transition-colors hover:border-cyan-600/60 hover:bg-slate-900/70"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-100">{m.title}</span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: SYSTEM_COLOR[m.system], border: `1px solid ${SYSTEM_COLOR[m.system]}55` }}
              >
                {SYSTEM_LABEL[m.system]}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-400">{m.summary}</div>
            <div className="mt-2 text-[11px] text-slate-500">
              {m.steps.length} steps · {m.quiz.length} questions · ~{m.estMinutes} min
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );
}

// ── Module (walkthrough → quiz → result) ─────────────────────────────────────

type Phase = "walkthrough" | "quiz" | "result";

function ModuleView({ module, onExit }: { module: TutorialModule; onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>("walkthrough");
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | undefined>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const restart = () => {
    setPhase("walkthrough");
    setStepIndex(0);
    setAnswers({});
    setResult(null);
  };

  const accent = SYSTEM_COLOR[module.system];

  return (
    <Shell>
      <button onClick={onExit} className="text-xs text-slate-400 hover:text-slate-200">
        ← All courses
      </button>
      <h1 className="mt-1 text-lg font-bold tracking-wide text-slate-100">{module.title}</h1>

      {phase === "walkthrough" && (
        <Walkthrough
          module={module}
          stepIndex={stepIndex}
          accent={accent}
          onPrev={() => setStepIndex((i) => Math.max(0, i - 1))}
          onNext={() => {
            if (stepIndex < module.steps.length - 1) setStepIndex((i) => i + 1);
            else setPhase("quiz");
          }}
        />
      )}

      {phase === "quiz" && (
        <Quiz
          module={module}
          answers={answers}
          onPick={(qid, idx) => setAnswers((a) => ({ ...a, [qid]: idx }))}
          onSubmit={() => {
            setResult(gradeQuiz(module, answers));
            setPhase("result");
          }}
        />
      )}

      {phase === "result" && result && (
        <Result module={module} result={result} onRetake={restart} onExit={onExit} accent={accent} />
      )}
    </Shell>
  );
}

function Walkthrough({
  module, stepIndex, accent, onPrev, onNext,
}: {
  module: TutorialModule;
  stepIndex: number;
  accent: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const step = module.steps[stepIndex];
  const last = stepIndex === module.steps.length - 1;
  return (
    <section className="mt-3">
      <div className="mb-2 flex items-center gap-1">
        {module.steps.map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded"
            style={{ background: i <= stepIndex ? accent : "#1e293b" }}
          />
        ))}
      </div>
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          Step {stepIndex + 1} of {module.steps.length}
        </div>
        <h2 className="mt-1 text-base font-semibold text-slate-100">{step.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{step.body}</p>
        {step.tip && (
          <div className="mt-3 rounded border-l-2 pl-3 text-xs text-slate-300" style={{ borderColor: accent }}>
            💡 {step.tip}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={stepIndex === 0}
          className="rounded bg-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100 disabled:opacity-30"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded px-3 py-1.5 text-sm font-semibold text-white"
          style={{ background: accent, color: "#0b1120" }}
        >
          {last ? "Take the quiz →" : "Next"}
        </button>
      </div>
    </section>
  );
}

function Quiz({
  module, answers, onPick, onSubmit,
}: {
  module: TutorialModule;
  answers: Record<string, number | undefined>;
  onPick: (qid: string, idx: number) => void;
  onSubmit: () => void;
}) {
  const allAnswered = module.quiz.every((q) => answers[q.id] !== undefined);
  return (
    <section className="mt-3 space-y-3">
      {module.quiz.map((q, qi) => (
        <div key={q.id} className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
          <div className="text-sm font-semibold text-slate-100">
            {qi + 1}. {q.prompt}
          </div>
          <div className="mt-2 space-y-1.5">
            {q.options.map((opt, oi) => {
              const picked = answers[q.id] === oi;
              return (
                <button
                  key={oi}
                  onClick={() => onPick(q.id, oi)}
                  className={`block w-full rounded border px-3 py-1.5 text-left text-sm transition-colors ${
                    picked
                      ? "border-cyan-500 bg-cyan-500/10 text-slate-100"
                      : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-500"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        onClick={onSubmit}
        disabled={!allAnswered}
        className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {allAnswered ? "Submit answers" : "Answer every question to submit"}
      </button>
    </section>
  );
}

function Result({
  module, result, onRetake, onExit, accent,
}: {
  module: TutorialModule;
  result: QuizResult;
  onRetake: () => void;
  onExit: () => void;
  accent: string;
}) {
  const pct = Math.round(result.score * 100);
  return (
    <section className="mt-3">
      <div className="rounded-lg border border-slate-700/60 bg-slate-900/50 p-4 text-center">
        <div className="text-3xl font-bold" style={{ color: result.passed ? accent : "#fb7185" }}>
          {pct}%
        </div>
        <div className="mt-1 text-sm text-slate-300">
          {result.correct} / {result.total} correct — {result.passed ? "Passed ✓" : "Keep studying"}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {module.quiz.map((q, qi) => {
          const r = result.perQuestion.find((p) => p.questionId === q.id)!;
          return (
            <div key={q.id} className="rounded border border-slate-700/60 bg-slate-900/40 p-3 text-xs">
              <div className="font-semibold text-slate-200">
                {r.correct ? "✓" : "✗"} {qi + 1}. {q.prompt}
              </div>
              <div className="mt-1 text-slate-400">
                Correct answer: <span className="text-slate-200">{q.options[q.correctIndex]}</span>
              </div>
              <div className="mt-1 text-slate-500">{q.explanation}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={onRetake}
          className="rounded px-3 py-1.5 text-sm font-semibold"
          style={{ background: accent, color: "#0b1120" }}
        >
          Retake
        </button>
        <button onClick={onExit} className="rounded bg-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-100">
          Back to courses
        </button>
      </div>
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl p-4 text-slate-100">{children}</div>;
}
