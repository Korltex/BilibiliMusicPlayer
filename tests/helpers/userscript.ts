import { readFileSync } from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";

interface RuntimeLibrary {
  file: string;
}

const runtimeLibraries = JSON.parse(
  readFileSync(path.resolve("scripts/userscript-runtime.json"), "utf8"),
) as RuntimeLibrary[];

const runtimeSources = runtimeLibraries.map(({ file }) =>
  readFileSync(path.resolve(file), "utf8"),
);
const userscriptSource = readFileSync(
  path.resolve("dist/bilibili-music-player.user.js"),
  "utf8",
);

export const BUILT_USERSCRIPT = [...runtimeSources, userscriptSource].join(
  "\n;\n",
);

export async function injectBuiltUserscript(page: Page): Promise<void> {
  await page.addScriptTag({ content: BUILT_USERSCRIPT });
}
