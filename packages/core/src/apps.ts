import { runAppleScript } from "./applescript.js";

export async function listApps(): Promise<string[]> {
  const result = await runAppleScript(`
    tell application "System Events"
      get name of every process where background only is false
    end tell
  `);
  return result.split(", ").map(s => s.trim()).sort();
}

export async function getFrontmostApp(): Promise<string> {
  return runAppleScript(`
    tell application "System Events"
      get name of first process where it is frontmost
    end tell
  `);
}

export async function activateApp(appName: string): Promise<void> {
  await runAppleScript(`tell application "${appName}" to activate`);
}
