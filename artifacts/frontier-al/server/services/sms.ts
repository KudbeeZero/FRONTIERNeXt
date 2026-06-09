// ── SMS delivery ─────────────────────────────────────────────────────────────
//
// Single send point for outbound SMS (used by admin 2FA). Provider-agnostic via
// the Twilio REST API over fetch — NO SDK dependency required.
//
// ┌─ PLUG IN YOUR SMS PROVIDER HERE ───────────────────────────────────────────┐
// │ Set these env vars (get them from your Twilio console — you create this     │
// │ account yourself):                                                          │
// │   TWILIO_ACCOUNT_SID   — Account SID  (starts "AC...")                       │
// │   TWILIO_AUTH_TOKEN    — Auth Token   (keep secret; host secret store only)  │
// │   TWILIO_FROM_NUMBER   — a Twilio phone number you own, E.164 (e.g. +1555…)  │
// │                                                                             │
// │ With all three set → real SMS is sent.                                      │
// │ Without them → DEV: the code is logged to the server console (so you can     │
// │                     test the whole flow with no provider);                  │
// │                PROD: delivery fails loudly (no silent "sent").              │
// │ To swap providers (Vonage/MessageBird/AWS SNS), replace only the `twilio`   │
// │ branch below — the call sites and return shape stay the same.               │
// └─────────────────────────────────────────────────────────────────────────────┘

const isProd = (): boolean => process.env.NODE_ENV === "production";

export interface SmsResult {
  /** twilio = really sent · console = dev-logged · failed = not delivered */
  delivery: "twilio" | "console" | "failed";
  error?: string;
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (sid && token && from) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const form = new URLSearchParams({ To: to, From: from, Body: body });
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!resp.ok) {
        const detail = await resp.text().catch(() => "");
        console.error("[sms] Twilio send failed", resp.status, detail.slice(0, 300));
        return { delivery: "failed", error: `Twilio responded ${resp.status}` };
      }
      return { delivery: "twilio" };
    } catch (e) {
      console.error("[sms] Twilio request threw:", e);
      return { delivery: "failed", error: "SMS provider request failed" };
    }
  }

  // No provider configured.
  if (isProd()) {
    console.error("[sms] No SMS provider configured (TWILIO_* env vars missing) — cannot deliver in production.");
    return { delivery: "failed", error: "SMS provider not configured" };
  }
  console.log(`[sms:dev] (no provider configured) → ${to}: ${body}`);
  return { delivery: "console" };
}

/** Mask a phone for display: keep country prefix + last 2 digits. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.length <= 4) return "•••";
  return `${digits.slice(0, 2)}•••••${digits.slice(-2)}`;
}
