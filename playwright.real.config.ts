import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const browserCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter((path): path is string => Boolean(path));

const executablePath = browserCandidates.find(existsSync);

export default defineConfig({
  testDir: "./tests/real",
  outputDir: "./test-results-real",
  timeout: 60_000,
  use: {
    bypassCSP: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : undefined,
  },
});
