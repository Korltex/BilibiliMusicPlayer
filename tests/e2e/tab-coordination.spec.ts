import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { injectBuiltUserscript } from "../helpers/userscript";

const TAB_A_URL = "https://www.bilibili.com/video/BV1TabMusicA/";
const TAB_B_URL = "https://www.bilibili.com/video/BV1TabMusicB/";
const TAKEOVER_NOTICE = "已由另一个 Bilibili 标签页接管播放";

async function installGmApi(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const storagePrefix = "__bili_music__:";

    Object.assign(window, {
      GM_getValue(name: string, fallback?: unknown) {
        const raw = localStorage.getItem(`${storagePrefix}${name}`);
        return raw === null ? fallback : JSON.parse(raw);
      },
      GM_setValue(name: string, value: unknown) {
        localStorage.setItem(`${storagePrefix}${name}`, JSON.stringify(value));
      },
      GM_addValueChangeListener() {
        return 1;
      },
      GM_removeValueChangeListener() {},
    });
  });
}

async function preparePlayerPage(
  page: Page,
  url: string,
  options: { rejectPlay?: boolean } = {},
): Promise<void> {
  await page.goto(url);
  await page.evaluate(({ rejectPlay }) => {
    const media = document.querySelector("video")!;
    let paused = true;

    Object.defineProperties(media, {
      paused: { get: () => paused },
      currentTime: { get: () => 0, set: () => {} },
      duration: { get: () => 240 },
      readyState: { get: () => 4 },
      volume: { get: () => 1, set: () => {} },
      muted: { get: () => false, set: () => {} },
    });

    media.play = async () => {
      if (rejectPlay) {
        throw new DOMException("Autoplay blocked", "NotAllowedError");
      }
      paused = false;
      media.dispatchEvent(new Event("play"));
    };
    media.pause = () => {
      paused = true;
      media.dispatchEvent(new Event("pause"));
    };
  }, options);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();
}

async function isPaused(page: Page): Promise<boolean> {
  return page
    .locator("video")
    .evaluate((media) => (media as HTMLVideoElement).paused);
}

test.beforeEach(async ({ context }) => {
  await context.route(
    /https:\/\/www\.bilibili\.com\/video\/BV1TabMusic[AB]\//,
    async (route) => {
      const title = route.request().url().includes("MusicA")
        ? "标签页 A"
        : "标签页 B";
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `
        <!doctype html>
        <html>
          <head><title>${title}_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="${title}">${title}</h1>
            <video></video>
          </body>
        </html>
      `,
      });
    },
  );
  await installGmApi(context);
});

test("silently pauses an existing player after another tab starts", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await tabA.locator(".player-panel .play-button").click();
  await expect.poll(() => isPaused(tabA)).toBe(false);

  await tabB.locator(".player-panel .play-button").click();
  await expect.poll(() => isPaused(tabA)).toBe(true);
  await expect.poll(() => isPaused(tabB)).toBe(false);
  await expect(tabA.getByText(TAKEOVER_NOTICE, { exact: true })).toHaveCount(0);
  await expect(tabA.locator(".status-message")).toHaveCount(0);
});

test("keeps the existing player running when another tab cannot start", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL, { rejectPlay: true });

  await tabA.locator(".player-panel .play-button").click();
  await expect.poll(() => isPaused(tabA)).toBe(false);

  await tabB.locator(".player-panel .play-button").click();
  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(true);
  await expect(tabB.locator(".status-message.actionable")).toHaveText(
    "浏览器阻止了自动播放，请点击播放按钮继续",
  );
  await expect(tabA.getByText(TAKEOVER_NOTICE, { exact: true })).toHaveCount(0);
});
