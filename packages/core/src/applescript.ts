import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

export async function runAppleScript(script: string): Promise<string> {
  const tmp = join(tmpdir(), `mcp-as-${Date.now()}-${Math.random().toString(36).slice(2)}.applescript`);
  try {
    await writeFile(tmp, script, "utf8");
    const { stdout } = await execFileAsync("osascript", [tmp]);
    return stdout.trim();
  } finally {
    await unlink(tmp).catch(() => {});
  }
}
