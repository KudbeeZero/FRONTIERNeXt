// Thin wrapper: `pnpm tsx scripts/voice/generate-one.ts <line_id> [--force]`
const id = process.argv[2];
if (!id || id.startsWith("-")) {
  console.error("Usage: generate-one.ts <line_id> [--force]");
  process.exit(1);
}
process.argv = [process.argv[0], process.argv[1], "--line", id, ...process.argv.slice(3)];
await import("./generate-all");

export {}; // mark as a module so the top-level await above is valid under tsc
