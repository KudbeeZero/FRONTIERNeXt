# HILDA — Professional Video Production Pipeline

### A-Grade · Full Voiceover · YouTube-Ready · Fully Automated

> Version 2.0 — Built on real 2026 AI video infrastructure

-----

## WHY THE ORIGINAL PLAN WAS B-GRADE

Text scripts ≠ videos. The original HILDA only wrote scripts.
A-grade means: **finished MP4 files, uploaded to YouTube, with voiceover,
avatar or gameplay footage, captions, chapters, thumbnail — zero human
editing required.**

That is fully achievable in 2026. Here’s exactly how.

-----

## THE PROFESSIONAL STACK

```
┌─────────────────────────────────────────────────────────────────┐
│                    HILDA A-GRADE PIPELINE                        │
│                                                                   │
│  LAYER 1 — BRAIN (Claude API)                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Script • SEO Title • Description • Tags • Chapters      │    │
│  │ B-roll timing cues • CTA • Thumbnail concept            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                       │
│  LAYER 2 — VOICE (ElevenLabs API)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Script → Studio-quality MP3 voiceover                   │    │
│  │ Model: eleven_multilingual_v2 or ElevenLabs V3          │    │
│  │ Voice: Custom cloned "Ascendancy Announcer" voice        │    │
│  │ Output: timestamped audio file with alignment data       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                       │
│  LAYER 3 — VIDEO (HeyGen API)                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Audio + Avatar → Lip-synced presenter video              │    │
│  │ OR: Gameplay screen recording as B-roll background       │    │
│  │ Model: Avatar IV — photorealistic facial animation       │    │
│  │ Output: 1080p MP4, ~30-60s render per minute of content  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                       │
│  LAYER 4 — VISUALS (Kling 3.0 / Veo 3.1 API)                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Generate cinematic B-roll from script cue prompts        │    │
│  │ Globe fly-overs • battle sequences • biome establishing  │    │
│  │ shots • faction reveal sequences                         │    │
│  │ Output: 1080p/4K clips, 8–15 seconds each               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                       │
│  LAYER 5 — ASSEMBLY (Shotstack API)                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stitch: avatar presenter + B-roll + gameplay footage     │    │
│  │ Add: captions (auto-burned-in) + chapter markers         │    │
│  │ Add: intro/outro bumpers + lower thirds + music bed      │    │
│  │ Add: Ascendancy branding overlay                         │    │
│  │ Output: final 1080p MP4 broadcast-ready                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           ↓                                       │
│  LAYER 6 — PUBLISH (YouTube Data API v3)                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Upload MP4 → set title, description, tags, category      │    │
│  │ Set thumbnail (AI-generated or template)                  │    │
│  │ Schedule publish time (optimal: Tue/Thu 2–4pm ET)        │    │
│  │ Add to playlist • enable captions • set chapters         │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

-----

## RENDER NETWORK — IS IT THE RIGHT TOOL?

**Short answer: No — not for this specific pipeline.**

The Render Network is a decentralized GPU marketplace built for:

- 3D rendering (Blender, Cinema 4D, Octane)
- Machine learning training jobs
- High-compute batch workloads

**For HILDA the bottleneck is API latency, not raw GPU compute.**
ElevenLabs, HeyGen, Kling, and Shotstack all run on their own
managed GPU infrastructure. You pay per request, not per GPU-hour.
Render Network would only help if you were running your OWN video
model weights — which is overkill here and would cost months of
engineering time.

**What you actually want instead:**

|Need               |Solution                                     |
|-------------------|---------------------------------------------|
|Voiceover quality  |ElevenLabs API (best in class, period)       |
|Avatar presenter   |HeyGen API (Avatar IV — photorealistic)      |
|Cinematic B-roll   |Kling 3.0 Omni API or Veo 3.1 via Vertex AI  |
|Video assembly     |Shotstack API (programmatic video editor)    |
|Thumbnail rendering|Bannerbear API (template-based, programmatic)|
|Distribution       |YouTube Data API v3                          |

All of these have REST APIs. HILDA calls them sequentially.
Total cost per video: ~$3–8 depending on length.

-----

## API COST BREAKDOWN (per 10-minute video)

|Service         |Usage                      |Estimated Cost  |
|----------------|---------------------------|----------------|
|Claude API      |Script + SEO (~3000 tokens)|~$0.05          |
|ElevenLabs      |~1500 words voiceover      |~$0.30          |
|HeyGen Avatar IV|10 min avatar video        |~$2.50          |
|Kling 3.0       |5× 10s B-roll clips        |~$1.50          |
|Shotstack       |Assembly + render          |~$0.80          |
|Bannerbear      |1 thumbnail                |~$0.10          |
|**Total**       |                           |**~$5.25/video**|

At 2 videos/week = ~$45/month.
Channel revenue from 10K views/video pays for itself in week 3.

-----

## HILDA v2 ARCHITECTURE — FULL CODE SPEC

### File Structure

```
artifacts/frontier-al/workers/hilda/
  index.ts           — HildaWorker orchestrator class
  layers/
    brain.ts         — Claude API: script + SEO generation
    voice.ts         — ElevenLabs API: text to audio
    avatar.ts        — HeyGen API: audio to avatar video
    visuals.ts       — Kling/Veo API: B-roll generation
    assembly.ts      — Shotstack API: final edit + captions
    publisher.ts     — YouTube Data API v3: upload + metadata
    thumbnail.ts     — Bannerbear API: thumbnail generation
  prompts/
    system.ts        — HILDA system prompt with game context
    topics.ts        — per-topic script prompts (10 topics)
    seo.ts           — SEO generation prompts
  types.ts           — all interfaces and enums
  config.ts          — API keys + model selections
  queue.ts           — job queue with retry logic
