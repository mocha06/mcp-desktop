import { describe, it, expect } from "vitest";
import { parseBlockedApps, isAppBlocked } from "./blocked.js";

describe("parseBlockedApps", () => {
  it("returns empty array for undefined or empty input", () => {
    expect(parseBlockedApps(undefined)).toEqual([]);
    expect(parseBlockedApps("")).toEqual([]);
    expect(parseBlockedApps(",,  ,")).toEqual([]);
  });

  it("splits, trims, and lowercases", () => {
    expect(parseBlockedApps("1Password, Keychain Access, Signal")).toEqual([
      "1password",
      "keychain access",
      "signal",
    ]);
  });
});

describe("isAppBlocked", () => {
  it("returns false against an empty blocklist", () => {
    expect(isAppBlocked("1Password", [])).toBe(false);
  });

  it("matches substring case-insensitively", () => {
    const blocked = parseBlockedApps("1Password, signal");
    expect(isAppBlocked("1Password 7", blocked)).toBe(true);
    expect(isAppBlocked("Signal", blocked)).toBe(true);
    expect(isAppBlocked("Brave Browser", blocked)).toBe(false);
  });

  it("blocks apps whose name contains a blocked token", () => {
    // Important: a token like "1password" should still match "1Password Manager"
    // because users may type a partial name in BLOCKED_APPS.
    const blocked = parseBlockedApps("1Password");
    expect(isAppBlocked("1Password Manager", blocked)).toBe(true);
  });
});
