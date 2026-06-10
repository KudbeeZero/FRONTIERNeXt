# CLAUDE.md
# Agent Context + Token Efficiency Rules

This repository powers a large-scale strategy game with a 3D planetary map, parcel system, AI factions, and blockchain interactions.

Efficient context usage is critical.

Claude must actively manage context and spawn subagents when performing large investigations.

---

# Core Principle

Context is the most valuable resource.

Every unnecessary file read wastes tokens.

Agents must minimize context usage and return summaries whenever possible.

---

# Default Agent Behavior

Claude should **spawn subagents automatically** when:

• Reading more than 3 files  
• Investigating architecture  
• Performing codebase exploration  
• Debugging systems  
• Reviewing code patterns  
• Running research tasks  
• Producing large analysis output  

Subagents should:

• read files in isolation  
• inspect architecture  
• summarize results  
• return concise conclusions  

---

# Stay in Main Context For

Claude should **NOT spawn subagents** when:

• Directly editing a file the user requested  
• Reading 1–2 files only  
• Performing quick clarifications  
• Writing implementation code the user must see  

---

# Decision Rule

If a task will:

• read more than 3 files  
• scan architecture  
• generate long analysis  

→ spawn a subagent and return a **summary only**

---

# Token Efficiency Rules

Claude must minimize token usage.

Always follow:

1. Prefer short explanations
2. Use bullet points instead of paragraphs
3. Avoid repeating code already shown
4. Avoid scanning the entire repo
5. Only read necessary files
6. Return summaries when possible
7. Avoid verbose reasoning unless asked
8. Prefer full file replacements over large diffs
9. Do not output unnecessary narrative text
10. Ask before performing large repo analysis

---

# Communication Style

Claude responses should be:

• concise  
• structured  
• direct  
• minimal filler  

Prefer:

✔ bullet lists  
✔ short summaries  
✔ code blocks  

Avoid:

✖ long essays  
✖ repeated explanations  
✖ verbose reasoning  

---

# Code Generation Rules

When modifying files:

• Prefer complete file outputs  
• Avoid fragmented patches  
• Ensure code compiles  
• Maintain modular architecture  
• Do not refactor unrelated systems  

---

# Investigation Workflow

When investigating a system:

1. Spawn subagent
2. Let agent explore files
3. Return concise summary including:

• relevant files  
• architecture overview  
• issues found  
• recommended fix  

---

# Rule of Thumb

If a task requires:

• reading many files
• understanding architecture
• investigating behavior

→ spawn subagent

If the user must see implementation steps

→ stay in main context

---

# Expected Outcome

This system should:

• reduce token usage
• prevent unnecessary file scanning
• improve code clarity
• allow efficient architecture exploration

---

# Overnight Handoff Protocol

> Two shifts, one codebase. Day shift ends with `/handoff`; the night shift runs
> `/loop 30m /night-shift`, building rated queue items on `claude/night/*` branches
> (never main, never deploys, never secrets); mornings start with `/morning` — a
> five-line brief plus multiple-choice decisions. Live state lives in
> `docs/handoff/NIGHT_BOARD.md` (status) and `docs/handoff/NIGHT_QUEUE.md` (rated
> backlog). Full spec: repo-root `docs/protocols/OVERNIGHT_HANDOFF_PROTOCOL.md`.

---

# Session Notes

> Session logs are stored in [`session-notes/`](session-notes/). See [session-notes/README.md](session-notes/README.md) for the full index.
>
> Claude must create a new dated file in `session-notes/` at the end of each session instead of appending here.

---

# Session close-out workflow (security / feature passes)

How to wrap up and merge a unit of work. Established across the 2026-06-07
security audit (see `docs/audit/` + `session-notes/`).

**Develop**
- Work on the designated feature branch (e.g. `claude/security-audit-*`). Never commit straight to `main`.
- Centralize cross-cutting logic in small modules (e.g. `server/security.ts`, `server/auth.ts`, `server/rateLimitStore.ts`) rather than scattering it.

**Verify BEFORE closing — all must be green:**
1. `pnpm run check` (tsc)
2. `pnpm run test:server`
3. `pnpm run build` (Vite + esbuild)
- Add unit tests for new logic; for middleware/security wiring add a throwaway `tsx` HTTP/WS integration test (mount the real handler, assert status codes), since the suite is single-process.

**Document** (same commit): update `ENV_VARS.md` + `docs/DEPLOYMENT_ENV_CHECKLIST.md`, the audit report in `docs/audit/`, and a dated `session-notes/` file.

**Merge to main (no-ff, from the real remote head):**
```
git fetch origin main
git checkout main && git reset --hard origin/main   # local main ref is often stale
git merge --no-ff <feature-branch> -m "Merge …"
git push origin main                                  # retry w/ backoff on network errors
git fetch origin main && verify local==origin
```
Always `reset --hard origin/main` first — skipping it produces a messy first-parent history.

**When to close out**
- Only after the three checks are green AND the merge is verified (`local main == origin/main`). Never merge on red.
- For PR-watch / "babysit" tasks, the task isn't done until the PR is MERGED or CLOSED.
- Secrets are never committed — document them in the env checklist; real values go in the host dashboard (Railway/Vercel), mnemonic in a secrets manager.

