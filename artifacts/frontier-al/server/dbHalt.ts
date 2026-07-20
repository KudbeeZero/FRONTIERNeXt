export function isDbHalted(): boolean {
  return process.env.HALT_DB === "true";
}
