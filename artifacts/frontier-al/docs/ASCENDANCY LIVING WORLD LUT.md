# ASCENDANCY — The Living World LUT

### Community · Comms · Weather · Contests · Voice · Narration · Engagement

> The layer that turns a working game into a world people return to · June 2026
> Build AFTER the foundation, security, and activation phases are done

-----

## THE THESIS

You have a strategy engine. What you don’t have yet is the **connective tissue that makes
a multiplayer world feel alive** — the reasons players come back daily, talk to each
other, compete in events, and feel like they’re inside a living planet rather than a
spreadsheet with a globe.

The scan confirms the gap precisely: you have a **strong WebSocket broadcast backbone**
(per-interval state flush, chain-health broadcasts, payload monitoring) but **zero social
layer** — no chat, no notifications, no announcements, no contests, no presence. The
transport exists. The world on top of it doesn’t.

This LUT designs that world. Everything here rides on the WebSocket server you already
have, and everything respects the anti-reset, additive, security-first discipline.

-----

## 1. SECURE INTEGRATED CHAT

### Why it’s the keystone

Chat is the single highest-retention feature you can add. Players who talk, stay. But chat
is also the highest-risk surface — spam, abuse, scams, impersonation. It must be secure by
design.

### Architecture (rides your existing WS server)

```
┌──────────────────────────────────────────────────────────────┐
│  CHAT SYSTEM (on existing wsServer.ts)                        │
│                                                               │
│  Channels:                                                    │
│   • Global       — everyone, heavily rate-limited             │
│   • Faction      — your faction only (NEXUS-7/KRONOS/etc)     │
│   • Region       — players near your territory                │
│   • Direct       — 1:1, opt-in                                │
│                                                               │
│  Every message:                                               │
│   1. Authed (session identity — Security LUT §1 required)     │
│   2. Rate-limited (per-player token bucket)                   │
│   3. Sanitized (no HTML/script injection)                     │
│   4. Filtered (profanity/scam-link detection)                 │
│   5. Signed-identity (display name tied to verified wallet)   │
│   6. Persisted (Redis ring buffer + optional Postgres log)    │
└──────────────────────────────────────────────────────────────┘
```

### Security rules (non-negotiable)

- **Auth-gated:** no chat without a verified wallet session. This kills anonymous spam and
  ties every message to a real, stakeable identity.
- **Rate-limited per player:** token bucket, e.g. 5 messages / 10 seconds, stricter in
  Global. Reuse the `express-rate-limit` pattern adapted for WS.
- **Sanitize everything:** strip HTML, escape on render. Never `dangerouslySetInnerHTML`
  chat content.
- **Scam-link defense:** block or warn on URLs; never auto-link. Crypto games are prime
  phishing targets — a fake “claim your $ASCEND” link in global chat is an attack.
- **Impersonation defense:** display name + a short wallet-address suffix
  (`Commander.xY3z`) so two players can’t appear identical.
- **Moderation hooks:** mute, timeout, report. Store reports for review. An `isMuted` flag
  per player, checked server-side before broadcast.
- **No PII in transit:** chat carries display name + message only, never email/address
  beyond the public wallet suffix.

### Storage model

```typescript
// Redis ring buffer per channel (fast, ephemeral, last ~200 messages)
//   key: chat:global, chat:faction:NEXUS7, chat:region:{regionId}
// Optional Postgres append-only log for moderation/audit (chat_log table)
interface ChatMessage {
  id: string;
  channel: 'global' | 'faction' | 'region' | 'direct';
  senderId: string;          // verified playerId
  senderName: string;        // display + wallet suffix
  body: string;              // sanitized
  ts: number;
  factionId?: string;
}
```

### Why it’s safe AND cheap

Riding the existing WS server means no new transport, no new scaling concern. Redis ring
buffers mean chat history costs almost nothing and self-expires. Auth-gating means the
identity work from the Security LUT does double duty.

-----

## 2. ANNOUNCEMENTS & NOTIFICATIONS

### The need

*“How do we send out announcements?”* — You need a way to push messages to players:
season starts, contests, attacks on their territory, market resolutions, dev updates.

