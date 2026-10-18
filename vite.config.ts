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
        name: {
          "": "Bilibili Music Player",
          en: "Bilibili Music Player",
          "zh-CN": "Bilibili 音乐播放器",
          "zh-TW": "Bilibili 音樂播放器",
        },

        description: {
          "": "A music playlist player for Bilibili videos.",
          en: "A music playlist player for Bilibili videos.",
          "zh-CN": "将喜欢的 Bilibili 视频整理成可播放的音乐歌单。",
          "zh-TW": "將喜歡的 Bilibili 影片整理成可播放的音樂歌單。",
        },

        namespace: "bilibili-music-player",
        author: "Korltex",
        license: "MIT",
        match: [
          // 首页：只挂悬浮按钮管理歌单（页面没有播放器，点歌单里的歌曲会导航到视频页）。
          // `@match` 的 path 是「路径 + 查询串」一起匹配（见 MDN Match patterns），
          // 所以根路径必须同时列出无查询串与 `?*` 两种形式，否则 `/?spm_id_from=...`
          // 这类带跟踪参数的首页不会被注入；`#` 片段不参与匹配，无需另列。
          "https://www.bilibili.com/*",
          // 专题/活动页（拜年纪等）：播放器内联渲染在页面里，当前视频由 `?bvid=` 指定。
          // 是否真正挂载由 `page-route.ts` 再按「带合法 bvid」判定。
          "https://www.bilibili.com/festival/*",
          "https://space.bilibili.com/*",
        ],
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
