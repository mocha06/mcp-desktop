import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseTabLines, switchTab, SUPPORTED_TAB_APPS } from "./tabs.js";
import * as applescript from "./applescript.js";

describe("parseTabLines", () => {
  it("parses pipe-delimited lines with URL", () => {
    const raw = "1|GitHub|https://github.com\n2|Hacker News|https://news.ycombinator.com\n";
    expect(parseTabLines(raw, true)).toEqual([
      { index: 1, title: "GitHub", url: "https://github.com" },
      { index: 2, title: "Hacker News", url: "https://news.ycombinator.com" },
    ]);
  });

  it("omits url when hasUrl is false", () => {
    const raw = "1|Tab 1\n2|Tab 2\n";
    expect(parseTabLines(raw, false)).toEqual([
      { index: 1, title: "Tab 1", url: undefined },
      { index: 2, title: "Tab 2", url: undefined },
    ]);
  });

  it("skips blank lines", () => {
    const raw = "\n1|A|https://a.com\n\n2|B|https://b.com\n";
    expect(parseTabLines(raw, true)).toHaveLength(2);
  });

  it("trims whitespace from title and url", () => {
    const raw = "1|  GitHub  |  https://github.com  \n";
    expect(parseTabLines(raw, true)[0]).toEqual({
      index: 1,
      title: "GitHub",
      url: "https://github.com",
    });
  });

  it("returns undefined url when url field is empty", () => {
    const raw = "1|Untitled|\n";
    expect(parseTabLines(raw, true)[0]?.url).toBeUndefined();
  });

  it("filters lines whose index is not numeric", () => {
    const raw = "1|Good|https://ok.com\nbroken-line\n";
    expect(parseTabLines(raw, true)).toHaveLength(1);
  });
});

describe("SUPPORTED_TAB_APPS", () => {
  it("includes major browsers and terminals", () => {
    expect(SUPPORTED_TAB_APPS).toEqual(
      expect.arrayContaining(["Brave Browser", "Google Chrome", "Safari", "iTerm2", "Terminal"]),
    );
  });
});

describe("switchTab matching", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const stubTabs = [
    { index: 1, title: "GitHub", url: "https://github.com/foo" },
    { index: 2, title: "Local Dev", url: "http://localhost:3000/" },
    { index: 3, title: "Pull Request #42", url: "https://github.com/foo/pull/42" },
  ];

  function mockTabsResponse() {
    // Return lines parseable by parseTabLines for chrome-like browsers
    const raw = stubTabs.map(t => `${t.index}|${t.title}|${t.url}`).join("\n") + "\n";
    return vi.spyOn(applescript, "runAppleScript").mockResolvedValue(raw);
  }

  it("resolves a numeric identifier by index", async () => {
    const spy = mockTabsResponse();
    await switchTab("Brave Browser", 3);
    const lastCall = spy.mock.calls.at(-1)?.[0] ?? "";
    expect(lastCall).toMatch(/if globalIdx = 3 then/);
  });

  it("matches URL substring before title substring", async () => {
    const spy = mockTabsResponse();
    // "github" appears in two URLs (indexes 1 and 3) and in title "GitHub" (1).
    // URL match should win and pick the first (index 1).
    await switchTab("Brave Browser", "github");
    const lastCall = spy.mock.calls.at(-1)?.[0] ?? "";
    expect(lastCall).toMatch(/if globalIdx = 1 then/);
  });

  it("falls back to title substring when no URL matches", async () => {
    const spy = mockTabsResponse();
    await switchTab("Brave Browser", "Pull Request");
    const lastCall = spy.mock.calls.at(-1)?.[0] ?? "";
    expect(lastCall).toMatch(/if globalIdx = 3 then/);
  });

  it("title match is case-insensitive", async () => {
    const spy = mockTabsResponse();
    await switchTab("Brave Browser", "local dev");
    const lastCall = spy.mock.calls.at(-1)?.[0] ?? "";
    expect(lastCall).toMatch(/if globalIdx = 2 then/);
  });

  it("throws with available tab list when nothing matches", async () => {
    mockTabsResponse();
    await expect(switchTab("Brave Browser", "nonexistent")).rejects.toThrow(/No tab found/);
    await expect(switchTab("Brave Browser", "nonexistent")).rejects.toThrow(/GitHub.*Local Dev.*Pull Request/);
  });

  it("rejects an unsupported app", async () => {
    await expect(switchTab("Finder", "anything")).rejects.toThrow(/not supported/);
  });
});
