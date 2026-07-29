import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const PAGE_URL = "https://www.bilibili.com/video/BV1AudioOnly/";
const API_URL = "https://www.bilibili.com/x/player/playurl";
const BINARY_URL = "https://www.bilibili.com/test-binary";
const STORAGE_PREFIX = "__bili_music_e2e__:";
const AUDIO_ONLY_KEY = "bilibili-music-player:audio-only";
const USER_SCRIPT = readFileSync(
  path.resolve("dist/bilibili-music-player.user.js"),
  "utf8",
);

test("rewrites initial __playinfo__ and hides only the video picture", async ({
  page,
}) => {
  await installAtDocumentStart(page, true);
  await routeVideoPage(
    page,
    `
      <script>
        window.__playinfo__ = ${JSON.stringify(dashPayload())};
        window.__observedPlayinfo__ = window.__playinfo__;
      </script>
      ${playerMarkup()}
    `,
  );

  await page.goto(PAGE_URL);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __observedPlayinfo__: {
                data: { dash: { video: unknown[] } };
              };
            }
          ).__observedPlayinfo__.data.dash.video,
      ),
    )
    .toEqual([]);
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as {
            __observedPlayinfo__: {
              data: { dash: { audio: unknown[] } };
            };
          }
        ).__observedPlayinfo__.data.dash.audio,
    ),
  ).toEqual([{ id: 30280, baseUrl: "audio.m4s" }]);
  await expect(page.locator("html")).toHaveAttribute(
    "data-bmp-audio-only",
    "active",
  );
  await expect(page.locator("video")).toHaveCSS("visibility", "hidden");
  await expect(page.locator(".bpx-player-control-wrap")).toBeVisible();

  await openPlayerPanel(page);
  await expect(
    page.getByText("纯音频模式已生效：视频流已被移除"),
  ).toBeVisible();
});

test("rewrites fetch playurl responses and preserves response URL", async ({
  page,
}) => {
  await installAtDocumentStart(page, true);
  await routePlayurl(page);
  await routeVideoPage(
    page,
    `
      <script>
        fetch("${API_URL}?source=fetch")
          .then(async (response) => {
            window.__fetchResponseUrl__ = response.url;
            window.__fetchResult__ = await response.json();
          });
      </script>
      ${playerMarkup()}
    `,
  );

  await page.goto(PAGE_URL);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __fetchResult__?: {
                data: { dash: { video: unknown[] } };
              };
            }
          ).__fetchResult__?.data.dash.video,
      ),
    )
    .toEqual([]);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __fetchResponseUrl__: string })
          .__fetchResponseUrl__,
    ),
  ).toBe(`${API_URL}?source=fetch`);
});