```

-----

### types.ts (complete)

```typescript
export enum HildaTopic {
  LAND_PURCHASE    = 'land_purchase',
  BATTLE_SYSTEM    = 'battle_system',
  BIOME_GUIDE      = 'biome_guide',
  COMMANDER_NFT    = 'commander_nft',
  FACTIONS         = 'factions',
  TOKEN_ECONOMY    = 'token_economy',
  ORBITAL_EVENTS   = 'orbital_events',
  TRADE_STATION    = 'trade_station',
  SUB_PARCELS      = 'sub_parcels',
  SEASON_MECHANICS = 'season_mechanics',
}

export interface GameContext {
  totalParcels:    number;
  ownedParcels:    number;
  activePlayers:   number;
  factions:        string[];
  network:         string;
  topLeaderboard:  Array<{ name: string; parcels: number }>;
}

export interface ScriptPackage {
  topic:           HildaTopic;
  title:           string;           // final YouTube title
  hook:            string;           // 0-15s hook line
  script:          string;           // full narration text
  brollCues:       BrollCue[];       // timed visual prompts
  chapters:        Chapter[];        // YouTube chapter markers
  cta:             string;           // end card copy
  seo:             SeoPackage;
}

export interface BrollCue {
  timestampSeconds: number;
  prompt:           string;          // Kling/Veo generation prompt
  durationSeconds:  number;
  type:             'gameplay' | 'cinematic' | 'ui_demo';
}

export interface Chapter {
  timestampSeconds: number;
  title:            string;
}

export interface SeoPackage {
  title:            string;          // under 60 chars
  description:      string;          // 150-word SEO block
  tags:             string[];        // 30 tags
  thumbnailConcept: string;          // visual description for Bannerbear
  publishTime:      string;          // ISO8601 — optimal schedule
  playlist:         string;          // YouTube playlist name
}

export interface AudioAsset {
  url:              string;
  durationSeconds:  number;
  alignmentData?:   unknown;
}

export interface VideoAsset {
  url:              string;
  durationSeconds:  number;
  type:             'avatar' | 'broll' | 'gameplay';
}

export interface AssemblyJob {
  avatarVideo:      VideoAsset;
  brollClips:       VideoAsset[];
  voiceAudio:       AudioAsset;
  captions:         boolean;
  intro:            string;          // URL to branded intro clip
  outro:            string;          // URL to branded outro clip
  musicBed:         string;          // URL to background music
  brandingOverlay:  string;          // URL to watermark/logo
}

