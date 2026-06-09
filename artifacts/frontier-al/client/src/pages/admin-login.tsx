/**
 * Admin login — username + password, then SMS 2FA (6-digit code).
 * On success the server issues an admin session (httpOnly cookie + bearer token);
 * we store the token and signal the parent to load the dashboard.
 */
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { setAdminToken } from "@/lib/adminSession";

export default function AdminLogin({ onAuthed }: { onAuthed: () => void }) {
  const [step, setStep] = useState<"password" | "otp">("password");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [devCode, setDevCode] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error ?? `Login failed (${r.status})`);
        return;
      }
      setPendingToken(data.pendingToken ?? "");
      setSentTo(data?.twoFactor?.sentTo ?? "");
      setDevCode(data?.devCode);
      setCode("");
      setStep("otp");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/2fa", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingToken, code }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data?.error ?? `Verification failed (${r.status})`);
        return;
      }
      if (data.token) setAdminToken(data.token);
      onAuthed();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="p-6 w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <h1 className="font-display text-lg uppercase tracking-widest text-primary">Admin Access</h1>
          <p className="text-xs text-muted-foreground">
            {step === "password" ? "Sign in with your admin credentials." : `Enter the 6-digit code sent to ${sentTo || "your phone"}.`}
          </p>
        </div>

        {step === "password" ? (
          <form onSubmit={submitPassword} className="space-y-3">
            <Input
              autoFocus
              placeholder="Username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              data-testid="input-admin-username"
            />
            <Input
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              data-testid="input-admin-password"
            />
            <Button
              type="submit"
              className="w-full font-display uppercase"
              disabled={busy || !username || !password}
            >
              {busy ? "Checking…" : "Continue"}
            </Button>
          </form>
        ) : (
          <form onSubmit={submitCode} className="space-y-4">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {devCode && (
              <p className="text-[10px] text-center font-mono text-muted-foreground">
                dev: no SMS provider configured — code is <span className="text-primary">{devCode}</span>
              </p>
            )}
            <Button type="submit" className="w-full font-display uppercase" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify & Enter"}
            </Button>
            <button
              type="button"
              className="w-full text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              onClick={() => { setStep("password"); setError(null); setCode(""); }}
            >
              ← Back
            </button>
          </form>
        )}

        {error && <p className="text-xs text-destructive" data-testid="text-admin-error">{error}</p>}
      </Card>
    </div>
  );
}
