import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Minus, Plus, MapPin, Shield, Zap, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LandParcel, Player } from "@shared/schema";

// Types for the widget data (UI-only)
export interface PlotWidgetData {
  plotId: number;
  owner: string;
  faction: string;
  level: number;
  yieldPerHour: number;
  pendingYield: number;
  defense: number;
  status: string;
  biome?: string;
  richness?: number;
}

interface FloatingPlotWidgetProps {
  parcel?: LandParcel | null;
  player?: Player | null;
  isOpen?: boolean;
  onClose?: () => void;
  onOpenFullSheet?: () => void; // for future "more control"
}

// Safe mock data (UI only, never mutates state)
const getMockData = (parcel?: LandParcel | null, player?: Player | null): PlotWidgetData => {
  if (parcel) {
    return {
      plotId: parcel.plotId,
      owner: player?.name || (player?.address ? `${player.address.slice(0, 6)}...${player.address.slice(-4)}` : "Unknown"),
      faction: player?.isAI ? "AI Faction" : "Player",
      level: Math.max(1, Math.floor((parcel.defenseLevel || 0) / 10) + 1),
      yieldPerHour: Math.round(((parcel.ironStored || 0) + (parcel.fuelStored || 0) + (parcel.crystalStored || 0)) / 10), // rough derived
      pendingYield: Math.round(parcel.ascendAccumulated || 0),
      defense: parcel.defenseLevel || 0,
      status: parcel.ownerId ? "Owned" : "Unclaimed",
      biome: "Volcanic", // placeholder - would come from game state
      richness: 87,
    };
  }
  return {
    plotId: 4721,
    owner: "0x4f2a...e9b1",
    faction: "Player",
    level: 5,
    yieldPerHour: 42,
    pendingYield: 156,
    defense: 58,
    status: "Owned",
    biome: "Volcanic",
    richness: 87,
  };
};

export function FloatingPlotWidget({
  parcel,
  player,
  isOpen = true,
  onClose,
  onOpenFullSheet,
}: FloatingPlotWidgetProps) {
  const [minimized, setMinimized] = useState(false);

  // Set CSS var for decoupled positioning (works even with portal to body)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty("--right-menu-width", "18rem");
    }
  }, []);

  if (!isOpen || typeof document === "undefined") return null;

  const data = getMockData(parcel, player);

  const widget = (
    <div
      className={cn(
        "fixed z-[100] flex flex-col overflow-hidden rounded-xl border border-cyan-900/50 bg-[#0a0c14]/95 shadow-2xl backdrop-blur-md",
        "text-white text-sm transition-all duration-200",
        minimized ? "h-14" : "max-h-[calc(100vh-2rem)]"
      )}
      style={{
        top: "1rem",
        right: "calc(var(--right-menu-width, 280px) + 12px)",
        width: "min(400px, calc(100vw - 2rem))",
        // Independent of any snapping grid - pure fixed + CSS var
      }}
    >
      {/* Widget Control Header */}
      <div className="flex items-center justify-between border-b border-cyan-900/30 bg-[#11131c] px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="font-mono text-base font-semibold tracking-tighter">
            #{data.plotId}
          </div>
          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px]">
            {data.biome}
          </Badge>
          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px]">
            {data.status}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-cyan-400">
          <button
            onClick={() => setMinimized(!minimized)}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10 active:bg-white/20"
            aria-label={minimized ? "Expand widget" : "Minimize widget"}
            title={minimized ? "Expand for more control" : "Minimize to free map space"}
          >
            {minimized ? <Plus className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="flex h-6 w-6 items-center justify-center rounded hover:bg-white/10 active:bg-white/20"
              aria-label="Close plot details"
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Compact bar when minimized */}
      {minimized && (
        <div className="flex items-center justify-between px-3 py-1.5 text-xs">
          <div className="flex items-center gap-3 font-mono text-[10px]">
            <span className="text-emerald-400">LVL {data.level}</span>
            <span>DEF {data.defense}</span>
            <span>+{data.yieldPerHour}/h</span>
          </div>
          <div className="text-emerald-400 text-[10px]">{data.pendingYield} pending</div>
        </div>
      )}

      {/* Expanded content */}
      {!minimized && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          {/* Owner / Faction */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">OWNER</div>
              <div className="font-mono text-sm text-white/90">{data.owner}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-zinc-400">FACTION</div>
              <div className="text-emerald-400">{data.faction}</div>
            </div>
          </div>

          {/* Core Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-cyan-900/30 bg-black/30 p-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <Shield className="h-3 w-3" /> DEFENSE
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold text-white">{data.defense}</div>
              <div className="text-[10px] text-emerald-400">LVL {data.level}</div>
            </div>

            <div className="rounded-lg border border-cyan-900/30 bg-black/30 p-2">
              <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                <Zap className="h-3 w-3" /> YIELD / HR
              </div>
              <div className="mt-0.5 font-mono text-xl font-semibold text-white">{data.yieldPerHour}</div>
              <div className="text-[10px] text-emerald-400">Richness {data.richness}</div>
            </div>
          </div>

          {/* Pending / Economy */}
          <div className="rounded-lg border border-cyan-900/30 bg-black/30 p-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">PENDING YIELD</span>
              <span className="font-mono text-emerald-400">{data.pendingYield}</span>
            </div>
            <div className="mt-1 text-[10px] text-zinc-400">Frontier accumulation ready to claim</div>
          </div>

          {/* More Control - Actions & Upgrades (UI only) */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-widest text-cyan-400">
              <span>MORE CONTROL</span>
              <span className="text-emerald-400 text-[9px]">EXPANDED</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start border-cyan-900/50 bg-black/40 text-xs hover:bg-cyan-900/20"
                onClick={() => console.log("[UI-only] Mine action clicked (demo)")}
              >
                <Zap className="mr-1.5 h-3 w-3" /> Mine
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start border-cyan-900/50 bg-black/40 text-xs hover:bg-cyan-900/20"
                onClick={() => console.log("[UI-only] Upgrade clicked (demo)")}
              >
                <Shield className="mr-1.5 h-3 w-3" /> Upgrade
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start border-cyan-900/50 bg-black/40 text-xs hover:bg-cyan-900/20"
                onClick={() => console.log("[UI-only] Build clicked (demo)")}
              >
                Build
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 justify-start border-cyan-900/50 bg-black/40 text-xs hover:bg-cyan-900/20"
                onClick={() => onOpenFullSheet?.()}
              >
                <MapPin className="mr-1.5 h-3 w-3" /> Manage Full
              </Button>
            </div>

            <div className="mt-2 text-[10px] text-zinc-400">
              Analytics: Yield efficiency high • No immediate threats
            </div>
          </div>
        </div>
      )}

      {/* Subtle footer hint */}
      {!minimized && (
        <div className="px-3 py-1 text-[10px] text-center text-zinc-500 border-t border-cyan-900/20 bg-[#0a0c14]">
          Widget • Decoupled • Read-only
        </div>
      )}
    </div>
  );

  return createPortal(widget, document.body);
}
