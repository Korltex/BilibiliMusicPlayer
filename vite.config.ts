import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import monkey from "vite-plugin-monkey";
import runtimeLibraries from "./scripts/userscript-runtime.json";

const projectFile = (relativePath: string): string =>
  fileURLToPath(new URL(relativePath, import.meta.url));

const requireUrls = runtimeLibraries.map(({ url, file }) => {
  const digest = createHash("sha256")
    .update(readFileSync(projectFile(file)))
    .digest("base64");
  return `${url}#sha256=${digest}`;
});

const externalGlobals = Object.fromEntries(
  runtimeLibraries.map((library) => [library.module, library.global]),
);

const thirdPartyNotices = readFileSync(
  projectFile("THIRD_PARTY_NOTICES.txt"),
  "utf8",
)
  .trim()
  .split(/\r?\n/)
  .map((line) => (line ? ` * ${line}` : " *"))
  .join("\n");

function readableCssOutput(): Plugin {
  const stringAssignment =
    /\b(var|const)\s+([A-Za-z_$][\w$]*)\s*=\s*("(?:\\.|[^"\\])*");/g;

  return {
    name: "readable-userscript-css",
    enforce: "post",
    generateBundle(_options, bundle) {
      let replacements = 0;

      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;

        output.code = output.code.replace(
          stringAssignment,
          (assignment, declaration, name, literal) => {
            const value = JSON.parse(literal) as string;
            if (!value.includes("#bilibili-music-player-root")) {
              return assignment;
            }

            replacements += 1;
            const lines = value
              .replace(/\r\n/g, "\n")
              .split("\n")
              .map((line) => `\t\t${JSON.stringify(line)}`)
              .join(",\n");
            return `${declaration} ${name} = [\n${lines}\n\t].join("\\n");`;
          },
        );
      }

      if (replacements !== 1) {
        this.error(
          `Expected one embedded application stylesheet, found ${replacements}`,
        );
      }
    },
  };
}

export default defineConfig({
  build: {
    // Greasy Fork requires bundled userscripts to remain readable.
    minify: false,
    cssMinify: false,
    rollupOptions: {
      output: {
        banner: `/*!
${thirdPartyNotices}
 */`,
      },
    },
  },
  plugins: [
    preact(),
    monkey({
      entry: "src/entry.tsx",
      userscript: {
        name: "Bilibili 音乐播放器",
        namespace: "bilibili-music-player",
        description:
          "在 Bilibili 视频页面中控制原生播放器、管理音乐歌单并可选纯音频模式",
        author: "Korltex",
        license: "MIT",
        match: ["https://www.bilibili.com/video/*"],
        require: requireUrls,
        "run-at": "document-start",
        noframes: true,
      },
      build: {
        externalGlobals,
        fileName: "bilibili-music-player.user.js",
        metaFileName: true,
      },
    }),
    readableCssOutput(),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
