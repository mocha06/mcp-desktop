# mcp-desktop

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

### Blocking apps

Set the `BLOCKED_APPS` environment variable to a comma-separated list of app names the server will refuse to access:

```json
"env": {
  "BLOCKED_APPS": "1Password,Keychain Access,Signal"
}
```

---

## Tools

### mcp-desktop-screenshot

#### `list_displays`
Lists all connected displays and their numbers.

```
→ { displays: [{ display: 1, note: "main display" }, { display: 2, note: "display 2" }] }
```

#### `list_apps`
Lists all running applications with a visible UI.

```
→ { apps: ["Brave Browser", "Cursor", "iTerm2", ...] }
```

#### `list_tabs`
Lists open tabs in a browser or terminal app. Returns title and URL (browsers only).

Supported apps: `Brave Browser`, `Google Chrome`, `Chromium`, `Arc`, `Safari`, `iTerm2`, `Terminal`

```
app_name: "Brave Browser"
→ { tabs: [{ index: 1, title: "GitHub", url: "https://github.com" }, ...] }
```

#### `take_screenshot`
Captures a specific display. Returns the image inline (base64). Optionally saves to disk.

```
display: 2
save_path: "/Users/you/Desktop/shot.png"  ← optional
```

#### `switch_app`
Brings an application to the foreground.

```
app_name: "Brave Browser"
```

#### `switch_tab`
Switches to a tab by URL substring, title substring, or index. Tries URL match first, then title, then index.

```
app_name: "Brave Browser"
tab: "localhost:3000"       ← URL substring
tab: "Pull Request #42"     ← title substring
tab: 3                      ← index from list_tabs
```

#### `screenshot_app`
Switches to an app, captures the display, then restores the previous app — all in one call.

```
app_name: "Brave Browser"
display: 2
save_path: "/Users/you/Desktop/shot.png"  ← optional
```

---

### mcp-desktop-control

Includes all tools from `mcp-desktop-screenshot`, plus:

#### `click`
Left-clicks at the given screen coordinates.

```
x: 500, y: 300
```

#### `double_click`
Double-clicks at the given screen coordinates.

```
x: 500, y: 300
```

#### `right_click`
Right-clicks (secondary click) at the given screen coordinates.

```
x: 500, y: 300
```

#### `type_text`
Types a string into the currently focused element.

```
text: "Hello, world!"
```

#### `key_press`
Presses a key or key combination.

```
combo: "return"
combo: "escape"
combo: "cmd+c"
combo: "cmd+shift+n"
combo: "cmd+a"
```

Supported modifiers: `cmd`, `shift`, `option` / `opt` / `alt`, `ctrl`

#### `scroll`
Scrolls at the given screen coordinates.

```
x: 760, y: 400
direction: "down"   ← up | down | left | right
amount: 3           ← number of lines
```

---

## Example workflows

### AI attaches screenshots to a PR description

```
1. list_displays           → find which display has the terminal
2. screenshot_app("Terminal", display: 3)  → capture test output
3. switch_tab("Brave Browser", "localhost:3000")  → focus preview
4. take_screenshot(display: 2)  → capture the UI
5. AI writes PR description with both images embedded
```

### AI fills out a form

```
1. screenshot_app("Brave Browser")  → see current state
2. click(x, y)                      → focus the input
3. type_text("roberto@example.com") → fill it in
4. key_press("tab")                 → next field
5. type_text("My message here")
6. key_press("return")              → submit
7. take_screenshot(display: 1)      → confirm success
```

---

## How it works

Both servers are built on macOS-native primitives — no third-party automation frameworks:

- **Screenshots**: `screencapture` CLI
- **App switching / tab control**: `osascript` (AppleScript)
- **Mouse / keyboard**: `System Events` via AppleScript
- **Scroll**: Python + `Quartz.CGEvent` (macOS built-in)

---

## Contributing

PRs welcome. The monorepo uses npm workspaces:

```bash
git clone https://github.com/mocha06/mcp-desktop
cd mcp-desktop
npm install
npm run build
```

Packages live in `packages/core` (shared primitives), `packages/mcp-screenshot`, and `packages/mcp-control`.

---

## License

MIT
