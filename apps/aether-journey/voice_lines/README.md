# Aether voice lines — ops

Pre-rendered ElevenLabs voice-over for Aether's Journey. The manifest is the
source of truth; MP3s are generated from it, hash-versioned, and bundled by Vite.

Source script: `AETHER_STORY_PASS_1.md` §11 (Chapter 1 voice manifest).

## Files

- `manifest.json` — every line: `id`, `chapter`, `speaker`, `text` (also the
  subtitle source), plus director `notes`/`beat`. Edit this to change a line.
- `speakers.json` — voice configs (voice_id, model, voice_settings, output).
  Aether is **Sarah** (`EXAVITQu4vr4xnSDxMaL`); the Archivist is **Jarvis**.
- `generation.log.json` — written by the generator each real run (tally + per-line).
- Output MP3 + JSON sidecars live in `../src/assets/voice/<chapter>/`.
- The runtime lookup `../src/lib/voice/index.generated.ts` is regenerated each run
  (committed) — `getVoiceClip(id)` resolves it; do not hand-edit.

## Generate

The key is read from `ELEVENLABS_API_KEY` (env only — never commit it; `.env` is
gitignored). From `apps/aether-journey/`:

```bash
pnpm voice:dry                       # parse + validate + hash; no network, no writes
ELEVENLABS_API_KEY=... pnpm voice:generate          # real run (spends credits)
ELEVENLABS_API_KEY=... pnpm voice:one ch1_s13_aether_01   # one line
# add --force to regenerate an unchanged line
```

The generator is idempotent: a line whose `text` + voice settings hash matches
its sidecar is **skipped**. Change the text or settings and the old files are
moved to `src/assets/voice/_archive/<id>.v<n>.{mp3,json}` and a fresh version is
rendered. A 50k-character-per-run cost cap guards against runaway spend; narrow
with `--line`/`--chapter` if you hit it.

## Wire a line into the game

1. Add the line to `manifest.json`, generate it.
2. Set `voiceId: "<line_id>"` on the matching `DialogueLine` in
   `src/data/dialogue.ts`. Keep the line's `text` equal to the manifest `text`
   so the on-screen subtitle matches the audio.
3. `audioEngine.speakLine()` plays the clip when present and falls back to Web
   Speech otherwise — no further wiring needed.

## Roll back a bad regen

Copy the wanted version from `_archive/` back over `ch1/<id>.{mp3,json}`, then
re-run `pnpm voice:generate` (it will pick up the restored sidecar hash).

## Background music (ElevenLabs Music API)

`music.json` lists tracks (`id`, `prompt`, `length_ms`, `loop`). Generate with:

```bash
pnpm music:dry                        # validate; no network
ELEVENLABS_API_KEY=... pnpm music:generate
```

Output goes to `../src/assets/music/<id>.mp3` (+ sidecar) and the committed
`../src/lib/music/index.generated.ts` lookup. Same idempotency/archive rules as
voice (hash of prompt + length + model). Music is billed by length, so the
generator caps total ms per run. `audioEngine.playMusic(id)` plays it under
dialogue (mute / volume / pause all apply); `title_intro` fires on BEGIN.

## When a v3 delivery isn't landing

Adjust the **manifest text** (punctuation, ellipses, em-dashes are the signal) —
do **not** silently bump model or stability. If you must change the voice, change
it in `speakers.json` and note why in the PR.
