# mcp-desktop

[![CI](https://github.com/mocha06/mcp-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/mocha06/mcp-desktop/actions/workflows/ci.yml)

macOS desktop automation for AI agents — screenshot any screen, switch apps and tabs, click, type, and scroll. Built as two separate MCP servers so you can install only the trust level you need.

---

## Packages

| Package | npm | What it does | Trust level |
|---|---|---|---|
| `mcp-desktop-screenshot` | `@rchavarria06/mcp-desktop-screenshot` | Screenshots, app switching, tab switching | **Low** — read-only |
| `mcp-desktop-control` | `@rchavarria06/mcp-desktop-control` | Everything above + click, type, scroll | **Higher** — can interact with your UI |

> **Tip:** Install only `mcp-desktop-screenshot` if you want an AI to observe your screen. Install `mcp-desktop-control` if you want it to act on your screen too — it includes all screenshot tools.

---

## Requirements

- macOS (Apple Silicon or Intel)
- Node.js 18+
- **Screen Recording** permission for your terminal app (System Settings → Privacy & Security → Screen Recording)
- **Accessibility** permission for your terminal app — only needed for `mcp-desktop-control` (System Settings → Privacy & Security → Accessibility)

---

## Installation

### Claude Code (CLI)

```bash
# Read-only: screenshots + app/tab switching
claude mcp add --scope user desktop-screenshot -- npx -y @rchavarria06/mcp-desktop-screenshot

# Full control (includes all screenshot tools)
claude mcp add --scope user desktop-control -- npx -y @rchavarria06/mcp-desktop-control
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "desktop-screenshot": {
      "command": "npx",
      "args": ["-y", "@rchavarria06/mcp-desktop-screenshot"],
      "env": {
        "BLOCKED_APPS": "1Password,Keychain"
      }
    }
  }
}
```

### Other MCP clients

Any client that supports stdio MCP servers can run:

```bash
npx @rchavarria06/mcp-desktop-screenshot
# or
npx @rchavarria06/mcp-desktop-control
```

---

## Privacy

Screenshots are **ephemeral by default** — they're returned as base64 image data in the AI's context and never written to disk. Pass a `save_path` to any screenshot tool if you want to persist it.

Set `BLOCKED_APPS` to a comma-separated list of app names the server will refuse to access:

```json
"env": { "BLOCKED_APPS": "1Password,Keychain Access,Signal" }
```

---

## Tools

### mcp-desktop-screenshot

| Tool | Description | Parameters |
|---|---|---|
| `list_displays` | List connected displays | — |
| `list_apps` | List running apps with a visible UI | — |
| `list_tabs` | List tabs in a browser or terminal | `app_name` |
| `take_screenshot` | Capture a display, return as image | `display` (default 1), `save_path?` |
| `switch_app` | Bring an app to the foreground | `app_name` |
| `switch_tab` | Switch tab by URL substring, title substring, or index | `app_name`, `tab` |
| `screenshot_app` | Switch to app, capture, restore previous app | `app_name`, `display?`, `save_path?` |

`list_tabs` supports: `Brave Browser`, `Google Chrome`, `Chromium`, `Arc`, `Safari`, `iTerm2`, `Terminal`

### mcp-desktop-control

Includes all tools above, plus:

| Tool | Description | Parameters |
|---|---|---|
| `click` | Left-click at coordinates | `x`, `y`, `verify_app?` |
| `double_click` | Double-click at coordinates | `x`, `y`, `verify_app?` |
| `triple_click` | Triple-click — selects all text in an input (mouse-native) | `x`, `y`, `verify_app?` |
| `right_click` | Right-click at coordinates | `x`, `y`, `verify_app?` |
| `type_text` | Type text into the focused element | `text`, `verify_app?` |
| `key_press` | Press a key or combo (`cmd+c`, `shift+tab`, `escape`, …) | `combo`, `verify_app?` |
| `scroll` | Scroll at coordinates | `x`, `y`, `direction` (up/down/left/right), `amount?`, `unit?` (line/page), `verify_app?` |

Pass `verify_app` to any control tool to abort with an error if the wrong app is frontmost — prevents accidental input to the wrong window.

---

## Example workflows

### AI attaches screenshots to a PR description

```
1. list_displays                                    → find which display has the terminal
2. screenshot_app("Terminal", display: 3)           → capture test output
3. switch_tab("Brave Browser", "localhost:3000")    → focus preview
4. take_screenshot(display: 2)                      → capture the UI
5. AI writes PR description with both images embedded
```

### AI fills out a form

```
1. screenshot_app("Brave Browser")      → see current state
2. click(x, y)                          → focus the input
3. type_text("roberto@example.com")     → fill it in
4. key_press("tab")                     → next field
5. type_text("My message here")
6. key_press("return")                  → submit
7. take_screenshot(display: 1)          → confirm success
```

---

## How it works

Both servers are built on macOS-native primitives — no third-party automation frameworks:

- **Screenshots**: `screencapture` CLI
- **App switching / tab control**: `osascript` (AppleScript)
- **Mouse / keyboard**: `System Events` via AppleScript
- **Scroll**: Swift + `CoreGraphics.CGEvent`

---

## Contributing

PRs welcome. The monorepo uses npm workspaces:

```bash
git clone https://github.com/mocha06/mcp-desktop
cd mcp-desktop
npm install
npm run build
npm test
```

Packages live in `packages/core` (shared primitives), `packages/mcp-screenshot`, and `packages/mcp-control`.

### Testing

Vitest covers pure logic: tab-list parsing and resolution, `BLOCKED_APPS` matching, AppleScript escaping, key-combo parsing, and the Swift scroll script construction. Side-effectful runners that call `osascript`, `screencapture`, or `swift` are exercised end-to-end on a real macOS machine — please smoke-test mouse/keyboard changes manually before opening a PR.

```bash
npm test           # one-shot
npm run test:watch # rerun on save
```

---

## License

MIT
