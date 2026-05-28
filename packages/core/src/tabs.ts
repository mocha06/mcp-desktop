import { runAppleScript } from "./applescript.js";

export interface Tab {
  index: number;
  title: string;
  url?: string;
}

const CHROME_LIKE = ["Brave Browser", "Google Chrome", "Chromium", "Arc"];
const SAFARI = ["Safari"];
const TERMINALS = ["iTerm2", "Terminal"];

export const SUPPORTED_TAB_APPS = [...CHROME_LIKE, ...SAFARI, ...TERMINALS];

function matchApp(appName: string, list: string[]): boolean {
  return list.some(a => a.toLowerCase() === appName.toLowerCase());
}

function resolvedName(appName: string): string {
  return SUPPORTED_TAB_APPS.find(a => a.toLowerCase() === appName.toLowerCase()) ?? appName;
}

export async function listTabs(appName: string): Promise<Tab[]> {
  const name = resolvedName(appName);

  if (matchApp(name, CHROME_LIKE)) return listChromeTabs(name);
  if (matchApp(name, SAFARI)) return listSafariTabs();
  if (name.toLowerCase() === "iterm2") return listITermTabs();
  if (name.toLowerCase() === "terminal") return listTerminalTabs();

  throw new Error(
    `Tab listing not supported for '${appName}'. Supported apps: ${SUPPORTED_TAB_APPS.join(", ")}`
  );
}

async function listChromeTabs(appName: string): Promise<Tab[]> {
  const raw = await runAppleScript(`
    tell application "${appName}"
      set output to ""
      set tabIdx to 0
      repeat with w in windows
        repeat with t in tabs of w
          set tabIdx to tabIdx + 1
          set output to output & tabIdx & "|" & title of t & "|" & URL of t & "\n"
        end repeat
      end repeat
      return output
    end tell
  `);
  return parseTabLines(raw, true);
}

async function listSafariTabs(): Promise<Tab[]> {
  const raw = await runAppleScript(`
    tell application "Safari"
      set output to ""
      set tabIdx to 0
      repeat with w in windows
        repeat with t in tabs of w
          set tabIdx to tabIdx + 1
          set output to output & tabIdx & "|" & name of t & "|" & URL of t & "\n"
        end repeat
      end repeat
      return output
    end tell
  `);
  return parseTabLines(raw, true);
}

async function listITermTabs(): Promise<Tab[]> {
  const raw = await runAppleScript(`
    tell application "iTerm2"
      set output to ""
      set tabIdx to 0
      repeat with w in windows
        repeat with t in tabs of w
          set tabIdx to tabIdx + 1
          set output to output & tabIdx & "|" & name of t & "\n"
        end repeat
      end repeat
      return output
    end tell
  `);
  return parseTabLines(raw, false);
}

async function listTerminalTabs(): Promise<Tab[]> {
  const raw = await runAppleScript(`
    tell application "Terminal"
      set output to ""
      set tabIdx to 0
      repeat with w in windows
        repeat with t in tabs of w
          set tabIdx to tabIdx + 1
          set output to output & tabIdx & "|" & custom title of t & "\n"
        end repeat
      end repeat
      return output
    end tell
  `);
  return parseTabLines(raw, false);
}

function parseTabLines(raw: string, hasUrl: boolean): Tab[] {
  return raw
    .split("\n")
    .filter(l => l.trim())
    .map(line => {
      const parts = line.split("|");
      return {
        index: parseInt(parts[0] ?? "0", 10),
        title: (parts[1] ?? "").trim(),
        url: hasUrl ? (parts[2] ?? "").trim() || undefined : undefined,
      };
    })
    .filter(t => !isNaN(t.index));
}

export async function switchTab(appName: string, identifier: string | number): Promise<void> {
  const name = resolvedName(appName);
  const tabs = await listTabs(name);

  let target: Tab | undefined;

  if (typeof identifier === "number") {
    target = tabs.find(t => t.index === identifier);
  } else {
    target = tabs.find(t => t.url?.includes(identifier))
      ?? tabs.find(t => t.title.toLowerCase().includes(identifier.toLowerCase()));
  }

  if (!target) {
    throw new Error(`No tab found matching '${identifier}' in ${name}. Available tabs: ${tabs.map(t => t.title).join(", ")}`);
  }

  await switchToIndex(name, target.index);
}

async function switchToIndex(appName: string, index: number): Promise<void> {
  if (matchApp(appName, CHROME_LIKE)) {
    await runAppleScript(`
      tell application "${appName}"
        activate
        set globalIdx to 0
        repeat with w in windows
          set localIdx to 0
          repeat with t in tabs of w
            set globalIdx to globalIdx + 1
            set localIdx to localIdx + 1
            if globalIdx = ${index} then
              set active tab index of w to localIdx
              set index of w to 1
              return
            end if
          end repeat
        end repeat
      end tell
    `);
  } else if (matchApp(appName, SAFARI)) {
    await runAppleScript(`
      tell application "Safari"
        activate
        set globalIdx to 0
        repeat with w in windows
          set localIdx to 0
          repeat with t in tabs of w
            set globalIdx to globalIdx + 1
            set localIdx to localIdx + 1
            if globalIdx = ${index} then
              set current tab index of w to localIdx
              set index of w to 1
              return
            end if
          end repeat
        end repeat
      end tell
    `);
  } else if (appName.toLowerCase() === "iterm2") {
    await runAppleScript(`
      tell application "iTerm2"
        activate
        set tabIdx to 0
        repeat with w in windows
          repeat with t in tabs of w
            set tabIdx to tabIdx + 1
            if tabIdx = ${index} then
              tell w to select t
              return
            end if
          end repeat
        end repeat
      end tell
    `);
  } else {
    await runAppleScript(`
      tell application "Terminal"
        activate
        set tabIdx to 0
        repeat with w in windows
          repeat with t in tabs of w
            set tabIdx to tabIdx + 1
            if tabIdx = ${index} then
              set selected of t to true
              set index of w to 1
              return
            end if
          end repeat
        end repeat
      end tell
    `);
  }
}
