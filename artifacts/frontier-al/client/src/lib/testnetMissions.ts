import type React from "react";
import {
  Wifi,
  Zap,
  BarChart3,
  Package,
  Trophy,
  Star,
  Pickaxe,
  Shield,
  Swords,
  Link2,
} from "lucide-react";

export type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface Mission {
  id: string;
  priority: Priority;
  title: string;
  objective: string;
  whatToWatch: string[];
  icon: React.ElementType;
  autoDetectKey?: string;
}

export interface PlayerStats {
  territories: number;
  totalIronMined: number;
  totalFuelMined: number;
  totalCrystalMined: number;
  totalAscendEarned: number;
  attacksWon: number;
  attacksLost: number;
  hasCommander: boolean;
  hasDrones: boolean;
  welcomeBonusReceived: boolean;
}

export const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; border: string }> = {
  CRITICAL: { color: "text-red-400",            bg: "bg-red-500/10",   border: "border-red-500/30"   },
  HIGH:     { color: "text-amber-400",          bg: "bg-amber-500/10", border: "border-amber-500/30" },
  MEDIUM:   { color: "text-primary",            bg: "bg-primary/10",   border: "border-primary/30"   },
  LOW:      { color: "text-muted-foreground",   bg: "bg-muted/30",     border: "border-border"       },
};

export const MISSIONS: Mission[] = [
  {
    id: "wallet-connect",
    priority: "CRITICAL",
    title: "WALLET CONNECTION",
    objective: "Connect your Pera or LUTE wallet to Algorand TestNet via the wallet button in the top-right corner of the game.",
    whatToWatch: [
      "Does the connection dialog open immediately?",
      "Is your wallet address displayed correctly after connecting?",
      "Does the connection persist after a full page refresh?",
    ],
    icon: Wifi,
    autoDetectKey: "wallet-connect",
  },
  {
    id: "asa-optin",
    priority: "CRITICAL",
    title: "ASCEND TOKEN OPT-IN",
    objective: "Opt your wallet into the ASCEND ASA (Algorand Standard Asset). The game should prompt or guide you through this step.",
    whatToWatch: [
      "Is the opt-in prompt clear and actionable?",
      "Does the transaction confirm on-chain without errors?",
      "Is your ASCEND token balance visible after opt-in?",
    ],
    icon: Link2,
  },
  {
    id: "purchase-land",
    priority: "HIGH",
    title: "CLAIM TERRITORY",
    objective: "Purchase your first land parcel. Tap an unclaimed tile on the map and complete the ALGO transaction.",
    whatToWatch: [
      "Is the purchase flow intuitive and clearly explained?",
      "Does ALGO deduct correctly from your wallet balance?",
      "Does the tile update to show your ownership immediately after confirmation?",
    ],
    icon: Package,
    autoDetectKey: "purchase-land",
  },
  {
    id: "mine-resources",
    priority: "HIGH",
    title: "MINE RESOURCES",
    objective: "Mine Iron, Fuel, and Crystal from your territory using the Mine button in the tile action panel.",
    whatToWatch: [
      "Does the 5-minute mining cooldown timer display and function correctly?",
      "Are resource yields consistent with the tile's biome type?",
      "Does the Resource HUD update in real-time after mining?",
    ],
    icon: Pickaxe,
    autoDetectKey: "mine-resources",
  },
  {
    id: "build-improvement",
    priority: "HIGH",
    title: "BUILD IMPROVEMENT",
    objective: "Construct a turret, drill, shield generator, or storage depot on one of your owned parcels.",
    whatToWatch: [
      "Is the build menu easy to navigate and understand?",
      "Do resource costs deduct accurately when building?",
      "Does the improvement icon appear on the map tile after construction?",
    ],
    icon: Zap,
  },
  {
    id: "claim-frontier",
    priority: "HIGH",
    title: "CLAIM ASCEND TOKENS",
    objective: "Accumulate passive ASCEND token earnings from your territory, then claim them to your wallet.",
    whatToWatch: [
      "Is the accumulation rate visible and consistent with expectations?",
      "Does the on-chain claim transaction confirm without errors?",
      "Is the claimed amount reflected in your Algorand wallet?",
    ],
    icon: Star,
    autoDetectKey: "claim-frontier",
  },
  {
    id: "pve-combat",
    priority: "MEDIUM",
    title: "PvE COMBAT",
    objective: "Initiate an attack against an AI-controlled parcel. Allocate troops and resources, then confirm the battle.",
    whatToWatch: [
      "Is the attack confirmation dialog clear and informative?",
      "Does battle resolution trigger correctly after the 10-minute window?",
      "Are battle outcomes logged in the War Room event feed?",
    ],
    icon: Swords,
    autoDetectKey: "pve-combat",
  },
  {
    id: "upgrade-defenses",
    priority: "MEDIUM",
    title: "UPGRADE BASE DEFENSES",
    objective: "Upgrade a parcel's defense level from the Command Center panel.",
    whatToWatch: [
      "Does the defense level increase and persist between sessions?",
      "Is the upgrade cost clearly displayed before confirming?",
      "Does the defensive bonus appear to affect battle outcomes?",
    ],
    icon: Shield,
  },
  {
    id: "collect-all",
    priority: "MEDIUM",
    title: "COLLECT ALL RESOURCES",
    objective: "Use the Collect All button to gather resources from all your territories simultaneously.",
    whatToWatch: [
      "Does Collect All work correctly when owning multiple parcels?",
      "Are all tiles' stored resources transferred to your balance?",
      "Is there any noticeable lag or partial collection failures?",
    ],
    icon: Package,
  },
  {
    id: "leaderboard",
    priority: "LOW",
    title: "LEADERBOARD ACCURACY",
    objective: "Check the Rankings tab and verify your player statistics are represented correctly.",
    whatToWatch: [
      "Is your rank accurate relative to other players?",
      "Do territory counts and token balances match your actual in-game state?",
      "Does the leaderboard refresh after major events?",
    ],
    icon: BarChart3,
  },
  {
    id: "commander-mint",
    priority: "LOW",
    title: "MINT COMMANDER AVATAR",
    objective: "Navigate to the Commander tab and attempt to mint a Commander NFT by burning ASCEND tokens.",
    whatToWatch: [
      "Is the token burn amount clearly shown before confirming?",
      "Does the Commander appear in the Commander panel after minting?",
      "Can you deploy a recon drone with the Commander afterward?",
    ],
    icon: Trophy,
    autoDetectKey: "commander-mint",
  },
];

export function autoDetectCompletions(stats: PlayerStats, isConnected: boolean): Set<string> {
  const auto = new Set<string>();
  if (isConnected) auto.add("wallet-connect");
  if (stats.territories > 0) auto.add("purchase-land");
  if (stats.totalIronMined > 0 || stats.totalFuelMined > 0) auto.add("mine-resources");
  if (stats.totalAscendEarned > 0) auto.add("claim-frontier");
  if (stats.attacksWon > 0 || stats.attacksLost > 0) auto.add("pve-combat");
  if (stats.hasCommander) auto.add("commander-mint");
  return auto;
}
