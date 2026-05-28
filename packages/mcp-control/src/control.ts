import { runAppleScript } from "@mcp-desktop/core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export async function click(x: number, y: number): Promise<void> {
  await runAppleScript(`
    tell application "System Events"
      click at {${x}, ${y}}
    end tell
  `);
}

export async function doubleClick(x: number, y: number): Promise<void> {
  await runAppleScript(`
    tell application "System Events"
      double click at {${x}, ${y}}
    end tell
  `);
}

export async function tripleClick(x: number, y: number): Promise<void> {
  await runAppleScript(`
    tell application "System Events"
      click at {${x}, ${y}}
      click at {${x}, ${y}}
      click at {${x}, ${y}}
    end tell
  `);
}

export async function rightClick(x: number, y: number): Promise<void> {
  await runAppleScript(`
    tell application "System Events"
      secondary click at {${x}, ${y}}
    end tell
  `);
}

export async function typeText(text: string): Promise<void> {
  // Use keystroke for text — safer than key code for arbitrary strings
  const safe = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  await runAppleScript(`
    tell application "System Events"
      keystroke "${safe}"
    end tell
  `);
}

const MODIFIER_MAP: Record<string, string> = {
  cmd: "command down",
  command: "command down",
  shift: "shift down",
  opt: "option down",
  option: "option down",
  alt: "option down",
  ctrl: "control down",
  control: "control down",
};

const KEY_CODE_MAP: Record<string, number> = {
  return: 36, enter: 36,
  escape: 53, esc: 53,
  tab: 48,
  space: 49,
  delete: 51, backspace: 51,
  up: 126, down: 125, left: 123, right: 124,
  home: 115, end: 119,
  pageup: 116, pagedown: 121,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
  f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
};

export async function keyPress(combo: string): Promise<void> {
  const parts = combo.toLowerCase().split("+").map(s => s.trim());
  const modifiers = parts.slice(0, -1).map(m => MODIFIER_MAP[m]).filter(Boolean);
  const key = parts[parts.length - 1] ?? "";

  const usingClause = modifiers.length > 0 ? ` using {${modifiers.join(", ")}}` : "";

  if (KEY_CODE_MAP[key] !== undefined) {
    await runAppleScript(`
      tell application "System Events"
        key code ${KEY_CODE_MAP[key]}${usingClause}
      end tell
    `);
  } else {
    const safeKey = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    await runAppleScript(`
      tell application "System Events"
        keystroke "${safeKey}"${usingClause}
      end tell
    `);
  }
}

export async function scroll(
  x: number,
  y: number,
  direction: "up" | "down" | "left" | "right",
  amount: number
): Promise<void> {
  const deltaY = direction === "up" ? amount : direction === "down" ? -amount : 0;
  const deltaX = direction === "right" ? amount : direction === "left" ? -amount : 0;

  // Swift + CoreGraphics — always available on macOS, no extra dependencies
  const script = `
import CoreGraphics

let point = CGPoint(x: ${x}, y: ${y})

// Move cursor to position
let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)!
moveEvent.post(tap: .cghidEventTap)

// Scroll wheel event (unit: line, 2 axes)
let scrollEvent = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 2, wheel1: ${deltaY}, wheel2: ${deltaX}, wheel3: 0)!
scrollEvent.location = point
scrollEvent.post(tap: .cghidEventTap)
`;

  const tmp = join(tmpdir(), `mcp-scroll-${Date.now()}.swift`);
  try {
    await writeFile(tmp, script, "utf8");
    await execFileAsync("swift", [tmp]);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
