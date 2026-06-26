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
import { apiRequest } from "@/lib/queryClient";
import { PLAYER_FACTIONS, chosenFaction, chooseFaction, nextFactionSync } from "@/lib/factions";
import { validateWaitlistSignup, type PlayerFactionId } from "@shared/waitlist";
import { missionBriefing } from "@shared/battleObjective";

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
    setVisible(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "linear-gradient(135deg, rgba(0,0,28,0.98) 0%, rgba(10,5,40,0.97) 100%)",
        backdropFilter: "blur(18px)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 26, padding: "32px 20px", overflowY: "auto",
        fontFamily: "'Courier New', 'SF Mono', monospace", color: "#e0eaff",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, letterSpacing: "0.35em", color: "rgba(120,170,255,0.6)", textTransform: "uppercase", marginBottom: 10 }}>
          ⬡ Frontier — Choose your allegiance
        </div>
        <h1 style={{ fontSize: "clamp(26px,5vw,40px)", fontWeight: 800, margin: 0, color: "#fff" }}>
          Pick your faction
        </h1>
        <p style={{ fontSize: 13, color: "rgba(170,200,255,0.7)", marginTop: 8 }}>
          Align with one of the four powers and drop into the live frontier.
        </p>
      </div>

      {/* Faction cards */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, justifyContent: "center", maxWidth: 880 }}>
        {PLAYER_FACTIONS.map((f) => {
          const active = selected === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setSelected(f.id)}
              style={{
                width: 200, textAlign: "left", cursor: "pointer",
                background: active ? `${f.color}22` : "rgba(8,16,44,0.7)",
                border: `1px solid ${active ? f.color : "rgba(90,120,190,0.35)"}`,
                borderRadius: 12, padding: "16px 16px",
                boxShadow: active ? `0 0 26px ${f.color}55` : "none",
                color: "inherit", fontFamily: "inherit", transition: "all 0.15s ease",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 800, color: f.color, letterSpacing: "0.05em" }}>{f.name}</div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(150,180,255,0.6)", margin: "4px 0 8px" }}>
                {f.behavior}
              </div>
              <div style={{ fontSize: 12, fontStyle: "italic", color: "rgba(200,220,255,0.85)", marginBottom: 6 }}>“{f.tagline}”</div>
              <div style={{ fontSize: 11, color: "rgba(160,190,235,0.7)", lineHeight: 1.5 }}>{f.blurb}</div>
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
            <div style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,150,150,0.8)", marginBottom: 4 }}>
              ⚔ Mission · {b.headline}
            </div>
            <div style={{ fontSize: 12, color: "rgba(220,225,255,0.85)" }}>{b.objective}</div>
          </div>
        );
      })()}

      {/* Optional waitlist */}
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontSize: 11, color: "rgba(150,180,255,0.6)", marginBottom: 8 }}>
          Optional — join early access by playing. The more you commit, the more you’re rewarded in the real game.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          <input
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="email (optional)"
            style={inputStyle}
          />
          <input
            value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="wallet address (optional)"
            style={inputStyle}
          />
        </div>
        {note && <div style={{ fontSize: 11, color: "rgba(255,210,120,0.9)", marginTop: 8 }}>{note}</div>}
      </div>

      <button
        onClick={enter}
        disabled={!selected || busy}
        style={{
          background: selected ? "rgba(60,100,255,0.32)" : "rgba(60,80,140,0.18)",
          border: `1px solid ${selected ? "rgba(120,170,255,0.7)" : "rgba(100,120,170,0.35)"}`,
          borderRadius: 9, padding: "14px 36px", color: selected ? "#dCEbff" : "rgba(160,180,220,0.5)",
          fontSize: 13, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 800,
          cursor: selected && !busy ? "pointer" : "not-allowed", fontFamily: "inherit",
        }}
      >
        {busy ? "Entering…" : selected ? "Align & Enter ▶" : "Select a faction"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: "1 1 200px", minWidth: 160, background: "rgba(5,12,36,0.8)",
  border: "1px solid rgba(90,120,190,0.4)", borderRadius: 8, padding: "10px 12px",
  color: "#e0eaff", fontSize: 12, fontFamily: "inherit",
};