### Two distinct systems

**A. Broadcast announcements (dev → all players)**
An admin-authored message pushed to every connected client + shown on next login.

```typescript
// Admin posts → WS broadcast + persisted banner
interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'event' | 'urgent';
  ctaUrl?: string;            // e.g. link to a contest
  startTs: number;
  endTs?: number;             // auto-expire
}
// POST /api/admin/announce  (admin-key gated)
// → broadcastRaw({ type: 'announcement', ... })
// → persisted in Redis, served to clients on connect
```

**B. Personal notifications (system → one player)**
Targeted events: “Your territory at Sector 12 is under attack”, “Your market bet won 240
$ASCEND”, “Your land NFT was delivered.”

```typescript
interface Notification {
  id: string;
  playerId: string;
  type: 'attack' | 'market' | 'nft' | 'season' | 'social';
  body: string;
  read: boolean;
  ts: number;
  link?: string;             // deep-link to the relevant plot/panel
}
// Delivered live via WS if online, queued in Redis if offline,
// shown in a notification bell on next login.
```

### The notification bus pattern

Create one internal event bus. Game systems (battle resolution, market settlement, NFT
delivery) emit notification events; the bus routes them to the right player’s WS connection
or queues them. This reuses your `pendingFrontierTransfers` queue philosophy — one pattern,
many event types.

### Out-of-game reach (later)

For players not currently online, integrate:

- **Email digests** (daily “here’s what happened to your empire”) via a transactional
  email API.
- **Discord webhook** posts for major world events (a legendary plot sold, a season
  ended).
- **Push notifications** if you ever wrap in a mobile shell.

-----

## 3. WEATHER & DYNAMIC ENVIRONMENT

### The idea you raised

Weather systems. This is genuinely great for a planet-based game — it makes the world feel
alive and adds a strategic layer that’s **deterministic and on-brand** with your
biome/observer design.

### Design: deterministic global weather

Weather should be **computed, not stored** (matching your globe philosophy). A global
weather seed advances each turn; weather per region is derived deterministically from
`(weatherSeed, regionId, turn)`. Every client computes identical weather — zero network
cost, like the Fibonacci sphere.

```typescript
interface WeatherSystem {
  type: 'clear' | 'storm' | 'ion_surge' | 'meteor_weather' | 'eclipse' | 'aurora';
  intensity: number;          // 0-1
  affectedRegions: number[];  // derived from seed
  startTurn: number;
  durationTurns: number;
}

// Deterministic: same seed + turn = same weather everywhere
function weatherForRegion(seed: number, regionId: number, turn: number): WeatherSystem {
  const h = hashSeed(seed, regionId, turn);
  // map hash → weather type, intensity, duration
}
```

### Strategic effects (ties into existing systems)

Weather modifies gameplay — feeding the battle engine as **inputs**, never touching
`tuning.ts`:

|Weather            |Effect                                          |System touched                    |
|-------------------|------------------------------------------------|----------------------------------|
|Ion Storm          |Energy structures yield +20%, but scans blocked |Energy archetype, fog of war      |
|Meteor Weather     |Mining yield +15%, random impact damage         |Resource archetype, orbital events|
|Eclipse            |Defense bonus (cover), reduced solar energy     |Battle inputs, energy             |
|Aurora             |$ASCEND mining bonus, purely cosmetic + economic|Token economy                     |
|Storm Belt activity|Movement/attack cost up in affected regions     |Battle inputs                     |

### Visual layer (ties into globe overhaul)

Weather renders as overlay shaders on the globe — storm clouds, ion shimmer, eclipse
shadow sweeping across regions. This is where the globe goes from “OK” to “alive.” Pairs
perfectly with the lighting overhaul from the Globe LUT.

### Why it’s powerful

It’s a **content engine that costs almost nothing** — deterministic generation means
infinite variety with no storage, and it gives players a constantly-shifting strategic map
plus a reason to check in (“there’s an ion storm over my energy grid — time to harvest”).

-----

## 4. CONTESTS & EVENTS

### The engagement engine

