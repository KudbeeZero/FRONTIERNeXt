import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../store/gameStore";
import { useSettingsStore } from "../store/settingsStore";
import { audio } from "../lib/audioEngine";
import { buildJourneyCard, ENDING_HUE, type JourneyCard } from "../lib/journeyCard";

// ---------------------------------------------------------------------------
// ShareCard — the shareable end-of-run artifact. Renders the player's unique
// journey (ending, trust, defining choices, fingerprint) onto a 1080×1080 canvas
// styled like the game, then offers native Share (Web Share API with the image
// file) or Download. This is the "wow, look what I got — and it's on a blockchain"
// moment built to spread. The card DATA is pure + tested (lib/journeyCard.ts).
// ---------------------------------------------------------------------------

const SIZE = 1080;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  card: JourneyCard,
  stats: { runs: number; bestRepairMs: number | null },
) {
  const hue = card.ending ? ENDING_HUE[card.ending] : "#7fe7ff";

  // ── Background: deep space + nebula blobs in the run's hue ────────────────
  ctx.fillStyle = "#04060d";
  ctx.fillRect(0, 0, SIZE, SIZE);
  const blobs: [number, number, number, string][] = [
    [300, 360, 460, hue],
    [820, 760, 520, "#6a2270"],
    [760, 240, 380, "#1b3a86"],
    [240, 820, 360, "#3a2a8a"],
  ];
  for (const [x, y, r, color] of blobs) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color + "55");
    g.addColorStop(1, color + "00");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  // star speckle
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 140; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const y = (Math.sin(i * 78.233) * 12543.123) % 1;
    ctx.globalAlpha = 0.15 + ((i * 7) % 10) / 40;
    ctx.fillRect(Math.abs(x) * SIZE, Math.abs(y) * SIZE, 2, 2);
  }
  ctx.globalAlpha = 1;

  // frame
  ctx.strokeStyle = "rgba(127,231,255,0.28)";
  ctx.lineWidth = 2;
  roundRect(ctx, 36, 36, SIZE - 72, SIZE - 72, 28);
  ctx.stroke();

  const cx = SIZE / 2;

  // ── Header ────────────────────────────────────────────────────────────────
  ctx.textAlign = "center";
  ctx.fillStyle = "#9fb4c9";
  ctx.font = "600 28px 'JetBrains Mono', monospace";
  ctx.fillText("A E T H E R ' S   J O U R N E Y", cx, 132);

  // ── Ending title (the hero) ────────────────────────────────────────────────
  ctx.font = "800 124px 'Orbitron', 'Rajdhani', sans-serif";
  ctx.fillStyle = hue;
  ctx.shadowColor = hue;
  ctx.shadowBlur = 44;
  ctx.fillText(card.title, cx, 320);
  ctx.shadowBlur = 0;

  // ── Verdict (wrapped) ──────────────────────────────────────────────────────
  ctx.font = "400 33px 'Rajdhani', sans-serif";
  ctx.fillStyle = "#c9dcee";
  const vlines = wrap(ctx, card.verdict, SIZE - 220);
  vlines.slice(0, 4).forEach((l, i) => ctx.fillText(l, cx, 400 + i * 46));

  // ── Trust ring ─────────────────────────────────────────────────────────────
  const ringY = 660;
  const ringR = 96;
  ctx.lineWidth = 16;
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.arc(cx, ringY, ringR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = hue;
  ctx.shadowColor = hue;
  ctx.shadowBlur = 24;
  ctx.beginPath();
  ctx.arc(cx, ringY, ringR, -Math.PI / 2, -Math.PI / 2 + (card.trust / 100) * Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#e7f4ff";
  ctx.font = "800 62px 'Orbitron', 'Rajdhani', sans-serif";
  ctx.fillText(`${card.trust}`, cx, ringY + 12);
  ctx.fillStyle = "#9fb4c9";
  ctx.font = "600 20px 'JetBrains Mono', monospace";
  ctx.fillText("TRUST IN AETHER", cx, ringY + 50);

  // rating seal
  ctx.fillStyle = hue;
  ctx.font = "800 30px 'Orbitron', 'Rajdhani', sans-serif";
  ctx.fillText(`◈ RANK ${card.rating}`, cx, ringY - 130);

  // ── Defining choices ───────────────────────────────────────────────────────
  ctx.font = "500 30px 'Rajdhani', sans-serif";
  const startY = 832;
  if (card.highlights.length) {
    card.highlights.forEach((h, i) => {
      ctx.textAlign = "center";
      ctx.fillStyle = "#bcd3e8";
      ctx.fillText(`›  ${h}`, cx, startY + i * 46);
    });
  } else {
    ctx.fillStyle = "#5f7da0";
    ctx.fillText("A quiet, careful crossing.", cx, startY);
  }

  // ── Footer: on-chain hook + fingerprint ────────────────────────────────────
  ctx.textAlign = "center";
  ctx.fillStyle = "#7fe7ff";
  ctx.font = "600 26px 'JetBrains Mono', monospace";
  ctx.fillText(`⛓  MINTED ON ALGORAND TESTNET  ·  ${card.seed}`, cx, SIZE - 86);
  ctx.fillStyle = "#5f7da0";
  ctx.font = "500 22px 'JetBrains Mono', monospace";
  const best = stats.bestRepairMs != null ? `best repair ${(stats.bestRepairMs / 1000).toFixed(1)}s · ` : "";
  ctx.fillText(`${best}run #${stats.runs}  ·  play at frontier`, cx, SIZE - 52);
}

export function ShareCard() {
  const ending = useGameStore((s) => s.ending);
  const trust = useGameStore((s) => s.trust);
  const flags = useGameStore((s) => s.flags);
  const stats = useSettingsStore((s) => s.stats);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const card = buildJourneyCard({ ending, trust, flags });

  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      // Wait for the brand webfonts so the card is crisp, then draw.
      try {
        await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      } catch {
        /* fonts API absent — draw with fallbacks */
      }
      if (cancelled) return;
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) drawCard(ctx, card, stats);
    };
    void render();
    return () => {
      cancelled = true;
    };
    // Redraw when the run identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.seed, stats.runs, stats.bestRepairMs]);

  const toBlob = () =>
    new Promise<Blob | null>((resolve) =>
      canvasRef.current ? canvasRef.current.toBlob(resolve, "image/png") : resolve(null),
    );

  const fileName = `aether-journey-${card.seed}.png`;

  const onShare = async () => {
    setBusy(true);
    setNote(null);
    audio.confirm();
    const blob = await toBlob();
    if (!blob) {
      setBusy(false);
      return;
    }
    const file = new File([blob], fileName, { type: "image/png" });
    const data = {
      title: "Aether's Journey",
      // Viral hook: name the stakes (an AI companion + real blockchain) and dare them.
      text: `I reached the ${card.title} ending of Aether's Journey — ${card.trust} trust in my AI companion, and my run is minted on Algorand. Think you'd do better? ${card.seed}`,
      files: [file],
    };
    try {
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share(data);
        setNote("Shared.");
      } else {
        downloadBlob(blob);
        setNote("Saved the image — post it anywhere.");
      }
    } catch {
      // user cancelled the share sheet, or it failed — no-op
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async () => {
    audio.beep(620, 0.05, "sine", 0.08);
    const blob = await toBlob();
    if (blob) {
      downloadBlob(blob);
      setNote("Saved the image — post it anywhere.");
    }
  };

  const downloadBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-6 flex w-full max-w-sm flex-col items-center">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="w-full max-w-[300px] rounded-xl border border-aether-core/25 shadow-[0_0_30px_rgba(29,233,255,0.12)]"
      />
      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={onShare}
          disabled={busy}
          className="rounded border border-aether-core/60 bg-aether-core/15 px-6 py-2.5 font-display text-sm uppercase tracking-[0.25em] text-aether-core text-glow transition hover:bg-aether-core/25 disabled:opacity-50"
        >
          ⤴ Share your journey
        </button>
        <button
          onClick={onDownload}
          className="rounded border border-white/15 bg-white/5 px-4 py-2.5 font-display text-sm uppercase tracking-[0.25em] text-[#9fb4c9] transition hover:bg-white/10"
        >
          ↓ Save
        </button>
      </div>
      <div className="mt-2 min-h-[16px] font-mono text-[10px] uppercase tracking-widest text-[#5f7da0]">
        {note ?? "your run, as a card — share it"}
      </div>
    </div>
  );
}
