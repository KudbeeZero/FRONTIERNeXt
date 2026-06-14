// Sample data + types for the Weapon Cache & Armory mockup.
//
// IMPORTANT: this is throwaway *presentation* data for a visual prototype. It is
// intentionally a Destiny/Division-style loot-shooter model (DPS, elements,
// rarity tiers, magazines, attachments, augments) per the UI Bible, and is NOT
// wired to the real FRONTIER-AL weapon system (missiles / artillery / anti-air
// with firepower/range/guidance attributes). No server, schema, or game data is
// touched. If/when this look is adopted, a later unit maps it onto real data.

export type Rarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary"
  | "Exotic"
  | "Mythic";

export type Element = "Fire" | "Ice" | "Electric" | "Toxic" | "Gravity" | "Void";

export type Category =
  | "AR"
  | "SMG"
  | "Shotgun"
  | "Sniper"
  | "Launcher"
  | "Energy"
  | "Experimental"
  | "Melee"
  | "Legendary"
  | "Boss";

export type StatKey =
  | "Damage"
  | "Fire Rate"
  | "Accuracy"
  | "Recoil"
  | "Range"
  | "Reload"
  | "Magazine"
  | "Critical Chance"
  | "Mobility";

export type AttachmentSlot =
  | "Barrel"
  | "Magazine"
  | "Scope"
  | "Grip"
  | "Stock"
  | "Elemental Core";

export interface Attachment {
  slot: AttachmentSlot;
  name: string;
  rarity: Rarity;
  /** Short stat-impact blurb, e.g. "+8% Accuracy / -4% Mobility". */
  impact: string;
  /** null = empty socket. */
  equipped: boolean;
}

export interface Augment {
  name: string;
  glyph: string;
  description: string;
  synergy: string;
}

export interface Weapon {
  id: string;
  name: string;
  category: Category;
  /** Display class, e.g. "Experimental Energy Rifle". */
  weaponClass: string;
  rarity: Rarity;
  element: Element;
  level: number;
  dps: number;
  manufacturer: string;
  lore: [string, string];
  stats: Record<StatKey, number>; // each 0..100
  attachments: Attachment[];
  augments: Augment[];
  favorite: boolean;
  /** Days since acquired — drives the "Recently Acquired" sort. */
  acquiredDaysAgo: number;
}

// The cache-screen tabs from the Bible.
export type CacheTab =
  | "ALL"
  | "AR"
  | "SMG"
  | "SHOTGUN"
  | "SNIPER"
  | "ENERGY"
  | "LEGENDARY"
  | "FAVORITES";

export const CACHE_TABS: CacheTab[] = [
  "ALL",
  "AR",
  "SMG",
  "SHOTGUN",
  "SNIPER",
  "ENERGY",
  "LEGENDARY",
  "FAVORITES",
];

export type SortKey = "DPS" | "Rarity" | "Element" | "Recently Acquired";
export const SORT_KEYS: SortKey[] = ["DPS", "Rarity", "Element", "Recently Acquired"];

// Maps a tab to the weapon categories it shows (ALL/FAVORITES handled separately).
export const TAB_CATEGORIES: Partial<Record<CacheTab, Category[]>> = {
  AR: ["AR"],
  SMG: ["SMG"],
  SHOTGUN: ["Shotgun"],
  SNIPER: ["Sniper"],
  ENERGY: ["Energy", "Experimental"],
  LEGENDARY: ["Legendary", "Boss"],
};

const ATTACHMENT_SLOTS: AttachmentSlot[] = [
  "Barrel",
  "Magazine",
  "Scope",
  "Grip",
  "Stock",
  "Elemental Core",
];

function slots(
  filled: Partial<Record<AttachmentSlot, { name: string; rarity: Rarity; impact: string }>>,
): Attachment[] {
  return ATTACHMENT_SLOTS.map((slot) => {
    const f = filled[slot];
    return f
      ? { slot, name: f.name, rarity: f.rarity, impact: f.impact, equipped: true }
      : { slot, name: "Empty", rarity: "Common", impact: "No module installed", equipped: false };
  });
}