export interface FinishedVideo {
  topic:            HildaTopic;
  mp4Url:           string;
  thumbnailUrl:     string;
  durationSeconds:  number;
  seo:              SeoPackage;
  youtubeVideoId?:  string;
  publishedAt?:     string;
}

export interface HildaJobStatus {
  jobId:            string;
  topic:            HildaTopic;
  stage:            HildaStage;
  progress:         number;          // 0-100
  startedAt:        string;
  completedAt?:     string;
  output?:          FinishedVideo;
  error?:           string;
}

export type HildaStage =
  | 'queued'
  | 'scripting'
  | 'voiceover'
  | 'avatar_render'
  | 'broll_generation'
  | 'assembly'
  | 'thumbnail'
  | 'uploading'
  | 'scheduled'
  | 'published'
  | 'failed';
```

-----

### config.ts

```typescript
export const HILDA_CONFIG = {
  elevenlabs: {
    apiKey:    process.env.ELEVENLABS_API_KEY!,
    voiceId:   process.env.ELEVENLABS_VOICE_ID!,   // custom Ascendancy voice
    model:     'eleven_multilingual_v2',
    stability: 0.5,
    similarity: 0.75,
    style:     0.4,
  },
  heygen: {
    apiKey:    process.env.HEYGEN_API_KEY!,
    avatarId:  process.env.HEYGEN_AVATAR_ID!,       // Ascendancy presenter avatar
    width:     1920,
    height:    1080,
  },
  kling: {
    apiKey:    process.env.KLING_API_KEY!,
    model:     'kling-v3-omni',
    duration:  10,
    aspectRatio: '16:9',
    quality:   'high',
  },
  shotstack: {
    apiKey:    process.env.SHOTSTACK_API_KEY!,
    env:       'production',
    resolution: 'hd',
    fps:       30,
  },
  bannerbear: {
    apiKey:    process.env.BANNERBEAR_API_KEY!,
    templateId: process.env.BANNERBEAR_TEMPLATE_ID!,
  },
  youtube: {
    clientId:     process.env.YOUTUBE_CLIENT_ID!,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET!,
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN!,
    channelId:    process.env.YOUTUBE_CHANNEL_ID!,
    categoryId:   '20',   // Gaming
    playlistIds: {
      tutorials:  process.env.YOUTUBE_PLAYLIST_TUTORIALS!,
      strategy:   process.env.YOUTUBE_PLAYLIST_STRATEGY!,
      lore:       process.env.YOUTUBE_PLAYLIST_LORE!,
    },
  },
  publish: {
    // Optimal YouTube upload windows (ET)
    slots: [
      { day: 2, hour: 14 },  // Tuesday 2pm
      { day: 4, hour: 14 },  // Thursday 2pm
    ],
  },
} as const;
```

-----

### index.ts — HildaWorker Orchestrator

```typescript
import { HildaTopic, HildaJobStatus, FinishedVideo } from './types';
import { BrainLayer }     from './layers/brain';
import { VoiceLayer }     from './layers/voice';
import { AvatarLayer }    from './layers/avatar';
import { VisualsLayer }   from './layers/visuals';
import { AssemblyLayer }  from './layers/assembly';
import { ThumbnailLayer } from './layers/thumbnail';
import { PublisherLayer } from './layers/publisher';
import { fetchGameContext } from './layers/brain';
import { randomUUID }     from 'crypto';

export class HildaWorker {
  private brain     = new BrainLayer();
  private voice     = new VoiceLayer();
  private avatar    = new AvatarLayer();
  private visuals   = new VisualsLayer();
  private assembly  = new AssemblyLayer();
  private thumbnail = new ThumbnailLayer();
  private publisher = new PublisherLayer();

