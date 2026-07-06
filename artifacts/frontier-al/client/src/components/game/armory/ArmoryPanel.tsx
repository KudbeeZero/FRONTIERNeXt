/**
 * client/src/components/game/armory/ArmoryPanel.tsx
 *
 * The Armory — the player-facing front end for the weapon system. Drives the
 * 2K-style loop against the live /api/weapons/* API:
 *   • allocate attribute points (with the tradeoff preview)
 *   • see your derived archetype + badge wall
 *   • browse the catalog (unlock-gated), acquire, upgrade, and equip weapons
 *
 * Pure data flows through TanStack Query; no globe/three dependencies.
 */

import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ARCHETYPE_IMAGES } from "./archetypeImages";
import {
  ATTRIBUTE_KEYS,
  ATTRIBUTE_BUDGET,
  ATTRIBUTE_MAX,
  ZERO_ATTRIBUTES,
  effectiveAttributes,
  totalSpent,
  ARCHETYPES,
  BADGE_KEYS,
  BADGE_DEFS,
  type AttributeBuild,
  type AttributeKey,
  type BadgeKey,
  type BadgeTier,
  type WeaponSpec,
  type PlayerWeaponProfile,
} from "@shared/weapons";

interface CatalogEntry {
  spec: WeaponSpec;
  unlocked: boolean;
  owned: boolean;
  fireCost: number;
  unlockCost: number;
}
interface CatalogResponse {
  profile: PlayerWeaponProfile;
  entries: CatalogEntry[];
}

const ATTR_LABEL: Record<AttributeKey, string> = {
  firepower: "Firepower",
  range: "Range",
  guidance: "Guidance",
  interception: "Interception",
  logistics: "Logistics",
};

const CATEGORY_LABEL: Record<string, string> = {
  ballistic: "Ballistic Missiles",
  cruise: "Cruise Missiles",
  hypersonic: "Hypersonic Missiles",
  artillery: "Artillery",
  rocket_artillery: "Rocket Artillery",
  loitering: "Loitering Munitions",
  anti_air: "Anti-Aircraft",
  missile_defense: "Missile Defense",
};

const TIER_COLOR: Record<BadgeTier, string> = {
  none: "#454b5e",
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  hall_of_fame: "#6ad1ff",
};

