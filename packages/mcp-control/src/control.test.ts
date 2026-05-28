import { describe, it, expect } from "vitest";
import {
  escapeAppleScriptString,
  buildClickScript,
  buildDoubleClickScript,
  buildTripleClickScript,
  buildRightClickScript,
  buildTypeTextScript,
  parseCombo,
  buildKeyPressScript,
  buildScrollScript,
} from "./control.js";

describe("escapeAppleScriptString", () => {
  it("escapes backslashes and double quotes", () => {
    expect(escapeAppleScriptString(`he said "hi"`)).toBe(`he said \\"hi\\"`);
    expect(escapeAppleScriptString(`C:\\path`)).toBe(`C:\\\\path`);
  });

  it("leaves regular text alone", () => {
    expect(escapeAppleScriptString("hello world")).toBe("hello world");
  });

  it("escapes backslashes before quotes (order matters)", () => {
    // Ensure we don't end up with a quote that escapes its own backslash escape.
    expect(escapeAppleScriptString(`a\\"b`)).toBe(`a\\\\\\"b`);
  });
});

describe("click script builders", () => {
  it("click emits 'click at {x, y}'", () => {
    expect(buildClickScript(100, 200)).toMatch(/click at \{100, 200\}/);
  });

  it("doubleClick emits 'double click'", () => {
    expect(buildDoubleClickScript(50, 60)).toMatch(/double click at \{50, 60\}/);
  });

  it("tripleClick emits three click commands at the same coordinates", () => {
    const script = buildTripleClickScript(10, 20);
    const matches = script.match(/click at \{10, 20\}/g) ?? [];
    expect(matches).toHaveLength(3);
  });

  it("rightClick uses 'secondary click'", () => {
    expect(buildRightClickScript(5, 5)).toMatch(/secondary click at \{5, 5\}/);
  });
});

describe("buildTypeTextScript", () => {
  it("emits a keystroke with the text inside double quotes", () => {
    expect(buildTypeTextScript("hello")).toMatch(/keystroke "hello"/);
  });

  it("escapes embedded quotes so AppleScript can parse the string", () => {
    expect(buildTypeTextScript(`say "hi"`)).toMatch(/keystroke "say \\"hi\\""/);
  });
});

describe("parseCombo", () => {
  it("parses a single key with no modifiers", () => {
    expect(parseCombo("return")).toEqual({ modifiers: [], key: "return", keyCode: 36 });
  });

  it("parses one modifier + key", () => {
    expect(parseCombo("cmd+a")).toEqual({
      modifiers: ["command down"],
      key: "a",
      keyCode: undefined,
    });
  });

  it("maps modifier aliases", () => {
    expect(parseCombo("opt+f").modifiers).toEqual(["option down"]);
    expect(parseCombo("alt+f").modifiers).toEqual(["option down"]);
    expect(parseCombo("option+f").modifiers).toEqual(["option down"]);
    expect(parseCombo("command+f").modifiers).toEqual(["command down"]);
    expect(parseCombo("ctrl+f").modifiers).toEqual(["control down"]);
    expect(parseCombo("control+f").modifiers).toEqual(["control down"]);
  });

  it("preserves order of multiple modifiers", () => {
    expect(parseCombo("cmd+shift+n").modifiers).toEqual(["command down", "shift down"]);
  });

  it("looks up key codes for special keys", () => {
    expect(parseCombo("escape").keyCode).toBe(53);
    expect(parseCombo("esc").keyCode).toBe(53);
    expect(parseCombo("tab").keyCode).toBe(48);
    expect(parseCombo("up").keyCode).toBe(126);
    expect(parseCombo("home").keyCode).toBe(115);
    expect(parseCombo("f5").keyCode).toBe(96);
  });

  it("is case-insensitive", () => {
    expect(parseCombo("CMD+A")).toEqual(parseCombo("cmd+a"));
  });
});

describe("buildKeyPressScript", () => {
  it("emits 'key code N' for known special keys", () => {
    expect(buildKeyPressScript("return")).toMatch(/key code 36/);
  });

  it("emits 'keystroke' for regular keys", () => {
    expect(buildKeyPressScript("a")).toMatch(/keystroke "a"/);
  });

  it("attaches 'using {…}' for modifiers", () => {
    expect(buildKeyPressScript("cmd+a")).toMatch(/keystroke "a" using \{command down\}/);
    expect(buildKeyPressScript("cmd+shift+n")).toMatch(
      /keystroke "n" using \{command down, shift down\}/,
    );
  });

  it("omits the 'using' clause when there are no modifiers", () => {
    expect(buildKeyPressScript("a")).not.toMatch(/using/);
  });

  it("supports modifier + special key", () => {
    expect(buildKeyPressScript("cmd+shift+tab")).toMatch(
      /key code 48 using \{command down, shift down\}/,
    );
  });
});

describe("buildScrollScript — line unit", () => {
  it("scrolls down → negative Y delta", () => {
    expect(buildScrollScript(100, 200, "down", 3)).toMatch(/wheel1: -3, wheel2: 0/);
  });

  it("scrolls up → positive Y delta", () => {
    expect(buildScrollScript(100, 200, "up", 3)).toMatch(/wheel1: 3, wheel2: 0/);
  });

  it("scrolls right → positive X delta", () => {
    expect(buildScrollScript(100, 200, "right", 5)).toMatch(/wheel1: 0, wheel2: 5/);
  });

  it("scrolls left → negative X delta", () => {
    expect(buildScrollScript(100, 200, "left", 5)).toMatch(/wheel1: 0, wheel2: -5/);
  });

  it("emits a 'line' units scroll event", () => {
    expect(buildScrollScript(0, 0, "down", 1)).toMatch(/units: \.line/);
  });

  it("places the cursor at the requested coordinates", () => {
    expect(buildScrollScript(123, 456, "down", 1)).toMatch(/CGPoint\(x: 123, y: 456\)/);
  });
});

describe("buildScrollScript — page unit", () => {
  it("emits a 'pixel' units scroll event sized from the display bounds", () => {
    const script = buildScrollScript(0, 0, "down", 1, "page");
    expect(script).toMatch(/units: \.pixel/);
    expect(script).toMatch(/CGGetDisplaysWithPoint/);
    expect(script).toMatch(/CGDisplayBounds/);
    expect(script).toMatch(/bounds\.height \* 0\.75/);
  });

  it("negates pageY for down direction", () => {
    expect(buildScrollScript(0, 0, "down", 1, "page")).toMatch(/wheel1: -pageY/);
  });

  it("positive pageY for up direction", () => {
    expect(buildScrollScript(0, 0, "up", 1, "page")).toMatch(/wheel1: pageY,/);
  });

  it("uses pageX for horizontal scrolling and zero for the unused axis", () => {
    const right = buildScrollScript(0, 0, "right", 1, "page");
    expect(right).toMatch(/wheel1: 0, wheel2: pageX/);
    const left = buildScrollScript(0, 0, "left", 1, "page");
    expect(left).toMatch(/wheel1: 0, wheel2: -pageX/);
  });

  it("multiplies page size by amount", () => {
    expect(buildScrollScript(0, 0, "down", 4, "page")).toMatch(/Int32\(4\)/);
  });
});
