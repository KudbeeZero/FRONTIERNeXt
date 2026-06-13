# 2026-06-11 — Kestra first-responder foundation

**Branch:** `claude/algorand-plugin-install-ksnm6e` → PR #17

Owner wants automated verification/monitoring/incident-response instead of
manual "go purchase land" testing. He runs a self-hosted **Kestra** VM; alerts
go to **Discord**; backend hosts on **Replit**; chaos drills will target a
separate staging instance (later unit).

## Shipped
- `server/veritas/reporter.ts`: `severityOf()` — any DRIFT → SEV1, any FAIL →
  SEV2, else OK; `toJsonReport()`; `shouldAlert` delegates (behavior unchanged).
- `server/veritas/run.ts`: `VERITAS_JSON=1` / `--json` → pure-JSON stdout,
  text report on stderr. Use `pnpm --silent run veritas` to keep pnpm's banner
  off stdout.
- `ops/kestra/` (repo root): `severity-router.yml`, `uptime.yml`,
  `deep-health.yml`, `veritas-grind.yml`, `README.md` (setup, secrets,
  SEV1/2/3 model, roadmap).
- +3 unit tests in `veritas.spec.ts`.

## Verified
- server suite 197/197, client 31/31, build green.
- JSON mode end-to-end: dead backend + dummy admin key → exit 1, stdout
  `"severity":"SEV2"`.
- tsc: 255 errors — identical pre-existing count to `main`, none in veritas.
- Kestra YAMLs: parse-validated only; **not yet imported** into the live
  Kestra instance.

## Lessons / gotchas
- `pnpm run` writes its script banner to stdout — any machine-parsed CLI must
  be invoked with `pnpm --silent run …`.
- Veritas flows all SKIP without `VERITAS_ADMIN_KEY`, so an unreachable
  backend can still report OK — the Kestra uptime/deep-health flows cover that
  blind spot, and the grind flow treats missing JSON output as SEV1.
