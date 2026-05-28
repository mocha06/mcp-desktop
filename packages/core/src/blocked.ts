export function parseBlockedApps(input: string | undefined): string[] {
  return (input ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAppBlocked(appName: string, blocked: string[]): boolean {
  const lower = appName.toLowerCase();
  return blocked.some(b => lower.includes(b));
}
