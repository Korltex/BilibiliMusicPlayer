import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { injectBuiltUserscript } from "../helpers/userscript";

const TAB_A_URL = "https://www.bilibili.com/video/BV1TabMusicA/";
const TAB_B_URL = "https://www.bilibili.com/video/BV1TabMusicB/";
const TRACK_A_TITLE = "插件歌曲 A";
const TRACK_B_TITLE = "插件歌曲 B";
const TRACK_C_TITLE = "插件歌曲 C";
const AUTOPLAY_NOTICE = "浏览器阻止了自动播放，请点击播放按钮继续";
const STORAGE_KEY = "bilibili-music-player:data";
const SESSION_KEY = "bilibili-music-player:playback-session";
const TEST_LISTENERS_KEY = "__bili_music_test_listeners__";

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
    {
      id: "playlist-tabs-b",
      name: "跨标签页歌单 B",
      tracks: [
        {
          id: "track-tab-c",
          bvid: "BV1TabMusicB",
          title: TRACK_C_TITLE,
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
      const storageKey = "bilibili-music-player:data";
      const listenersKey = "__bili_music_test_listeners__";
      let listenerId = 0;

      Object.assign(window, {
        GM_getValue(name: string, fallback?: unknown) {
          const raw = localStorage.getItem(`${storagePrefix}${name}`);
          if (raw !== null) {
            return JSON.parse(raw);
          }
          return name === storageKey ? data : fallback;
        },
        GM_setValue(name: string, value: unknown) {
          localStorage.setItem(
            `${storagePrefix}${name}`,
            JSON.stringify(value),
          );
        },
        GM_addValueChangeListener(
          _name: string,
          listener: (
            key: string,
            oldValue: unknown,
            newValue: unknown,
            remote: boolean,
          ) => void,
        ) {
          listenerId += 1;
          const listeners =
            (
              window as typeof window & {
                [listenersKey]?: Map<number, typeof listener>;
              }
            )[listenersKey] ?? new Map<number, typeof listener>();
          listeners.set(listenerId, listener);
          (
            window as typeof window & {
              [listenersKey]?: Map<number, typeof listener>;
            }
          )[listenersKey] = listeners;
          return listenerId;
        },
        GM_removeValueChangeListener(id: number) {
          (
            window as typeof window & {
              [listenersKey]?: Map<number, () => void>;
            }
          )[listenersKey]?.delete(id);
        },
      });
    },
    { data: initialData },
  );
}

async function deliverRemoteData(source: Page, target: Page): Promise<void> {
  const data = await source.evaluate((storageKey) => {
    const raw = localStorage.getItem(`__bili_music__:${storageKey}`);
    return raw === null ? undefined : JSON.parse(raw);
  }, STORAGE_KEY);

  await target.evaluate(
    ({ listenersKey, storageKey, newValue }) => {
      const listeners = (
        window as typeof window & {
          [key: string]:
            | Map<
                number,
                (
                  key: string,
                  oldValue: unknown,
                  newValue: unknown,
                  remote: boolean,
                ) => void
              >
            | undefined;
        }
      )[listenersKey];
      listeners?.forEach((listener) =>
        listener(storageKey, undefined, newValue, true),
      );
    },
    {
      listenersKey: TEST_LISTENERS_KEY,
      storageKey: STORAGE_KEY,
      newValue: data,
    },
  );
}

async function preparePlayerPage(
  page: Page,
  url: string,
  options: { rejectPlay?: boolean } = {},
): Promise<void> {
  await page.goto(url);
  await installMockMedia(page, options);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();
}

async function installMockMedia(
  page: Page,
  options: { rejectPlay?: boolean } = {},
): Promise<void> {
  await page.evaluate(({ rejectPlay }) => {
    const media = document.querySelector("video")!;
    let paused = true;
    let currentTime = 0;

    Object.defineProperties(media, {
      paused: { get: () => paused },
      currentTime: {
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
          media.dispatchEvent(new Event("timeupdate"));
        },
      },
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
}

async function isPaused(page: Page): Promise<boolean> {
  return page
    .locator("video")
    .evaluate((media) => (media as HTMLVideoElement).paused);
}

async function readSession(page: Page) {
  return page.evaluate((sessionKey) => {
    const raw = sessionStorage.getItem(sessionKey);
    return raw === null ? undefined : JSON.parse(raw);
  }, SESSION_KEY);
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

test("keeps existing playlist playback when an already-playing page joins the playlist", async ({
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

  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});

test("keeps both playlist players running when another playlist starts", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPlaylistPlayback(tabA, TRACK_A_TITLE);
  await startPlaylistPlayback(tabB, TRACK_B_TITLE);

  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});

test("keeps each tab's selected playlist while both playlist players run", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPlaylistPlayback(tabA, TRACK_A_TITLE);
  await tabB
    .getByLabel("当前歌单", { exact: true })
    .selectOption("playlist-tabs-b");
  await startPlaylistPlayback(tabB, TRACK_C_TITLE);

  await expect(tabA.getByLabel("当前歌单", { exact: true })).toHaveValue(
    "playlist-tabs",
  );
  await expect(tabB.getByLabel("当前歌单", { exact: true })).toHaveValue(
    "playlist-tabs-b",
  );
  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});

test("keeps playlist state in the same tab after a refresh", async ({
  page,
}) => {
  await preparePlayerPage(page, TAB_A_URL);
  await startPlaylistPlayback(page, TRACK_A_TITLE);
  await page.locator("video").evaluate((media) => {
    (media as HTMLVideoElement).currentTime = 37;
  });

  await expect
    .poll(() => readSession(page))
    .toMatchObject({
      activePlaylistId: "playlist-tabs",
      playback: { playlistId: "playlist-tabs", trackId: "track-tab-a" },
    });

  // 进度写入有十秒节流，刷新时的 pagehide 才会补写当前位置。
  await page.reload();
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();

  await expect(page.getByLabel("当前歌单", { exact: true })).toHaveValue(
    "playlist-tabs",
  );
  await expect(page.locator(".track-row.active")).toHaveCount(1);
  await expect
    .poll(() => readSession(page))
    .toMatchObject({
      activePlaylistId: "playlist-tabs",
      playback: {
        playlistId: "playlist-tabs",
        trackId: "track-tab-a",
        currentTime: 37,
      },
    });
});

test("exits local playlist playback when another tab deletes its current song", async ({
  context,
  page: tabA,
}) => {
  const tabB = await context.newPage();
  await preparePlayerPage(tabA, TAB_A_URL);
  await preparePlayerPage(tabB, TAB_B_URL);

  await startPlaylistPlayback(tabA, TRACK_A_TITLE);
  tabB.on("dialog", (dialog) => void dialog.accept());
  await tabB.getByLabel(`删除 ${TRACK_A_TITLE}`).click();
  await deliverRemoteData(tabB, tabA);

  await expect(tabA.locator(".playlist-context-chip")).toBeHidden();
  await expect.poll(() => isPaused(tabA)).toBe(false);
});

test("keeps existing playlist playback when another playback is rejected", async ({
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

test("keeps playlist playback independent while the player UI is minimal or collapsed", async ({
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
  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(false);

  await minimalA.getByRole("button", { name: "收起播放器" }).click();
  await expect(tabA.locator(".floating-button")).toBeVisible();
  await expect.poll(() => isPaused(tabA)).toBe(false);
  await expect.poll(() => isPaused(tabB)).toBe(false);
});
