// Bottom action bar: EQUIP / UPGRADE / MODIFY / COMPARE / FAVORITE / DISMANTLE /
// INSPECT. EQUIP and FAVORITE are wired to local state; COMPARE and INSPECT are
// deferred (placeholder toast). Presentation-only.

import {
  ArrowLeftRight,
  Check,
  Eye,
  Hammer,
  Heart,
  Settings2,
  Star,
  Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Weapon } from "./_data";

interface ActionBarProps {
  weapon: Weapon | null;
  equipped: boolean;
  onEquip: () => void;
  onToggleFavorite: () => void;
  /** Fired by the deferred actions (COMPARE / INSPECT / UPGRADE / MODIFY / DISMANTLE). */
  onDeferred: (action: string) => void;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  primary,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-wider transition-all",
        "disabled:cursor-not-allowed disabled:opacity-40",
        primary
          ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200 shadow-[0_0_18px_-6px_rgba(34,211,238,0.9)] hover:bg-cyan-400/25"
          : danger
            ? "border-red-500/40 text-red-300 hover:bg-red-500/10"
            : active
              ? "border-amber-400/50 bg-amber-400/10 text-amber-200"
              : "border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
      )}
    >
      <Icon className={cn("h-4 w-4", active && "fill-current")} />
      {label}
    </button>
  );
}

export function ActionBar({
  weapon,
  equipped,
  onEquip,
  onToggleFavorite,
  onDeferred,
}: ActionBarProps) {
  const disabled = weapon === null;

  return (
    <div className="flex items-stretch gap-2 rounded-xl border border-white/5 bg-zinc-950/70 p-2 backdrop-blur">
      <ActionButton
        icon={equipped ? Check : Star}
        label={equipped ? "Equipped" : "Equip"}
        onClick={onEquip}
        disabled={disabled}
        primary={!equipped}
        active={equipped}
      />
      <ActionButton
        icon={Hammer}
        label="Upgrade"
        onClick={() => onDeferred("Upgrade")}
        disabled={disabled}
      />
      <ActionButton
        icon={Settings2}
        label="Modify"
        onClick={() => onDeferred("Modify")}
        disabled={disabled}
      />
      <ActionButton
        icon={ArrowLeftRight}
        label="Compare"
        onClick={() => onDeferred("Compare")}
        disabled={disabled}
      />
      <ActionButton
        icon={Heart}
        label="Favorite"
        onClick={onToggleFavorite}
        disabled={disabled}
        active={weapon?.favorite ?? false}
      />
      <ActionButton
        icon={Trash2}
        label="Dismantle"
        onClick={() => onDeferred("Dismantle")}
        disabled={disabled}
        danger
      />
      <ActionButton
        icon={Eye}
        label="Inspect"
        onClick={() => onDeferred("Inspect")}
        disabled={disabled}
      />
    </div>
  );
}
