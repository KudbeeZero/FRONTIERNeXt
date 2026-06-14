// Right panel: full weapon detail — artwork, identity, lore, the nine stat bars,
// the six attachment slots, and the augment chip sockets (hover for description +
// synergy). Presentation-only.

import type { ReactNode } from "react";
import { Atom, Box, Crosshair, Grip, Layers, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { AttachmentSlot, Augment, Weapon } from "./_data";
import { ELEMENT, RARITY, STAT_ORDER } from "./_tokens";
import { StatBar } from "./_StatBar";

const SLOT_ICON: Record<AttachmentSlot, LucideIcon> = {
  Barrel: Wrench,
  Magazine: Box,
  Scope: Crosshair,
  Grip: Grip,
  Stock: Layers,
  "Elemental Core": Atom,
};

function AugmentChip({ augment }: { augment: Augment }) {
  return (
    <div className="group/aug relative">
      <button
        type="button"
        className="grid h-11 w-11 place-items-center rounded-full border border-cyan-400/40 bg-cyan-400/10 text-lg shadow-[0_0_16px_-6px_rgba(34,211,238,0.9)] transition-transform hover:scale-110"
        aria-label={augment.name}
      >
        {augment.glyph}
      </button>
      {/* Hover detail */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-52 -translate-x-1/2 rounded-lg border border-white/10 bg-zinc-950/95 p-3 opacity-0 shadow-xl backdrop-blur transition-opacity group-hover/aug:opacity-100">
        <p className="text-xs font-semibold text-cyan-200">{augment.name}</p>
        <p className="mt-1 text-[11px] leading-snug text-zinc-300">{augment.description}</p>
        <p className="mt-1.5 text-[10px] leading-snug text-emerald-300">
          ⚙ {augment.synergy}
        </p>
      </div>
    </div>
  );
}

export function WeaponDetails({ weapon }: { weapon: Weapon | null }) {
  if (!weapon) {
    return (
      <div className="grid h-full place-items-center rounded-xl border border-white/5 bg-zinc-950/50 text-sm text-zinc-600">
        Select a weapon to inspect.
      </div>
    );
  }

  const rarity = RARITY[weapon.rarity];
  const element = ELEMENT[weapon.element];
  const emptyAugments = Math.max(0, 3 - weapon.augments.length);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-xl border border-white/5 bg-zinc-950/60">
      {/* Artwork hero */}
      <div
        className="relative h-44 shrink-0"
        style={{
          background: `radial-gradient(130% 100% at 50% 0%, ${element.hex}40, transparent 65%), linear-gradient(160deg, ${rarity.hex}26, #09090b 78%)`,
        }}
      >
        <span
          className="absolute left-3 top-3 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em]"
          style={{ backgroundColor: `${rarity.hex}22`, color: rarity.hex }}
        >
          {rarity.label}
        </span>
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-7xl opacity-40 grayscale">{element.glyph}</span>
        </div>
        <div className="absolute bottom-3 left-3 right-3">
          <h2
            className="text-2xl font-black tracking-wide"
            style={{
              color: rarity.rainbow ? "#f0abfc" : rarity.hex,
              textShadow: `0 0 18px ${rarity.hex}66`,
            }}
          >
            {weapon.name}
          </h2>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-400">
            {weapon.weaponClass}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-4">
        {/* Key facts */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <Fact label="DPS" value={String(weapon.dps)} accent="#e4e4e7" />
          <Fact label="Element" value={`${element.glyph} ${element.label}`} accent={element.hex} />
          <Fact label="Level" value={String(weapon.level)} accent="#e4e4e7" />
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">Manufacturer</p>
          <p className="text-sm font-medium text-zinc-200">{weapon.manufacturer}</p>
        </div>

        {/* Lore */}
        <p className="border-l-2 pl-3 text-sm italic leading-relaxed text-zinc-400"
           style={{ borderColor: `${rarity.hex}88` }}>
          “{weapon.lore[0]}
          <br />
          {weapon.lore[1]}”
        </p>

        {/* Stat bars */}
        <section>
          <SectionTitle>Stats</SectionTitle>
          <div className="flex flex-col gap-2">
            {STAT_ORDER.map((key) => (
              <StatBar key={key} label={key} value={weapon.stats[key]} hex={rarity.hex} />
            ))}
          </div>
        </section>

        {/* Attachments */}
        <section>
          <SectionTitle>Attachments</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {weapon.attachments.map((att) => {
              const Icon = SLOT_ICON[att.slot];
              const aRarity = RARITY[att.rarity];
              return (
                <div
                  key={att.slot}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2.5 py-2",
                    att.equipped ? "bg-white/[0.03]" : "bg-transparent opacity-60",
                  )}
                  style={{ borderColor: att.equipped ? `${aRarity.hex}55` : "rgba(255,255,255,0.08)" }}
                  title={att.impact}
                >
                  <div
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
                    style={{
                      backgroundColor: att.equipped ? `${aRarity.hex}1a` : "rgba(255,255,255,0.04)",
                      color: att.equipped ? aRarity.hex : "#71717a",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500">{att.slot}</p>
                    <p
                      className="truncate text-xs font-medium"
                      style={{ color: att.equipped ? aRarity.hex : "#a1a1aa" }}
                    >
                      {att.name}
                    </p>
                    <p className="truncate text-[10px] text-zinc-500">{att.impact}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Augment sockets */}
        <section>
          <SectionTitle>Augment Chips</SectionTitle>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {weapon.augments.map((aug) => (
              <AugmentChip key={aug.name} augment={aug} />
            ))}
            {Array.from({ length: emptyAugments }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="grid h-11 w-11 place-items-center rounded-full border border-dashed border-white/15 text-white/20"
                aria-label="Empty augment socket"
              >
                ◉
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Fact({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-2"
      style={{ boxShadow: `inset 0 0 18px -14px ${accent}` }}
    >
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="text-sm font-bold" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-400">
      {children}
    </h3>
  );
}
