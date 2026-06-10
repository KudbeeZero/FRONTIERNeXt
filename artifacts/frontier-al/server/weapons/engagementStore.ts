/**
 * server/weapons/engagementStore.ts
 *
 * The RUNTIME memory layer (ephemeral, in-process). It tracks live engagements —
 * in-flight projectiles and deployed defensive batteries — and resolves layered
 * interception deterministically via the shared sim. The persisted progression
 * layer (player profiles) lives separately in storage; this store is the
 * tick-state the globe renders and the battle resolution reads.
 *
 * Pure of any DB/HTTP imports so it can be unit-tested in isolation. Routes wire
 * it to storage (deduct ASCEND, settle damage, bump stats) at the edges.
 */

import { randomUUID } from "crypto";
import type { GeoPoint } from "@shared/weapons";
import {
  getWeapon,
  isDefenseSpec,
  timeOfFlightMs,
  greatCircleKm,
  solveIntercept,
  rollIntercept,
} from "@shared/weapons";

export type EngagementStatus = "in_flight" | "intercepted" | "impacted";

export interface Engagement {
  id: string;
  weaponSpecId: string;
  attackerId: string;
  from: GeoPoint;
  to: GeoPoint;
  sourceParcelId: string;
  targetParcelId: string;
  launchTs: number;
  /** Time of flight (ms). */
  tof: number;
  /** When the warhead would impact if not intercepted. */
  impactTs: number;
  status: EngagementStatus;
  damage: number;
  // intercept resolution (set when intercepted)
  interceptedByBatteryId?: string;
  interceptedBySpecId?: string;
  interceptAt?: GeoPoint;
  interceptTs?: number;
  pk?: number;
}

export interface DefenseBattery {
  id: string;
  specId: string;
  ownerId: string;
  parcelId: string;
  at: GeoPoint;
  magazineRemaining: number;
}

export interface LaunchParams {
  weaponSpecId: string;
  attackerId: string;
  from: GeoPoint;
  to: GeoPoint;
  sourceParcelId: string;
  targetParcelId: string;
  /** Defaults to Date.now(); injectable for deterministic tests. */
  now?: number;
}

/** How long a resolved engagement stays queryable (for fade-out FX). */
export const ENGAGEMENT_FADE_MS = 8_000;

/** Max simultaneous defensive batteries one player may have deployed. */
export const MAX_BATTERIES_PER_PLAYER = 12;

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class EngagementStore {
  private engagements = new Map<string, Engagement>();
  private batteries = new Map<string, DefenseBattery>();

  // ── Defensive batteries ─────────────────────────────────────────────────────

  deployDefense(params: { specId: string; ownerId: string; parcelId: string; at: GeoPoint }): DefenseBattery {
    const spec = getWeapon(params.specId);
    if (!spec || !isDefenseSpec(spec)) {
      throw new Error(`deployDefense: ${params.specId} is not a defensive weapon`);
    }
    const owned = this.listBatteries().filter((b) => b.ownerId === params.ownerId).length;
    if (owned >= MAX_BATTERIES_PER_PLAYER) {
      throw new Error(`Battery limit reached (${MAX_BATTERIES_PER_PLAYER}). Decommission one first.`);
    }
    const battery: DefenseBattery = {
      id: randomUUID(),
      specId: params.specId,
      ownerId: params.ownerId,
      parcelId: params.parcelId,
      at: params.at,
      magazineRemaining: spec.intercept.magazine,
    };
    this.batteries.set(battery.id, battery);
    return battery;
  }

  listBatteries(): DefenseBattery[] {
    return [...this.batteries.values()];
  }

  removeBattery(id: string): void {
    this.batteries.delete(id);
  }

  // ── Launching & interception ────────────────────────────────────────────────

  /**
   * Launch a weapon and immediately resolve any interception against eligible
   * enemy batteries. Layered defense: feasible batteries fire in time order
   * (earliest engagement first); the first successful kill stops the track.
   */
  launch(params: LaunchParams): Engagement {
    const spec = getWeapon(params.weaponSpecId);
    if (!spec) throw new Error(`launch: unknown weapon ${params.weaponSpecId}`);

    const now = params.now ?? Date.now();
    // Opportunistic GC so the engagement map can't grow unbounded under play.
    this.prune(now);
    const distanceKm = greatCircleKm(params.from, params.to);
    const tof = timeOfFlightMs(spec, distanceKm);

    const engagement: Engagement = {
      id: randomUUID(),
      weaponSpecId: spec.id,
      attackerId: params.attackerId,
      from: params.from,
      to: params.to,
      sourceParcelId: params.sourceParcelId,
      targetParcelId: params.targetParcelId,
      launchTs: now,
      tof,
      impactTs: now + tof,
      status: "in_flight",
      damage: spec.damage,
    };

    this.resolveInterception(engagement, spec.id);
    this.engagements.set(engagement.id, engagement);
    return engagement;
  }

  private resolveInterception(engagement: Engagement, incomingSpecId: string): void {
    const incoming = getWeapon(incomingSpecId)!;

    // Eligible: enemy-owned, has ammo, geometrically feasible.
    const candidates = this.listBatteries()
      .filter((b) => b.ownerId !== engagement.attackerId && b.magazineRemaining > 0)
      .map((b) => {
        const defense = getWeapon(b.specId)!;
        const res = solveIntercept({
          incoming,
          from: engagement.from,
          to: engagement.to,
          defense,
          defenseAt: b.at,
        });
        return { battery: b, res };
      })
      .filter((c) => c.res.intercepted && c.res.timeToInterceptMs !== undefined)
      .sort((a, b) => (a.res.timeToInterceptMs! - b.res.timeToInterceptMs!));

    for (const { battery, res } of candidates) {
      battery.magazineRemaining -= 1; // an interceptor is expended on the attempt
      const hit = rollIntercept(res.pk, hashSeed(engagement.id + battery.id));
      // A spent battery is removed so it can't accumulate or be re-walked forever.
      if (battery.magazineRemaining <= 0) this.batteries.delete(battery.id);
      if (hit) {
        engagement.status = "intercepted";
        engagement.interceptedByBatteryId = battery.id;
        engagement.interceptedBySpecId = battery.specId;
        engagement.interceptAt = res.interceptAt;
        engagement.interceptTs = engagement.launchTs + (res.timeToInterceptMs ?? 0);
        engagement.pk = res.pk;
        return;
      }
    }
  }

  // ── Queries & lifecycle ─────────────────────────────────────────────────────

  get(id: string): Engagement | undefined {
    return this.engagements.get(id);
  }

  /** Engagements still relevant for rendering (in-flight or within fade window). */
  active(now: number = Date.now()): Engagement[] {
    return [...this.engagements.values()].filter((e) => {
      const endTs = e.status === "intercepted" ? (e.interceptTs ?? e.impactTs) : e.impactTs;
      return now <= endTs + ENGAGEMENT_FADE_MS;
    });
  }

  /** Drop engagements whose fade window has fully elapsed. */
  prune(now: number = Date.now()): number {
    let removed = 0;
    for (const [id, e] of this.engagements) {
      const endTs = e.status === "intercepted" ? (e.interceptTs ?? e.impactTs) : e.impactTs;
      if (now > endTs + ENGAGEMENT_FADE_MS) {
        this.engagements.delete(id);
        removed++;
      }
    }
    return removed;
  }

  clear(): void {
    this.engagements.clear();
    this.batteries.clear();
  }
}

/** Process-wide singleton used by the live server. */
export const engagementStore = new EngagementStore();
