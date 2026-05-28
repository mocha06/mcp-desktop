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
  amount: number,
  unit: "line" | "page" = "line"
): Promise<void> {
  const signY = direction === "up" ? 1 : direction === "down" ? -1 : 0;
  const signX = direction === "right" ? 1 : direction === "left" ? -1 : 0;

  let script: string;

  if (unit === "page") {
    // Express sign as a Swift expression so we avoid Int/Int32 type mismatches
    const w1 = signY === 0 ? "0" : signY > 0 ? "pageY" : "-pageY";
    const w2 = signX === 0 ? "0" : signX > 0 ? "pageX" : "-pageX";

    // CGGetDisplaysWithPoint returns the display under the cursor.
    // CGDisplayBounds gives logical (point) dimensions — correct for pixel scroll events on Retina.
    // 85% of display height approximates one browser viewport (accounts for chrome/taskbar).
    script = `
import CoreGraphics

let point = CGPoint(x: ${x}, y: ${y})

var displayID = CGMainDisplayID()
var count: UInt32 = 0
CGGetDisplaysWithPoint(point, 1, &displayID, &count)
let bounds = CGDisplayBounds(displayID)

let pageY = Int32(bounds.height * 0.85) * Int32(${amount})
let pageX = Int32(bounds.width * 0.85) * Int32(${amount})

let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)!
moveEvent.post(tap: .cghidEventTap)

let scrollEvent = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: ${w1}, wheel2: ${w2}, wheel3: 0)!
scrollEvent.location = point
scrollEvent.post(tap: .cghidEventTap)
`;
  } else {
    script = `
import CoreGraphics

let point = CGPoint(x: ${x}, y: ${y})

let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)!
moveEvent.post(tap: .cghidEventTap)

let scrollEvent = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 2, wheel1: ${signY * amount}, wheel2: ${signX * amount}, wheel3: 0)!
scrollEvent.location = point
scrollEvent.post(tap: .cghidEventTap)
`;
  }

  const tmp = join(tmpdir(), `mcp-scroll-${Date.now()}.swift`);
  try {
    await writeFile(tmp, script, "utf8");
    await execFileAsync("swift", [tmp]);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
