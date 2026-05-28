import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  probeDisplays,
  listApps,
  listTabs,
  switchTab,
  captureDisplay,
  activateApp,
  getFrontmostApp,
  SUPPORTED_TAB_APPS,
} from "@mcp-desktop/core";
import { click, doubleClick, rightClick, typeText, keyPress, scroll } from "./control.js";

const BLOCKED_APPS = (process.env.BLOCKED_APPS ?? "")
  .split(",")
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function assertNotBlocked(appName: string): void {
  const lower = appName.toLowerCase();
  if (BLOCKED_APPS.some(b => lower.includes(b))) {
    throw new Error(`'${appName}' is in the blocked list and cannot be accessed.`);
  }
}

const server = new McpServer({ name: "mcp-desktop-control", version: "0.1.0" });

// ── Screenshot tools (same as mcp-desktop-screenshot) ──────────────────────

server.registerTool(
  "list_displays",
  {
    description: "List available displays with their numbers. Use the display number with take_screenshot or screenshot_app.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const displays = await probeDisplays();
    return { content: [{ type: "text", text: JSON.stringify({ displays, total: displays.length }, null, 2) }] };
  }
);

server.registerTool(
  "list_apps",
  {
    description: "List currently running applications with a visible UI.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const apps = await listApps();
    return { content: [{ type: "text", text: JSON.stringify({ apps }, null, 2) }] };
  }
);

server.registerTool(
  "list_tabs",
  {
    description: `List open tabs in a browser or terminal. Returns index, title, and URL (browsers only). Supported: ${SUPPORTED_TAB_APPS.join(", ")}.`,
    inputSchema: {
      app_name: z.string().describe("App to list tabs for (e.g. 'Brave Browser', 'iTerm2')"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ app_name }) => {
    assertNotBlocked(app_name);
    const tabs = await listTabs(app_name);
    return { content: [{ type: "text", text: JSON.stringify({ tabs }, null, 2) }] };
  }
);

server.registerTool(
  "take_screenshot",
  {
    description: "Capture a screenshot of a specific display. Returns the image.",
    inputSchema: {
      display: z.number().int().min(1).default(1).describe("Display number (1 = main)."),
      save_path: z.string().optional().describe("Optional absolute path to save the screenshot. Ephemeral if omitted."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ display, save_path }) => {
    const { base64, savedTo } = await captureDisplay(display, save_path);
    return {
      content: [
        { type: "image", data: base64, mimeType: "image/png" },
        ...(savedTo ? [{ type: "text" as const, text: `Saved to: ${savedTo}` }] : []),
      ],
    };
  }
);

server.registerTool(
  "switch_app",
  {
    description: "Bring an application to the foreground.",
    inputSchema: {
      app_name: z.string().describe("Name of the application to activate"),
    },
  },
  async ({ app_name }) => {
    assertNotBlocked(app_name);
    await activateApp(app_name);
    return { content: [{ type: "text", text: `Switched to ${app_name}` }] };
  }
);

server.registerTool(
  "switch_tab",
  {
    description: "Switch to a tab in a browser or terminal. Matches by URL substring, then title substring, then index.",
    inputSchema: {
      app_name: z.string().describe("App containing the tab"),
      tab: z.union([z.string(), z.number()]).describe("URL substring, title substring, or tab index"),
    },
  },
  async ({ app_name, tab }) => {
    assertNotBlocked(app_name);
    await switchTab(app_name, tab);
    return { content: [{ type: "text", text: `Switched to tab '${tab}' in ${app_name}` }] };
  }
);

server.registerTool(
  "screenshot_app",
  {
    description: "Switch to an app, take a screenshot, then restore the previous app.",
    inputSchema: {
      app_name: z.string().describe("Application to screenshot"),
      display: z.number().int().min(1).default(1).describe("Display number to capture after switching."),
      save_path: z.string().optional().describe("Optional path to save the screenshot. Ephemeral if omitted."),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ app_name, display, save_path }) => {
    assertNotBlocked(app_name);
    const previous = await getFrontmostApp().catch(() => undefined);
    try {
      await activateApp(app_name);
      await new Promise(r => setTimeout(r, 600));
      const { base64, savedTo } = await captureDisplay(display, save_path);
      return {
        content: [
          { type: "image", data: base64, mimeType: "image/png" },
          ...(savedTo ? [{ type: "text" as const, text: `Saved to: ${savedTo}` }] : []),
        ],
      };
    } finally {
      if (previous) activateApp(previous).catch(() => {});
    }
  }
);

// ── Control tools ───────────────────────────────────────────────────────────

server.registerTool(
  "click",
  {
    description: "Left-click at the given screen coordinates.",
    inputSchema: {
      x: z.number().int().describe("X coordinate in screen pixels"),
      y: z.number().int().describe("Y coordinate in screen pixels"),
    },
  },
  async ({ x, y }) => {
    await click(x, y);
    return { content: [{ type: "text", text: `Clicked at (${x}, ${y})` }] };
  }
);

server.registerTool(
  "double_click",
  {
    description: "Double-click at the given screen coordinates.",
    inputSchema: {
      x: z.number().int().describe("X coordinate in screen pixels"),
      y: z.number().int().describe("Y coordinate in screen pixels"),
    },
  },
  async ({ x, y }) => {
    await doubleClick(x, y);
    return { content: [{ type: "text", text: `Double-clicked at (${x}, ${y})` }] };
  }
);

server.registerTool(
  "right_click",
  {
    description: "Right-click (secondary click) at the given screen coordinates.",
    inputSchema: {
      x: z.number().int().describe("X coordinate in screen pixels"),
      y: z.number().int().describe("Y coordinate in screen pixels"),
    },
  },
  async ({ x, y }) => {
    await rightClick(x, y);
    return { content: [{ type: "text", text: `Right-clicked at (${x}, ${y})` }] };
  }
);

server.registerTool(
  "type_text",
  {
    description: "Type a string of text as keyboard input into the currently focused element.",
    inputSchema: {
      text: z.string().describe("Text to type"),
    },
  },
  async ({ text }) => {
    await typeText(text);
    return { content: [{ type: "text", text: `Typed: ${text}` }] };
  }
);

server.registerTool(
  "key_press",
  {
    description: "Press a key or key combination. Examples: 'return', 'escape', 'cmd+c', 'cmd+shift+n', 'tab', 'cmd+a'.",
    inputSchema: {
      combo: z.string().describe("Key or combo to press. Modifiers: cmd, shift, option/opt/alt, ctrl. Separated by +."),
    },
  },
  async ({ combo }) => {
    await keyPress(combo);
    return { content: [{ type: "text", text: `Pressed: ${combo}` }] };
  }
);

server.registerTool(
  "scroll",
  {
    description: "Scroll at the given screen coordinates.",
    inputSchema: {
      x: z.number().int().describe("X coordinate to scroll at"),
      y: z.number().int().describe("Y coordinate to scroll at"),
      direction: z.enum(["up", "down", "left", "right"]).describe("Scroll direction"),
      amount: z.number().int().min(1).default(3).describe("Number of lines to scroll"),
    },
  },
  async ({ x, y, direction, amount }) => {
    await scroll(x, y, direction, amount);
    return { content: [{ type: "text", text: `Scrolled ${direction} ${amount} lines at (${x}, ${y})` }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