  async run(
    topic: HildaTopic,
    onProgress?: (status: HildaJobStatus) => void
  ): Promise<FinishedVideo> {
    const jobId = randomUUID();
    const emit = (stage: HildaJobStatus['stage'], progress: number) => {
      onProgress?.({ jobId, topic, stage, progress,
        startedAt: new Date().toISOString() });
    };

    // 1. Fetch live game state for script context
    emit('scripting', 5);
    const gameContext = await fetchGameContext();

    // 2. Generate script + SEO package
    emit('scripting', 15);
    const scriptPackage = await this.brain.generateScript(topic, gameContext);

    // 3. Generate voiceover audio
    emit('voiceover', 25);
    const audioAsset = await this.voice.generate(scriptPackage.script);

    // 4. Render avatar presenter video with audio
    emit('avatar_render', 35);
    const avatarVideo = await this.avatar.render(audioAsset);

    // 5. Generate B-roll clips from script cues (parallel)
    emit('broll_generation', 50);
    const brollClips = await Promise.all(
      scriptPackage.brollCues.map(cue => this.visuals.generate(cue))
    );

    // 6. Assemble final video
    emit('assembly', 70);
    const assembledVideo = await this.assembly.render({
      avatarVideo,
      brollClips,
      voiceAudio: audioAsset,
      captions:   true,
      intro:      process.env.HILDA_INTRO_URL!,
      outro:      process.env.HILDA_OUTRO_URL!,
      musicBed:   process.env.HILDA_MUSIC_URL!,
      brandingOverlay: process.env.HILDA_WATERMARK_URL!,
    });

    // 7. Generate thumbnail
    emit('thumbnail', 85);
    const thumbnailUrl = await this.thumbnail.generate(scriptPackage);

    // 8. Upload to YouTube (scheduled)
    emit('uploading', 90);
    const youtubeVideoId = await this.publisher.upload({
      videoPath:    assembledVideo.url,
      thumbnailUrl,
      seo:          scriptPackage.seo,
      chapters:     scriptPackage.chapters,
    });

    emit('published', 100);

    return {
      topic,
      mp4Url:       assembledVideo.url,
      thumbnailUrl,
      durationSeconds: assembledVideo.durationSeconds,
      seo:          scriptPackage.seo,
      youtubeVideoId,
      publishedAt:  new Date().toISOString(),
    };
  }
}
```

-----

## CUSTOM ASCENDANCY VOICE — HOW TO CREATE IT

This is what separates A-grade from B-grade.
Don’t use a generic ElevenLabs stock voice.

**Steps to create the “Ascendancy Commander” voice:**

1. Record 15–30 minutes of clean voice audio (you or a VO artist)
- Quiet room, condenser mic or even iPhone in a closet
- Read game descriptions, battle narrations, faction lore
- Vary pacing: some urgent, some slow and deliberate
1. Upload to ElevenLabs → Voice Lab → Instant Voice Clone
- Name it “Ascendancy Commander”
- Save the `voice_id`
- Set in env: `ELEVENLABS_VOICE_ID=your_cloned_voice_id`
1. Fine-tune settings in `config.ts`:
- `stability: 0.5` — balanced consistency
- `style: 0.4` — enough expressiveness for game content

**Alternative:** Use ElevenLabs’ “Professional Voice Clone”
service ($1/hr) for studio-quality cloning from any audio source.

-----

## HEYGEN AVATAR — CREATING THE ASCENDANCY PRESENTER

Option A — **Photorealistic Avatar (recommended)**

1. Take 1 clean photo (or use AI-generated character image)
1. Upload to HeyGen → Avatar IV → Photo to Video
1. Save the `avatar_id`
1. Result: fully animated, lip-synced presenter

Option B — **Screen capture overlay**

- Record gameplay on frontierprotocol.app
- Use as full-screen B-roll with voiceover overlay
- No avatar needed — works as “faceless” gaming channel

Option C — **Hybrid** (best retention)

- Avatar presenter in corner (picture-in-picture)
- Full-screen gameplay as background
- Standard format for top gaming tutorial channels

-----

## NEW ENV VARS FOR RAILWAY + HILDA

Add these to Railway alongside your existing vars:

```env
# ── HILDA VIDEO PIPELINE ─────────────────────────────────────────
ELEVENLABS_API_KEY=your_key
ELEVENLABS_VOICE_ID=your_cloned_voice_id

HEYGEN_API_KEY=your_key
HEYGEN_AVATAR_ID=your_avatar_id

KLING_API_KEY=your_key

SHOTSTACK_API_KEY=your_key

BANNERBEAR_API_KEY=your_key
BANNERBEAR_TEMPLATE_ID=your_thumbnail_template_id

