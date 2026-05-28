import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, unlink, mkdir, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const execFileAsync = promisify(execFile);

export interface CaptureResult {
  base64: string;
  savedTo?: string;
}

export interface DisplayInfo {
  display: number;
  note: string;
}

export async function captureDisplay(display: number, savePath?: string): Promise<CaptureResult> {
  const tmp = join(tmpdir(), `mcp-screenshot-${Date.now()}-${Math.random().toString(36).slice(2)}.png`);

  try {
    await execFileAsync("screencapture", ["-D", String(display), "-x", tmp]);
    const data = await readFile(tmp);
    const base64 = data.toString("base64");

    let savedTo: string | undefined;
    if (savePath) {
      await mkdir(dirname(savePath), { recursive: true });
      await copyFile(tmp, savePath);
      savedTo = savePath;
    }

    return { base64, savedTo };
  } finally {
    if (existsSync(tmp)) await unlink(tmp).catch(() => {});
  }
}

export async function probeDisplays(): Promise<DisplayInfo[]> {
  const displays: DisplayInfo[] = [];

  for (let i = 1; i <= 8; i++) {
    const tmp = join(tmpdir(), `mcp-probe-${i}-${Date.now()}.png`);
    try {
      await execFileAsync("screencapture", ["-D", String(i), "-x", tmp], { timeout: 3000 });
      const info = await stat(tmp).catch(() => null);
      if (info && info.size > 1000) {
        displays.push({ display: i, note: i === 1 ? "main display" : `display ${i}` });
        await unlink(tmp).catch(() => {});
      } else {
        await unlink(tmp).catch(() => {});
        break;
      }
    } catch {
      await unlink(tmp).catch(() => {});
      break;
    }
  }

  return displays;
}
