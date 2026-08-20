// ==UserScript==
// @name         Bilibili 音乐播放器
// @namespace    bilibili-music-player
// @version      0.1.6
// @author       Korltex
// @description  在 Bilibili 视频页面中控制原生播放器、管理音乐歌单并可选纯音频模式
// @license      MIT
// @match        https://www.bilibili.com/video/*
// @require      https://cdn.jsdelivr.net/npm/preact@10.29.7/dist/preact.min.umd.js#sha256=vWCK8okVrPZcOCL+DYDSHpswNp61X5Ab29I+Khh2Erk=
// @require      https://cdn.jsdelivr.net/npm/preact@10.29.7/hooks/dist/hooks.umd.js#sha256=XCkjjl3JnfMG1/f/8DhZGjl8/Pq7Wfgfve9D1nCqBWY=
// @require      https://cdn.jsdelivr.net/npm/preact@10.29.7/jsx-runtime/dist/jsxRuntime.umd.js#sha256=viwpXhBqgKvdcE++nq539c5Fuc8yTKsXTqZ1NvV1daY=
// @require      https://cdn.jsdelivr.net/npm/@preact/signals-core@1.14.4/dist/signals-core.min.js#sha256=272lpSHRyEu8adxda4dUsDbLLhWPBjIb4l+e204591Y=
// @require      https://cdn.jsdelivr.net/npm/@preact/signals@2.10.0/dist/signals.min.js#sha256=JS4u3lzVw2ZCtlep9sZnYCqm4AD8QL23vtXXUzwC+3c=
// @grant        GM_addValueChangeListener
// @grant        GM_getValue
// @grant        GM_removeValueChangeListener
// @grant        GM_setValue
// @grant        unsafeWindow
// @run-at       document-start
// @noframes
// ==/UserScript==