Contests are scheduled, rule-bound competitions with $ASCEND/NFT prizes. They create
urgency, social buzz, and reasons to log in. Your seasons system is the foundation — this
extends it.

### Contest types

|Contest                |Goal                              |Prize                        |Duration|
|-----------------------|----------------------------------|-----------------------------|--------|
|**Land Rush**          |Most parcels claimed in 48h       |$ASCEND pool + rare commander|Weekend |
|**Conquest**           |Most successful attacks           |Legendary plot               |Week    |
|**Builder**            |Highest sub-parcel development    |Building blueprint NFT       |Week    |
|**Faction War**        |Faction with most territory gained|Faction-wide $ASCEND airdrop |Season  |
|**Market Maker**       |Most trade volume                 |Fee rebate + title           |Week    |
|**Prediction Champion**|Best prediction-market record     |$ASCEND + leaderboard glory  |Ongoing |

### Architecture (extends seasons + treasury)

```typescript
interface Contest {
  id: string;
  type: ContestType;
  title: string;
  rules: ContestRules;        // metric tracked, eligibility
  prizePool: { ascend: number; nfts?: string[] };
  startTs: number;
  endTs: number;
  leaderboard: ContestEntry[]; // computed from game events
  status: 'upcoming' | 'active' | 'settling' | 'complete';
}
```

Contest scoring reads from the events you already emit (purchases, battles, trades). The
treasury ledger funds prizes. Settlement distributes $ASCEND on-chain. This is mostly
**reading existing data through a new lens** — not new game mechanics.

### The contest → announcement → chat loop

A contest creates a self-reinforcing engagement cycle:

1. Announcement system pushes “Land Rush starts in 1 hour”
1. Players compete (existing mechanics)
1. Live leaderboard updates via WS broadcast
1. Chat lights up with trash talk and alliances
1. Settlement pays out + announces winners
1. HILDA generates a recap video

Every system feeds every other. This is what “living world” means structurally.

-----

## 5. VOICE & NARRATION

### Two distinct voice opportunities

**A. World narration (HILDA’s voice, in-game)**
The custom ElevenLabs “Ascendancy Commander” voice from the HILDA pipeline isn’t just for
YouTube — it can narrate the game itself:

- Season opening cinematics (“Season 3 begins. The factions stir…”)
- Major event announcements (a legendary plot falls, a faction conquers a continent)
- Onboarding (“Welcome, Commander. Your empire begins with a single parcel.”)
- Contest kickoffs and winner announcements

These are **pre-generated audio clips** triggered by game events — cheap, high-impact,
and they reuse the voice you already cloned.

**B. Live voice chat (later, ambitious)**
Faction-based voice channels for coordinated play. This is a bigger lift (WebRTC, TURN
servers, moderation) — defer it, but design the chat channel structure (Section 1) so
voice channels map onto the same faction/region model when you’re ready.

### Dynamic narration (advanced)

Combine the Claude API + ElevenLabs to generate **contextual narration on the fly**: when a
major battle resolves, Claude writes a one-line dramatic recap, ElevenLabs voices it, and
it plays for involved players. “The forces of KRONOS shattered against the walls of Sector
9.” This is the kind of texture that makes a world feel authored.

-----

## 6. PRESENCE & SOCIAL FABRIC

### Small features, big retention impact

- **Online presence:** show how many players are online, who’s in your faction right now.
  The WS server already knows `clients.size` — surface it.
- **Activity feed:** a global ticker of world events (“Commander.xY3z claimed Sector 44”,
  “VANGUARD won the Land Rush”). Reads from `gameEvents`. Makes the world feel populated.
- **Player profiles:** public profile per wallet — territory held, battles won, faction,
  commander, contest titles. Creates identity and status.
- **Faction identity:** faction-wide stats, faction chat, faction contests. Turns solo
  play into team play. Your AI factions (NEXUS-7, KRONOS, VANGUARD, SPECTRE) already give
  you the team structure — let human players rally under them.
- **Titles & achievements:** earned badges (“First Blood”, “Land Baron”, “Storm Rider”)
  shown in chat and profile. Cheap to implement, strong status motivation.

-----

