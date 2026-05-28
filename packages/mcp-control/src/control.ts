import { runAppleScript } from "@mcp-desktop/core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export function escapeAppleScriptString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildClickScript(x: number, y: number): string {
  return `
    tell application "System Events"
      click at {${x}, ${y}}
    end tell
  `;
}

export function buildDoubleClickScript(x: number, y: number): string {
  return `
    tell application "System Events"
      double click at {${x}, ${y}}
    end tell
  `;
}

export function buildTripleClickScript(x: number, y: number): string {
  return `
    tell application "System Events"
      click at {${x}, ${y}}
      click at {${x}, ${y}}
      click at {${x}, ${y}}
    end tell
  `;
}

export function buildRightClickScript(x: number, y: number): string {
  return `
    tell application "System Events"
      secondary click at {${x}, ${y}}
    end tell
  `;
}

export function buildTypeTextScript(text: string): string {
  return `
    tell application "System Events"
      keystroke "${escapeAppleScriptString(text)}"
    end tell
  `;
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

export interface ParsedCombo {
  modifiers: string[];
  key: string;
  keyCode?: number;
}

export function parseCombo(combo: string): ParsedCombo {
  const parts = combo.toLowerCase().split("+").map(s => s.trim());
  const modifiers = parts.slice(0, -1).map(m => MODIFIER_MAP[m]).filter(Boolean);
  const key = parts[parts.length - 1] ?? "";
  const keyCode = KEY_CODE_MAP[key];
  return { modifiers, key, keyCode };
}

export function buildKeyPressScript(combo: string): string {
  const { modifiers, key, keyCode } = parseCombo(combo);
  const usingClause = modifiers.length > 0 ? ` using {${modifiers.join(", ")}}` : "";

  if (keyCode !== undefined) {
    return `
      tell application "System Events"
        key code ${keyCode}${usingClause}
      end tell
    `;
  }
  return `
    tell application "System Events"
      keystroke "${escapeAppleScriptString(key)}"${usingClause}
    end tell
  `;
}

export type ScrollDirection = "up" | "down" | "left" | "right";
export type ScrollUnit = "line" | "page";

export function buildScrollScript(
  x: number,
  y: number,
  direction: ScrollDirection,
  amount: number,
  unit: ScrollUnit = "line"
): string {
  const signY = direction === "up" ? 1 : direction === "down" ? -1 : 0;
  const signX = direction === "right" ? 1 : direction === "left" ? -1 : 0;

  if (unit === "page") {
    // Sign expressed in Swift to keep Int32 typing consistent on both axes.
    const w1 = signY === 0 ? "0" : signY > 0 ? "pageY" : "-pageY";
    const w2 = signX === 0 ? "0" : signX > 0 ? "pageX" : "-pageX";

    // CGGetDisplaysWithPoint resolves the display under the cursor; CGDisplayBounds
    // returns logical (point) dimensions, which is what scroll-pixel events expect on Retina.
    // 75% of display height leaves a small overlap strip on the next page for readability.
    return `
import CoreGraphics

let point = CGPoint(x: ${x}, y: ${y})

var displayID = CGMainDisplayID()
var count: UInt32 = 0
CGGetDisplaysWithPoint(point, 1, &displayID, &count)
let bounds = CGDisplayBounds(displayID)

let pageY = Int32(bounds.height * 0.75) * Int32(${amount})
let pageX = Int32(bounds.width * 0.75) * Int32(${amount})

let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)!
moveEvent.post(tap: .cghidEventTap)

let scrollEvent = CGEvent(scrollWheelEvent2Source: nil, units: .pixel, wheelCount: 2, wheel1: ${w1}, wheel2: ${w2}, wheel3: 0)!
scrollEvent.location = point
scrollEvent.post(tap: .cghidEventTap)
`;
  }

  return `
import CoreGraphics

let point = CGPoint(x: ${x}, y: ${y})

let moveEvent = CGEvent(mouseEventSource: nil, mouseType: .mouseMoved, mouseCursorPosition: point, mouseButton: .left)!
moveEvent.post(tap: .cghidEventTap)

let scrollEvent = CGEvent(scrollWheelEvent2Source: nil, units: .line, wheelCount: 2, wheel1: ${signY * amount}, wheel2: ${signX * amount}, wheel3: 0)!
scrollEvent.location = point
scrollEvent.post(tap: .cghidEventTap)
`;
}

export async function click(x: number, y: number): Promise<void> {
  await runAppleScript(buildClickScript(x, y));
}

export async function doubleClick(x: number, y: number): Promise<void> {
  await runAppleScript(buildDoubleClickScript(x, y));
}

export async function tripleClick(x: number, y: number): Promise<void> {
  await runAppleScript(buildTripleClickScript(x, y));
}

export async function rightClick(x: number, y: number): Promise<void> {
  await runAppleScript(buildRightClickScript(x, y));
}

export async function typeText(text: string): Promise<void> {
  await runAppleScript(buildTypeTextScript(text));
}

export async function keyPress(combo: string): Promise<void> {
  await runAppleScript(buildKeyPressScript(combo));
}

export async function scroll(
  x: number,
  y: number,
  direction: ScrollDirection,
  amount: number,
  unit: ScrollUnit = "line"
): Promise<void> {
  const script = buildScrollScript(x, y, direction, amount, unit);
  const tmp = join(tmpdir(), `mcp-scroll-${Date.now()}.swift`);
  try {
    await writeFile(tmp, script, "utf8");
    await execFileAsync("swift", [tmp]);
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
