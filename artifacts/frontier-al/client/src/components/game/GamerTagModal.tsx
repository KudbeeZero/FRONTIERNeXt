import { apiRequest } from "@/lib/queryClient";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";

interface GamerTagModalProps {
  playerId: string;
  walletAddress: string;
  onComplete: (name: string) => void;
  onSkip: () => void;
}

/**
 * `apiRequest` rejects non-ok responses with a message shaped like
 * `"<status>: <response-body>"`. Pull the server's human-readable `error` field
 * out of that so the modal can show it instead of a raw "401: {...}" string.
 */
function extractErrorMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err);
  const match = raw.match(/^\d+:\s*(\{.*\})\s*$/s);
  if (match) {
    try {
      const body = JSON.parse(match[1]) as { error?: string };
      if (typeof body.error === "string" && body.error.length > 0) return body.error;
    } catch {
      /* not JSON — fall through to raw */
    }
  }
  return raw || fallback;
}

export function GamerTagModal({ playerId, walletAddress, onComplete, onSkip }: GamerTagModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Synchronous single-flight guard. React state updates are async, so two
  // clicks dispatched in the same tick would both read `submitting === false`;
  // the ref catches that race so we never issue a duplicate write.
  const inFlightRef = useRef(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError("Name must be 2-20 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_\-. ]+$/.test(trimmed)) {
      setError("Letters, numbers, spaces, dashes, dots, and underscores only");
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setSubmitting(true);
    setError("");

    try {
      // apiRequest attaches the wallet session (credentials + Authorization
      // Bearer token) — required because /api/actions/* is gated by the global
      // mutation ownership guard on the server. A bare fetch here previously
      // hit that guard with no session and failed with 401.
      const res = await apiRequest("POST", "/api/actions/set-name", {
        playerId,
        name: trimmed,
        address: walletAddress,
      });
      const data = await res.json();
      onComplete(data.name);
    } catch (err) {
      // Surface the server's readable message (e.g. "Authentication required",
      // "That tag is already taken", "Name must be 2-20 characters") instead of
      // a generic error — but never leak raw stack traces.
      setError(extractErrorMessage(err, "Failed to set name"));
      setSubmitting(false);
    } finally {
      inFlightRef.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md">
      <div className="max-w-sm w-full mx-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-lg mx-auto flex items-center justify-center bg-card border border-primary/50 text-primary">
            <User className="w-8 h-8" />
          </div>

          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wider">
              Choose Your Tag
            </h2>
            <p className="text-sm text-primary font-display uppercase tracking-wide mt-1">
              Commander Identity
            </p>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed px-2">
            Enter a name or gamertag so other players can recognize you on the battlefield.
          </p>

          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim().length >= 2) handleSubmit();
              }}
              placeholder="Enter gamertag..."
              maxLength={20}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground font-display text-center text-lg tracking-wide uppercase focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="text-xs text-muted-foreground mt-1 text-right pr-1">
              {name.length}/20
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          <Button
            onClick={handleSubmit}
            disabled={name.trim().length < 2 || submitting}
            className="w-full font-display uppercase tracking-wide"
          >
            {submitting ? "Saving..." : "Confirm Tag"}
          </Button>

          <button
            onClick={onSkip}
            className="block w-full text-xs text-muted-foreground font-display uppercase tracking-wide text-center"
          >
            Skip - Use Wallet Address
          </button>
        </div>
      </div>
    </div>
  );
}
