import preact from "@preact/preset-vite";
import { defineConfig } from "vitest/config";
import monkey from "vite-plugin-monkey";

export default defineConfig({
  build: {
    // Greasy Fork requires bundled userscripts to remain readable.
    minify: false,
    rollupOptions: {
      output: {
        banner: `/*
 * Bundled third-party libraries:
 * - Preact 10.29.7: https://github.com/preactjs/preact
 * - @preact/signals 2.10.0: https://github.com/preactjs/signals
 * - lucide-preact 1.27.0: https://github.com/lucide-icons/lucide
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
        "run-at": "document-start",
        noframes: true,
      },
      build: {
        fileName: "bilibili-music-player.user.js",
        metaFileName: true,
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
