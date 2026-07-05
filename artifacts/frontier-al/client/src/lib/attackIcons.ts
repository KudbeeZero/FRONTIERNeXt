import type React from "react";
import { Target, Zap, Crosshair, Skull } from "lucide-react";
import type { SpecialAttackType } from "@shared/schema";

export const ATTACK_ICONS: Record<SpecialAttackType, React.ElementType> = {
  orbital_strike: Target,
  emp_blast: Zap,
  siege_barrage: Crosshair,
  sabotage: Skull,
};
