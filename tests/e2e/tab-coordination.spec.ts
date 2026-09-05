import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { injectBuiltUserscript } from "../helpers/userscript";

const TAB_A_URL = "https://www.bilibili.com/video/BV1TabMusicA/";
const TAB_B_URL = "https://www.bilibili.com/video/BV1TabMusicB/";
const TRACK_A_TITLE = "插件歌曲 A";
const TRACK_B_TITLE = "插件歌曲 B";
const AUTOPLAY_NOTICE = "浏览器阻止了自动播放，请点击播放按钮继续";

const initialData = {
  version: 1,
  playlists: [
    {
      id: "playlist-tabs",
      name: "跨标签页歌单",
      tracks: [
        {
          id: "track-tab-a",
          bvid: "BV1TabMusicA",
          title: TRACK_A_TITLE,
          startTime: 0,
          duration: 240,
          addedAt: 1_000,
          source: "manual",
        },
        {
          id: "track-tab-b",
          bvid: "BV1TabMusicB",
          title: TRACK_B_TITLE,
          startTime: 0,
          duration: 240,
          addedAt: 1_000,
          source: "manual",
        },
      ],
      createdAt: 1_000,
      updatedAt: 1_000,
    },
  ],
  activePlaylistId: "playlist-tabs",
  playMode: "list-loop",
  volume: 1,
  playback: {
    playlistId: "playlist-tabs",
    currentTime: 0,
    resumeRequested: false,
    updatedAt: 1_000,
  },
};

async function installGmApi(context: BrowserContext): Promise<void> {
  await context.addInitScript(
    ({ data }) => {
      const storagePrefix = "__bili_music__:";

      Object.assign(window, {
        GM_getValue(name: string, fallback?: unknown) {
          const raw = localStorage.getItem(`${storagePrefix}${name}`);
          if (raw !== null) {
            return JSON.parse(raw);
          }
          return name === "bilibili-music-player:data" ? data : fallback;
        },
        GM_setValue(name: string, value: unknown) {
          localStorage.setItem(
            `${storagePrefix}${name}`,
            JSON.stringify(value),
          );
        },
        GM_addValueChangeListener() {
          return 1;
        },
        GM_removeValueChangeListener() {},
      });
    },
    { data: initialData },
  );
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
      if (!paused) {
        return;
      }
      paused = false;
      media.dispatchEvent(new Event("play"));
    };
    media.pause = () => {
      if (paused) {
        return;
      }
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

async function startPagePlayback(page: Page): Promise<void> {
  await page.locator(".player-panel .play-button").click();
  await expect.poll(() => isPaused(page)).toBe(false);
}

async function startPlaylistPlayback(
  page: Page,
  trackTitle: string,
): Promise<void> {
  await page
    .locator(".track-row")
    .filter({ hasText: trackTitle })
    .locator(".track-main")
    .click();
  await expect.poll(() => isPaused(page)).toBe(false);
  await expect(page.locator(".playlist-context-chip")).toBeVisible();
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

test("keeps two ordinary page videos playing", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPagePlayback(tabA);
  await startPagePlayback(tabB);

  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});

test("does not pause page playback when playlist playback starts", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPagePlayback(tabA);
  await startPlaylistPlayback(tabB, TRACK_B_TITLE);

  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});

test("claims playlist ownership when an already-playing page joins the playlist", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPlaylistPlayback(tabA, TRACK_A_TITLE);
  await startPagePlayback(tabB);
  await expect.poll(() => isPaused(tabA)).toBe(false);

  await startPlaylistPlayback(tabB, TRACK_B_TITLE);

  await expect.poll(() => isPaused(tabA)).toBe(true);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});

test("pauses earlier playlist playback when another playlist starts", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPlaylistPlayback(tabA, TRACK_A_TITLE);
  await startPlaylistPlayback(tabB, TRACK_B_TITLE);

  await expect.poll(() => isPaused(tabA)).toBe(true);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});

test("does not claim playlist ownership when playback is rejected", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL, { rejectPlay: true });

  await startPlaylistPlayback(tabA, TRACK_A_TITLE);
  await tabB
    .locator(".track-row")
    .filter({ hasText: TRACK_B_TITLE })
    .locator(".track-main")
    .click();

  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(true);
  await expect(tabB.locator(".status-message.actionable")).toHaveText(
    AUTOPLAY_NOTICE,
  );
});

test("coordinates playlist playback while the player UI is minimal or collapsed", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPlaylistPlayback(tabA, TRACK_A_TITLE);
  await tabA.getByRole("button", { name: "进入极简模式" }).click();
  const minimalA = tabA.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });

  await startPlaylistPlayback(tabB, TRACK_B_TITLE);
  await expect.poll(() => isPaused(tabA)).toBe(true);

  await minimalA.getByRole("button", { name: "播放", exact: true }).click();
  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(true);

  await minimalA.getByRole("button", { name: "收起播放器" }).click();
  await tabB.locator(".player-panel .play-button").click();
  await expect.poll(() => isPaused(tabA)).toBe(true);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});
