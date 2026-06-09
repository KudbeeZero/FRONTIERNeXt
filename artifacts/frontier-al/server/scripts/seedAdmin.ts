// Seed (or update) an admin user for the dashboard login.
//
// Usage:
//   tsx server/scripts/seedAdmin.ts <username> <password> <phoneE164>
// Example:
//   tsx server/scripts/seedAdmin.ts ops 'S0me-Str0ng-Pass!' +15551234567
//
// Requires DATABASE_URL (loaded from .env). Run after `pnpm db:push` so the
// admin_users table exists. The password is scrypt-hashed; the raw value is
// never stored. Re-running with an existing username updates the password/phone.

import "dotenv/config";
import { upsertAdminUser } from "../adminAuth";

function isE164(p: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(p);
}

async function main(): Promise<void> {
  const [username, password, phone] = process.argv.slice(2);
  if (!username || !password || !phone) {
    console.error("Usage: tsx server/scripts/seedAdmin.ts <username> <password> <phoneE164>");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Refusing: password must be at least 12 characters.");
    process.exit(1);
  }
  if (!isE164(phone)) {
    console.error(`Refusing: phone must be E.164 (e.g. +15551234567), got "${phone}".`);
    process.exit(1);
  }
  const result = await upsertAdminUser(username, password, phone);
  console.log(`✅ Admin user "${username}" ${result} (2FA → ${phone}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error("seedAdmin failed:", err);
  process.exit(1);
});
