import { expect, test, type Page } from "@playwright/test";
import { BUILT_USERSCRIPT, injectBuiltUserscript } from "../helpers/userscript";

const VIDEO_URL = "https://www.bilibili.com/video/BV1xQ4y157Qi/";
// 拜年纪等专题/活动页：B 站把播放器内联渲染在 `#bilibili-player` 里（light DOM、无 iframe），
// 当前视频由 `?bvid=` 指定。实测（2026-10）`/video/BV1wzaE63EEw/` 会被客户端重定向到
// `/festival/ournotesBonly?bvid=BV1wzaE63EEw`，所以这条路由必须能独立工作。
const FESTIVAL_URL =
  "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2";
const FESTIVAL_ACTIVITY_TITLE = "2025哔哩哔哩拜年纪";

/** 真实站点用的是内存版 GM 替身：只要插件能起引擎、找到媒体即可。 */
async function installMemoryGm(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const memory = new Map<string, unknown>();
    Object.assign(window, {
      GM_getValue(name: string, fallback?: unknown) {
        return memory.get(name) ?? fallback;
      },
      GM_setValue(name: string, value: unknown) {
        memory.set(name, value);
      },
      GM_addValueChangeListener() {
        return 1;
      },
      GM_removeValueChangeListener() {},
    });
  });
}

test("mounts on a real public Bilibili video page", async ({
  page,
}, testInfo) => {
  await installMemoryGm(page);

  await page.goto(VIDEO_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("video").first()).toBeAttached({
    timeout: 30_000,
  });

  await injectBuiltUserscript(page);

  const openButton = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  await expect(openButton).toBeVisible({ timeout: 15_000 });
  await openButton.click();
  await expect(
    page.getByRole("region", { name: "Bilibili 音乐播放器" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "将当前视频添加到歌单" }),
  ).toBeEnabled();

  await page.screenshot({
    path: testInfo.outputPath("real-bilibili.png"),
    fullPage: false,
  });
});

test("mounts on a real Bilibili festival page and binds its inline player", async ({
  page,
}, testInfo) => {
  await installMemoryGm(page);

  await page.goto(FESTIVAL_URL, { waitUntil: "domcontentloaded" });
  // 专题页是客户端渲染：等真正内联的播放器出现（不是活动页里的装饰性媒体）。
  await expect(page.locator("#bilibili-player video").first()).toBeAttached({
    timeout: 45_000,
  });

  await injectBuiltUserscript(page);

  const openButton = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  await expect(openButton).toBeVisible({ timeout: 15_000 });
  await openButton.click();
  await expect(
    page.getByRole("region", { name: "Bilibili 音乐播放器" }),
  ).toBeVisible();

  // 引擎真的绑上了专题页那个 <video>：能添加当前视频就说明 currentMedia 存在。
  await expect(
    page.getByRole("button", { name: "将当前视频添加到歌单" }),
  ).toBeEnabled({ timeout: 30_000 });

  // 标题必须来自播放器工具条里的当前视频，而不是活动名（document.title）。
  const title = page.locator(".now-playing-copy strong");
  await expect(title).not.toHaveText(FESTIVAL_ACTIVITY_TITLE, {
    timeout: 15_000,
  });
  await expect(title).not.toHaveText("当前 Bilibili 视频");

  await page.screenshot({
    path: testInfo.outputPath("real-festival.png"),
    fullPage: false,
  });
});