/*!
* Third-party software included in or loaded by Bilibili Music Player
* ==================================================================
*
* Preact 10.29.7 - https://github.com/preactjs/preact
*
* The MIT License (MIT)
*
* Copyright (c) 2015-present Jason Miller
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*
* @preact/signals 2.10.0 and @preact/signals-core 1.14.4
* https://github.com/preactjs/signals
*
* The MIT License (MIT)
*
* Copyright (c) 2022-present Preact Team
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*
* Lucide Icons 1.27.0 - https://github.com/lucide-icons/lucide
*
* ISC License
*
* Copyright (c) 2026 Lucide Icons and Contributors
*
* Permission to use, copy, modify, and/or distribute this software for any
* purpose with or without fee is hereby granted, provided that the above
* copyright notice and this permission notice appear in all copies.
*
* THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
* WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
* MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
* ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
* WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
* ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
* OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
*
* Selected Lucide icons are derived from the Feather project.
*
* The MIT License (MIT)
*
* Copyright (c) 2013-present Cole Bemis
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
*/
(function(preact, preact_hooks, preact_jsx_runtime, _preact_signals) {
	"use strict";
	var styles_default = [
		":host {",
		"  all: initial;",
		"  color-scheme: dark;",
		"}",
		"",
		":host([data-web-fullscreen]) {",
		"  display: none !important;",
		"}",
		"",
		"*,",
		"*::before,",
		"*::after {",
		"  box-sizing: border-box;",
		"}",
		"",
		"button,",
		"input,",
		"select {",
		"  font: inherit;",
		"  letter-spacing: 0;",
		"}",
		"",
		"button {",
		"  color: inherit;",
		"}",
		"",
		"#bilibili-music-player-root {",
		"  --bg: #17181c;",
		"  --surface: #22242a;",
		"  --surface-hover: #2a2d34;",
		"  --border: #383b44;",
		"  --text: #f4f4f5;",
		"  --muted: #a8abb4;",
		"  --accent: #fb7299;",
		"  --accent-hover: #ff8bad;",
		"  --cyan: #36c5b7;",
		"  --danger: #ff6b6b;",
		"  position: fixed;",
		"  inset: 0;",
		"  z-index: 2147483647;",
		"  pointer-events: none;",
		"  font-family:",
		"    Inter,",
		"    \"Segoe UI\",",
		"    \"Microsoft YaHei\",",
		"    system-ui,",
		"    -apple-system,",
		"    sans-serif;",
		"  font-size: 14px;",
		"  line-height: 1.4;",
		"  color: var(--text);",
		"}",
		"",
		".floating-button,",
		".player-panel,",
		".minimal-player {",
		"  pointer-events: auto;",
		"}",
		"",
		".floating-button {",
		"  position: fixed;",
		"  right: 24px;",
		"  bottom: 76px;",
		"  display: grid;",
		"  width: 48px;",
		"  height: 48px;",
		"  place-items: center;",
		"  border: 1px solid #ff9bb8;",
		"  border-radius: 50%;",
		"  color: #fff;",
		"  background: var(--accent);",
		"  box-shadow: 0 10px 28px rgb(0 0 0 / 30%);",
		"  cursor: pointer;",
		"  touch-action: none;",
		"  user-select: none;",
		"}",
		"",
		".player-panel {",
		"  position: fixed;",
		"  right: 20px;",
		"  bottom: 20px;",
		"  display: flex;",
		"  width: min(400px, calc(100vw - 24px));",
		"  max-height: min(720px, calc(100vh - 24px));",
		"  flex-direction: column;",
		"  overflow: hidden;",
		"  border: 1px solid var(--border);",
		"  border-radius: 8px;",
		"  background: var(--bg);",
		"  box-shadow: 0 18px 60px rgb(0 0 0 / 42%);",
		"}",
		"",
		".minimal-player {",
		"  position: fixed;",
		"  right: 20px;",
		"  bottom: 20px;",
		"  display: flex;",
		"  width: min(396px, calc(100vw - 24px));",
		"  height: 56px;",
		"  align-items: center;",
		"  gap: 2px;",
		"  padding: 0 6px;",
		"  overflow: visible;",
		"  border: 1px solid var(--border);",
		"  border-radius: 10px;",
		"  background: var(--bg);",
		"  box-shadow: 0 12px 36px rgb(0 0 0 / 38%);",
		"  pointer-events: auto;",
		"  touch-action: none;",
		"}",
		"",
		".minimal-now-playing {",
		"  min-width: 0;",
		"  width: auto;",
		"  flex: 1 1 84px;",
		"  cursor: move;",
		"  user-select: none;",
		"}",
		"",
		".minimal-now-playing strong,",
		".minimal-now-playing span {",
		"  display: block;",
		"  overflow: hidden;",
		"  text-overflow: ellipsis;",
		"  white-space: nowrap;",
		"}",
		"",
		".minimal-now-playing strong {",
		"  font-size: 12px;",
		"}",
		"",
		".minimal-now-playing span {",
		"  color: var(--muted);",
		"  font-size: 11px;",
		"}",
		"",
		".minimal-player > .minimal-action-button {",
		"  width: 26px;",
		"  height: 26px;",
		"}",
		"",
		".minimal-interaction-prompt {",
		"  position: absolute;",
		"  left: 0;",
		"  width: 100%;",
		"  min-height: 32px;",
		"  border: 1px solid var(--accent);",
		"  border-radius: 8px;",
		"  color: var(--text);",
		"  background: var(--surface);",
		"  box-shadow: 0 8px 24px rgb(0 0 0 / 32%);",
		"  cursor: pointer;",
		"}",
		"",
		".minimal-interaction-prompt.above {",
		"  bottom: calc(100% + 6px);",
		"}",
		"",
		".minimal-interaction-prompt.below {",
		"  top: calc(100% + 6px);",
		"}",
		"",
		".minimal-player :focus-visible {",
		"  outline: 2px solid var(--accent);",
		"  outline-offset: 2px;",
		"}",
		"",
		".panel-header,",
		".playlist-toolbar,",
		".transport,",
		".editor-heading,",
		".inline-form {",
		"  display: flex;",
		"  align-items: center;",
		"}",
		"",
		".panel-header {",
		"  min-height: 48px;",
		"  justify-content: space-between;",
		"  padding: 0 12px 0 14px;",
		"  border-bottom: 1px solid var(--border);",
		"  cursor: move;",
		"  touch-action: none;",
		"  user-select: none;",
		"}",
		"",
		".brand {",
		"  display: flex;",
		"  min-width: 0;",
		"  align-items: center;",
		"  gap: 8px;",
		"}",
		"",
		".header-actions {",
		"  display: flex;",
		"  flex: 0 0 auto;",
		"  align-items: center;",
		"  gap: 2px;",
		"}",
		"",
		".brand-icon {",
		"  display: grid;",
		"  width: 26px;",
		"  height: 26px;",
		"  place-items: center;",
		"  border-radius: 6px;",
		"  color: #fff;",
		"  background: var(--accent);",
		"}",
		"",
		".brand strong {",
		"  font-size: 14px;",
		"}",
		"",
		".version {",
		"  color: var(--muted);",
		"  font-size: 11px;",
		"}",
		"",
		".icon-button,",
		".row-action {",
		"  display: inline-grid;",
		"  flex: 0 0 auto;",
		"  place-items: center;",
		"  border: 0;",
		"  background: transparent;",
		"  cursor: pointer;",
		"}",
		"",
		".icon-button {",
		"  width: 34px;",
		"  height: 34px;",
		"  border-radius: 6px;",
		"  color: var(--muted);",
		"}",
		"",
		".icon-button:hover:not(:disabled),",
		".row-action:hover:not(:disabled) {",
		"  color: var(--text);",
		"  background: var(--surface-hover);",
		"}",
		"",
		".icon-button:disabled,",
		".add-current-button:disabled,",
		".current-time-button:disabled {",
		"  cursor: not-allowed;",
		"  opacity: 0.4;",
		"}",
		"",
		".icon-button.accent {",
		"  color: var(--accent);",
		"}",
		"",
		".audio-mode-button.detecting {",
		"  color: var(--accent);",
		"  animation: audio-mode-pulse 1.4s ease-in-out infinite;",
		"}",
		"",
		".audio-mode-button.active {",
		"  color: var(--cyan);",
		"  background: rgb(54 197 183 / 12%);",
		"}",
		"",
		".audio-mode-button.fallback {",
		"  color: var(--danger);",
		"  background: rgb(255 107 107 / 10%);",
		"}",
		"",
		"@keyframes audio-mode-pulse {",
		"  50% {",
		"    color: var(--cyan);",
		"    background: rgb(54 197 183 / 10%);",
		"  }",
		"}",
		"",
		"@media (prefers-reduced-motion: reduce) {",
		"  .audio-mode-button.detecting {",
		"    animation: none;",
		"  }",
		"}",
		"",
		".danger:hover:not(:disabled) {",
		"  color: var(--danger);",
		"}",
		"",
		".now-playing {",
		"  display: flex;",
		"  min-height: 82px;",
		"  align-items: center;",
		"  gap: 12px;",
		"  padding: 12px 14px 8px;",
		"}",
		"",
		".cover {",
		"  display: grid;",
		"  width: 58px;",
		"  height: 58px;",
		"  flex: 0 0 auto;",
		"  place-items: center;",
		"  overflow: hidden;",
		"  border: 1px solid var(--border);",
		"  border-radius: 6px;",
		"  color: var(--cyan);",
		"  background: var(--surface);",
		"}",
		"",
		".cover img {",
		"  width: 100%;",
		"  height: 100%;",
		"  object-fit: cover;",
		"}",
		"",
		".now-playing-copy {",
		"  display: flex;",
		"  min-width: 0;",
		"  flex: 1;",
		"  flex-direction: column;",
		"  gap: 2px;",
		"}",
		"",
		".now-playing-copy strong,",
		".track-copy strong {",
		"  overflow: hidden;",
		"  text-overflow: ellipsis;",
		"  white-space: nowrap;",
		"}",
		"",
		".now-playing-copy strong {",
		"  font-size: 15px;",
		"}",
		"",
		".now-playing-copy > span,",
		".track-copy span,",
		".time-row,",
		".track-duration {",
		"  color: var(--muted);",
		"  font-size: 12px;",
		"}",
		"",
		".playlist-context-chip {",
		"  display: inline-flex;",
		"  width: fit-content;",
		"  max-width: 100%;",
		"  height: 18px;",
		"  align-items: center;",
		"  border: 1px solid rgb(251 114 153 / 55%);",
		"  border-radius: 999px;",
		"  padding: 0 6px;",
		"  color: var(--accent);",
		"  background: rgb(251 114 153 / 8%);",
		"  font-size: 11px;",
		"  line-height: 16px;",
		"  white-space: nowrap;",
		"  cursor: pointer;",
		"}",
		"",
		".playlist-context-chip:hover {",
		"  color: var(--text);",
		"  background: rgb(251 114 153 / 16%);",
		"}",
		"",
		".progress-area {",
		"  padding: 2px 14px 0;",
		"}",
		"",
		".range {",
		"  width: 100%;",
		"  height: 18px;",
		"  margin: 0;",
		"  accent-color: var(--accent);",
		"  cursor: pointer;",
		"}",
		"",
		".time-row {",
		"  display: flex;",
		"  justify-content: space-between;",
		"  margin-top: -2px;",
		"  font-variant-numeric: tabular-nums;",
		"}",
		"",
		".transport {",
		"  min-height: 54px;",
		"  justify-content: center;",
		"  gap: 7px;",
		"  padding: 4px 12px 8px;",
		"}",
		"",
		".play-button {",
		"  display: grid;",
		"  width: 42px;",
		"  height: 42px;",
		"  place-items: center;",
		"  border: 0;",
		"  border-radius: 50%;",
		"  color: #fff;",
		"  background: var(--accent);",
		"  cursor: pointer;",
		"}",
		"",
		".play-button:hover {",
		"  background: var(--accent-hover);",
		"}",
		"",
		".play-button:disabled {",
		"  cursor: not-allowed;",
		"  opacity: 0.4;",
		"}",
		"",
		".transport-minimal {",
		"  min-width: 0;",
		"  flex: 0 0 auto;",
		"  gap: 0;",
		"  padding: 0;",
		"}",
		"",
		".transport-minimal .icon-button {",
		"  width: 26px;",
		"  height: 26px;",
		"}",
		"",
		".transport-minimal .icon-button svg {",
		"  width: 16px;",
		"  height: 16px;",
		"}",
		"",
		".transport-minimal .play-button {",
		"  position: relative;",
		"  z-index: 1;",
		"  width: 36px;",
		"  height: 36px;",
		"}",
		"",
		".transport-minimal .play-button svg {",
		"  width: 18px;",
		"  height: 18px;",
		"}",
		"",
		".transport-minimal .volume-control {",
		"  width: 68px;",
		"}",
		"",
		".transport-minimal .volume-range {",
		"  width: 42px;",
		"}",
		"",
		".circular-play-control {",
		"  position: relative;",
		"  display: grid;",
		"  width: 40px;",
		"  height: 40px;",
		"  place-items: center;",
		"}",
		"",
		".circular-progress {",
		"  position: absolute;",
		"  inset: 0;",
		"  width: 40px;",
		"  height: 40px;",
		"  transform: rotate(-90deg);",
		"  transform-origin: center;",
		"  pointer-events: none;",
		"}",
		"",
		".circular-progress-track,",
		".circular-progress-value {",
		"  fill: none;",
		"  stroke-width: 2;",
		"}",
		"",
		".circular-progress-track {",
		"  stroke: var(--border);",
		"}",
		"",
		".circular-progress-value {",
		"  stroke-dasharray: var(--play-progress) 100;",
		"  stroke: var(--accent);",
		"}",
		"",
		".visually-hidden {",
		"  position: absolute;",
		"  width: 1px;",
		"  height: 1px;",
		"  overflow: hidden;",
		"  clip: rect(0 0 0 0);",
		"  clip-path: inset(50%);",
		"  white-space: nowrap;",
		"}",
		"",
		"button:focus-visible,",
		"input:focus-visible,",
		"select:focus-visible {",
		"  outline: 2px solid var(--accent);",
		"  outline-offset: 2px;",
		"}",
		"",
		".volume-control {",
		"  display: flex;",
		"  width: 92px;",
		"  align-items: center;",
		"}",
		"",
		".volume-range {",
		"  width: 56px;",
		"}",
		"",
		".status-message {",
		"  display: block;",
		"  width: calc(100% - 28px);",
		"  min-height: 30px;",
		"  margin: 0 14px 8px;",
		"  overflow: hidden;",
		"  padding: 5px 8px;",
		"  border: 1px solid var(--border);",
		"  border-radius: 6px;",
		"  color: var(--muted);",
		"  background: var(--surface);",
		"  text-align: left;",
		"  text-overflow: ellipsis;",
		"  white-space: nowrap;",
		"}",
		"",
		".status-message.actionable {",
		"  border-color: var(--accent);",
		"  color: var(--text);",
		"  cursor: pointer;",
		"}",
		"",
		".status-message.fallback {",
		"  border-color: var(--danger);",
		"  color: var(--text);",
		"}",
		"",
		".playlist-toolbar {",
		"  min-height: 44px;",
		"  gap: 5px;",
		"  padding: 6px 10px 6px 14px;",
		"  border-top: 1px solid var(--border);",
		"  border-bottom: 1px solid var(--border);",
		"}",
		"",
		".playlist-toolbar select {",
		"  min-width: 0;",
		"  height: 32px;",
		"  flex: 1;",
		"  border: 1px solid var(--border);",
		"  border-radius: 6px;",
		"  padding: 0 30px 0 9px;",
		"  color: var(--text);",
		"  background: var(--surface);",
		"}",
		"",
		".inline-form {",
		"  gap: 6px;",
		"  padding: 8px 14px 0;",
		"}",
		"",
		".inline-form input,",
		".track-editor input {",
		"  min-width: 0;",
		"  height: 34px;",
		"  border: 1px solid var(--border);",
		"  border-radius: 6px;",
		"  padding: 0 9px;",
		"  color: var(--text);",
		"  outline: none;",
		"  background: var(--surface);",
		"}",
		"",
		".inline-form input {",
		"  flex: 1;",
		"}",
		"",
		".inline-form input:focus,",
		".track-editor input:focus,",
		".playlist-toolbar select:focus {",
		"  border-color: var(--accent);",
		"}",
		"",
		".add-current-button,",
		".save-track-button,",
		".current-time-button {",
		"  display: flex;",
		"  align-items: center;",
		"  justify-content: center;",
		"  border: 0;",
		"  border-radius: 6px;",
		"  cursor: pointer;",
		"}",
		"",
		".add-current-button {",
		"  min-height: 36px;",
		"  margin: 10px 14px;",
		"  gap: 7px;",
		"  color: #fff;",
		"  background: var(--accent);",
		"}",
		"",
		".add-current-button:hover:not(:disabled),",
		".save-track-button:hover {",
		"  background: var(--accent-hover);",
		"}",
		"",
		".track-editor {",
		"  display: flex;",
		"  flex-direction: column;",
		"  gap: 8px;",
		"  padding: 10px 14px 12px;",
		"  border-top: 1px solid var(--border);",
		"  border-bottom: 1px solid var(--border);",
		"  background: #1c1e23;",
		"}",
		"",
		".editor-heading {",
		"  min-height: 28px;",
		"  justify-content: space-between;",
		"}",
		"",
		".chapter-field {",
		"  position: relative;",
		"  z-index: 1;",
		"}",
		"",
		".chapter-combobox {",
		"  position: relative;",
		"  display: flex;",
		"  min-width: 0;",
		"  height: 34px;",
		"  border: 1px solid var(--border);",
		"  border-radius: 6px;",
		"  background: var(--surface);",
		"}",
		"",
		".chapter-combobox:focus-within {",
		"  border-color: var(--accent);",
		"}",
		"",
		".track-editor .chapter-combobox input {",
		"  height: 32px;",
		"  flex: 1;",
		"  border: 0;",
		"  padding-right: 2px;",
		"  background: transparent;",
		"}",
		"",
		".chapter-toggle {",
		"  display: grid;",
		"  width: 32px;",
		"  height: 32px;",
		"  flex: 0 0 auto;",
		"  place-items: center;",
		"  border: 0;",
		"  border-radius: 0 5px 5px 0;",
		"  color: var(--muted);",
		"  background: transparent;",
		"  cursor: pointer;",
		"}",
		"",
		".chapter-toggle:hover {",
		"  color: var(--text);",
		"  background: var(--surface-hover);",
		"}",
		"",
		".chapter-toggle svg {",
		"  transition: transform 120ms ease;",
		"}",
		"",
		".chapter-toggle svg.expanded {",
		"  transform: rotate(180deg);",
		"}",
		"",
		".chapter-listbox {",
		"  position: absolute;",
		"  z-index: 2;",
		"  top: calc(100% + 4px);",
		"  right: 0;",
		"  left: 0;",
		"  max-height: 176px;",
		"  overflow-y: auto;",
		"  border: 1px solid var(--border);",
		"  border-radius: 6px;",
		"  padding: 3px;",
		"  background: var(--surface);",
		"  box-shadow: 0 10px 24px rgb(0 0 0 / 38%);",
		"}",
		"",
		".chapter-option {",
		"  display: flex;",
		"  width: 100%;",
		"  min-width: 0;",
		"  min-height: 32px;",
		"  align-items: center;",
		"  justify-content: space-between;",
		"  gap: 12px;",
		"  border: 0;",
		"  border-radius: 4px;",
		"  padding: 6px 7px;",
		"  color: var(--text);",
		"  background: transparent;",
		"  text-align: left;",
		"  cursor: pointer;",
		"}",
		"",
		".chapter-option:hover,",
		".chapter-option.active {",
		"  background: var(--surface-hover);",
		"}",
		"",
		".chapter-option span:first-child {",
		"  overflow: hidden;",
		"  text-overflow: ellipsis;",
		"  white-space: nowrap;",
		"}",
		"",
		".chapter-option span:last-child {",
		"  flex: 0 0 auto;",
		"  color: var(--muted);",
		"  font-size: 12px;",
		"  font-variant-numeric: tabular-nums;",
		"  white-space: nowrap;",
		"}",
		"",
		".track-editor label {",
		"  display: flex;",
		"  min-width: 0;",
		"  flex: 1;",
		"  flex-direction: column;",
		"  gap: 4px;",
		"}",
		"",
		".editor-field {",
		"  display: flex;",
		"  min-width: 0;",
		"  flex-direction: column;",
		"  gap: 4px;",
		"}",
		"",
		".track-editor label > span,",
		".editor-field > label {",
		"  color: var(--muted);",
		"  font-size: 12px;",
		"}",
		"",
		".chapter-combobox {",
		"  position: relative;",
		"  min-width: 0;",
		"}",
		"",
		".chapter-combobox input {",
		"  width: 100%;",
		"  padding-right: 36px;",
		"}",
		"",
		".chapter-toggle {",
		"  position: absolute;",
		"  top: 1px;",
		"  right: 1px;",
		"  display: grid;",
		"  width: 32px;",
		"  height: 32px;",
		"  place-items: center;",
		"  border: 0;",
		"  border-radius: 0 5px 5px 0;",
		"  color: var(--muted);",
		"  background: transparent;",
		"  cursor: pointer;",
		"}",
		"",
		".chapter-toggle:hover,",
		".chapter-toggle:focus-visible {",
		"  color: var(--text);",
		"  background: var(--surface-hover);",
		"  outline: none;",
		"}",
		"",
		".chapter-toggle svg {",
		"  transition: transform 120ms ease;",
		"}",
		"",
		".chapter-toggle.open svg {",
		"  transform: rotate(180deg);",
		"}",
		"",
		".chapter-options {",
		"  position: absolute;",
		"  top: calc(100% + 4px);",
		"  right: 0;",
		"  left: 0;",
		"  z-index: 5;",
		"  min-height: 34px;",
		"  max-height: 184px;",
		"  overflow-y: auto;",
		"  border: 1px solid var(--border);",
		"  border-radius: 6px;",
		"  background: var(--surface);",
		"  box-shadow: 0 10px 26px rgb(0 0 0 / 35%);",
		"}",
		"",
		".chapter-option {",
		"  display: grid;",
		"  width: 100%;",
		"  min-width: 0;",
		"  grid-template-columns: minmax(0, 1fr) auto;",
		"  align-items: center;",
		"  gap: 12px;",
		"  border: 0;",
		"  padding: 8px 10px;",
		"  color: var(--text);",
		"  background: transparent;",
		"  text-align: left;",
		"  cursor: pointer;",
		"}",
		"",
		".chapter-option + .chapter-option {",
		"  border-top: 1px solid rgb(56 59 68 / 65%);",
		"}",
		"",
		".chapter-option:hover,",
		".chapter-option.active {",
		"  background: var(--surface-hover);",
		"}",
		"",
		".chapter-option span:first-child {",
		"  overflow: hidden;",
		"  text-overflow: ellipsis;",
		"  white-space: nowrap;",
		"}",
		"",
		".chapter-option span:last-child {",
		"  color: var(--muted);",
		"  font-size: 12px;",
		"  font-variant-numeric: tabular-nums;",
		"  white-space: nowrap;",
		"}",
		"",
		".time-fields {",
		"  display: flex;",
		"  align-items: flex-end;",
		"  gap: 6px;",
		"}",
		"",
		".current-time-button {",
		"  width: 66px;",
		"  height: 34px;",
		"  flex: 0 0 auto;",
		"  gap: 4px;",
		"  color: var(--text);",
		"  background: var(--surface);",
		"}",
		"",
		".editor-error {",
		"  color: var(--danger);",
		"  font-size: 12px;",
		"}",
		"",
		".save-track-button {",
		"  height: 34px;",
		"  gap: 6px;",
		"  color: #fff;",
		"  background: var(--accent);",
		"}",
		"",
		".track-list {",
		"  min-height: 110px;",
		"  overflow-x: hidden;",
		"  overflow-y: auto;",
		"  overscroll-behavior: contain;",
		"}",
		"",
		".track-row {",
		"  display: grid;",
		"  min-height: 54px;",
		"  grid-template-columns: minmax(0, 1fr) 32px 32px;",
		"  align-items: stretch;",
		"  border-bottom: 1px solid rgb(56 59 68 / 65%);",
		"}",
		"",
		".track-row:hover {",
		"  background: var(--surface);",
		"}",
		"",
		".track-row.active {",
		"  box-shadow: inset 3px 0 var(--accent);",
		"  background: #25242a;",
		"}",
		"",
		".track-main {",
		"  display: grid;",
		"  min-width: 0;",
		"  grid-template-columns: 32px minmax(0, 1fr) auto;",
		"  align-items: center;",
		"  gap: 7px;",
		"  border: 0;",
		"  padding: 7px 5px 7px 11px;",
		"  color: var(--text);",
		"  background: transparent;",
		"  text-align: left;",
		"  cursor: pointer;",
		"}",
		"",
		".track-index {",
		"  display: grid;",
		"  width: 28px;",
		"  place-items: center;",
		"  color: var(--muted);",
		"  font-size: 11px;",
		"  font-variant-numeric: tabular-nums;",
		"}",
		"",
		".track-row.active .track-index {",
		"  color: var(--accent);",
		"}",
		"",
		".track-copy {",
		"  display: flex;",
		"  min-width: 0;",
		"  flex-direction: column;",
		"  gap: 2px;",
		"}",
		"",
		".track-copy strong {",
		"  font-size: 13px;",
		"}",
		"",
		".track-duration {",
		"  padding-left: 6px;",
		"  font-variant-numeric: tabular-nums;",
		"}",
		"",
		".row-action {",
		"  width: 32px;",
		"  min-height: 32px;",
		"  align-self: center;",
		"  border-radius: 5px;",
		"  color: var(--muted);",
		"}",
		"",
		".empty-state {",
		"  display: flex;",
		"  min-height: 118px;",
		"  flex-direction: column;",
		"  align-items: center;",
		"  justify-content: center;",
		"  gap: 7px;",
		"  color: var(--muted);",
		"}",
		"",
		"@media (max-width: 520px) {",
		"  .player-panel {",
		"    right: 12px;",
		"    bottom: 12px;",
		"    max-height: calc(100vh - 24px);",
		"  }",
		"",
		"  .floating-button {",
		"    right: 16px;",
		"    bottom: 64px;",
		"  }",
		"",
		"  .volume-control {",
		"    width: 76px;",
		"  }",
		"",
		"  .volume-range {",
		"    width: 42px;",
		"  }",
		"}",
		"",
		"@media (max-width: 340px) {",
		"  .minimal-player {",
		"    gap: 1px;",
		"    padding-inline: 4px;",
		"  }",
		"",
		"  .transport-minimal .icon-button,",
		"  .minimal-player > .minimal-action-button {",
		"    width: 24px;",
		"    height: 24px;",
		"  }",
		"",
		"  .circular-play-control,",
		"  .circular-progress {",
		"    width: 36px;",
		"    height: 36px;",
		"  }",
		"",
		"  .transport-minimal .play-button {",
		"    width: 32px;",
		"    height: 32px;",
		"  }",
		"",
		"  .transport-minimal .volume-control {",
		"    width: 56px;",
		"  }",
		"",
		"  .transport-minimal .volume-range {",
		"    width: 32px;",
		"  }",
		"}",
		""
	].join("\n");
	var _style = (b, a = document.createElement("style")) => (a.append(b), a);
	var styles_css_default = _style(styles_default);
	var version = "0.1.6";
	function SvgIcon({ size = 24, strokeWidth = 2, children, ...props }) {
		return (0, preact_jsx_runtime.jsx)("svg", {
			xmlns: "http://www.w3.org/2000/svg",
			width: size,
			height: size,
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": strokeWidth,
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
			focusable: "false",
			...props,
			children
		});
	}
	function ChevronDown(props) {
		return (0, preact_jsx_runtime.jsx)(SvgIcon, {
			...props,
			children: (0, preact_jsx_runtime.jsx)("path", { d: "m6 9 6 6 6-6" })
		});
	}
	function Clock3(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("circle", {
				cx: "12",
				cy: "12",
				r: "10"
			}), (0, preact_jsx_runtime.jsx)("path", { d: "M12 6v6h4" })]
		});
	}
	function Headphones(props) {
		return (0, preact_jsx_runtime.jsx)(SvgIcon, {
			...props,
			children: (0, preact_jsx_runtime.jsx)("path", { d: "M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" })
		});
	}
	function ListMusic(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "M16 5H3" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M11 12H3" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M11 19H3" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M21 16V5" }),
				(0, preact_jsx_runtime.jsx)("circle", {
					cx: "18",
					cy: "16",
					r: "3"
				})
			]
		});
	}
	function Music2(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("circle", {
				cx: "8",
				cy: "18",
				r: "4"
			}), (0, preact_jsx_runtime.jsx)("path", { d: "M12 18V2l7 4" })]
		});
	}
	function Minimize2(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "m14 10 7-7" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M20 10h-6V4" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "m3 21 7-7" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M4 14h6v6" })
			]
		});
	}
	function Maximize2(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "M15 3h6v6" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "m21 3-7 7" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "m3 21 7-7" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M9 21H3v-6" })
			]
		});
	}
	function Pause(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("rect", {
				x: "14",
				y: "3",
				width: "5",
				height: "18",
				rx: "1"
			}), (0, preact_jsx_runtime.jsx)("rect", {
				x: "5",
				y: "3",
				width: "5",
				height: "18",
				rx: "1"
			})]
		});
	}
	function Pencil(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }), (0, preact_jsx_runtime.jsx)("path", { d: "m15 5 4 4" })]
		});
	}
	function Play(props) {
		return (0, preact_jsx_runtime.jsx)(SvgIcon, {
			...props,
			children: (0, preact_jsx_runtime.jsx)("path", { d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" })
		});
	}
	function Plus(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("path", { d: "M5 12h14" }), (0, preact_jsx_runtime.jsx)("path", { d: "M12 5v14" })]
		});
	}
	function Repeat(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "m17 2 4 4-4 4" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M3 11v-1a4 4 0 0 1 4-4h14" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "m7 22-4-4 4-4" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M21 13v1a4 4 0 0 1-4 4H3" })
			]
		});
	}
	function Repeat1(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "m17 2 4 4-4 4" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M3 11v-1a4 4 0 0 1 4-4h14" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "m7 22-4-4 4-4" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M21 13v1a4 4 0 0 1-4 4H3" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M11 10h1v4" })
			]
		});
	}
	function RotateCcw(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("path", { d: "M3 12a9 9 0 1 0 3-6.7L3 8" }), (0, preact_jsx_runtime.jsx)("path", { d: "M3 3v5h5" })]
		});
	}
	function Save(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M7 3v4a1 1 0 0 0 1 1h7" })
			]
		});
	}
	function Shuffle(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "m18 14 4 4-4 4" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "m18 2 4 4-4 4" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M2 6h1.972a4 4 0 0 1 3.6 2.2" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" })
			]
		});
	}
	function SkipBack(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("path", { d: "M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" }), (0, preact_jsx_runtime.jsx)("path", { d: "M3 20V4" })]
		});
	}
	function SkipForward(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("path", { d: "M21 4v16" }), (0, preact_jsx_runtime.jsx)("path", { d: "M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" })]
		});
	}
	function Trash2(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "M10 11v6" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M14 11v6" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M3 6h18" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
			]
		});
	}
	function Volume2(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M16 9a5 5 0 0 1 0 6" }),
				(0, preact_jsx_runtime.jsx)("path", { d: "M19.364 18.364a9 9 0 0 0 0-12.728" })
			]
		});
	}
	function VolumeX(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [
				(0, preact_jsx_runtime.jsx)("path", { d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z" }),
				(0, preact_jsx_runtime.jsx)("line", {
					x1: "22",
					x2: "16",
					y1: "9",
					y2: "15"
				}),
				(0, preact_jsx_runtime.jsx)("line", {
					x1: "16",
					x2: "22",
					y1: "9",
					y2: "15"
				})
			]
		});
	}
	function X(props) {
		return (0, preact_jsx_runtime.jsxs)(SvgIcon, {
			...props,
			children: [(0, preact_jsx_runtime.jsx)("path", { d: "M18 6 6 18" }), (0, preact_jsx_runtime.jsx)("path", { d: "m6 6 12 12" })]
		});
	}
	function createId(prefix) {
		return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
	}
	function getBvid(url = location.href) {
		return new URL(url).pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
	}
	function getPageNumber(url = location.href) {
		const page = Number(new URL(url).searchParams.get("p"));
		return Number.isInteger(page) && page > 1 ? page : void 0;
	}
	function readCurrentVideoMetadata() {
		const bvid = getBvid();
		if (!bvid) return;
		const titleElement = document.querySelector("h1.video-title, h1[title], .video-title");
		const rawTitle = titleElement?.getAttribute("title") ?? titleElement?.textContent ?? document.querySelector("meta[property=\"og:title\"]")?.getAttribute("content") ?? document.title;
		const uploader = document.querySelector(".up-name, .up-info-container .username, a.up-name, .members-info .staff-name")?.textContent?.trim() || void 0;
		const cover = document.querySelector("meta[property=\"og:image\"]")?.getAttribute("content") || void 0;
		return {
			bvid,
			page: getPageNumber(),
			title: cleanPageTitle(rawTitle),
			uploader,
			cover
		};
	}
	function createTrackFromCurrentPage(media, title, startTime, endTime, cid) {
		const metadata = readCurrentVideoMetadata();
		if (!metadata) return;
		return {
			id: createId("track"),
			...metadata,
			...cid !== void 0 ? { cid } : {},
			title: title.trim() || metadata.title,
			startTime,
			endTime,
			duration: Number.isFinite(media.duration) ? media.duration : 0,
			addedAt: Date.now(),
			source: "manual"
		};
	}
	function cleanPageTitle(title) {
		return title.replace(/_哔哩哔哩_bilibili$/i, "").replace(/\s*-\s*哔哩哔哩.*$/i, "").trim();
	}
	function clamp(value, minimum, maximum) {
		return Math.min(maximum, Math.max(minimum, value));
	}
	function toStartSecond(value) {
		return Math.floor(value);
	}
	function toEndSecond(value) {
		return Math.ceil(value);
	}
	function formatTime(value) {
		if (!Number.isFinite(value) || value < 0) return "00:00";
		const totalSeconds = Math.floor(value);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor(totalSeconds % 3600 / 60);
		const seconds = totalSeconds % 60;
		if (hours > 0) return [
			hours,
			minutes,
			seconds
		].map((part) => String(part).padStart(2, "0")).join(":");
		return [minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
	}
	async function fetchVideoChapters(source, options = {}) {
		const fetcher = options.fetcher ?? fetch;
		let cid = validPositiveInteger(source.cid) ? source.cid : void 0;
		try {
			if (cid === void 0) {
				const viewUrl = new URL("https://api.bilibili.com/x/web-interface/view");
				viewUrl.searchParams.set("bvid", source.bvid);
				const pages = readRecord((await readSuccessfulPayload(await fetcher(viewUrl, {
					credentials: "include",
					signal: options.signal
				})))?.data)?.pages;
				const pageIndex = validPositiveInteger(source.page) ? source.page - 1 : 0;
				const resolvedCid = (Array.isArray(pages) ? readRecord(pages[pageIndex]) : void 0)?.cid;
				cid = validPositiveInteger(resolvedCid) ? resolvedCid : void 0;
			}
			if (cid === void 0) return { chapters: [] };
			const playerUrl = new URL("https://api.bilibili.com/x/player/wbi/v2");
			playerUrl.searchParams.set("bvid", source.bvid);
			playerUrl.searchParams.set("cid", String(cid));
			const viewPoints = readRecord((await readSuccessfulPayload(await fetcher(playerUrl, {
				credentials: "include",
				signal: options.signal
			})))?.data)?.view_points;
			return {
				cid,
				chapters: parseVideoChapters(viewPoints)
			};
		} catch {
			return {
				cid,
				chapters: []
			};
		}
	}
	function parseVideoChapters(value) {
		if (!Array.isArray(value)) return [];
		return value.flatMap((entry) => {
			const record = readRecord(entry);
			const title = typeof record?.content === "string" ? record.content.trim() : "";
			const rawStart = record?.from;
			const rawEnd = record?.to;
			if (!title || typeof rawStart !== "number" || typeof rawEnd !== "number" || !Number.isFinite(rawStart) || !Number.isFinite(rawEnd) || rawStart < 0 || rawEnd <= rawStart) return [];
			const startTime = toStartSecond(rawStart);
			const endTime = toEndSecond(rawEnd);
			if (endTime <= startTime) return [];
			const rawCover = record?.imgUrl;
			const cover = typeof rawCover === "string" && rawCover.trim() ? rawCover.trim().replace(/^http:/i, "https:") : void 0;
			return [{
				title,
				startTime,
				endTime,
				...cover ? { cover } : {}
			}];
		});
	}
	async function readSuccessfulPayload(response) {
		if (!response.ok) return;
		const payload = readRecord(await response.json());
		return payload?.code === 0 ? payload : void 0;
	}
	function readRecord(value) {
		return value !== null && typeof value === "object" ? value : void 0;
	}
	function validPositiveInteger(value) {
		return typeof value === "number" && Number.isInteger(value) && value > 0;
	}
	var _GM_addValueChangeListener = (() => typeof GM_addValueChangeListener != "undefined" ? GM_addValueChangeListener : void 0)();
	var _GM_getValue = (() => typeof GM_getValue != "undefined" ? GM_getValue : void 0)();
	var _GM_removeValueChangeListener = (() => typeof GM_removeValueChangeListener != "undefined" ? GM_removeValueChangeListener : void 0)();
	var _GM_setValue = (() => typeof GM_setValue != "undefined" ? GM_setValue : void 0)();
	var _unsafeWindow = (() => typeof unsafeWindow != "undefined" ? unsafeWindow : void 0)();
	var LAYOUT_STORAGE_KEY = "bilibili-music-player:layout";
	var DEFAULT_LAYOUT = {
		version: 1,
		lastOpenMode: "full"
	};
	function readOpenPanelMode(value) {
		return value === "minimal" ? "minimal" : "full";
	}
	function readPosition(value) {
		if (!value || typeof value !== "object") return;
		const candidate = value;
		if (typeof candidate.x !== "number" || !Number.isFinite(candidate.x) || typeof candidate.y !== "number" || !Number.isFinite(candidate.y)) return;
		return {
			x: candidate.x,
			y: candidate.y
		};
	}
	function migrateLayoutData(raw) {
		if (!raw || typeof raw !== "object") return DEFAULT_LAYOUT;
		const candidate = raw;
		if (candidate.version !== 1) return DEFAULT_LAYOUT;
		const migrated = {
			version: 1,
			lastOpenMode: readOpenPanelMode(candidate.lastOpenMode)
		};
		const launcher = readPosition(candidate.launcher);
		if (launcher) migrated.launcher = launcher;
		const panel = readPosition(candidate.panel);
		if (panel) migrated.panel = panel;
		return migrated;
	}
	var LayoutRepository = class {
		load() {
			return migrateLayoutData(_GM_getValue(LAYOUT_STORAGE_KEY));
		}
		savePosition(target, position) {
			_GM_setValue(LAYOUT_STORAGE_KEY, {
				...this.load(),
				[target]: position
			});
		}
		clearPosition(target) {
			const layout = this.load();
			delete layout[target];
			_GM_setValue(LAYOUT_STORAGE_KEY, layout);
		}
		saveLastOpenMode(lastOpenMode) {
			_GM_setValue(LAYOUT_STORAGE_KEY, {
				...this.load(),
				lastOpenMode
			});
		}
	};
	function clampPosition(position, elementSize, viewportSize) {
		const maximumX = Math.max(0, viewportSize.width - elementSize.width);
		const maximumY = Math.max(0, viewportSize.height - elementSize.height);
		return {
			x: Math.min(maximumX, Math.max(0, position.x)),
			y: Math.min(maximumY, Math.max(0, position.y))
		};
	}
	function positionsEqual(first, second) {
		return first.x === second.x && first.y === second.y;
	}
	var DRAG_THRESHOLD = 4;
	var layoutRepository$1 = new LayoutRepository();
	function viewportSize() {
		return {
			width: window.innerWidth,
			height: window.innerHeight
		};
	}
	function useDraggablePosition(target) {
		const [element, setElement] = (0, preact_hooks.useState)(null);
		const [position, setPosition] = (0, preact_hooks.useState)(() => layoutRepository$1.load()[target]);
		const activeDrag = (0, preact_hooks.useRef)();
		const suppressClick = (0, preact_hooks.useRef)(false);
		const ref = (0, preact_hooks.useCallback)((nextElement) => {
			setElement((currentElement) => currentElement === nextElement ? currentElement : nextElement);
		}, []);
		const clampCurrentPosition = (0, preact_hooks.useCallback)(() => {
			if (!element) return;
			setPosition((currentPosition) => {
				if (!currentPosition) return currentPosition;
				const bounds = element.getBoundingClientRect();
				const nextPosition = clampPosition(currentPosition, {
					width: bounds.width,
					height: bounds.height
				}, viewportSize());
				return positionsEqual(currentPosition, nextPosition) ? currentPosition : nextPosition;
			});
		}, [element]);
		(0, preact_hooks.useLayoutEffect)(clampCurrentPosition, [clampCurrentPosition]);
		(0, preact_hooks.useEffect)(() => {
			if (!element) return;
			window.addEventListener("resize", clampCurrentPosition);
			const resizeObserver = new ResizeObserver(clampCurrentPosition);
			resizeObserver.observe(element);
			return () => {
				window.removeEventListener("resize", clampCurrentPosition);
				resizeObserver.disconnect();
			};
		}, [clampCurrentPosition, element]);
		const onPointerDown = (0, preact_hooks.useCallback)((event) => {
			if (!element || !event.isPrimary || event.pointerType === "mouse" && event.button !== 0) return;
			const bounds = element.getBoundingClientRect();
			const originPosition = {
				x: bounds.left,
				y: bounds.top
			};
			suppressClick.current = false;
			activeDrag.current = {
				pointerId: event.pointerId,
				captureElement: event.currentTarget,
				movedElement: element,
				originPointerX: event.clientX,
				originPointerY: event.clientY,
				originPosition,
				lastPosition: originPosition,
				dragged: false
			};
			event.currentTarget.setPointerCapture(event.pointerId);
		}, [element]);
		const onPointerMove = (0, preact_hooks.useCallback)((event) => {
			const drag = activeDrag.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			const deltaX = event.clientX - drag.originPointerX;
			const deltaY = event.clientY - drag.originPointerY;
			if (!drag.dragged && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;
			drag.dragged = true;
			const bounds = drag.movedElement.getBoundingClientRect();
			const nextPosition = clampPosition({
				x: drag.originPosition.x + deltaX,
				y: drag.originPosition.y + deltaY
			}, {
				width: bounds.width,
				height: bounds.height
			}, viewportSize());
			drag.lastPosition = nextPosition;
			setPosition(nextPosition);
			event.preventDefault();
		}, []);
		const finishDrag = (0, preact_hooks.useCallback)((event, cancelled) => {
			const drag = activeDrag.current;
			if (!drag || drag.pointerId !== event.pointerId) return;
			if (drag.dragged) {
				setPosition(drag.lastPosition);
				layoutRepository$1.savePosition(target, drag.lastPosition);
				suppressClick.current = !cancelled;
			}
			activeDrag.current = void 0;
			if (drag.captureElement.hasPointerCapture(event.pointerId)) drag.captureElement.releasePointerCapture(event.pointerId);
		}, [target]);
		const onPointerUp = (0, preact_hooks.useCallback)((event) => finishDrag(event, false), [finishDrag]);
		const onPointerCancel = (0, preact_hooks.useCallback)((event) => finishDrag(event, true), [finishDrag]);
		const consumeSuppressedClick = (0, preact_hooks.useCallback)(() => {
			if (!suppressClick.current) return false;
			suppressClick.current = false;
			return true;
		}, []);
		const saveCurrentPosition = (0, preact_hooks.useCallback)(() => {
			if (!element) return;
			const bounds = element.getBoundingClientRect();
			const nextPosition = clampPosition({
				x: bounds.left,
				y: bounds.top
			}, {
				width: bounds.width,
				height: bounds.height
			}, viewportSize());
			setPosition(nextPosition);
			layoutRepository$1.savePosition(target, nextPosition);
		}, [element, target]);
		const resetPosition = (0, preact_hooks.useCallback)(() => {
			activeDrag.current = void 0;
			suppressClick.current = false;
			setPosition(void 0);
			layoutRepository$1.clearPosition(target);
		}, [target]);
		return {
			ref,
			style: position ? {
				left: position.x,
				top: position.y,
				right: "auto",
				bottom: "auto"
			} : void 0,
			onPointerDown,
			onPointerMove,
			onPointerUp,
			onPointerCancel,
			consumeSuppressedClick,
			saveCurrentPosition,
			resetPosition
		};
	}
	function calculatePlaybackProgress({ currentTime, startTime, endTime, duration, storedDuration }) {
		const effectiveEnd = endTime ?? (duration > 0 ? duration : storedDuration);
		if (!Number.isFinite(currentTime) || !Number.isFinite(startTime) || !Number.isFinite(effectiveEnd) || effectiveEnd <= startTime) return 0;
		return Math.min(1, Math.max(0, (currentTime - startTime) / (effectiveEnd - startTime)));
	}
	var PLAY_MODE_LABELS = {
		sequence: "顺序播放",
		"list-loop": "列表循环",
		"single-loop": "单曲循环",
		shuffle: "随机播放"
	};
	function PlayerControls({ variant, playMode, runtime, audioOnlyState, progress, onToggleAudioOnly, onCyclePlayMode, onPrevious, onTogglePlayback, onNext, onToggleMute, onSetVolume }) {
		const playButton = (0, preact_jsx_runtime.jsx)("button", {
			class: "play-button",
			type: "button",
			title: runtime.playing ? "暂停" : "播放",
			"aria-label": runtime.playing ? "暂停" : "播放",
			disabled: !runtime.mediaReady,
			onClick: onTogglePlayback,
			children: runtime.playing ? (0, preact_jsx_runtime.jsx)(Pause, {
				size: 22,
				fill: "currentColor",
				"aria-hidden": "true"
			}) : (0, preact_jsx_runtime.jsx)(Play, {
				size: 22,
				fill: "currentColor",
				"aria-hidden": "true"
			})
		});
		return (0, preact_jsx_runtime.jsxs)("div", {
			class: `transport transport-${variant}`,
			children: [
				(0, preact_jsx_runtime.jsx)("button", {
					class: `icon-button audio-mode-button ${audioOnlyState.status}`,
					type: "button",
					title: audioOnlyButtonLabel(audioOnlyState),
					"aria-label": audioOnlyButtonLabel(audioOnlyState),
					"aria-pressed": audioOnlyState.requested,
					onClick: onToggleAudioOnly,
					children: (0, preact_jsx_runtime.jsx)(Headphones, {
						size: 19,
						"aria-hidden": "true"
					})
				}),
				(0, preact_jsx_runtime.jsx)("button", {
					class: "icon-button",
					type: "button",
					title: PLAY_MODE_LABELS[playMode],
					"aria-label": PLAY_MODE_LABELS[playMode],
					onClick: onCyclePlayMode,
					children: (0, preact_jsx_runtime.jsx)(PlayModeIcon, { mode: playMode })
				}),
				(0, preact_jsx_runtime.jsx)("button", {
					class: "icon-button",
					type: "button",
					title: "上一首",
					"aria-label": "上一首",
					disabled: !runtime.mediaReady,
					onClick: onPrevious,
					children: (0, preact_jsx_runtime.jsx)(SkipBack, {
						size: 20,
						"aria-hidden": "true"
					})
				}),
				variant === "minimal" ? (0, preact_jsx_runtime.jsxs)("div", {
					class: "circular-play-control",
					style: { "--play-progress": String((progress ?? 0) * 100) },
					children: [
						(0, preact_jsx_runtime.jsxs)("svg", {
							class: "circular-progress",
							viewBox: "0 0 40 40",
							"aria-hidden": "true",
							children: [(0, preact_jsx_runtime.jsx)("circle", {
								class: "circular-progress-track",
								cx: "20",
								cy: "20",
								r: "18"
							}), (0, preact_jsx_runtime.jsx)("circle", {
								class: "circular-progress-value",
								cx: "20",
								cy: "20",
								r: "18",
								pathLength: "100"
							})]
						}),
						playButton,
						(0, preact_jsx_runtime.jsx)("span", {
							class: "visually-hidden",
							role: "progressbar",
							"aria-label": "播放进度",
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							"aria-valuenow": Math.round((progress ?? 0) * 100)
						})
					]
				}) : playButton,
				(0, preact_jsx_runtime.jsx)("button", {
					class: "icon-button",
					type: "button",
					title: "下一首",
					"aria-label": "下一首",
					disabled: !runtime.mediaReady,
					onClick: onNext,
					children: (0, preact_jsx_runtime.jsx)(SkipForward, {
						size: 20,
						"aria-hidden": "true"
					})
				}),
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "volume-control",
					children: [(0, preact_jsx_runtime.jsx)("button", {
						class: "icon-button",
						type: "button",
						title: runtime.muted ? "取消静音" : "静音",
						"aria-label": runtime.muted ? "取消静音" : "静音",
						onClick: onToggleMute,
						children: runtime.muted || runtime.volume === 0 ? (0, preact_jsx_runtime.jsx)(VolumeX, {
							size: 19,
							"aria-hidden": "true"
						}) : (0, preact_jsx_runtime.jsx)(Volume2, {
							size: 19,
							"aria-hidden": "true"
						})
					}), (0, preact_jsx_runtime.jsx)("input", {
						class: "range volume-range",
						type: "range",
						min: "0",
						max: "1",
						step: "0.01",
						value: runtime.muted ? 0 : runtime.volume,
						"aria-label": "音量",
						onInput: (event) => onSetVolume(Number(event.currentTarget.value))
					})]
				})
			]
		});
	}
	function PlayModeIcon({ mode }) {
		switch (mode) {
			case "list-loop": return (0, preact_jsx_runtime.jsx)(Repeat, {
				size: 19,
				"aria-hidden": "true"
			});
			case "single-loop": return (0, preact_jsx_runtime.jsx)(Repeat1, {
				size: 19,
				"aria-hidden": "true"
			});
			case "shuffle": return (0, preact_jsx_runtime.jsx)(Shuffle, {
				size: 19,
				"aria-hidden": "true"
			});
			default: return (0, preact_jsx_runtime.jsx)(ListMusic, {
				size: 19,
				"aria-hidden": "true"
			});
		}
	}
	function audioOnlyButtonLabel(state) {
		switch (state.status) {
			case "detecting": return "纯音频模式正在检测播放流；点击关闭并重载";
			case "active": return "纯音频模式已生效；点击关闭并重载";
			case "fallback": return `纯音频模式未生效，已回退正常视频：${audioOnlyReasonLabel(state.reason)}；点击关闭并重载`;
			default: return "开启纯音频模式并重载页面";
		}
	}
	function audioOnlyReasonLabel(reason) {
		switch (reason) {
			case "durl-only": return "当前视频只提供音视频混流";
			case "missing-audio": return "DASH 清单没有可用音频";
			case "missing-dash":
			case "invalid-payload": return "未找到可改写的 DASH 清单";
			case "invalid-json": return "播放清单不是有效 JSON";
			case "unsupported-response-type": return "播放器使用了暂不支持的响应格式";
			case "playinfo-nonconfigurable": return "首屏播放信息无法拦截";
			case "playinfo-rewrite-failed":
			case "fetch-rewrite-failed":
			case "xhr-rewrite-failed": return "播放清单拦截失败";
			default: return "当前播放格式不受支持";
		}
	}
	function MinimalPlayer({ playMode, runtime, audioOnlyState, drag, onToggleAudioOnly, onCyclePlayMode, onPrevious, onTogglePlayback, onNext, onToggleMute, onSetVolume, onExpand, onClose }) {
		const [interactionPromptVisible, setInteractionPromptVisible] = (0, preact_hooks.useState)(false);
		const [interactionPromptPlacement, setInteractionPromptPlacement] = (0, preact_hooks.useState)("above");
		const playerElement = (0, preact_hooks.useRef)(null);
		const setPlayerElement = (0, preact_hooks.useCallback)((element) => {
			playerElement.current = element;
			drag.ref(element);
		}, [drag.ref]);
		const progress = calculatePlaybackProgress({
			currentTime: runtime.currentTime,
			startTime: runtime.nowPlaying.startTime,
			endTime: runtime.nowPlaying.endTime,
			duration: runtime.duration,
			storedDuration: runtime.nowPlaying.storedDuration
		});
		(0, preact_hooks.useEffect)(() => {
			if (!runtime.requiresInteraction) {
				setInteractionPromptVisible(false);
				return;
			}
			setInteractionPromptVisible(true);
			const timeout = window.setTimeout(() => setInteractionPromptVisible(false), 5e3);
			return () => window.clearTimeout(timeout);
		}, [runtime.message, runtime.requiresInteraction]);
		(0, preact_hooks.useLayoutEffect)(() => {
			const element = playerElement.current;
			if (!interactionPromptVisible || !element) return;
			const bounds = element.getBoundingClientRect();
			const promptExtent = 38;
			const nextPlacement = bounds.bottom + promptExtent <= window.innerHeight || bounds.top < promptExtent ? "below" : "above";
			setInteractionPromptPlacement(nextPlacement);
		}, [
			drag.style?.left,
			drag.style?.top,
			interactionPromptVisible
		]);
		return (0, preact_jsx_runtime.jsxs)("section", {
			ref: setPlayerElement,
			class: "minimal-player",
			style: drag.style,
			"aria-label": "Bilibili 音乐播放器（极简模式）",
			onPointerDown: (event) => {
				if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a")) return;
				drag.onPointerDown(event);
			},
			onPointerMove: drag.onPointerMove,
			onPointerUp: drag.onPointerUp,
			onPointerCancel: drag.onPointerCancel,
			children: [
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "minimal-now-playing",
					children: [(0, preact_jsx_runtime.jsx)("strong", {
						title: runtime.nowPlaying.title,
						children: runtime.mediaReady ? runtime.nowPlaying.title : "等待播放器"
					}), runtime.mediaReady && runtime.nowPlaying.uploader && (0, preact_jsx_runtime.jsx)("span", {
						title: runtime.nowPlaying.uploader,
						children: runtime.nowPlaying.uploader
					})]
				}),
				(0, preact_jsx_runtime.jsx)(PlayerControls, {
					variant: "minimal",
					playMode,
					runtime,
					audioOnlyState,
					progress,
					onToggleAudioOnly,
					onCyclePlayMode,
					onPrevious,
					onTogglePlayback,
					onNext,
					onToggleMute,
					onSetVolume
				}),
				interactionPromptVisible && (0, preact_jsx_runtime.jsx)("button", {
					class: `minimal-interaction-prompt ${interactionPromptPlacement}`,
					type: "button",
					"aria-label": "点击继续播放",
					onClick: onTogglePlayback,
					children: "点击继续播放"
				}),
				(0, preact_jsx_runtime.jsx)("button", {
					class: "icon-button minimal-action-button",
					type: "button",
					title: "展开完整播放器",
					"aria-label": "展开完整播放器",
					onClick: onExpand,
					children: (0, preact_jsx_runtime.jsx)(Maximize2, {
						size: 18,
						"aria-hidden": "true"
					})
				}),
				(0, preact_jsx_runtime.jsx)("button", {
					class: "icon-button close-panel-button minimal-action-button",
					type: "button",
					title: "收起播放器",
					"aria-label": "收起播放器",
					onClick: onClose,
					children: (0, preact_jsx_runtime.jsx)(X, {
						size: 18,
						"aria-hidden": "true"
					})
				})
			]
		});
	}
	var PLAY_MODES = [
		"sequence",
		"list-loop",
		"single-loop",
		"shuffle"
	];
	var layoutRepository = new LayoutRepository();
	function App({ store, engine, audioOnly }) {
		const [displayMode, setDisplayMode] = (0, preact_hooks.useState)("launcher");
		const [creatingPlaylist, setCreatingPlaylist] = (0, preact_hooks.useState)(false);
		const [newPlaylistName, setNewPlaylistName] = (0, preact_hooks.useState)("");
		const [editorTrack, setEditorTrack] = (0, preact_hooks.useState)();
		const launcherDrag = useDraggablePosition("launcher");
		const panelDrag = useDraggablePosition("panel");
		const data = store.data.value;
		const runtime = engine.state.value;
		const audioOnlyState = audioOnly.state.value;
		const activePlaylist = data.playlists.find((playlist) => playlist.id === data.activePlaylistId) ?? data.playlists[0];
		const nowPlaying = runtime.nowPlaying;
		const progressMinimum = nowPlaying.startTime;
		const progressMaximum = nowPlaying.endTime ?? (runtime.duration > 0 ? runtime.duration : nowPlaying.storedDuration);
		const audioFallbackNotice = audioOnlyState.status === "fallback" ? `纯音频模式未生效，已回退正常视频：${audioOnlyReasonLabel(audioOnlyState.reason)}` : void 0;
		const primaryNotice = runtime.message ?? audioFallbackNotice;
		const noticeActionable = Boolean(runtime.message && runtime.requiresInteraction);
		const noticeFallback = !runtime.message && Boolean(audioFallbackNotice);
		const createPlaylist = (event) => {
			event.preventDefault();
			store.createPlaylist(newPlaylistName);
			setNewPlaylistName("");
			setCreatingPlaylist(false);
		};
		const cyclePlayMode = () => {
			const currentIndex = PLAY_MODES.indexOf(data.playMode);
			engine.setPlayMode(PLAY_MODES[(currentIndex + 1) % PLAY_MODES.length]);
		};
		const showPanel = (mode) => {
			if (displayMode !== "launcher" && displayMode !== mode) panelDrag.saveCurrentPosition();
			layoutRepository.saveLastOpenMode(mode);
			setDisplayMode(mode);
		};
		if (displayMode === "launcher") return (0, preact_jsx_runtime.jsx)("button", {
			ref: launcherDrag.ref,
			class: "floating-button",
			type: "button",
			style: launcherDrag.style,
			title: "打开 Bilibili 音乐播放器",
			"aria-label": "打开 Bilibili 音乐播放器",
			onPointerDown: launcherDrag.onPointerDown,
			onPointerMove: launcherDrag.onPointerMove,
			onPointerUp: launcherDrag.onPointerUp,
			onPointerCancel: launcherDrag.onPointerCancel,
			onClick: (event) => {
				if (launcherDrag.consumeSuppressedClick()) {
					event.preventDefault();
					return;
				}
				showPanel(layoutRepository.load().lastOpenMode);
			},
			children: (0, preact_jsx_runtime.jsx)(Music2, {
				size: 22,
				"aria-hidden": "true"
			})
		});
		if (displayMode === "minimal") return (0, preact_jsx_runtime.jsx)(MinimalPlayer, {
			playMode: data.playMode,
			runtime,
			audioOnlyState,
			drag: panelDrag,
			onToggleAudioOnly: () => audioOnly.toggle(engine.currentMedia?.currentTime ?? runtime.currentTime),
			onCyclePlayMode: cyclePlayMode,
			onPrevious: () => engine.previous(),
			onTogglePlayback: () => void engine.togglePlayback(),
			onNext: () => engine.next(),
			onToggleMute: () => engine.toggleMute(),
			onSetVolume: (volume) => engine.setVolume(volume),
			onExpand: () => showPanel("full"),
			onClose: () => setDisplayMode("launcher")
		});
		return (0, preact_jsx_runtime.jsxs)("section", {
			ref: panelDrag.ref,
			class: "player-panel",
			style: panelDrag.style,
			"aria-label": "Bilibili 音乐播放器",
			children: [
				(0, preact_jsx_runtime.jsxs)("header", {
					class: "panel-header",
					onPointerDown: (event) => {
						if (event.target instanceof Element && event.target.closest("button, input, select, textarea, a")) return;
						panelDrag.onPointerDown(event);
					},
					onPointerMove: panelDrag.onPointerMove,
					onPointerUp: panelDrag.onPointerUp,
					onPointerCancel: panelDrag.onPointerCancel,
					children: [(0, preact_jsx_runtime.jsxs)("div", {
						class: "brand",
						children: [
							(0, preact_jsx_runtime.jsx)("span", {
								class: "brand-icon",
								children: (0, preact_jsx_runtime.jsx)(Music2, {
									size: 18,
									"aria-hidden": "true"
								})
							}),
							(0, preact_jsx_runtime.jsx)("strong", { children: "Bilibili 音乐播放器" }),
							(0, preact_jsx_runtime.jsx)("span", {
								class: "version",
								children: version
							})
						]
					}), (0, preact_jsx_runtime.jsxs)("div", {
						class: "header-actions",
						children: [
							(0, preact_jsx_runtime.jsx)("button", {
								class: "icon-button reset-position-button",
								type: "button",
								title: "重置图标和播放器位置",
								"aria-label": "重置图标和播放器位置",
								onClick: () => {
									launcherDrag.resetPosition();
									panelDrag.resetPosition();
								},
								children: (0, preact_jsx_runtime.jsx)(RotateCcw, {
									size: 18,
									"aria-hidden": "true"
								})
							}),
							(0, preact_jsx_runtime.jsx)("button", {
								class: "icon-button",
								type: "button",
								title: "进入极简模式",
								"aria-label": "进入极简模式",
								onClick: () => showPanel("minimal"),
								children: (0, preact_jsx_runtime.jsx)(Minimize2, {
									size: 18,
									"aria-hidden": "true"
								})
							}),
							(0, preact_jsx_runtime.jsx)("button", {
								class: "icon-button close-panel-button",
								type: "button",
								title: "收起播放器",
								"aria-label": "收起播放器",
								onClick: () => setDisplayMode("launcher"),
								children: (0, preact_jsx_runtime.jsx)(X, {
									size: 18,
									"aria-hidden": "true"
								})
							})
						]
					})]
				}),
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "now-playing",
					children: [(0, preact_jsx_runtime.jsx)("div", {
						class: "cover",
						children: nowPlaying.cover ? (0, preact_jsx_runtime.jsx)("img", {
							src: nowPlaying.cover,
							alt: ""
						}) : (0, preact_jsx_runtime.jsx)(Music2, {
							size: 28,
							"aria-hidden": "true"
						})
					}), (0, preact_jsx_runtime.jsxs)("div", {
						class: "now-playing-copy",
						children: [
							(0, preact_jsx_runtime.jsx)("strong", {
								title: nowPlaying.title,
								children: nowPlaying.title
							}),
							(0, preact_jsx_runtime.jsx)("span", { children: nowPlaying.uploader ?? (runtime.mediaReady ? "当前 Bilibili 视频" : "等待播放器") }),
							runtime.playbackContext === "playlist" && (0, preact_jsx_runtime.jsx)("button", {
								class: "playlist-context-chip",
								type: "button",
								title: "退出歌单播放并继续播放完整视频",
								"aria-label": "退出歌单播放并继续播放完整视频",
								onClick: () => engine.exitPlaylistPlayback(),
								children: "播放完整视频"
							})
						]
					})]
				}),
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "progress-area",
					children: [(0, preact_jsx_runtime.jsx)("input", {
						class: "range progress-range",
						type: "range",
						min: progressMinimum,
						max: Math.max(progressMaximum, progressMinimum + 1),
						step: "0.1",
						value: Math.min(Math.max(runtime.currentTime, progressMinimum), Math.max(progressMaximum, progressMinimum + 1)),
						"aria-label": "播放进度",
						disabled: !runtime.mediaReady,
						onInput: (event) => engine.seek(Number(event.currentTarget.value))
					}), (0, preact_jsx_runtime.jsxs)("div", {
						class: "time-row",
						children: [(0, preact_jsx_runtime.jsx)("span", { children: formatTime(runtime.currentTime) }), (0, preact_jsx_runtime.jsx)("span", { children: formatTime(progressMaximum) })]
					})]
				}),
				(0, preact_jsx_runtime.jsx)(PlayerControls, {
					variant: "full",
					playMode: data.playMode,
					runtime,
					audioOnlyState,
					onToggleAudioOnly: () => audioOnly.toggle(engine.currentMedia?.currentTime ?? runtime.currentTime),
					onCyclePlayMode: cyclePlayMode,
					onPrevious: () => engine.previous(),
					onTogglePlayback: () => void engine.togglePlayback(),
					onNext: () => engine.next(),
					onToggleMute: () => engine.toggleMute(),
					onSetVolume: (volume) => engine.setVolume(volume)
				}),
				primaryNotice && (noticeActionable ? (0, preact_jsx_runtime.jsx)("button", {
					class: "status-message actionable",
					type: "button",
					title: primaryNotice,
					onClick: () => void engine.togglePlayback(),
					children: primaryNotice
				}) : (0, preact_jsx_runtime.jsx)("div", {
					class: `status-message ${noticeFallback ? "fallback" : ""}`,
					role: "status",
					title: primaryNotice,
					children: primaryNotice
				})),
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "playlist-toolbar",
					children: [
						(0, preact_jsx_runtime.jsx)("select", {
							value: activePlaylist.id,
							"aria-label": "当前歌单",
							onChange: (event) => store.selectPlaylist(event.currentTarget.value),
							children: data.playlists.map((playlist) => (0, preact_jsx_runtime.jsx)("option", {
								value: playlist.id,
								children: playlist.name
							}, playlist.id))
						}),
						(0, preact_jsx_runtime.jsx)("button", {
							class: "icon-button",
							type: "button",
							title: "新建歌单",
							"aria-label": "新建歌单",
							onClick: () => setCreatingPlaylist((value) => !value),
							children: (0, preact_jsx_runtime.jsx)(Plus, {
								size: 18,
								"aria-hidden": "true"
							})
						}),
						(0, preact_jsx_runtime.jsx)("button", {
							class: "icon-button danger",
							type: "button",
							title: "删除当前歌单",
							"aria-label": "删除当前歌单",
							disabled: data.playlists.length <= 1,
							onClick: () => store.removePlaylist(activePlaylist.id),
							children: (0, preact_jsx_runtime.jsx)(Trash2, {
								size: 17,
								"aria-hidden": "true"
							})
						})
					]
				}),
				creatingPlaylist && (0, preact_jsx_runtime.jsxs)("form", {
					class: "inline-form",
					onSubmit: createPlaylist,
					children: [(0, preact_jsx_runtime.jsx)("input", {
						value: newPlaylistName,
						placeholder: "歌单名称",
						"aria-label": "歌单名称",
						autoFocus: true,
						onInput: (event) => setNewPlaylistName(event.currentTarget.value)
					}), (0, preact_jsx_runtime.jsx)("button", {
						class: "icon-button accent",
						type: "submit",
						title: "保存歌单",
						children: (0, preact_jsx_runtime.jsx)(Save, {
							size: 17,
							"aria-hidden": "true"
						})
					})]
				}),
				(0, preact_jsx_runtime.jsxs)("button", {
					class: "add-current-button",
					type: "button",
					disabled: !engine.currentMedia,
					onClick: () => setEditorTrack("new"),
					children: [(0, preact_jsx_runtime.jsx)(Plus, {
						size: 17,
						"aria-hidden": "true"
					}), "将当前视频添加到歌单"]
				}),
				editorTrack && (0, preact_jsx_runtime.jsx)(TrackEditor, {
					media: engine.currentMedia,
					track: editorTrack === "new" ? void 0 : editorTrack,
					onCancel: () => setEditorTrack(void 0),
					onSave: (track) => {
						if (editorTrack === "new") store.addTrack(track);
						else store.updateTrack(track);
						setEditorTrack(void 0);
					}
				}, editorTrack === "new" ? "new" : editorTrack.id),
				(0, preact_jsx_runtime.jsx)("div", {
					class: "track-list",
					role: "list",
					"aria-label": "歌曲列表",
					children: activePlaylist.tracks.length === 0 ? (0, preact_jsx_runtime.jsxs)("div", {
						class: "empty-state",
						children: [(0, preact_jsx_runtime.jsx)(ListMusic, {
							size: 26,
							"aria-hidden": "true"
						}), (0, preact_jsx_runtime.jsx)("span", { children: "歌单还是空的" })]
					}) : activePlaylist.tracks.map((track, index) => (0, preact_jsx_runtime.jsxs)("div", {
						class: `track-row ${track.id === nowPlaying.trackId ? "active" : ""}`,
						role: "listitem",
						children: [
							(0, preact_jsx_runtime.jsxs)("button", {
								class: "track-main",
								type: "button",
								title: `播放 ${track.title}`,
								onClick: () => engine.playTrack(track),
								children: [
									(0, preact_jsx_runtime.jsx)("span", {
										class: "track-index",
										children: track.id === nowPlaying.trackId && runtime.playing ? (0, preact_jsx_runtime.jsx)(Volume2, {
											size: 15,
											"aria-hidden": "true"
										}) : String(index + 1).padStart(2, "0")
									}),
									(0, preact_jsx_runtime.jsxs)("span", {
										class: "track-copy",
										children: [(0, preact_jsx_runtime.jsx)("strong", { children: track.title }), (0, preact_jsx_runtime.jsxs)("span", { children: [track.uploader ?? track.bvid, ` · ${formatTime(track.startTime)}–${formatTime(track.endTime ?? track.duration)}`] })]
									}),
									(0, preact_jsx_runtime.jsx)("span", {
										class: "track-duration",
										children: formatTime((track.endTime ?? track.duration) - track.startTime)
									})
								]
							}),
							(0, preact_jsx_runtime.jsx)("button", {
								class: "row-action",
								type: "button",
								title: "编辑歌曲",
								"aria-label": `编辑 ${track.title}`,
								onClick: () => setEditorTrack(track),
								children: (0, preact_jsx_runtime.jsx)(Pencil, {
									size: 15,
									"aria-hidden": "true"
								})
							}),
							(0, preact_jsx_runtime.jsx)("button", {
								class: "row-action danger",
								type: "button",
								title: "删除歌曲",
								"aria-label": `删除 ${track.title}`,
								onClick: () => store.removeTrack(track.id),
								children: (0, preact_jsx_runtime.jsx)(Trash2, {
									size: 15,
									"aria-hidden": "true"
								})
							})
						]
					}, track.id))
				})
			]
		});
	}
	function TrackEditor({ media, track, onCancel, onSave }) {
		const metadata = readCurrentVideoMetadata();
		const [title, setTitle] = (0, preact_hooks.useState)(track?.title ?? metadata?.title ?? "");
		const [startTime, setStartTime] = (0, preact_hooks.useState)(String(toStartSecond(track?.startTime ?? 0)));
		const [endTime, setEndTime] = (0, preact_hooks.useState)(track?.endTime === void 0 ? "" : String(toEndSecond(track.endTime)));
		const [error, setError] = (0, preact_hooks.useState)("");
		const [chapters, setChapters] = (0, preact_hooks.useState)([]);
		const [resolvedCid, setResolvedCid] = (0, preact_hooks.useState)(track?.cid);
		const [chapterMenuOpen, setChapterMenuOpen] = (0, preact_hooks.useState)(false);
		const [activeChapterIndex, setActiveChapterIndex] = (0, preact_hooks.useState)(-1);
		const chapterCombobox = (0, preact_hooks.useRef)(null);
		const titleInput = (0, preact_hooks.useRef)(null);
		const chapterSourceBvid = track?.bvid ?? metadata?.bvid;
		const chapterSourcePage = track?.page ?? metadata?.page;
		const chapterSourceCid = track?.cid;
		(0, preact_hooks.useEffect)(() => {
			const controller = new AbortController();
			let cancelled = false;
			setChapters([]);
			setResolvedCid(chapterSourceCid);
			setChapterMenuOpen(false);
			setActiveChapterIndex(-1);
			if (chapterSourceBvid) fetchVideoChapters({
				bvid: chapterSourceBvid,
				page: chapterSourcePage,
				cid: chapterSourceCid
			}, { signal: controller.signal }).then((result) => {
				if (cancelled) return;
				setChapters(result.chapters);
				setResolvedCid(result.cid);
				setActiveChapterIndex(-1);
			});
			return () => {
				cancelled = true;
				controller.abort();
			};
		}, [
			chapterSourceBvid,
			chapterSourceCid,
			chapterSourcePage
		]);
		(0, preact_hooks.useEffect)(() => {
			if (!chapterMenuOpen) return;
			const closeOnOutsidePointer = (event) => {
				const combobox = chapterCombobox.current;
				if (combobox && !event.composedPath().includes(combobox)) {
					setChapterMenuOpen(false);
					setActiveChapterIndex(-1);
				}
			};
			document.addEventListener("pointerdown", closeOnOutsidePointer);
			return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
		}, [chapterMenuOpen]);
		(0, preact_hooks.useEffect)(() => {
			setError("");
		}, [startTime, endTime]);
		const save = (event) => {
			event.preventDefault();
			const start = Number(startTime);
			const end = endTime.trim() ? Number(endTime) : void 0;
			if (!Number.isFinite(start) || start < 0) {
				setError("开始时间无效");
				return;
			}
			if (!Number.isInteger(start)) {
				setError("开始时间必须是整数秒");
				return;
			}
			if (end !== void 0 && !Number.isFinite(end)) {
				setError("结束时间无效");
				return;
			}
			if (end !== void 0 && !Number.isInteger(end)) {
				setError("结束时间必须是整数秒");
				return;
			}
			if (end !== void 0 && end <= start) {
				setError("结束时间必须晚于开始时间");
				return;
			}
			if (track) {
				onSave({
					...track,
					...resolvedCid !== void 0 ? { cid: resolvedCid } : {},
					title: title.trim() || track.title,
					startTime: start,
					endTime: end
				});
				return;
			}
			if (!media) {
				setError("尚未找到 Bilibili 播放器");
				return;
			}
			const nextTrack = createTrackFromCurrentPage(media, title, start, end, resolvedCid);
			if (!nextTrack) {
				setError("无法读取当前视频信息");
				return;
			}
			onSave(nextTrack);
		};
		const selectChapter = (chapter) => {
			setTitle(chapter.title);
			setStartTime(String(chapter.startTime));
			setEndTime(String(chapter.endTime));
			setChapterMenuOpen(false);
			setActiveChapterIndex(-1);
			titleInput.current?.focus();
		};
		const moveActiveChapter = (direction) => {
			if (chapters.length === 0) {
				setChapterMenuOpen(true);
				setActiveChapterIndex(-1);
				return;
			}
			setChapterMenuOpen(true);
			setActiveChapterIndex((current) => {
				if (current < 0) return direction === 1 ? 0 : chapters.length - 1;
				return (current + direction + chapters.length) % chapters.length;
			});
		};
		return (0, preact_jsx_runtime.jsxs)("form", {
			class: "track-editor",
			onSubmit: save,
			children: [
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "editor-heading",
					children: [(0, preact_jsx_runtime.jsx)("strong", { children: track ? "编辑歌曲" : "添加歌曲" }), (0, preact_jsx_runtime.jsx)("button", {
						class: "icon-button",
						type: "button",
						title: "关闭编辑器",
						"aria-label": "关闭编辑器",
						onClick: onCancel,
						children: (0, preact_jsx_runtime.jsx)(X, {
							size: 16,
							"aria-hidden": "true"
						})
					})]
				}),
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "editor-field",
					children: [(0, preact_jsx_runtime.jsx)("label", {
						for: "bilibili-music-track-title",
						children: "标题"
					}), (0, preact_jsx_runtime.jsxs)("div", {
						class: "chapter-combobox",
						ref: chapterCombobox,
						children: [
							(0, preact_jsx_runtime.jsx)("input", {
								id: "bilibili-music-track-title",
								ref: titleInput,
								value: title,
								required: true,
								role: "combobox",
								"aria-autocomplete": "none",
								"aria-expanded": chapterMenuOpen,
								"aria-controls": "bilibili-music-chapter-options",
								"aria-activedescendant": chapterMenuOpen && activeChapterIndex >= 0 ? `bilibili-music-chapter-${activeChapterIndex}` : void 0,
								onInput: (event) => {
									setTitle(event.currentTarget.value);
									setActiveChapterIndex(-1);
								},
								onKeyDown: (event) => {
									if (event.key === "ArrowDown") {
										event.preventDefault();
										moveActiveChapter(1);
									} else if (event.key === "ArrowUp") {
										event.preventDefault();
										moveActiveChapter(-1);
									} else if (event.key === "Enter" && chapterMenuOpen && activeChapterIndex >= 0) {
										event.preventDefault();
										selectChapter(chapters[activeChapterIndex]);
									} else if (event.key === "Escape" && chapterMenuOpen) {
										event.preventDefault();
										setChapterMenuOpen(false);
										setActiveChapterIndex(-1);
									}
								}
							}),
							(0, preact_jsx_runtime.jsx)("button", {
								class: `chapter-toggle ${chapterMenuOpen ? "open" : ""}`,
								type: "button",
								title: chapterMenuOpen ? "收起视频章节" : "展开视频章节",
								"aria-label": chapterMenuOpen ? "收起视频章节" : "展开视频章节",
								"aria-expanded": chapterMenuOpen,
								"aria-controls": "bilibili-music-chapter-options",
								onClick: () => {
									setChapterMenuOpen((open) => {
										const nextOpen = !open;
										setActiveChapterIndex(nextOpen && chapters.length > 0 ? 0 : -1);
										return nextOpen;
									});
									titleInput.current?.focus();
								},
								children: (0, preact_jsx_runtime.jsx)(ChevronDown, {
									size: 17,
									"aria-hidden": "true"
								})
							}),
							chapterMenuOpen && (0, preact_jsx_runtime.jsx)("div", {
								class: "chapter-options",
								id: "bilibili-music-chapter-options",
								role: "listbox",
								"aria-label": "视频章节",
								children: chapters.map((chapter, index) => (0, preact_jsx_runtime.jsxs)("button", {
									class: `chapter-option ${index === activeChapterIndex ? "active" : ""}`,
									id: `bilibili-music-chapter-${index}`,
									type: "button",
									role: "option",
									"aria-selected": index === activeChapterIndex,
									tabIndex: -1,
									onPointerEnter: () => setActiveChapterIndex(index),
									onClick: () => selectChapter(chapter),
									children: [(0, preact_jsx_runtime.jsx)("span", { children: chapter.title }), (0, preact_jsx_runtime.jsxs)("span", { children: [
										formatTime(chapter.startTime),
										"–",
										formatTime(chapter.endTime)
									] })]
								}, `${chapter.startTime}-${chapter.endTime}-${chapter.title}`))
							})
						]
					})]
				}),
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "time-fields",
					children: [(0, preact_jsx_runtime.jsxs)("label", { children: [(0, preact_jsx_runtime.jsx)("span", { children: "开始时间（秒）" }), (0, preact_jsx_runtime.jsx)("input", {
						type: "number",
						min: "0",
						step: "1",
						value: startTime,
						onInput: (event) => setStartTime(event.currentTarget.value),
						onInvalid: (event) => {
							if (event.currentTarget.validity.stepMismatch) {
								event.preventDefault();
								setError("开始时间必须是整数秒");
							}
						}
					})] }), (0, preact_jsx_runtime.jsxs)("button", {
						class: "current-time-button",
						type: "button",
						disabled: !media,
						onClick: () => setStartTime(String(toStartSecond(media?.currentTime ?? 0))),
						children: [(0, preact_jsx_runtime.jsx)(Clock3, {
							size: 15,
							"aria-hidden": "true"
						}), "当前"]
					})]
				}),
				(0, preact_jsx_runtime.jsxs)("div", {
					class: "time-fields",
					children: [(0, preact_jsx_runtime.jsxs)("label", { children: [(0, preact_jsx_runtime.jsx)("span", { children: "结束时间（秒）" }), (0, preact_jsx_runtime.jsx)("input", {
						type: "number",
						min: "0",
						step: "1",
						value: endTime,
						onInput: (event) => setEndTime(event.currentTarget.value),
						onInvalid: (event) => {
							if (event.currentTarget.validity.stepMismatch) {
								event.preventDefault();
								setError("结束时间必须是整数秒");
							}
						}
					})] }), (0, preact_jsx_runtime.jsxs)("button", {
						class: "current-time-button",
						type: "button",
						disabled: !media,
						onClick: () => setEndTime(media ? String(toEndSecond(media.currentTime)) : ""),
						children: [(0, preact_jsx_runtime.jsx)(Clock3, {
							size: 15,
							"aria-hidden": "true"
						}), "当前"]
					})]
				}),
				error && (0, preact_jsx_runtime.jsx)("div", {
					class: "editor-error",
					children: error
				}),
				(0, preact_jsx_runtime.jsxs)("button", {
					class: "save-track-button",
					type: "submit",
					children: [(0, preact_jsx_runtime.jsx)(Save, {
						size: 16,
						"aria-hidden": "true"
					}), "保存"]
				})
			]
		});
	}
	var STORAGE_KEY$1 = "bilibili-music-player:data";
	function createDefaultData(now = Date.now()) {
		const playlist = {
			id: createId("playlist"),
			name: "默认歌单",
			tracks: [],
			createdAt: now,
			updatedAt: now
		};
		return {
			version: 1,
			playlists: [playlist],
			activePlaylistId: playlist.id,
			playMode: "list-loop",
			volume: 1,
			playback: {
				playlistId: playlist.id,
				currentTime: 0,
				resumeRequested: false,
				updatedAt: now
			}
		};
	}
	function migrateAppData(raw) {
		if (!raw || typeof raw !== "object") return createDefaultData();
		const candidate = raw;
		if (candidate.version !== 1 || !Array.isArray(candidate.playlists)) return createDefaultData();
		const fallback = createDefaultData();
		const playlists = candidate.playlists.filter((playlist) => Boolean(playlist && typeof playlist.id === "string" && typeof playlist.name === "string" && Array.isArray(playlist.tracks)));
		if (playlists.length === 0) return fallback;
		const activePlaylistId = playlists.some((playlist) => playlist.id === candidate.activePlaylistId) ? candidate.activePlaylistId : playlists[0].id;
		return {
			version: 1,
			playlists,
			activePlaylistId,
			playMode: candidate.playMode === "sequence" || candidate.playMode === "list-loop" || candidate.playMode === "single-loop" || candidate.playMode === "shuffle" ? candidate.playMode : "list-loop",
			volume: typeof candidate.volume === "number" ? Math.min(1, Math.max(0, candidate.volume)) : 1,
			playback: {
				playlistId: candidate.playback?.playlistId ?? activePlaylistId,
				trackId: candidate.playback?.trackId,
				currentTime: candidate.playback?.currentTime ?? 0,
				resumeRequested: candidate.playback?.resumeRequested ?? false,
				updatedAt: candidate.playback?.updatedAt ?? Date.now()
			}
		};
	}
	var AppRepository = class {
		load() {
			return migrateAppData(_GM_getValue(STORAGE_KEY$1));
		}
		save(data) {
			_GM_setValue(STORAGE_KEY$1, data);
		}
		subscribe(listener) {
			const listenerId = _GM_addValueChangeListener(STORAGE_KEY$1, (_key, _oldValue, newValue, remote) => {
				if (remote) listener(migrateAppData(newValue));
			});
			return () => _GM_removeValueChangeListener(listenerId);
		}
	};
	var AppStore = class {
		data = (0, _preact_signals.signal)(createDefaultData());
		repository = new AppRepository();
		unsubscribe;
		start() {
			this.data.value = this.repository.load();
			this.unsubscribe = this.repository.subscribe((data) => {
				this.data.value = data;
			});
		}
		stop() {
			this.unsubscribe?.();
		}
		get activePlaylist() {
			const data = this.data.peek();
			return data.playlists.find((playlist) => playlist.id === data.activePlaylistId) ?? data.playlists[0];
		}
		findTrack(trackId) {
			if (!trackId) return;
			return this.data.peek().playlists.flatMap((playlist) => playlist.tracks).find((track) => track.id === trackId);
		}
		createPlaylist(name) {
			const normalizedName = name.trim();
			if (!normalizedName) return;
			const now = Date.now();
			const playlist = {
				id: createId("playlist"),
				name: normalizedName,
				tracks: [],
				createdAt: now,
				updatedAt: now
			};
			this.commit((data) => ({
				...data,
				playlists: [...data.playlists, playlist],
				activePlaylistId: playlist.id,
				playback: {
					...data.playback,
					playlistId: playlist.id,
					trackId: void 0,
					currentTime: 0,
					resumeRequested: false,
					updatedAt: now
				}
			}));
		}
		removePlaylist(playlistId) {
			if (this.data.peek().playlists.length <= 1) return;
			this.commit((data) => {
				const playlists = data.playlists.filter((playlist) => playlist.id !== playlistId);
				const activePlaylistId = data.activePlaylistId === playlistId ? playlists[0].id : data.activePlaylistId;
				return {
					...data,
					playlists,
					activePlaylistId,
					playback: data.playback.playlistId === playlistId ? {
						playlistId: activePlaylistId,
						currentTime: 0,
						resumeRequested: false,
						updatedAt: Date.now()
					} : data.playback
				};
			});
		}
		selectPlaylist(playlistId) {
			if (!this.data.peek().playlists.some((item) => item.id === playlistId)) return;
			this.commit((data) => ({
				...data,
				activePlaylistId: playlistId,
				playback: {
					playlistId,
					currentTime: 0,
					resumeRequested: false,
					updatedAt: Date.now()
				}
			}));
		}
		addTrack(track) {
			this.commit((data) => ({
				...data,
				playlists: data.playlists.map((playlist) => playlist.id === data.activePlaylistId ? {
					...playlist,
					tracks: [...playlist.tracks, track],
					updatedAt: Date.now()
				} : playlist)
			}));
		}
		updateTrack(track) {
			this.commit((data) => ({
				...data,
				playlists: data.playlists.map((playlist) => playlist.id === data.activePlaylistId ? {
					...playlist,
					tracks: playlist.tracks.map((item) => item.id === track.id ? track : item),
					updatedAt: Date.now()
				} : playlist)
			}));
		}
		removeTrack(trackId) {
			this.commit((data) => ({
				...data,
				playlists: data.playlists.map((playlist) => playlist.id === data.activePlaylistId ? {
					...playlist,
					tracks: playlist.tracks.filter((track) => track.id !== trackId),
					updatedAt: Date.now()
				} : playlist),
				playback: data.playback.trackId === trackId ? {
					...data.playback,
					trackId: void 0,
					currentTime: 0,
					resumeRequested: false,
					updatedAt: Date.now()
				} : data.playback
			}));
		}
		setPlayMode(playMode) {
			this.commit((data) => ({
				...data,
				playMode
			}));
		}
		setVolume(volume) {
			this.commit((data) => ({
				...data,
				volume: Math.min(1, Math.max(0, volume))
			}));
		}
		requestTrack(track, currentTime = track.startTime) {
			this.commit((data) => ({
				...data,
				playback: {
					playlistId: data.activePlaylistId,
					trackId: track.id,
					currentTime,
					resumeRequested: true,
					updatedAt: Date.now()
				}
			}));
		}
		consumeResumeRequest() {
			this.commit((data) => ({
				...data,
				playback: {
					...data.playback,
					resumeRequested: false,
					updatedAt: Date.now()
				}
			}));
		}
		savePosition(currentTime) {
			if (!this.data.peek().playback.trackId) return;
			this.commit((data) => ({
				...data,
				playback: {
					...data.playback,
					currentTime,
					updatedAt: Date.now()
				}
			}));
		}
		commit(updater) {
			const next = updater(this.data.peek());
			this.data.value = next;
			this.repository.save(next);
		}
	};
	var appStore = new AppStore();
	var PLAYURL_PATH = /^\/x\/player\/(?:wbi\/)?playurl\/?$/;
	function isPlayurlUrl(url) {
		if (typeof url !== "string" || !url) return false;
		try {
			return PLAYURL_PATH.test(new URL(url, "https://www.bilibili.com").pathname);
		} catch {
			return false;
		}
	}
	function rewritePlayurlText(url, text) {
		if (!isPlayurlUrl(url)) return {
			value: text,
			changed: false,
			supported: false,
			reason: "not-playurl"
		};
		try {
			const result = rewritePlayurlPayload(JSON.parse(text));
			return {
				...result,
				value: result.changed ? JSON.stringify(result.value) : text
			};
		} catch {
			return {
				value: text,
				changed: false,
				supported: false,
				reason: "invalid-json"
			};
		}
	}
	function rewritePlayurlPayload(payload) {
		if (!isRecord(payload)) return unchanged(payload, "invalid-payload");
		const dashPaths = [
			["data", "dash"],
			["result", "dash"],
			[
				"data",
				"video_info",
				"dash"
			]
		];
		if (dashPaths.map((path) => getPath(payload, path)).filter(isRecord).length === 0) return unchanged(payload, containsDurl(payload) ? "durl-only" : "missing-dash");
		let hasAudio = false;
		let alreadyAudioOnly = false;
		const clone = cloneValue(payload);
		let changed = false;
		for (const path of dashPaths) {
			const sourceDash = getPath(payload, path);
			const targetDash = getPath(clone, path);
			if (!isRecord(sourceDash) || !isRecord(targetDash)) continue;
			if (!Array.isArray(sourceDash.audio) || sourceDash.audio.length === 0) continue;
			hasAudio = true;
			if (!Array.isArray(sourceDash.video)) continue;
			if (sourceDash.video.length === 0) {
				alreadyAudioOnly = true;
				continue;
			}
			targetDash.video = [];
			changed = true;
		}
		if (changed) return {
			value: clone,
			changed: true,
			supported: true,
			reason: "rewritten"
		};
		if (alreadyAudioOnly) return {
			value: payload,
			changed: false,
			supported: true,
			reason: "already-audio-only"
		};
		return unchanged(payload, hasAudio ? "missing-dash" : "missing-audio");
	}
	function unchanged(value, reason) {
		return {
			value,
			changed: false,
			supported: false,
			reason
		};
	}
	function containsDurl(payload) {
		return [
			["data", "durl"],
			["result", "durl"],
			[
				"data",
				"video_info",
				"durl"
			]
		].some((path) => Array.isArray(getPath(payload, path)));
	}
	function getPath(value, path) {
		let current = value;
		for (const key of path) {
			if (!isRecord(current)) return;
			current = current[key];
		}
		return current;
	}
	function isRecord(value) {
		return Boolean(value) && typeof value === "object" && !Array.isArray(value);
	}
	function cloneValue(value, seen = new WeakMap()) {
		if (!value || typeof value !== "object") return value;
		const cached = seen.get(value);
		if (cached) return cached;
		if (Array.isArray(value)) {
			const clone = [];
			seen.set(value, clone);
			for (const item of value) clone.push(cloneValue(item, seen));
			return clone;
		}
		const clone = {};
		seen.set(value, clone);
		for (const [key, item] of Object.entries(value)) clone[key] = cloneValue(item, seen);
		return clone;
	}
	var INSTALL_KEY = Symbol.for("bilibili-music-player:audio-only-interceptors");
	function installAudioOnlyInterceptors(pageWindow, onOutcome) {
		const installTarget = pageWindow;
		if (installTarget[INSTALL_KEY]) return;
		Object.defineProperty(installTarget, INSTALL_KEY, {
			configurable: false,
			value: true
		});
		installPlayinfoInterceptor(pageWindow, onOutcome);
		installFetchInterceptor(pageWindow, onOutcome);
		installXhrInterceptor(pageWindow, onOutcome);
	}
	function installPlayinfoInterceptor(pageWindow, onOutcome) {
		try {
			const descriptor = Object.getOwnPropertyDescriptor(pageWindow, "__playinfo__");
			if (descriptor && !descriptor.configurable) {
				onOutcome({
					supported: false,
					reason: "playinfo-nonconfigurable"
				});
				return;
			}
			let playinfo = descriptor?.get ? descriptor.get.call(pageWindow) : descriptor?.value;
			if (playinfo !== void 0) {
				const result = rewritePlayurlPayload(playinfo);
				playinfo = result.value;
				reportRewriteResult(result, onOutcome);
			}
			Object.defineProperty(pageWindow, "__playinfo__", {
				configurable: true,
				enumerable: descriptor?.enumerable ?? true,
				get: () => playinfo,
				set: (value) => {
					try {
						const result = rewritePlayurlPayload(value);
						playinfo = result.value;
						reportRewriteResult(result, onOutcome);
					} catch {
						playinfo = value;
						onOutcome({
							supported: false,
							reason: "playinfo-rewrite-failed"
						});
					}
				}
			});
		} catch {
			onOutcome({
				supported: false,
				reason: "playinfo-rewrite-failed"
			});
		}
	}
	function installFetchInterceptor(pageWindow, onOutcome) {
		const rawFetch = pageWindow.fetch;
		if (typeof rawFetch !== "function") return;
		pageWindow.fetch = async function(input, init) {
			const url = requestUrl(pageWindow, input);
			const response = await Reflect.apply(rawFetch, this, [input, init]);
			if (!isPlayurlUrl(url)) return response;
			try {
				const result = rewritePlayurlText(url, await response.clone().text());
				reportRewriteResult(result, onOutcome);
				if (!result.changed) return response;
				return createRewrittenResponse(pageWindow, response, result.value);
			} catch {
				onOutcome({
					supported: false,
					reason: "fetch-rewrite-failed"
				});
				return response;
			}
		};
	}
	function installXhrInterceptor(pageWindow, onOutcome) {
		const XHR = pageWindow.XMLHttpRequest;
		if (!XHR) return;
		const prototype = XHR.prototype;
		const responseDescriptor = Object.getOwnPropertyDescriptor(prototype, "response");
		const responseTextDescriptor = Object.getOwnPropertyDescriptor(prototype, "responseText");
		if (!responseDescriptor?.configurable || !responseDescriptor.get || !responseTextDescriptor?.configurable || !responseTextDescriptor.get) {
			onOutcome({
				supported: false,
				reason: "xhr-rewrite-failed"
			});
			return;
		}
		const states = new WeakMap();
		const rawOpen = prototype.open;
		const rawResponseGet = responseDescriptor.get;
		const rawResponseTextGet = responseTextDescriptor.get;
		try {
			Object.defineProperty(prototype, "response", {
				...responseDescriptor,
				get() {
					const original = rawResponseGet.call(this);
					return rewriteXhrValue(pageWindow, this, original, states, onOutcome, "response");
				}
			});
			Object.defineProperty(prototype, "responseText", {
				...responseTextDescriptor,
				get() {
					const original = rawResponseTextGet.call(this);
					return rewriteXhrValue(pageWindow, this, original, states, onOutcome, "text");
				}
			});
			prototype.open = function(method, url, ...rest) {
				states.set(this, {
					url: String(url),
					processed: false
				});
				return Reflect.apply(rawOpen, this, [
					method,
					url,
					...rest
				]);
			};
		} catch {
			onOutcome({
				supported: false,
				reason: "xhr-rewrite-failed"
			});
		}
	}
	function rewriteXhrValue(pageWindow, xhr, original, states, onOutcome, requestedValue) {
		const state = states.get(xhr);
		if (!state || xhr.readyState !== pageWindow.XMLHttpRequest.DONE || !isPlayurlUrl(state.url)) return original;
		if (!state.processed) {
			state.processed = true;
			try {
				switch (xhr.responseType) {
					case "":
					case "text": {
						const text = String(original ?? "");
						const result = rewritePlayurlText(state.url, text);
						reportRewriteResult(result, onOutcome);
						state.text = result.value;
						state.response = result.value;
						break;
					}
					case "json": {
						const result = rewritePlayurlPayload(original);
						reportRewriteResult(result, onOutcome);
						state.response = result.value;
						break;
					}
					case "arraybuffer": {
						if (!(original instanceof pageWindow.ArrayBuffer)) {
							state.response = original;
							onOutcome({
								supported: false,
								reason: "xhr-rewrite-failed"
							});
							break;
						}
						const text = new pageWindow.TextDecoder("utf-8").decode(original);
						const result = rewritePlayurlText(state.url, text);
						reportRewriteResult(result, onOutcome);
						state.response = result.changed ? new pageWindow.TextEncoder().encode(result.value).buffer : original;
						break;
					}
					default:
						state.response = original;
						onOutcome({
							supported: false,
							reason: "unsupported-response-type"
						});
				}
			} catch {
				state.response = original;
				onOutcome({
					supported: false,
					reason: "xhr-rewrite-failed"
				});
			}
		}
		return requestedValue === "text" ? state.text : state.response;
	}
	function requestUrl(pageWindow, input) {
		if (typeof input === "string") return input;
		if (input instanceof pageWindow.URL) return input.href;
		return input.url;
	}
	function createRewrittenResponse(pageWindow, original, text) {
		const headers = new pageWindow.Headers(original.headers);
		headers.delete("content-encoding");
		headers.delete("content-length");
		const rewritten = new pageWindow.Response(text, {
			status: original.status,
			statusText: original.statusText,
			headers
		});
		for (const property of [
			"url",
			"redirected",
			"type"
		]) try {
			Object.defineProperty(rewritten, property, {
				configurable: true,
				value: original[property]
			});
		} catch {}
		return rewritten;
	}
	function reportRewriteResult(result, onOutcome) {
		onOutcome({
			supported: result.supported,
			reason: result.reason
		});
	}
	var STORAGE_KEY = "bilibili-music-player:audio-only";
	var STYLE_ID = "bilibili-music-player-audio-only-style";
	var ROOT_ATTRIBUTE = "data-bmp-audio-only";
	var PAGE_STYLE = `
html[${ROOT_ATTRIBUTE}="active"] .bpx-player-video-wrap video,
html[${ROOT_ATTRIBUTE}="active"] #bilibili-player video,
html[${ROOT_ATTRIBUTE}="active"] .bilibili-player-video video,
html[${ROOT_ATTRIBUTE}="active"] video.bpx-player-video {
  visibility: hidden !important;
}
`;
	var AudioOnlyController = class {
		state = (0, _preact_signals.signal)(createInitialState());
		started = false;
		diagnosticLogged = false;
		start() {
			if (this.started) return;
			this.started = true;
			if (!this.state.peek().requested) return;
			installAudioOnlyInterceptors(_unsafeWindow, (outcome) => this.handleOutcome(outcome));
		}
		toggle(currentTime = 0) {
			this.setEnabled(!this.state.peek().requested, currentTime);
		}
		setEnabled(enabled, currentTime = 0) {
			_GM_setValue(STORAGE_KEY, enabled);
			this.state.value = {
				requested: enabled,
				status: enabled ? "detecting" : "off"
			};
			this.applyPagePresentation(false);
			const url = new URL(location.href);
			const resumeTime = Number.isFinite(currentTime) ? Math.max(0, Math.floor(currentTime)) : 0;
			if (resumeTime > 0) url.searchParams.set("t", String(resumeTime));
			else url.searchParams.delete("t");
			location.replace(url.href);
		}
		handleOutcome(outcome) {
			if (outcome.reason === "not-playurl") return;
			const active = outcome.supported;
			this.state.value = {
				requested: true,
				status: active ? "active" : "fallback",
				reason: outcome.reason
			};
			this.applyPagePresentation(active);
			if (!this.diagnosticLogged) {
				this.diagnosticLogged = true;
				console.info("[Bilibili Music Player] audio-only", {
					status: active ? "active" : "fallback",
					reason: outcome.reason
				});
			}
		}
		applyPagePresentation(active) {
			const root = document.documentElement;
			if (!root) {
				document.addEventListener("readystatechange", () => this.applyPagePresentation(this.state.peek().status === "active"), { once: true });
				return;
			}
			if (active) {
				ensurePageStyle(root);
				root.setAttribute(ROOT_ATTRIBUTE, "active");
			} else root.removeAttribute(ROOT_ATTRIBUTE);
		}
	};
	function createInitialState() {
		const stored = _GM_getValue(STORAGE_KEY, false);
		const requested = stored === true || stored === 1 || stored === "1";
		return {
			requested,
			status: requested ? "detecting" : "off"
		};
	}
	function ensurePageStyle(root) {
		if (document.getElementById(STYLE_ID)) return;
		const style = document.createElement("style");
		style.id = STYLE_ID;
		style.textContent = PAGE_STYLE;
		(document.head ?? root).append(style);
	}
	var audioOnlyController = new AudioOnlyController();
	var MediaLocator = class {
		listener;
		current = null;
		currentUrl = location.href;
		mutationObserver;
		scanTimer;
		routeTimer;
		scanQueued = false;
		constructor(listener) {
			this.listener = listener;
		}
		start() {
			this.scan();
			this.mutationObserver = new MutationObserver(() => this.queueScan());
			this.mutationObserver.observe(document.documentElement, {
				childList: true,
				subtree: true
			});
			this.scanTimer = window.setInterval(() => this.scan(), 1e3);
			this.routeTimer = window.setInterval(() => {
				if (location.href === this.currentUrl) return;
				this.currentUrl = location.href;
				this.listener(this.current, "route");
				this.queueScan();
			}, 300);
		}
		stop() {
			this.mutationObserver?.disconnect();
			window.clearInterval(this.scanTimer);
			window.clearInterval(this.routeTimer);
		}
		queueScan() {
			if (this.scanQueued) return;
			this.scanQueued = true;
			window.setTimeout(() => {
				this.scanQueued = false;
				this.scan();
			}, 100);
		}
		scan() {
			const candidate = findActiveMedia();
			if (candidate === this.current) return;
			this.current = candidate;
			this.listener(candidate, "media");
		}
	};
	function findActiveMedia() {
		return [...document.querySelectorAll("video, audio")].filter((media) => media.isConnected && !media.closest("#bilibili-music-player-host") && media.getAttribute("aria-hidden") !== "true").sort((left, right) => mediaScore(right) - mediaScore(left))[0] ?? null;
	}
	function mediaScore(media) {
		const area = media.clientWidth * media.clientHeight;
		const ready = media.readyState > 0 ? 1e6 : 0;
		const hasDuration = Number.isFinite(media.duration) ? 1e5 : 0;
		return (media.paused ? 0 : 1e7) + ready + hasDuration + area;
	}
	function selectAdjacentTrack(playlist, currentTrackId, mode, options) {
		const tracks = playlist?.tracks ?? [];
		if (tracks.length === 0) return;
		const currentIndex = Math.max(0, tracks.findIndex((track) => track.id === currentTrackId));
		if (mode === "single-loop" && options.automatic) return tracks[currentIndex];
		if (mode === "shuffle" && tracks.length > 1) {
			const random = options.random ?? Math.random;
			return tracks[(currentIndex + (1 + Math.floor(random() * (tracks.length - 1)))) % tracks.length];
		}
		const nextIndex = currentIndex + options.direction;
		if (nextIndex >= 0 && nextIndex < tracks.length) return tracks[nextIndex];
		if (mode === "list-loop" || mode === "single-loop") return tracks[(nextIndex + tracks.length) % tracks.length];
	}
	var CHANNEL_NAME = "bilibili-music-player";
	var TabCoordinator = class {
		id = crypto.randomUUID();
		channel = typeof BroadcastChannel === "undefined" ? void 0 : new BroadcastChannel(CHANNEL_NAME);
		constructor(onOtherTabClaimed) {
			if (this.channel) this.channel.onmessage = (event) => {
				const message = event.data;
				if (message.type === "claim" && message.tabId !== this.id) onOtherTabClaimed();
			};
		}
		claim() {
			this.channel?.postMessage({
				type: "claim",
				tabId: this.id
			});
		}
		close() {
			this.channel?.close();
		}
	};
	var INITIAL_RUNTIME_STATE = {
		mediaReady: false,
		playing: false,
		currentTime: 0,
		duration: 0,
		volume: 1,
		muted: false,
		playbackContext: "page",
		nowPlaying: {
			title: "未连接到 Bilibili 播放器",
			startTime: 0,
			storedDuration: 0
		},
		requiresInteraction: false
	};
	var PlayerEngine = class {
		store;
		state = (0, _preact_signals.signal)(INITIAL_RUNTIME_STATE);
		media = null;
		mediaEvents;
		positionSavedAt = 0;
		segmentAdvancing = false;
		locator;
		tabs;
		constructor(store) {
			this.store = store;
			this.locator = new MediaLocator((media, reason) => this.handleMediaChange(media, reason));
			this.tabs = new TabCoordinator(() => {
				if (this.media && !this.media.paused) this.media.pause();
			});
		}
		start() {
			this.store.start();
			this.setPlaybackContext(this.shouldUsePlaylistContext() ? "playlist" : "page");
			this.locator.start();
			this.installMediaSessionHandlers();
			window.addEventListener("pagehide", this.savePosition);
		}
		stop() {
			this.savePosition();
			this.mediaEvents?.abort();
			this.locator.stop();
			this.tabs.close();
			this.store.stop();
			window.removeEventListener("pagehide", this.savePosition);
		}
		get currentMedia() {
			return this.media;
		}
		async togglePlayback() {
			if (!this.media) {
				this.setMessage("尚未找到 Bilibili 播放器");
				return;
			}
			if (!this.media.paused) {
				this.media.pause();
				return;
			}
			const data = this.store.data.peek();
			const track = this.store.findTrack(data.playback.trackId);
			if (this.isPlaylistContext() && data.playback.resumeRequested && track && !this.isCurrentPage(track)) {
				this.playTrack(track);
				return;
			}
			await this.tryPlay();
		}
		seek(time) {
			if (!this.media || !Number.isFinite(this.media.duration)) return;
			this.media.currentTime = clamp(time, 0, this.media.duration);
			this.syncRuntime();
		}
		setVolume(volume) {
			const normalized = clamp(volume, 0, 1);
			this.store.setVolume(normalized);
			if (this.media) {
				this.media.volume = normalized;
				this.media.muted = false;
			}
		}
		toggleMute() {
			if (this.media) this.media.muted = !this.media.muted;
		}
		setPlayMode(mode) {
			this.store.setPlayMode(mode);
		}
		exitPlaylistPlayback() {
			if (this.store.data.peek().playback.resumeRequested) this.store.consumeResumeRequest();
			this.exitPlaylistContext();
		}
		playTrack(track) {
			this.store.requestTrack(track);
			this.setPlaybackContext("playlist");
			if (!this.isCurrentPage(track)) {
				location.assign(buildTrackUrl(track));
				return;
			}
			this.setPlaylistRouteMarker(true);
			this.refreshPageMetadata();
			this.resumeRequestedTrack();
		}
		next(automatic = false) {
			const data = this.store.data.peek();
			const track = selectAdjacentTrack(data.playlists.find((item) => item.id === data.playback.playlistId), data.playback.trackId, data.playMode, {
				direction: 1,
				automatic
			});
			if (!track) {
				if (automatic) {
					this.media?.pause();
					this.exitPlaylistContext();
				}
				return;
			}
			this.playTrack(track);
		}
		previous() {
			const data = this.store.data.peek();
			const track = selectAdjacentTrack(data.playlists.find((item) => item.id === data.playback.playlistId), data.playback.trackId, data.playMode, { direction: -1 });
			if (track) this.playTrack(track);
		}
		handleMediaChange(media, reason) {
			if (media !== this.media) this.bindMedia(media);
			if (reason === "route") {
				this.setPlaybackContext(this.shouldUsePlaylistContext() ? "playlist" : "page");
				this.refreshPageMetadata();
				window.setTimeout(() => this.refreshPageMetadata(), 1e3);
			}
			if (media && this.isPlaylistContext() && this.store.data.peek().playback.resumeRequested) this.resumeRequestedTrack();
		}
		bindMedia(media) {
			this.mediaEvents?.abort();
			this.mediaEvents = void 0;
			this.media = media;
			if (!media) {
				const playbackContext = this.state.peek().playbackContext;
				this.state.value = {
					...INITIAL_RUNTIME_STATE,
					volume: this.store.data.peek().volume,
					playbackContext
				};
				return;
			}
			media.volume = this.store.data.peek().volume;
			const controller = new AbortController();
			const options = { signal: controller.signal };
			this.mediaEvents = controller;
			media.addEventListener("play", this.handlePlay, options);
			media.addEventListener("pause", this.syncRuntime, options);
			media.addEventListener("timeupdate", this.handleTimeUpdate, options);
			media.addEventListener("durationchange", this.syncRuntime, options);
			media.addEventListener("loadedmetadata", this.handleLoadedMetadata, options);
			media.addEventListener("volumechange", this.syncRuntime, options);
			media.addEventListener("ended", this.handleEnded, options);
			this.refreshPageMetadata();
			this.syncRuntime();
		}
		handlePlay = () => {
			this.tabs.claim();
			this.state.value = {
				...this.state.peek(),
				playing: true,
				requiresInteraction: false,
				message: void 0
			};
			this.updateMediaSession();
		};
		handleTimeUpdate = () => {
			this.syncRuntime();
			const track = this.getActiveTrack();
			if (track?.endTime !== void 0 && this.media && this.media.currentTime >= track.endTime - .15 && !this.segmentAdvancing) {
				this.segmentAdvancing = true;
				this.next(true);
				window.setTimeout(() => {
					this.segmentAdvancing = false;
				}, 500);
				return;
			}
			if (this.media && Date.now() - this.positionSavedAt >= 1e4 && track) {
				this.positionSavedAt = Date.now();
				this.store.savePosition(this.media.currentTime);
			}
		};
		handleLoadedMetadata = () => {
			this.syncRuntime();
			if (this.isPlaylistContext() && this.store.data.peek().playback.resumeRequested) this.resumeRequestedTrack();
		};
		handleEnded = () => {
			if (this.getActiveTrack()) this.next(true);
		};
		syncRuntime = () => {
			if (!this.media) return;
			this.state.value = {
				...this.state.peek(),
				mediaReady: this.media.readyState > 0,
				playing: !this.media.paused,
				currentTime: this.media.currentTime || 0,
				duration: Number.isFinite(this.media.duration) ? this.media.duration : 0,
				volume: this.media.volume,
				muted: this.media.muted
			};
			this.updateMediaPosition();
		};
		async resumeRequestedTrack() {
			const media = this.media;
			const data = this.store.data.peek();
			const track = this.store.findTrack(data.playback.trackId);
			if (!this.isPlaylistContext() || !media || !track || !this.isCurrentPage(track)) return;
			if (media.readyState === 0) return;
			const resumeTime = data.playback.currentTime >= track.startTime && (track.endTime === void 0 || data.playback.currentTime < track.endTime) ? data.playback.currentTime : track.startTime;
			media.currentTime = clamp(resumeTime, 0, Number.isFinite(media.duration) ? media.duration : resumeTime);
			this.refreshPageMetadata();
			this.store.consumeResumeRequest();
			await this.tryPlay();
		}
		async tryPlay() {
			if (!this.media) return;
			try {
				await this.media.play();
				this.state.value = {
					...this.state.peek(),
					requiresInteraction: false,
					message: void 0
				};
			} catch {
				this.state.value = {
					...this.state.peek(),
					requiresInteraction: true,
					message: "浏览器阻止了自动播放，请点击播放按钮继续"
				};
			}
		}
		refreshPageMetadata() {
			const track = this.getActiveTrack();
			const metadata = readCurrentVideoMetadata();
			this.state.value = {
				...this.state.peek(),
				nowPlaying: {
					trackId: track?.id,
					title: track?.title ?? metadata?.title ?? "Bilibili 音乐播放器",
					uploader: metadata?.uploader ?? track?.uploader,
					cover: metadata?.cover ?? track?.cover,
					startTime: track?.startTime ?? 0,
					endTime: track?.endTime,
					storedDuration: track?.duration ?? 0
				}
			};
			this.updateMediaSession();
		}
		getActiveTrack() {
			if (!this.isPlaylistContext()) return;
			const track = this.store.findTrack(this.store.data.peek().playback.trackId);
			return track && this.isCurrentPage(track) ? track : void 0;
		}
		isPlaylistContext() {
			return this.state.peek().playbackContext === "playlist";
		}
		shouldUsePlaylistContext() {
			if (!hasPlaylistRouteMarker()) return false;
			const track = this.store.findTrack(this.store.data.peek().playback.trackId);
			return Boolean(track && this.isCurrentPage(track));
		}
		setPlaybackContext(playbackContext) {
			if (this.state.peek().playbackContext === playbackContext) return;
			this.state.value = {
				...this.state.peek(),
				playbackContext
			};
		}
		exitPlaylistContext() {
			this.setPlaybackContext("page");
			this.setPlaylistRouteMarker(false);
			this.refreshPageMetadata();
		}
		setPlaylistRouteMarker(enabled) {
			const url = new URL(location.href);
			if (enabled) url.searchParams.set("bili_music", "1");
			else url.searchParams.delete("bili_music");
			if (url.href !== location.href) history.replaceState(history.state, "", url);
		}
		isCurrentPage(track) {
			return getBvid()?.toLowerCase() === track.bvid.toLowerCase() && (track.page ?? 1) === (getPageNumber() ?? 1);
		}
		setMessage(message) {
			this.state.value = {
				...this.state.peek(),
				message
			};
		}
		savePosition = () => {
			if (this.media && this.getActiveTrack()) this.store.savePosition(this.media.currentTime);
		};
		installMediaSessionHandlers() {
			if (!("mediaSession" in navigator)) return;
			const handlers = {
				play: () => void this.togglePlayback(),
				pause: () => this.media?.pause(),
				previoustrack: () => this.previous(),
				nexttrack: () => this.next(),
				seekto: (details) => {
					if (details.seekTime !== void 0) this.seek(details.seekTime);
				},
				seekbackward: (details) => this.seek((this.media?.currentTime ?? 0) - (details.seekOffset ?? 10)),
				seekforward: (details) => this.seek((this.media?.currentTime ?? 0) + (details.seekOffset ?? 10))
			};
			for (const [action, handler] of Object.entries(handlers)) try {
				navigator.mediaSession.setActionHandler(action, handler ?? null);
			} catch {}
		}
		updateMediaSession() {
			if (!("mediaSession" in navigator)) return;
			const { nowPlaying } = this.state.peek();
			navigator.mediaSession.metadata = new MediaMetadata({
				title: nowPlaying.title,
				artist: nowPlaying.uploader ?? "Bilibili",
				album: "Bilibili Music Player",
				artwork: nowPlaying.cover ? [{
					src: nowPlaying.cover,
					sizes: "512x512",
					type: "image/jpeg"
				}] : []
			});
		}
		updateMediaPosition() {
			if (!("mediaSession" in navigator) || !this.media || !Number.isFinite(this.media.duration) || this.media.duration <= 0) return;
			try {
				navigator.mediaSession.setPositionState({
					duration: this.media.duration,
					playbackRate: this.media.playbackRate,
					position: clamp(this.media.currentTime, 0, this.media.duration)
				});
			} catch {}
		}
	};
	function buildTrackUrl(track) {
		const url = new URL(`/video/${track.bvid}/`, location.origin);
		if (track.page && track.page > 1) url.searchParams.set("p", String(track.page));
		url.searchParams.set("bili_music", "1");
		return url.href;
	}
	function hasPlaylistRouteMarker(url = location.href) {
		return new URL(url).searchParams.get("bili_music") === "1";
	}
	var HOST_ID = "bilibili-music-player-host";
	var BILIBILI_PLAYER_SELECTOR = ".bpx-player-container";
	var BILIBILI_WEB_FULLSCREEN_SELECTOR = `${BILIBILI_PLAYER_SELECTOR}[data-screen="web"]`;
	audioOnlyController.start();
	function containsBilibiliPlayer(node) {
		return node instanceof Element && (node.matches(BILIBILI_PLAYER_SELECTOR) || node.querySelector(BILIBILI_PLAYER_SELECTOR) !== null);
	}
	function observeWebFullscreen(host) {
		const syncVisibility = () => {
			host.toggleAttribute("data-web-fullscreen", document.querySelector(BILIBILI_WEB_FULLSCREEN_SELECTOR) !== null);
		};
		const observer = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.type === "attributes" || [...mutation.addedNodes, ...mutation.removedNodes].some(containsBilibiliPlayer))) syncVisibility();
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-screen"],
			childList: true,
			subtree: true
		});
		syncVisibility();
		return () => observer.disconnect();
	}
	function isolateKeyboardEvents(mountPoint) {
		const stopPropagation = (event) => {
			event.stopPropagation();
		};
		mountPoint.addEventListener("keydown", stopPropagation);
		mountPoint.addEventListener("keyup", stopPropagation);
		return () => {
			mountPoint.removeEventListener("keydown", stopPropagation);
			mountPoint.removeEventListener("keyup", stopPropagation);
		};
	}
	function mount() {
		if (document.getElementById(HOST_ID)) return;
		const host = document.createElement("div");
		host.id = HOST_ID;
		const shadowRoot = host.attachShadow({ mode: "open" });
		const mountPoint = document.createElement("div");
		mountPoint.id = "bilibili-music-player-root";
		shadowRoot.append(styles_css_default, mountPoint);
		document.documentElement.append(host);
		const stopObservingWebFullscreen = observeWebFullscreen(host);
		const stopIsolatingKeyboardEvents = isolateKeyboardEvents(mountPoint);
		const engine = new PlayerEngine(appStore);
		engine.start();
		(0, preact.render)((0, preact_jsx_runtime.jsx)(App, {
			store: appStore,
			engine,
			audioOnly: audioOnlyController
		}), mountPoint);
		window.addEventListener("pagehide", () => {
			stopObservingWebFullscreen();
			stopIsolatingKeyboardEvents();
			engine.stop();
			(0, preact.render)(null, mountPoint);
		}, { once: true });
	}
	if (document.documentElement) mount();
	else document.addEventListener("readystatechange", mount, { once: true });
})(preact, preactHooks, jsxRuntime, preactSignals);