test("rewrites XHR text, json, and arraybuffer without changing native errors", async ({
  page,
}) => {
  await installAtDocumentStart(page, true);
  await routePlayurl(page);
  await page.route(BINARY_URL, async (route) => {
    await route.fulfill({
      contentType: "application/octet-stream",
      body: Buffer.from([1, 2, 3, 4]),
    });
  });
  await routeVideoPage(
    page,
    `
      <script>
        function requestPlayurl(kind, responseType, useResponseText) {
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", "${API_URL}?kind=" + kind);
            xhr.responseType = responseType;
            xhr.onload = () => {
              try {
                const value = useResponseText ? xhr.responseText : xhr.response;
                if (responseType === "arraybuffer") {
                  resolve(JSON.parse(new TextDecoder().decode(value)));
                } else if (typeof value === "string") {
                  resolve(JSON.parse(value));
                } else {
                  resolve(value);
                }
              } catch (error) {
                reject(error);
              }
            };
            xhr.onerror = reject;
            xhr.send();
          });
        }

        function readUnrelatedResponseText() {
          return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", "${BINARY_URL}");
            xhr.responseType = "arraybuffer";
            xhr.onload = () => {
              try {
                void xhr.responseText;
                resolve("no-error");
              } catch (error) {
                resolve(error.name);
              }
            };
            xhr.onerror = reject;
            xhr.send();
          });
        }

        Promise.all([
          requestPlayurl("text-response", "", false),
          requestPlayurl("text-responseText", "text", true),
          requestPlayurl("json", "json", false),
          requestPlayurl("arraybuffer", "arraybuffer", false),
          readUnrelatedResponseText(),
        ]).then(([textResponse, textResponseText, json, arraybuffer, nativeError]) => {
          window.__xhrResults__ = {
            textResponse,
            textResponseText,
            json,
            arraybuffer,
            nativeError,
          };
        });
      </script>
      ${playerMarkup()}
    `,
  );

  await page.goto(PAGE_URL);

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __xhrResults__?: {
                textResponse: {
                  data: { dash: { video: unknown[] } };
                };
                textResponseText: {
                  data: { dash: { video: unknown[] } };
                };
                json: { data: { dash: { video: unknown[] } } };
                arraybuffer: {
                  data: { dash: { video: unknown[] } };
                };
                nativeError: string;
              };
            }
          ).__xhrResults__,
      ),
    )
    .toMatchObject({
      textResponse: { data: { dash: { video: [] } } },
      textResponseText: { data: { dash: { video: [] } } },
      json: { data: { dash: { video: [] } } },
      arraybuffer: { data: { dash: { video: [] } } },
      nativeError: "InvalidStateError",
    });
});

test("falls back to visible video for durl-only playinfo", async ({ page }) => {
  await installAtDocumentStart(page, true);
  await routeVideoPage(
    page,
    `
      <script>
        window.__playinfo__ = {
          code: 0,
          data: { durl: [{ url: "muxed.mp4" }] },
        };
      </script>
      ${playerMarkup()}
    `,
  );

  await page.goto(PAGE_URL);

  await expect(page.locator("html")).not.toHaveAttribute(
    "data-bmp-audio-only",
    "active",
  );
  await expect(page.locator("video")).toHaveCSS("visibility", "visible");
  await openPlayerPanel(page);
  await expect(
    page.getByText(
      "纯音频模式未生效，已回退正常视频：当前视频只提供音视频混流",
    ),
  ).toBeVisible();
});

test("persists both toggle directions and preserves navigation context", async ({
  page,
}) => {
  await installAtDocumentStart(page, false);
  await routeVideoPage(
    page,
    `
      ${playerMarkup()}
      <script>
        window.__playinfo__ = ${JSON.stringify(dashPayload())};
        const media = document.querySelector("video");
        let currentTime = 42;
        Object.defineProperties(media, {
          currentTime: {
            configurable: true,
            get: () => currentTime,
            set: (value) => { currentTime = value; },
          },
          duration: { configurable: true, get: () => 240 },
          readyState: { configurable: true, get: () => 4 },
        });
        window.__setTestCurrentTime__ = (value) => { currentTime = value; };
      </script>
    `,
  );

  await page.goto(`${PAGE_URL}?p=2&bili_music=1&t=99`);
  expect(
    await page.evaluate(
      () =>
        window.fetch ===
          (
            window as unknown as {
              __testNativeFetch__: typeof window.fetch;
            }
          ).__testNativeFetch__ &&
        XMLHttpRequest.prototype.open ===
          (
            window as unknown as {
              __testNativeXhrOpen__: typeof XMLHttpRequest.prototype.open;
            }
          ).__testNativeXhrOpen__,
    ),
  ).toBe(true);
  await openPlayerPanel(page);
  await expect(
    page.getByRole("button", { name: "将当前视频添加到歌单" }),
  ).toBeEnabled();

  await page.getByRole("button", { name: "开启纯音频模式并重载页面" }).click();
  await page.waitForURL((url) => url.searchParams.get("t") === "42");

  let url = new URL(page.url());
  expect(url.searchParams.get("p")).toBe("2");
  expect(url.searchParams.get("bili_music")).toBe("1");
  expect(await readStoredAudioMode(page)).toBe(true);
  await expect(page.locator("html")).toHaveAttribute(
    "data-bmp-audio-only",
    "active",
  );

  await openPlayerPanel(page);
  await page.evaluate(() => {
    (
      window as unknown as {
        __setTestCurrentTime__: (value: number) => void;
      }
    ).__setTestCurrentTime__(0);
  });
  await page
    .getByRole("button", {
      name: "纯音频模式已生效；点击关闭并重载",
    })
    .click();
  await page.waitForURL((nextUrl) => !nextUrl.searchParams.has("t"));

  url = new URL(page.url());
  expect(url.searchParams.get("p")).toBe("2");
  expect(url.searchParams.get("bili_music")).toBe("1");
  expect(await readStoredAudioMode(page)).toBe(false);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-bmp-audio-only",
    "active",
  );
});