## 7. THE ENGAGEMENT FLYWHEEL

Here’s how all of this compounds. Each system makes the others stronger:

```
        Weather shifts the map
                 ↓
   Contest announced around it
                 ↓
   Announcement pushed to all  ←──────┐
                 ↓                     │
   Players log in to compete           │
                 ↓                     │
   Chat lights up (secure, social)     │
                 ↓                     │
   Battles/trades generate events      │
                 ↓                     │
   Activity feed + leaderboard live    │
                 ↓                     │
   Narration voices the drama          │
                 ↓                     │
   Contest settles, winners paid       │
                 ↓                     │
   HILDA makes a recap video ──────────┘
   (which recruits new players, who arrive
    to a world that's visibly alive)
```

No single feature does this. The **combination** is what turns retention from a leaky
bucket into a flywheel.

-----

## 8. BUILD ORDER (after foundation/security/activation)

Ordered by retention-impact per unit effort:

|#|Feature                       |Impact   |Effort |Depends on                         |
|-|------------------------------|---------|-------|-----------------------------------|
|1|Secure chat (global + faction)|Very High|3 days |Wallet auth (Security LUT)         |
|2|Announcements + notifications |High     |2 days |WS server (exists)                 |
|3|Activity feed + presence      |High     |1 day  |gameEvents (exists)                |
|4|Contests (extend seasons)     |Very High|3 days |Seasons (exists), treasury (exists)|
|5|Weather system                |High     |3 days |Globe overhaul (Globe LUT)         |
|6|World narration (clips)       |Medium   |2 days |HILDA voice (HILDA LUT)            |
|7|Player profiles + titles      |Medium   |2 days |Auth, gameEvents                   |
|8|Dynamic narration (live)      |Medium   |2 days |Claude + ElevenLabs                |
|9|Voice chat                    |High     |1+ week|Chat channel model                 |

**Start with chat.** It’s the keystone — it depends only on the wallet auth you’re already
building for security, and it’s the feature that most directly turns players into a
community. Everything social compounds off it.

-----

## 9. THINGS YOU MIGHT NOT HAVE CONSIDERED

A few more that fit the world:

- **Spectator mode** — let non-players watch live battles on the globe (the stream camera
  already exists in your constants — `STREAM_DWELL_MS`). Great for marketing and Twitch.
- **Replays** — you already store battle replays in Redis. Surface them: shareable battle
  replay links. Viral potential.
- **Alliances** — formal player-to-player pacts (non-aggression, shared vision). Adds
  diplomacy depth on top of factions.
- **In-game mail** — asynchronous messages tied to plots (“the previous owner left a
  note”). Atmospheric and useful.
- **Daily login rewards** — small $ASCEND or resource drip for consecutive logins. Classic
  retention mechanic, ties to the token economy.
- **Tutorial quests** — guided first-session objectives (“Claim your first parcel”, “Win
  your first battle”, “Build your first structure”). You have `useTutorial.ts` already —
  extend it into a quest chain.
- **Cross-faction events** — world bosses or environmental threats (a massive meteor
  event) that require factions to cooperate temporarily. Breaks up PvP with PvE.

-----

## 10. THE GUARDRAILS (unchanged)

Everything here follows the established discipline:

- ✅ Rides existing WS server — no new transport
- ✅ Deterministic where possible (weather, like positions) — minimal DB
- ✅ Auth-gated (chat needs the Security LUT auth) — secure by design
- ✅ Additive — no resets, no schema destruction
- ✅ Effects feed battle engine as inputs — `tuning.ts` untouched
- ✅ Workers separate — narration/recaps run on the worker host, not the game server
- ✅ Economic integrity — contest prizes flow through the treasury ledger + audit log

-----

## CLOSING

The foundation, security, and activation LUTs get you a **working, secure, full-featured
game.** This LUT gets you a **world** — the difference between software people use and a
place people belong.

Build it after the core is solid. Start with secure chat. Let the flywheel turn.

-----

*The Living World LUT · Ascendancy · frontierprotocol.app*
*A strategy engine becomes a world when its players can talk, compete, and watch the weather change.*