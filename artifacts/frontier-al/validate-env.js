// Pre-boot environment validation. Fatal for missing core secrets; warnings for
// recommended security settings so misconfigurations are visible in logs.

const required = [
  'DATABASE_URL',
  'ALGORAND_ADMIN_MNEMONIC',
  'ALGORAND_ADMIN_ADDRESS',
  'SESSION_SECRET',
  'PUBLIC_BASE_URL',
  'ALGORAND_NETWORK'
];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error('❌ Missing secrets:', missing.join(', '));
  process.exit(1);
}

const net = process.env.ALGORAND_NETWORK;
if (net !== 'mainnet' && net !== 'testnet') {
  console.error('❌ ALGORAND_NETWORK must be mainnet or testnet, got:', net);
  process.exit(1);
}

// ── Security posture warnings (non-fatal) ────────────────────────────────────
const warn = (m) => console.warn('⚠️ ', m);

// SESSION_SECRET signs wallet-auth session tokens — must be strong.
if ((process.env.SESSION_SECRET || '').length < 16) {
  warn('SESSION_SECRET is shorter than 16 chars — use a long random value (sessions reset on restart otherwise).');
}

// ADMIN_KEY gates /api/admin/* — without it those endpoints fail closed (503) in prod.
if (!process.env.ADMIN_KEY) {
  warn('ADMIN_KEY is not set — admin endpoints will be disabled (503) in production.');
}

// Wallet-signature auth should stay enforced.
if (process.env.WALLET_AUTH_REQUIRED === 'false') {
  warn('WALLET_AUTH_REQUIRED=false — wallet-signature auth is DISABLED. Only use this during a brief rollout window.');
}

// Sybil gate for the welcome bonus.
if (process.env.WELCOME_BONUS_SYBIL_CHECK === 'false') {
  warn('WELCOME_BONUS_SYBIL_CHECK=false — the welcome bonus is ungated and farmable by throwaway wallets.');
}

console.log('✅ All secrets validated. Network:', net);
