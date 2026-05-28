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
  parseBlockedApps,
  isAppBlocked,
} from "@mcp-desktop/core";

const BLOCKED_APPS = parseBlockedApps(process.env.BLOCKED_APPS);

function assertNotBlocked(appName: string): void {
  if (isAppBlocked(appName, BLOCKED_APPS)) {
    throw new Error(`'${appName}' is in the blocked list and cannot be accessed.`);
  }
}

const server = new McpServer({ name: "mcp-desktop-screenshot", version: "0.1.0" });

server.registerTool(
  "list_displays",
  {
    description: "List available displays with their numbers. Use the display number with take_screenshot or screenshot_app.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const displays = await probeDisplays();
    return {
      content: [{ type: "text", text: JSON.stringify({ displays, total: displays.length }, null, 2) }],
    };
  }
);

server.registerTool(
  "list_apps",
  {
    description: "List currently running applications that have a visible UI. Use app names with screenshot_app, switch_app, or list_tabs.",
    inputSchema: {},
    annotations: { readOnlyHint: true },
  },
  async () => {
    const apps = await listApps();
    return {
      content: [{ type: "text", text: JSON.stringify({ apps }, null, 2) }],
    };
  }
);

server.registerTool(
  "list_tabs",
  {
    description: `List open tabs in a browser or terminal app. Returns index, title, and URL (browsers only). Supported apps: ${SUPPORTED_TAB_APPS.join(", ")}.`,
    inputSchema: {
      app_name: z.string().describe("App to list tabs for (e.g. 'Brave Browser', 'iTerm2')"),
    },
    annotations: { readOnlyHint: true },
  },
  async ({ app_name }) => {
    assertNotBlocked(app_name);
    const tabs = await listTabs(app_name);
    return {
      content: [{ type: "text", text: JSON.stringify({ tabs }, null, 2) }],
    };
  }
);

server.registerTool(
  "take_screenshot",
  {
    description: "Capture a screenshot of a specific display. Returns the image. Use list_displays first to find display numbers.",
    inputSchema: {
      display: z.number().int().min(1).default(1).describe("Display number (1 = main). Use list_displays to see all available displays."),
      save_path: z.string().optional().describe("Optional absolute path to save the screenshot (e.g. /Users/you/Desktop/shot.png). If omitted the screenshot is ephemeral."),
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
    description: "Bring an application to the foreground. Use list_apps to see available app names.",
    inputSchema: {
      app_name: z.string().describe("Name of the application to activate (e.g. 'Brave Browser', 'Terminal', 'Cursor')"),
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
    description: "Switch to a specific tab in a browser or terminal. Matches by URL substring first, then title substring, then index. Use list_tabs to see available tabs.",
    inputSchema: {
      app_name: z.string().describe("App containing the tab (e.g. 'Brave Browser', 'iTerm2')"),
      tab: z.union([z.string(), z.number()]).describe("Tab to switch to: URL substring, title substring, or tab index from list_tabs"),
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
    description: "Switch to an app, take a screenshot of the specified display, then restore the previous app. Returns the image.",
    inputSchema: {
      app_name: z.string().describe("Name of the application to screenshot (e.g. 'Brave Browser', 'Terminal')"),
      display: z.number().int().min(1).default(1).describe("Display number to capture after switching. Use list_displays to find the right one."),
      save_path: z.string().optional().describe("Optional absolute path to save the screenshot. If omitted the screenshot is ephemeral."),
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

const transport = new StdioServerTransport();
await server.connect(transport);
