// ==UserScript==
// @name               Bilibili Music Player
// @name:en            Bilibili Music Player
// @name:zh-CN         Bilibili 音乐播放器
// @name:zh-TW         Bilibili 音樂播放器
// @namespace          bilibili-music-player
// @version            0.1.7
// @author             Korltex
// @description        A music playlist player for Bilibili videos.
// @description:en     A music playlist player for Bilibili videos.
// @description:zh-CN  将喜欢的 Bilibili 视频整理成可播放的音乐歌单。
// @license            MIT
// @match              https://www.bilibili.com/video/*
// @require            https://cdn.jsdelivr.net/npm/preact@10.29.7/dist/preact.min.umd.js#sha256=vWCK8okVrPZcOCL+DYDSHpswNp61X5Ab29I+Khh2Erk=
// @require            https://cdn.jsdelivr.net/npm/preact@10.29.7/hooks/dist/hooks.umd.js#sha256=XCkjjl3JnfMG1/f/8DhZGjl8/Pq7Wfgfve9D1nCqBWY=
// @require            https://cdn.jsdelivr.net/npm/preact@10.29.7/jsx-runtime/dist/jsxRuntime.umd.js#sha256=viwpXhBqgKvdcE++nq539c5Fuc8yTKsXTqZ1NvV1daY=
// @require            https://cdn.jsdelivr.net/npm/@preact/signals-core@1.14.4/dist/signals-core.min.js#sha256=272lpSHRyEu8adxda4dUsDbLLhWPBjIb4l+e204591Y=
// @require            https://cdn.jsdelivr.net/npm/@preact/signals@2.10.0/dist/signals.min.js#sha256=JS4u3lzVw2ZCtlep9sZnYCqm4AD8QL23vtXXUzwC+3c=
// @grant              GM_addValueChangeListener
// @grant              GM_getValue
// @grant              GM_removeValueChangeListener
// @grant              GM_setValue
// @grant              unsafeWindow
// @run-at             document-start
// @noframes
// ==/UserScript==