test("requests audio but not advertised video media in audio-only mode", async ({
  page,
}) => {
  const requestedUrls: string[] = [];
  page.on("request", (request) => requestedUrls.push(request.url()));

  await page.addInitScript({
    content: `
      if (window.top === window) {
        (() => {
          const memory = new Map([
            ["bilibili-music-player:audio-only", true],
          ]);
          Object.assign(window, {
            unsafeWindow: window,
            GM_getValue(name, fallback) {
              return memory.has(name) ? memory.get(name) : fallback;
            },
            GM_setValue(name, value) {
              memory.set(name, value);
            },
            GM_addValueChangeListener() {
              return 1;
            },
            GM_removeValueChangeListener() {},
          });

          function urlsFor(entries) {
            if (!Array.isArray(entries)) {
              return [];
            }
            return entries.flatMap((entry) => [
              entry?.baseUrl,
              entry?.base_url,
              ...(entry?.backupUrl ?? []),
              ...(entry?.backup_url ?? []),
            ]).filter((value) => typeof value === "string");
          }

          window.__bmpOriginalDashUrls__ = {
            video: [],
            audio: [],
          };
          window.__bmpCaptureDash__ = (value) => {
            const dash =
              value?.data?.dash ??
              value?.result?.dash ??
              value?.data?.video_info?.dash;
            if (!dash) {
              return;
            }
            window.__bmpOriginalDashUrls__ = {
              video: urlsFor(dash.video),
              audio: urlsFor(dash.audio),
            };
          };

          const nativeFetch = window.fetch;
          window.fetch = async function (...args) {
            const response = await nativeFetch.apply(this, args);
            const requestUrl =
              typeof args[0] === "string" ? args[0] : args[0]?.url;
            if (/\\/x\\/player\\/(?:wbi\\/)?playurl/.test(requestUrl ?? "")) {
              response.clone().json()
                .then(window.__bmpCaptureDash__)
                .catch(() => {});
            }
            return response;
          };

          const xhrUrls = new WeakMap();
          const xhrPrototype = XMLHttpRequest.prototype;
          const nativeOpen = xhrPrototype.open;
          const responseDescriptor = Object.getOwnPropertyDescriptor(
            xhrPrototype,
            "response",
          );
          const responseTextDescriptor = Object.getOwnPropertyDescriptor(
            xhrPrototype,
            "responseText",
          );
          xhrPrototype.open = function (method, url, ...rest) {
            xhrUrls.set(this, String(url));
            return nativeOpen.call(this, method, url, ...rest);
          };

          function captureXhrPayload(xhr, value) {
            if (
              xhr.readyState !== XMLHttpRequest.DONE ||
              !/\\/x\\/player\\/(?:wbi\\/)?playurl/.test(
                xhrUrls.get(xhr) ?? "",
              )
            ) {
              return;
            }
            try {
              if (xhr.responseType === "json") {
                window.__bmpCaptureDash__(value);
              } else if (xhr.responseType === "arraybuffer") {
                window.__bmpCaptureDash__(
                  JSON.parse(new TextDecoder().decode(value)),
                );
              } else if (typeof value === "string") {
                window.__bmpCaptureDash__(JSON.parse(value));
              }
            } catch {}
          }

          if (responseDescriptor?.configurable && responseDescriptor.get) {
            Object.defineProperty(xhrPrototype, "response", {
              ...responseDescriptor,
              get() {
                const value = responseDescriptor.get.call(this);
                captureXhrPayload(this, value);
                return value;
              },
            });
          }
          if (
            responseTextDescriptor?.configurable &&
            responseTextDescriptor.get
          ) {
            Object.defineProperty(xhrPrototype, "responseText", {
              ...responseTextDescriptor,
              get() {
                const value = responseTextDescriptor.get.call(this);
                captureXhrPayload(this, value);
                return value;
              },
            });
          }
        })();

        ${BUILT_USERSCRIPT}

        (() => {
          const descriptor = Object.getOwnPropertyDescriptor(
            window,
            "__playinfo__",
          );
          if (!descriptor?.get || !descriptor.set) {
            return;
          }

          Object.defineProperty(window, "__playinfo__", {
            configurable: true,
            enumerable: descriptor.enumerable,
            get: descriptor.get,
            set(value) {
              window.__bmpCaptureDash__(value);
              descriptor.set.call(window, value);
            },
          });
        })();
      }
    `,
  });

  await page.goto(VIDEO_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute(
    "data-bmp-audio-only",
    "active",
    { timeout: 30_000 },
  );
  await page.waitForFunction(
    () =>
      (
        window as unknown as {
          __bmpOriginalDashUrls__?: {
            video: string[];
            audio: string[];
          };
        }
      ).__bmpOriginalDashUrls__?.audio.length,
    undefined,
    { timeout: 30_000 },
  );

  const candidates = await page.evaluate(
    () =>
      (
        window as unknown as {
          __bmpOriginalDashUrls__: {
            video: string[];
            audio: string[];
          };
        }
      ).__bmpOriginalDashUrls__,
  );
  const audioMedia = candidates.audio.map(mediaIdentity);
  const videoMedia = candidates.video.map(mediaIdentity);

  try {
    await expect
      .poll(
        () =>
          requestedUrls.some((url) => audioMedia.includes(mediaIdentity(url))),
        {
          timeout: 10_000,
        },
      )
      .toBe(true);
  } catch {
    const player = page.locator(".bpx-player-video-wrap").first();
    await expect(player).toBeVisible({ timeout: 15_000 });
    await player.click({ position: { x: 20, y: 20 } });
    await expect
      .poll(
        () =>
          requestedUrls.some((url) => audioMedia.includes(mediaIdentity(url))),
        {
          timeout: 20_000,
        },
      )
      .toBe(true);
  }

  expect(
    requestedUrls.some((url) => videoMedia.includes(mediaIdentity(url))),
  ).toBe(false);
});

function mediaIdentity(url: string): string {
  try {
    const parsed = new URL(url, "https://www.bilibili.com");
    return parsed.pathname;
  } catch {
    return url;
  }
}
