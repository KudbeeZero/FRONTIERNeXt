// safeUuid — a UUID generator that never throws.
//
// `crypto.randomUUID()` is only defined in secure contexts (HTTPS/localhost) and
// modern engines; over plain HTTP or in older WebViews it is `undefined`, so
// calling it directly throws and breaks the action that needed an idempotency
// nonce. This falls back to `crypto.getRandomValues` and finally `Math.random`,
// always returning a token that matches the server's nonce charset
// (`^[A-Za-z0-9_-]{8,128}$`).
export function safeUuid(): string {
  const c: Crypto | undefined = globalThis.crypto;

  if (typeof c?.randomUUID === "function") {
    try {
      return c.randomUUID();
    } catch {
      /* fall through to the byte-based fallback */
    }
  }

  const bytes = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  // 32 lowercase hex chars — well within [A-Za-z0-9_-]{8,128}.
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}