async function installAtDocumentStart(
  page: Page,
  initiallyEnabled: boolean,
): Promise<void> {
  const initialValue = JSON.stringify(initiallyEnabled);
  await page.addInitScript({
    content: `
      (() => {
        const storagePrefix = ${JSON.stringify(STORAGE_PREFIX)};
        const audioOnlyStorageKey =
          storagePrefix + ${JSON.stringify(AUDIO_ONLY_KEY)};
        if (localStorage.getItem(audioOnlyStorageKey) === null) {
          localStorage.setItem(audioOnlyStorageKey, ${JSON.stringify(initialValue)});
        }

        const listeners = new Map();
        let listenerId = 0;
        window.__testNativeFetch__ = window.fetch;
        window.__testNativeXhrOpen__ = XMLHttpRequest.prototype.open;
        Object.assign(window, {
          unsafeWindow: window,
          GM_getValue(name, fallback) {
            const raw = localStorage.getItem(storagePrefix + name);
            return raw === null ? fallback : JSON.parse(raw);
          },
          GM_setValue(name, value) {
            localStorage.setItem(storagePrefix + name, JSON.stringify(value));
          },
          GM_addValueChangeListener(_name, listener) {
            listenerId += 1;
            listeners.set(listenerId, listener);
            return listenerId;
          },
          GM_removeValueChangeListener(id) {
            listeners.delete(id);
          },
        });
      })();
      ${USER_SCRIPT}
    `,
  });
}

async function routeVideoPage(page: Page, body: string): Promise<void> {
  await page.route(`${PAGE_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>纯音频测试_bilibili</title>
          </head>
          <body>
            <h1 class="video-title" title="纯音频测试">纯音频测试</h1>
            ${body}
          </body>
        </html>
      `,
    });
  });
}

async function routePlayurl(page: Page): Promise<void> {
  await page.route(`${API_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify(dashPayload()),
    });
  });
}

async function openPlayerPanel(page: Page): Promise<void> {
  const openButton = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  if (await openButton.isVisible()) {
    await openButton.click();
  }
  await expect(
    page.getByRole("region", { name: "Bilibili 音乐播放器" }),
  ).toBeVisible();
}

async function readStoredAudioMode(page: Page): Promise<boolean> {
  return page.evaluate(
    ({ prefix, key }) =>
      JSON.parse(localStorage.getItem(prefix + key) ?? "false") as boolean,
    { prefix: STORAGE_PREFIX, key: AUDIO_ONLY_KEY },
  );
}

function dashPayload() {
  return {
    code: 0,
    data: {
      dash: {
        video: [{ id: 80, baseUrl: "video.m4s" }],
        audio: [{ id: 30280, baseUrl: "audio.m4s" }],
      },
    },
  };
}

function playerMarkup(): string {
  return `
    <div class="bpx-player-container">
      <div class="bpx-player-video-wrap">
        <video style="display:block;width:900px;height:506px"></video>
      </div>
      <div class="bpx-player-control-wrap">播放器控件</div>
    </div>
  `;
}