YOUTUBE_CLIENT_ID=your_oauth_client_id
YOUTUBE_CLIENT_SECRET=your_oauth_client_secret
YOUTUBE_REFRESH_TOKEN=your_refresh_token
YOUTUBE_CHANNEL_ID=your_channel_id
YOUTUBE_PLAYLIST_TUTORIALS=your_playlist_id
YOUTUBE_PLAYLIST_STRATEGY=your_playlist_id
YOUTUBE_PLAYLIST_LORE=your_playlist_id

# Branded assets (host on Cloudflare R2 or S3)
HILDA_INTRO_URL=https://assets.frontierprotocol.app/intro.mp4
HILDA_OUTRO_URL=https://assets.frontierprotocol.app/outro.mp4
HILDA_MUSIC_URL=https://assets.frontierprotocol.app/ambient.mp3
HILDA_WATERMARK_URL=https://assets.frontierprotocol.app/watermark.png
```

-----

## JARVIS INTEGRATION — HILDA AS WORKER

In the Jarvis dashboard, HILDA appears as a worker card:

```
┌─────────────────────────────────────────────┐
│  🎬 HILDA                          [ACTIVE] │
│  AI Content & Video Production Worker       │
│                                             │
│  Last video: "Battle System Guide"          │
│  Published: 2 hours ago · 847 views         │
│                                             │
│  Queue: 2 missions pending                  │
│  Avg render time: 8 minutes                 │
│  Cost this month: $38.50                    │
│                                             │
│  [+ NEW MISSION]  [VIEW OUTPUTS]            │
└─────────────────────────────────────────────┘
```

**Mission Creator for HILDA:**

```
Topic:    [Battle System ▼]
Length:   [10 min ▼]
Style:    [Tutorial / Strategy / Lore ▼]
Voice:    [Ascendancy Commander ▼]
Avatar:   [Presenter / Faceless / Hybrid ▼]
Schedule: [Now / Next slot (Thu 2pm) / Custom]

[DEPLOY MISSION →]
```

-----

## CONTENT CALENDAR — FIRST 30 DAYS

|Week|Video                                          |Type    |Est. Views|
|----|-----------------------------------------------|--------|----------|
|1   |“How to Buy Your First Land Plot on Algorand”  |Tutorial|2K–8K     |
|1   |“Ascendancy Battle System — Complete Guide”    |Tutorial|3K–12K    |
|2   |“Which Biome Should You Buy? (Data-Driven)”    |Strategy|1K–5K     |
|2   |“Commander NFTs Explained — Are They Worth It?”|Tutorial|2K–8K     |
|3   |“AI Factions — NEXUS-7 vs VANGUARD vs KRONOS”  |Strategy|2K–10K    |
|3   |“$ASCEND Token Economy — How to Earn Maximum”  |Tutorial|3K–15K    |
|4   |“Orbital Satellite Strategy — Advanced Guide”  |Strategy|1K–4K     |
|4   |“Trade Station Order Book — Arbitrage Guide”   |Tutorial|1K–5K     |

Estimated month 1 total: **15K–67K views**
Conservative monetization threshold (1000 subs / 4000 hours):
achievable by week 8 with consistent output.

-----

## RENDER PIPELINE TIMING

```
Script generation:     ~30 seconds  (Claude API)
Voiceover:             ~45 seconds  (ElevenLabs)
Avatar render:         ~8 minutes   (HeyGen — 10 min video)
B-roll generation:     ~4 minutes   (Kling × 5 clips, parallel)
Assembly:              ~3 minutes   (Shotstack)
Thumbnail:             ~15 seconds  (Bannerbear)
YouTube upload:        ~2 minutes   (depends on file size)
─────────────────────────────────────────────
Total end-to-end:      ~18 minutes per video
Human review:          Optional — Jarvis review queue
```

**HILDA can produce 2 videos/day if scheduled.**
That’s 60 videos/month at ~$315/month total API cost.
At 10K avg views and $2 RPM: **$1,200/month YouTube revenue.**

-----

*HILDA v2 — Built for Ascendancy · frontierprotocol.app*
*From script to published video in 18 minutes.*