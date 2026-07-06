/**
 * client/src/components/game/FactionSelectGate.tsx
 *
 * The fun, fund-free entry gate: come in (zero-click dev login), PICK YOUR
 * FACTION, align, and drop into the game. Optionally — purely if you want — leave
 * a wallet address and/or email to join the early-access waitlist "by playing":
 * no committed actions, but the more you come back the higher your engagement
 * tier, which converts to rewards in the real game later (that payout is a
 * separate, gated on-chain unit — this gate never moves funds).
 *
 * Mounted as a page-level overlay above <GameLayout>, so it never touches the
 * globe/combat canvas. Shows once (remembered in localStorage); pick a faction to
 * dismiss it.
 */
import { useState } from "react";
import { Mail, Wallet, ChevronsRight, ChevronsLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { PLAYER_FACTIONS, chosenFaction, chooseFaction, nextFactionSync } from "@/lib/factions";
import { FACTION_EMBLEMS } from "@/lib/factionEmblems";
import { DEV_MODE, startDevSession } from "@/lib/devSession";
import { getAuthToken, setAuthToken } from "@/lib/authToken";
import { goToGame } from "@/lib/gameUrl";
import { validateWaitlistSignup, type PlayerFactionId } from "@shared/waitlist";
import { missionBriefing } from "@shared/battleObjective";
import { Starfield } from "@/pages/landing-shared";

/** Small glowing tick mark in each corner of the HUD frame — pure decoration. */
function CornerTick({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const pos: React.CSSProperties = {
    position: "absolute",
    ...(corner.includes("t") ? { top: 14 } : { bottom: 14 }),
    ...(corner.includes("l") ? { left: 14 } : { right: 14 }),
    fontSize: 13, color: "rgba(120,170,255,0.45)", fontFamily: "var(--font-mono)",
    lineHeight: 1, userSelect: "none", pointerEvents: "none",
  };
  return <div style={pos}>+</div>;
}

export function FactionSelectGate() {
  const [visible, setVisible] = useState(() => chosenFaction() == null);
  const [selected, setSelected] = useState<PlayerFactionId | null>(null);
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!visible) return null;

  const enter = async () => {
    if (!selected || busy) return;
    setBusy(true);
    chooseFaction(selected);

    // No-wallet playtest entry: in dev/playtest builds (VITE_DEV_MODE), if there's
    // no session yet, sign in as the shared test player so picking a faction
    // actually drops you into the game — no wallet, no funds. Requires the server's
    // DEV_LOGIN_ENABLED; on a normal deploy quick-auth 403s and we just continue to
    // the usual wallet flow (no crash). On success we reload /game so the app picks
    // up the fresh session instead of falling through to the wallet gate.
    let establishedDevSession = false;
    if (DEV_MODE && !getAuthToken()) {
      try {
        const res = await apiRequest("POST", "/api/dev/quick-auth", {});
        const data = await res.json().catch(() => ({}));
        if (data?.token && data?.address) {
          setAuthToken(data.token);
          startDevSession(data.address);
          establishedDevSession = true;
        }
      } catch {
        /* dev login disabled on this server — fall through to the wallet flow */
      }
    }

    // Persist the alignment to the player's record (best-effort) so the faction is
    // attached to the wallet/DB, not just localStorage. Never blocks entry.
    try {
      const meRes = await apiRequest("GET", "/api/auth/me");
      const me = await meRes.json().catch(() => ({}));
      const sync = nextFactionSync(me?.player?.playerFactionId, selected);
      if (sync.shouldJoin && me?.player?.id) {
        await apiRequest("POST", `/api/factions/${encodeURIComponent(selected)}/join`, {
          playerId: me.player.id,
        });
      }
    } catch {
      /* non-blocking — enter anyway */
    }

    // Optional waitlist signup — only if they typed a contact. Best-effort: a
    // failed/disabled signup must never block entry.
    if (address.trim() || email.trim()) {
      const check = validateWaitlistSignup({ faction: selected, address, email });
      if (!check.ok) {
        setNote(check.error);
        setBusy(false);
        return; // let them fix the contact or clear it
      }
      try {
        const res = await apiRequest("POST", "/api/waitlist/join", {
          faction: selected,
          address: address.trim() || undefined,
          email: email.trim() || undefined,
        });
        const data = await res.json().catch(() => ({}));
        if (data?.tier) setNote(`On the list — rank ${data.tier}. Welcome, commander.`);
      } catch {
        /* non-blocking — enter anyway */
      }
    }

    // If we just signed in without a wallet, reload /game so the app re-reads the
    // session and drops straight into the game (otherwise it would still show the
    // wallet gate). Otherwise just dismiss the overlay.
    if (establishedDevSession) {
      goToGame();
      return;
    }
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        overflowY: "auto", color: "#e0eaff",
      }}
    >
      {/* Starfield + dark scrim, masked with a hole bottom-right so the REAL 3D globe
          already rendering behind this gate (in <GameLayout>, mounted as a sibling —
          see the file header) shows through instead of a fake CSS planet. This never
          touches the globe/canvas itself, only how much of it this overlay covers. */}
      <div
        style={{
          position: "fixed", inset: 0,
          WebkitMaskImage: "radial-gradient(circle 460px at calc(100% - 40px) calc(100% - 40px), transparent 0%, transparent 58%, black 82%)",
          maskImage: "radial-gradient(circle 460px at calc(100% - 40px) calc(100% - 40px), transparent 0%, transparent 58%, black 82%)",
        }}
      >
        <Starfield />
        <div style={{
          position: "fixed", inset: 0,
          background: "radial-gradient(ellipse at 35% 45%, rgba(0,4,16,0.45) 0%, rgba(0,2,10,0.85) 75%)",
          pointerEvents: "none",
        }} />
      </div>
      {/* Soft ring around the globe window so the cutout reads as deliberate framing,
          not a clipping artifact. */}
      <div style={{
        position: "fixed", right: -60, bottom: -60, width: 360, height: 360, borderRadius: "50%",
        border: "1px solid rgba(120,180,255,0.25)", boxShadow: "0 0 60px 10px rgba(60,120,255,0.12) inset",
        pointerEvents: "none",
      }} />

      {/* HUD chrome — corner ticks + status readouts, purely decorative. */}
      <CornerTick corner="tl" />
      <CornerTick corner="tr" />
      <CornerTick corner="bl" />
      <CornerTick corner="br" />
      <div style={{ position: "fixed", top: 18, left: 34, display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", color: "rgba(150,220,255,0.75)" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 6px #34d399", display: "inline-block" }} />
        SYSTEM ONLINE
      </div>
      <div style={{ position: "fixed", top: 18, right: 34, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "rgba(150,180,255,0.55)", lineHeight: 1.6 }}>
        <div>SECTOR: 7X-19</div>
        <div>FRONTIER · TESTNET</div>
      </div>
      <div style={{ position: "fixed", bottom: 16, right: 34, fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "rgba(120,170,255,0.4)" }}>
        LINK STABLE
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 26, padding: "48px 20px" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, letterSpacing: "0.35em", color: "rgba(120,170,255,0.65)", textTransform: "uppercase", marginBottom: 12, fontFamily: "var(--font-mono)" }}>
            Frontier — Choose your allegiance
          </div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(30px,5.5vw,46px)", fontWeight: 700, margin: 0, color: "#fff", letterSpacing: "0.01em" }}>
            Pick Your Faction
          </h1>
          <div style={{ width: 64, height: 2, background: "linear-gradient(90deg, transparent, #4fc3f7, transparent)", margin: "14px auto" }} />
          <p style={{ fontSize: 13, color: "rgba(170,200,255,0.7)", marginTop: 6 }}>
            Align with one of the four powers and drop into the live frontier.
          </p>
        </div>

        {/* Faction cards — sized to fill most of the page width, with a persistent
            (not just on-select) glow so they pop against the starfield. The pulse
            keyframe is defined once below and applied via className since inline
            styles can't express @keyframes. */}
        <style>{`
          @keyframes faction-card-pulse {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.12); }
          }
        `}</style>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22, justifyContent: "center", maxWidth: 1240 }}>
          {PLAYER_FACTIONS.map((f) => {
            const active = selected === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelected(f.id)}
                style={{
                  position: "relative", width: 260, textAlign: "left", cursor: "pointer",
                  background: active
                    ? `linear-gradient(160deg, ${f.color}30 0%, rgba(8,12,32,0.88) 70%)`
                    : `linear-gradient(160deg, ${f.color}18 0%, rgba(8,12,32,0.8) 70%)`,
                  border: `1.5px solid ${active ? f.color : `${f.color}70`}`,
                  borderRadius: 12, padding: "26px 22px 20px",
                  boxShadow: active
                    ? `0 0 50px ${f.color}70, 0 0 110px ${f.color}30, inset 0 0 28px ${f.color}22`
                    : `0 0 24px ${f.color}40, 0 0 60px ${f.color}18`,
                  color: "inherit", fontFamily: "inherit", transition: "all 0.15s ease",
                  animation: "faction-card-pulse 3.2s ease-in-out infinite",
                }}
              >
                <img
                  src={FACTION_EMBLEMS[f.id]}
                  alt={`${f.name} emblem`}
                  style={{ width: 56, height: 56, marginBottom: 14, filter: `drop-shadow(0 0 10px ${f.color})` }}
                />
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: f.color, letterSpacing: "0.03em", textShadow: `0 0 18px ${f.color}90` }}>{f.name}</div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(150,180,255,0.6)", margin: "4px 0 14px" }}>
                  {f.behavior}
                </div>
                <div style={{ width: "100%", height: 1, background: `linear-gradient(90deg, ${f.color}90, transparent)`, marginBottom: 12 }} />
                <div style={{ fontSize: 13, color: "rgba(200,220,255,0.85)", lineHeight: 1.55 }}>“{f.tagline}” {f.blurb}</div>
                {/* Bottom tick pattern + accent bar, matching the faction's color. */}
                <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 9, letterSpacing: "0.2em", color: `${f.color}88`, fontFamily: "var(--font-mono)" }}>×××</span>
                  <span style={{ width: 32, height: 3, borderRadius: 2, background: f.color, opacity: active ? 1 : 0.55, boxShadow: `0 0 8px ${f.color}` }} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Mission briefing — your rival + objective, the moment you pick a side */}
        {selected && (() => {
          const b = missionBriefing(selected);
          if (!b) return null;
          return (
            <div style={{
              maxWidth: 460, textAlign: "center", padding: "10px 16px",
              background: "rgba(255,90,90,0.08)", border: "1px solid rgba(255,120,120,0.35)",
              borderRadius: 10,
            }}>
              <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,150,150,0.8)", marginBottom: 4, fontFamily: "var(--font-mono)" }}>
                ⚔ Mission · {b.headline}
              </div>
              <div style={{ fontSize: 12, color: "rgba(220,225,255,0.85)" }}>{b.objective}</div>
            </div>
          );
        })()}

        {/* Optional waitlist */}
        <div style={{ width: "100%", maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "rgba(150,180,255,0.6)", marginBottom: 10 }}>
            ⓘ Optional — join early access by playing. The more you commit, the more you’re rewarded in the real game.
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
            <div style={{ ...inputWrapStyle }}>
              <Mail size={14} color="rgba(150,180,255,0.6)" />
              <input
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                style={inputStyle}
              />
            </div>
            <div style={{ ...inputWrapStyle }}>
              <Wallet size={14} color="rgba(150,180,255,0.6)" />
              <input
                value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Wallet address (optional)"
                style={inputStyle}
              />
            </div>
          </div>
          {note && <div style={{ fontSize: 11, color: "rgba(255,210,120,0.9)", marginTop: 8 }}>{note}</div>}
        </div>

        <button
          onClick={enter}
          disabled={!selected || busy}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
            background: selected ? "linear-gradient(90deg, rgba(30,60,160,0.4), rgba(60,110,255,0.32), rgba(30,60,160,0.4))" : "rgba(60,80,140,0.18)",
            border: `1px solid ${selected ? "rgba(120,170,255,0.75)" : "rgba(100,120,170,0.35)"}`,
            borderRadius: 8, padding: "15px 40px", color: selected ? "#dCEbff" : "rgba(160,180,220,0.5)",
            fontFamily: "var(--font-display)", fontSize: 14, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
            cursor: selected && !busy ? "pointer" : "not-allowed", transition: "all 0.15s ease",
            boxShadow: selected ? "0 0 24px rgba(80,130,255,0.35)" : "none",
          }}
        >
          <ChevronsRight size={16} style={{ opacity: 0.7 }} />
          {busy ? "Entering…" : selected ? "Enter the Frontier" : "Select Faction"}
          <ChevronsLeft size={16} style={{ opacity: 0.7 }} />
        </button>
      </div>
    </div>
  );
}

const inputWrapStyle: React.CSSProperties = {
  flex: "1 1 210px", minWidth: 170, display: "flex", alignItems: "center", gap: 8,
  background: "rgba(5,12,36,0.8)", border: "1px solid rgba(90,120,190,0.4)",
  borderRadius: 8, padding: "10px 12px",
};

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
  color: "#e0eaff", fontSize: 12, fontFamily: "inherit",
};