const A = {
  chainLightning: {
    name: "Chain Lightning",
    glyph: "⚡",
    description: "Hits arc to up to 3 nearby targets for 40% damage.",
    synergy: "Electric weapons +15% arc range.",
  },
  cryoBurst: {
    name: "Cryo Burst",
    glyph: "🧊",
    description: "Critical hits emit a freezing nova, slowing enemies 35%.",
    synergy: "Ice element: slow becomes a 1.2s freeze.",
  },
  explosiveReload: {
    name: "Explosive Reload",
    glyph: "💥",
    description: "Reloading discharges stored rounds as a concussive blast.",
    synergy: "High Magazine stat scales the blast radius.",
  },
  timeDilation: {
    name: "Time Dilation",
    glyph: "🕒",
    description: "Aiming briefly slows local time by 30% for 2s.",
    synergy: "Pairs with Sniper class for guaranteed crits.",
  },
  ghostDash: {
    name: "Ghost Dash",
    glyph: "👻",
    description: "Dashing leaves a decoy and grants 1s of phase-through.",
    synergy: "Mobility over 60 reduces dash cooldown.",
  },
} satisfies Record<string, Augment>;

export const WEAPONS: Weapon[] = [
  {
    id: "arcstorm-mk2",
    name: "ARCSTORM MK-II",
    category: "Experimental",
    weaponClass: "Experimental Energy Rifle",
    rarity: "Exotic",
    element: "Electric",
    level: 42,
    dps: 432,
    manufacturer: "Nova Industries",
    lore: [
      "Forged in the storm-foundries of the outer belt,",
      "the ARCSTORM channels a caged lightning core.",
    ],
    stats: {
      Damage: 86, "Fire Rate": 62, Accuracy: 91, Recoil: 28,
      Range: 74, Reload: 55, Magazine: 80, "Critical Chance": 66, Mobility: 41,
    },
    attachments: slots({
      Barrel: { name: "Tesla Vent", rarity: "Epic", impact: "+9% Range / -3% Mobility" },
      Scope: { name: "Storm Optic", rarity: "Rare", impact: "+12% Accuracy" },
      "Elemental Core": { name: "Voltaic Cell", rarity: "Exotic", impact: "+18% Electric DMG" },
    }),
    augments: [A.chainLightning, A.timeDilation],
    favorite: true,
    acquiredDaysAgo: 2,
  },
  {
    id: "frostbite-vortex",
    name: "FROSTBITE VORTEX",
    category: "Energy",
    weaponClass: "Cryo Beam Projector",
    rarity: "Legendary",
    element: "Ice",
    level: 38,
    dps: 388,
    manufacturer: "Polar Dynamics",
    lore: [
      "A continuous lance of supercooled plasma",
      "that crystallizes whatever it touches.",
    ],
    stats: {
      Damage: 78, "Fire Rate": 88, Accuracy: 70, Recoil: 18,
      Range: 60, Reload: 49, Magazine: 92, "Critical Chance": 44, Mobility: 52,
    },
    attachments: slots({
      "Elemental Core": { name: "Glacier Cell", rarity: "Legendary", impact: "+22% Ice DMG" },
      Magazine: { name: "Coolant Drum", rarity: "Epic", impact: "+20% Magazine" },
    }),
    augments: [A.cryoBurst],
    favorite: false,
    acquiredDaysAgo: 9,
  },
  {
    id: "vanguard-ar7",
    name: "VANGUARD AR-7",
    category: "AR",
    weaponClass: "Tactical Assault Rifle",
    rarity: "Epic",
    element: "Fire",
    level: 33,
    dps: 311,
    manufacturer: "Ironworks Defense",
    lore: [
      "Standard-issue for frontier shock troops,",
      "rugged enough to outlive its operator.",
    ],
    stats: {
      Damage: 70, "Fire Rate": 74, Accuracy: 80, Recoil: 40,
      Range: 68, Reload: 66, Magazine: 60, "Critical Chance": 50, Mobility: 64,
    },
    attachments: slots({
      Barrel: { name: "Compensator", rarity: "Rare", impact: "-12% Recoil" },
      Grip: { name: "Angled Grip", rarity: "Uncommon", impact: "+6% Accuracy" },
      Stock: { name: "Light Stock", rarity: "Rare", impact: "+8% Mobility" },
    }),
    augments: [A.explosiveReload],
    favorite: true,
    acquiredDaysAgo: 1,
  },
  {
    id: "whisper-smg",
    name: "WHISPER-9",
    category: "SMG",
    weaponClass: "Suppressed Machine Pistol",
    rarity: "Rare",
    element: "Toxic",
    level: 27,
    dps: 264,
    manufacturer: "Shade Collective",
    lore: [
      "Barely louder than a held breath,",
      "its rounds weep a corrosive venom.",
    ],
    stats: {
      Damage: 52, "Fire Rate": 95, Accuracy: 58, Recoil: 24,
      Range: 38, Reload: 72, Magazine: 70, "Critical Chance": 60, Mobility: 88,
    },
    attachments: slots({
      Barrel: { name: "Suppressor", rarity: "Rare", impact: "Silent / -5% Range" },
      Magazine: { name: "Venom Clip", rarity: "Epic", impact: "+14% Toxic DMG" },
    }),
    augments: [A.ghostDash],
    favorite: false,
    acquiredDaysAgo: 14,
  },
  {
    id: "longreach-x",
    name: "LONGREACH X",
    category: "Sniper",
    weaponClass: "Anti-Materiel Rail Sniper",
    rarity: "Legendary",
    element: "Gravity",
    level: 45,
    dps: 502,
    manufacturer: "Meridian Optics",
    lore: [
      "One shot bends space toward the target;",
      "distance is a courtesy, not a defense.",
    ],
    stats: {
      Damage: 98, "Fire Rate": 22, Accuracy: 96, Recoil: 70,
      Range: 99, Reload: 34, Magazine: 20, "Critical Chance": 90, Mobility: 30,
    },
    attachments: slots({
      Scope: { name: "Singularity Lens", rarity: "Legendary", impact: "+18% Range / +10% Crit" },
      Barrel: { name: "Heavy Rail", rarity: "Epic", impact: "+12% Damage / +Recoil" },
      "Elemental Core": { name: "Graviton Cell", rarity: "Epic", impact: "+16% Gravity DMG" },
    }),
    augments: [A.timeDilation],
    favorite: false,
    acquiredDaysAgo: 20,
  },
  {
    id: "breaker-12",
    name: "BREAKER-12",
    category: "Shotgun",
    weaponClass: "Auto Breach Shotgun",
    rarity: "Epic",
    element: "Fire",
    level: 31,
    dps: 356,
    manufacturer: "Ironworks Defense",
    lore: [
      "Doors, walls, arguments — all settled",
      "in a single thunderous breath of flame.",
    ],
    stats: {
      Damage: 92, "Fire Rate": 48, Accuracy: 40, Recoil: 66,
      Range: 26, Reload: 58, Magazine: 44, "Critical Chance": 55, Mobility: 58,
    },
    attachments: slots({
      Barrel: { name: "Dragon Choke", rarity: "Epic", impact: "+15% Fire DMG / +Spread" },
      Grip: { name: "Recoil Pad", rarity: "Rare", impact: "-10% Recoil" },
    }),
    augments: [A.explosiveReload],
    favorite: false,
    acquiredDaysAgo: 6,
  },
  {
    id: "nemesis-prime",
    name: "NEMESIS PRIME",
    category: "Boss",
    weaponClass: "Boss-Drop Devastator",
    rarity: "Mythic",
    element: "Void",
    level: 50,
    dps: 640,
    manufacturer: "??? // Recovered",
    lore: [
      "Pried from the husk of the Hollow King,",
      "it remembers everything it has unmade.",
    ],
    stats: {
      Damage: 100, "Fire Rate": 70, Accuracy: 84, Recoil: 50,
      Range: 80, Reload: 60, Magazine: 88, "Critical Chance": 95, Mobility: 62,
    },
    attachments: slots({
      Barrel: { name: "Null Barrel", rarity: "Mythic", impact: "+20% Void DMG" },
      Magazine: { name: "Abyss Drum", rarity: "Legendary", impact: "+24% Magazine" },
      Scope: { name: "Oblivion Sight", rarity: "Exotic", impact: "+14% Crit" },
      "Elemental Core": { name: "Singularity Heart", rarity: "Mythic", impact: "+30% Void DMG" },
    }),
    augments: [A.chainLightning, A.cryoBurst, A.timeDilation],
    favorite: true,
    acquiredDaysAgo: 0,
  },
  {
    id: "scrap-carbine",
    name: "SCRAP CARBINE",
    category: "AR",
    weaponClass: "Salvaged Carbine",
    rarity: "Common",
    element: "Fire",
    level: 8,
    dps: 96,
    manufacturer: "Field Salvage",
    lore: [
      "Three other guns donated parts to make it.",
      "It works. Mostly. Don't ask about the smell.",
    ],
    stats: {
      Damage: 34, "Fire Rate": 50, Accuracy: 42, Recoil: 55,
      Range: 40, Reload: 48, Magazine: 38, "Critical Chance": 20, Mobility: 60,
    },
    attachments: slots({}),
    augments: [],
    favorite: false,
    acquiredDaysAgo: 30,
  },
  {
    id: "ranger-smg",
    name: "RANGER SMG",
    category: "SMG",
    weaponClass: "Frontier Sidearm SMG",
    rarity: "Uncommon",
    element: "Electric",
    level: 15,
    dps: 158,
    manufacturer: "Frontier Co-op",
    lore: [
      "Cheap, cheerful, and surprisingly loyal.",
      "Every settler's first real weapon.",
    ],
    stats: {
      Damage: 44, "Fire Rate": 82, Accuracy: 54, Recoil: 30,
      Range: 36, Reload: 70, Magazine: 62, "Critical Chance": 38, Mobility: 84,
    },
    attachments: slots({
      Magazine: { name: "Extended Mag", rarity: "Uncommon", impact: "+10% Magazine" },
    }),
    augments: [A.chainLightning],
    favorite: false,
    acquiredDaysAgo: 18,
  },
  {
    id: "sunder-blade",
    name: "SUNDER BLADE",
    category: "Melee",
    weaponClass: "Plasma Greatsword",
    rarity: "Legendary",
    element: "Fire",
    level: 40,
    dps: 410,
    manufacturer: "Emberforge",
    lore: [
      "A blade that drinks heat and gives it back",
      "in one long, decisive arc.",
    ],
    stats: {
      Damage: 95, "Fire Rate": 30, Accuracy: 100, Recoil: 0,
      Range: 18, Reload: 0, Magazine: 0, "Critical Chance": 72, Mobility: 70,
    },
    attachments: slots({
      "Elemental Core": { name: "Ember Core", rarity: "Legendary", impact: "+25% Fire DMG" },
      Grip: { name: "Balanced Hilt", rarity: "Epic", impact: "+10% Crit" },
    }),
    augments: [A.ghostDash],
    favorite: false,
    acquiredDaysAgo: 11,
  },
  {
    id: "halo-launcher",
    name: "HALO LAUNCHER",
    category: "Launcher",
    weaponClass: "Seeker Missile Launcher",
    rarity: "Epic",
    element: "Gravity",
    level: 36,
    dps: 470,
    manufacturer: "Meridian Optics",
    lore: [
      "Fire and forget — the halo finds its way.",
      "Lock tone is the last thing they hear.",
    ],
    stats: {
      Damage: 96, "Fire Rate": 18, Accuracy: 88, Recoil: 60,
      Range: 90, Reload: 28, Magazine: 12, "Critical Chance": 40, Mobility: 36,
    },
    attachments: slots({
      Scope: { name: "Lock Array", rarity: "Epic", impact: "+20% lock speed" },
      "Elemental Core": { name: "Graviton Cell", rarity: "Rare", impact: "+12% Gravity DMG" },
    }),
    augments: [A.timeDilation],
    favorite: false,
    acquiredDaysAgo: 4,
  },
  {
    id: "verdict-dmr",
    name: "VERDICT DMR",
    category: "Sniper",
    weaponClass: "Marksman Rifle",
    rarity: "Rare",
    element: "Toxic",
    level: 24,
    dps: 248,
    manufacturer: "Shade Collective",
    lore: [
      "Patient, precise, and lightly poisoned.",
      "It does not miss twice.",
    ],
    stats: {
      Damage: 74, "Fire Rate": 40, Accuracy: 90, Recoil: 44,
      Range: 86, Reload: 52, Magazine: 30, "Critical Chance": 78, Mobility: 50,
    },
    attachments: slots({
      Scope: { name: "Hunter Optic", rarity: "Rare", impact: "+10% Accuracy" },
      Magazine: { name: "Venom Clip", rarity: "Rare", impact: "+10% Toxic DMG" },
    }),
    augments: [A.cryoBurst],
    favorite: false,
    acquiredDaysAgo: 16,
  },
];
