# Menu design rules

Spacing, radius, and typography conventions for the in-game menu/panel system
(`client/src/components/game/**`). Written after an audit found 7 border-radius
values, 5 panel-header font sizes, and 4 letter-spacing values all live at once
across the ~12 rail/tab panels — no shared rule, so panels looked "boxy" and
inconsistent next to each other. These are the rules new panel work should
follow; existing panels are being brought into line incrementally (see the
prioritized fix list in the design-audit notes, not all panels are converted
yet — check the panel you're touching before assuming it already matches).

## Spacing

Use Tailwind's existing default spacing scale — no new tokens needed:

| Class | Px | Use for |
|---|---|---|
| `gap-1` / `p-1` | 4px | icon-to-label micro gaps, badge internal padding |
| `gap-2` / `p-2` | 8px | inline gaps (icon+text), chip padding, dense list-row gaps |
| `p-3` | 12px | compact card padding |
| `p-4` / `px-4 py-3` | 16px | **default panel/card padding and header inset** — the one true header padding |
| `gap-6` | 24px | gap between major sections inside a panel |
| `p-8` | 32px | page-level margins, gate/modal outer padding (already correct in `FactionSelectGate.tsx`) |

A panel's header padding and its row/body padding must use the same horizontal
inset so their left edges line up (this was the literal cause of the "fonts
aren't centered" complaint in `LeaderboardPanel` — the header was `p-4` and
the rows were `p-3`).

## Border radius

Tailwind's configured scale (`tailwind.config.ts`): `sm`=3px, `md`=6px,
`lg`=9px (plus unconfigured Tailwind defaults `xl`=12px, `2xl`=16px, all of
which are also in live use — that's the bug).

- **`rounded-md`** — the default for cards, list rows, stat tiles, icon
  badges, buttons, inputs. Use this unless you have a specific reason not to.
- **`rounded-lg`** — panel shells only (the outermost container of a tab).
- **`rounded-full`** — avatars, status dots, pills.
- Don't reach for `rounded`, `rounded-sm`, `rounded-xl`, or `rounded-2xl` in
  panel chrome — if you find one, it's almost certainly a leftover that
  should be `rounded-md`.

## Typography

- **Panel/section header** (the title bar of a rail tab): `font-display
  text-sm font-bold uppercase tracking-wide`, left-aligned, in a `px-4 py-3
  border-b border-border` header bar. This is the single most common
  omission — several panels either had no `font-display` at all (defaulting
  to body font) or used one-off sizes (12/16/18/20px) and tracking values
  (`wide`/`wider`/`widest`/raw bracket values).
- **Gate / hero / modal headers** (`FactionSelectGate`-style full-screen
  moments only): centered — mono eyebrow label → `font-display` H1 → thin
  gradient divider → centered subtitle. Don't apply this centered treatment
  to in-panel headers; a title centered over left-aligned list rows below it
  looks worse, not better.
- **Body text**: `text-xs` (12px), `font-sans`.
- **Label / caption / micro-stat**: 10px floor. Don't use `text-[8px]` or
  `text-[9px]` — bump to `text-[10px]`.
- **HUD / mono readouts** (timers, coordinates, system-status lines): keep
  `font-mono`, and use one tracking value, `tracking-[0.2em]`, rather than
  several ad hoc bracket values.
- **Display font**: `--font-display` is **Orbitron** (loaded in
  `index.html`) — a bold, geometric sci-fi font used for headers/titles only,
  paired with `font-bold` (700) or `font-semibold` (600). Never use it for
  body copy.

## Known follow-up (not done in this pass)

- `ArmoryPanel.tsx` / `UniversityPanel.tsx` still use raw Tailwind
  `slate-*` colors internally instead of the semantic `card`/`border`/
  `foreground` tokens the rest of the panels use. This pass gave both a real
  panel shell and fixed their headers, but a full palette pass to the
  semantic tokens is separate, larger work.
- `CommanderPanel.tsx` and `WorldIntelPanel.tsx` each have a dozen-plus
  `text-[8px]`/`text-[9px]` instances beyond the ones fixed here; a full
  sweep to the 10px floor is a follow-up unit, not bundled into this one to
  keep the diff reviewable.