export function ArmoryPanel({ playerId }: { playerId: string }) {
  const query = useQuery<CatalogResponse>({
    queryKey: ["weapons-catalog", playerId],
    queryFn: async () =>
      (await apiRequest("GET", `/api/weapons/catalog?playerId=${encodeURIComponent(playerId)}`)).json(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["weapons-catalog", playerId] });

  if (query.isLoading) return <Shell><p className="text-slate-400">Loading armory…</p></Shell>;
  if (query.isError || !query.data) return <Shell><p className="text-rose-400">Failed to load armory.</p></Shell>;

  return <ArmoryInner playerId={playerId} data={query.data} onChanged={invalidate} />;
}

function ArmoryInner({
  playerId, data, onChanged,
}: { playerId: string; data: CatalogResponse; onChanged: () => void }) {
  const { profile, entries } = data;
  const [draft, setDraft] = useState<AttributeBuild>({ ...ZERO_ATTRIBUTES, ...profile.attributes });

  const spent = totalSpent(draft);
  const remaining = ATTRIBUTE_BUDGET - spent;
  const eff = useMemo(() => effectiveAttributes(draft), [draft]);
  const dirty = ATTRIBUTE_KEYS.some((k) => draft[k] !== profile.attributes[k]);

  const buildMut = useMutation({
    mutationFn: async (attributes: AttributeBuild) =>
      (await apiRequest("POST", "/api/weapons/build", { playerId, attributes })).json(),
    onSuccess: onChanged,
  });
  const unlockMut = useMutation({
    mutationFn: async (specId: string) =>
      (await apiRequest("POST", "/api/weapons/unlock", { playerId, specId })).json(),
    onSuccess: onChanged,
  });
  const upgradeMut = useMutation({
    mutationFn: async (ownedWeaponId: string) =>
      (await apiRequest("POST", "/api/weapons/upgrade", { playerId, ownedWeaponId })).json(),
    onSuccess: onChanged,
  });
  const loadoutMut = useMutation({
    mutationFn: async (loadout: string[]) =>
      (await apiRequest("POST", "/api/weapons/loadout", { playerId, loadout })).json(),
    onSuccess: onChanged,
  });

  const ownedBySpec = useMemo(() => {
    const m = new Map<string, { id: string; upgradeTier: number }>();
    for (const w of profile.ownedWeapons) m.set(w.specId, { id: w.id, upgradeTier: w.upgradeTier });
    return m;
  }, [profile.ownedWeapons]);

  const loadoutSet = new Set(profile.loadout);
  const archetype = profile.archetypeId ? ARCHETYPES[profile.archetypeId] : null;

  const step = (k: AttributeKey, delta: number) => {
    setDraft((d) => {
      const next = d[k] + delta;
      if (next < 0 || next > ATTRIBUTE_MAX) return d;
      if (delta > 0 && remaining <= 0) return d;
      return { ...d, [k]: next };
    });
  };

  const toggleEquip = (specId: string) => {
    const next = loadoutSet.has(specId)
      ? profile.loadout.filter((s) => s !== specId)
      : [...profile.loadout, specId];
    loadoutMut.mutate(next);
  };

  const grouped = useMemo(() => {
    const g: Record<string, CatalogEntry[]> = {};
    for (const e of entries) (g[e.spec.category] ??= []).push(e);
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.spec.tier - b.spec.tier);
    return g;
  }, [entries]);

  return (
    <Shell>
      <h1 className="text-xl font-bold tracking-wide text-slate-100">ARMORY</h1>

      {/* Archetype + badges */}
      <section className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
        <div className="flex gap-3">
          {archetype && (
            <img
              src={ARCHETYPE_IMAGES[archetype.id]}
              alt={archetype.name}
              className="h-20 w-20 shrink-0 rounded-md border border-cyan-500/30 object-cover"
            />
          )}
          <div className="text-sm text-slate-300">
            Archetype: <span className="font-semibold text-cyan-300">{archetype?.name ?? "—"}</span>
            {archetype && <div className="mt-1 text-xs text-slate-500">{archetype.description}</div>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {BADGE_KEYS.map((k: BadgeKey) => (
            <span key={k} className="rounded px-2 py-1 text-xs font-semibold"
              style={{ background: "#11182b", color: TIER_COLOR[profile.badges[k] ?? "none"], border: `1px solid ${TIER_COLOR[profile.badges[k] ?? "none"]}55` }}>
              {BADGE_DEFS[k].name}: {(profile.badges[k] ?? "none").replace("_", " ")}
            </span>
          ))}
        </div>
      </section>

      {/* Attribute build */}
      <section className="mt-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-200">Attribute Build</span>
          <span className={`text-xs ${remaining < 0 ? "text-rose-400" : "text-slate-400"}`}>
            {remaining} / {ATTRIBUTE_BUDGET} points left
          </span>
        </div>
        <div className="mt-2 space-y-2">
          {ATTRIBUTE_KEYS.map((k) => {
            const penalty = eff[k] < draft[k];
            return (
              <div key={k} className="flex items-center gap-2">
                <span className="w-28 text-xs text-slate-300">{ATTR_LABEL[k]}</span>
                <button className="h-6 w-6 rounded bg-slate-700 text-slate-100" onClick={() => step(k, -1)}>−</button>
                <span className="w-8 text-center text-sm text-slate-100">{draft[k]}</span>
                <button className="h-6 w-6 rounded bg-slate-700 text-slate-100" onClick={() => step(k, +1)}>+</button>
                <div className="ml-2 h-2 flex-1 rounded bg-slate-800">
                  <div className="h-2 rounded bg-cyan-500/70" style={{ width: `${(draft[k] / ATTRIBUTE_MAX) * 100}%` }} />
                </div>
                <span className={`w-16 text-right text-xs ${penalty ? "text-amber-400" : "text-slate-500"}`}>
                  eff {eff[k]}{penalty ? " ▼" : ""}
                </span>
              </div>
            );
          })}
        </div>
        <button
          disabled={!dirty || remaining < 0 || buildMut.isPending}
          onClick={() => buildMut.mutate(draft)}
          className="mt-3 rounded bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {buildMut.isPending ? "Saving…" : "Save Build"}
        </button>
      </section>

      {/* Catalog */}
      <section className="mt-3 space-y-4">
        {Object.keys(grouped).map((cat) => (
          <div key={cat}>
            <h2 className="mb-1 text-sm font-semibold text-slate-300">{CATEGORY_LABEL[cat] ?? cat}</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {grouped[cat].map((e) => {
                const owned = ownedBySpec.get(e.spec.id);
                const equipped = loadoutSet.has(e.spec.id);
                return (
                  <div key={e.spec.id}
                    className={`rounded-lg border p-2 text-xs ${e.unlocked ? "border-slate-700/60 bg-slate-900/40" : "border-slate-800 bg-slate-950/40 opacity-60"}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{e.spec.name}</span>
                      <span className="text-slate-500">T{e.spec.tier}{owned ? ` · L${owned.upgradeTier}` : ""}</span>
                    </div>
                    <div className="mt-0.5 text-slate-400">
                      {e.spec.rangeKm}km · dmg {e.spec.damage} · {e.spec.realWorldRef}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {!e.unlocked && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">
                          locked · {e.spec.unlock.badge} {e.spec.unlock.tier.replace("_", " ")}
                        </span>
                      )}
                      {e.unlocked && !owned && (
                        <button disabled={unlockMut.isPending}
                          onClick={() => unlockMut.mutate(e.spec.id)}
                          className="rounded bg-emerald-600 px-2 py-0.5 font-semibold text-white disabled:opacity-40">
                          Unlock · {e.unlockCost} FR
                        </button>
                      )}
                      {owned && (
                        <>
                          <button disabled={upgradeMut.isPending}
                            onClick={() => upgradeMut.mutate(owned.id)}
                            className="rounded bg-indigo-600 px-2 py-0.5 font-semibold text-white disabled:opacity-40">
                            Upgrade
                          </button>
                          <button disabled={loadoutMut.isPending}
                            onClick={() => toggleEquip(e.spec.id)}
                            className={`rounded px-2 py-0.5 font-semibold text-white disabled:opacity-40 ${equipped ? "bg-amber-600" : "bg-slate-600"}`}>
                            {equipped ? "Equipped" : "Equip"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl p-4 text-slate-100">
      {children}
    </div>
  );
}
