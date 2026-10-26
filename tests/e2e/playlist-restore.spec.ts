import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { injectBuiltUserscript } from "../helpers/userscript";

/**
 * 歌单恢复：`AppData.activePlaylistId` 是「上次使用的歌单」的持久记录。
 *
 * `PlaybackSession` 存在 sessionStorage，只活到标签页关闭；因此「刷新」和
 * 「关闭后重新打开 / 新标签页」是两条不同的路径，必须分别断言：
 * - 同标签页刷新：会话还在，恢复由 `migratePlaybackSession()` 完成。
 * - 新会话：只能靠共享 GM 数据里的 `activePlaylistId` 恢复。
 *
 * GM 模拟必须用「键不存在才写入」的守卫，否则每次导航都会把 fixture 重新灌回去，
 * 新会话恢复会被掩盖（`player.spec.ts` 里的 `installLocalStorageGm` 是无条件覆盖的）。
 */

const URL_A = "https://www.bilibili.com/video/BV1RestoreA/";
const URL_B = "https://www.bilibili.com/video/BV1RestoreB/";
const URL_C = "https://www.bilibili.com/video/BV1RestoreC/";
const DATA_KEY = "bilibili-music-player:data";
const SESSION_KEY = "bilibili-music-player:playback-session";

const TRACK_A = {
  id: "track-restore-a",
  bvid: "BV1RestoreA",
  title: "恢复测试 A",
  startTime: 0,
  duration: 240,
  addedAt: 1_000,
  source: "manual" as const,
};

const TRACK_B = {
  id: "track-restore-b",
  bvid: "BV1RestoreB",
  title: "恢复测试 B",
  startTime: 0,
  duration: 240,
  addedAt: 1_000,
  source: "manual" as const,
};

function createRestoreData(
  activePlaylistId = "playlist-a",
  playMode = "list-loop",
) {
  return {
    version: 1,
    playlists: [
      {
        id: "playlist-a",
        name: "歌单 A",
        tracks: [TRACK_A],
        createdAt: 1_000,
        updatedAt: 1_000,
      },
      {
        id: "playlist-b",
        name: "歌单 B",
        tracks: [TRACK_B],
        createdAt: 1_000,
        updatedAt: 1_000,
      },
      {
        id: "playlist-c",
        name: "歌单 C",
        tracks: [],
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    ],
    activePlaylistId,
    playMode,
    volume: 1,
    playback: {
      playlistId: activePlaylistId,
      currentTime: 0,
      resumeRequested: false,
      updatedAt: 1_000,
    },
  };
}

/** 上下文级 GM 模拟：localStorage 跨标签页共享，且只在键缺失时写入 fixture。 */
async function installGmApi(
  context: BrowserContext,
  data: unknown = createRestoreData(),
): Promise<void> {
  await context.addInitScript(
    ({ initialData }) => {
      const storagePrefix = "__bili_music__:";
      const storageKey = "bilibili-music-player:data";

      if (localStorage.getItem(`${storagePrefix}${storageKey}`) === null) {
        localStorage.setItem(
          `${storagePrefix}${storageKey}`,
          JSON.stringify(initialData),
        );
      }

      Object.assign(window, {
        GM_getValue(name: string, fallback?: unknown) {
          const raw = localStorage.getItem(`${storagePrefix}${name}`);
          return raw === null ? fallback : JSON.parse(raw);
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
    { initialData: data },
  );
}

async function routeVideoPage(page: Page, url: string, title: string) {
  // 用 `**` 兜住查询串：歌单播放会把 `?bili_music=1` 补回 URL，精确匹配会漏。
  await page.route(`${url}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><head><title>${title}_哔哩哔哩_bilibili</title></head><body><h1 class="video-title" title="${title}">${title}</h1><video></video></body></html>`,
    });
  });
}

async function installMockMedia(page: Page) {
  await page.evaluate(() => {
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
      paused = false;
      media.dispatchEvent(new Event("play"));
    };
    media.pause = () => {
      paused = true;
      media.dispatchEvent(new Event("pause"));
    };
  });
}

/** 打开一个标签页并展开播放器面板。 */
async function openPlayer(
  page: Page,
  url: string,
  title: string,
): Promise<void> {
  await routeVideoPage(page, url, title);
  await page.goto(url);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();
}

const playlistSelect = (page: Page) =>
  page.getByLabel("当前歌单", { exact: true });

async function readStoredData(page: Page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(`__bili_music__:${key}`);
    return raw === null ? undefined : JSON.parse(raw);
  }, DATA_KEY);
}

async function readSession(page: Page) {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  }, SESSION_KEY);
}

async function isPaused(page: Page): Promise<boolean> {
  return page
    .locator("video")
    .evaluate((media) => (media as HTMLVideoElement).paused);
}

test("persists the selected playlist for the next session", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page, URL_A, "恢复测试 A");

  await playlistSelect(page).selectOption("playlist-b");

  // 选择立刻写进共享数据：这是新会话唯一的恢复依据。
  await expect
    .poll(async () => (await readStoredData(page))?.activePlaylistId)
    .toBe("playlist-b");
  expect((await readSession(page))?.activePlaylistId).toBe("playlist-b");
});

test("restores the last used playlist after a refresh in the same tab", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  // 用与 B 曲目同一个 BV 的页面，点歌才是本页播放而不是跨页导航。
  await openPlayer(page, URL_B, "恢复测试 B");
  await playlistSelect(page).selectOption("playlist-b");

  // 播放 B 的歌并让它自然结束：结束播放不能把所属歌单重置成默认歌单。
  await page
    .locator(".track-row")
    .filter({ hasText: TRACK_B.title })
    .locator(".track-main")
    .click();
  await expect.poll(() => isPaused(page)).toBe(false);
  await page.locator("video").evaluate((media) => {
    media.dispatchEvent(new Event("ended"));
  });
  await expect
    .poll(async () => (await readSession(page))?.activePlaylistId)
    .toBe("playlist-b");

  await page.reload();
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();

  await expect(playlistSelect(page)).toHaveValue("playlist-b");
  await expect(
    page.locator(".track-row").filter({ hasText: TRACK_B.title }),
  ).toHaveCount(1);
});

test("restores the playlist in a new tab after playback ended", async ({
  context,
  page: tabA,
}) => {
  await installGmApi(context);
  await openPlayer(tabA, URL_B, "恢复测试 B");

  await playlistSelect(tabA).selectOption("playlist-b");
  await tabA
    .locator(".track-row")
    .filter({ hasText: TRACK_B.title })
    .locator(".track-main")
    .click();
  await expect.poll(() => isPaused(tabA)).toBe(false);
  await tabA.locator("video").evaluate((media) => {
    media.dispatchEvent(new Event("ended"));
  });

  // 新标签页 = 全新 sessionStorage，只能靠共享数据恢复。
  const tabB = await context.newPage();
  await openPlayer(tabB, URL_B, "恢复测试 B");

  await expect(playlistSelect(tabB)).toHaveValue("playlist-b");
  await expect(
    tabB.locator(".track-row").filter({ hasText: TRACK_B.title }),
  ).toHaveCount(1);
  // 只恢复选择，不自动播放：新会话是空快照，没有曲目也没有恢复请求。
  expect(await isPaused(tabB)).toBe(true);
  const session = await readSession(tabB);
  if (session) {
    expect(session.activePlaylistId).toBe("playlist-b");
    expect(session.playback.trackId).toBeUndefined();
    expect(session.playback.resumeRequested).toBe(false);
  }
  await expect(tabB.locator(".track-row.active")).toHaveCount(0);
});

test("restores the playlist after closing the tab without playing", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page, URL_A, "恢复测试 A");

  await playlistSelect(page).selectOption("playlist-b");
  await expect
    .poll(async () => (await readStoredData(page))?.activePlaylistId)
    .toBe("playlist-b");

  await page.close();

  const reopened = await context.newPage();
  await openPlayer(reopened, URL_C, "恢复测试 C");

  await expect(playlistSelect(reopened)).toHaveValue("playlist-b");
  expect(await isPaused(reopened)).toBe(true);
});

test("falls back to the first remaining playlist when the recorded one was deleted", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page, URL_A, "恢复测试 A");

  await playlistSelect(page).selectOption("playlist-b");
  await expect
    .poll(async () => (await readStoredData(page))?.activePlaylistId)
    .toBe("playlist-b");

  // 删除正在使用的歌单 B：记录必须改指到仍然存在的歌单，不能留悬空 id。
  await page.getByRole("button", { name: "删除当前歌单" }).click();
  await page
    .getByRole("dialog", { name: "删除歌单" })
    .getByRole("button", { name: "确定" })
    .click();
  await expect
    .poll(async () => (await readStoredData(page))?.activePlaylistId)
    .toBe("playlist-a");
  expect(
    (await readStoredData(page))?.playlists.map(
      (playlist: { id: string }) => playlist.id,
    ),
  ).toEqual(["playlist-a", "playlist-c"]);

  await page.close();

  const reopened = await context.newPage();
  await openPlayer(reopened, URL_A, "恢复测试 A");
  await expect(playlistSelect(reopened)).toHaveValue("playlist-a");
});

test("restoring the playlist keeps an explicit resume request intact", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  // 已有会话：B 歌单 + 待恢复的歌曲（跨页面续播的既有契约）。
  await page.addInitScript(
    ({ sessionKey, session }) => {
      if (sessionStorage.getItem(sessionKey) === null) {
        sessionStorage.setItem(sessionKey, JSON.stringify(session));
      }
    },
    {
      sessionKey: SESSION_KEY,
      session: {
        activePlaylistId: "playlist-b",
        playMode: "list-loop",
        playback: {
          playlistId: "playlist-b",
          trackId: TRACK_B.id,
          currentTime: 37,
          resumeRequested: true,
          updatedAt: 1_000,
        },
      },
    },
  );

  await openPlayer(page, URL_B, "恢复测试 B");

  // 恢复歌单选择，同时既有的跨页面续播照旧：位置被恢复、请求被消费。
  await expect(playlistSelect(page)).toHaveValue("playlist-b");
  await expect.poll(() => isPaused(page)).toBe(false);
  const session = await readSession(page);
  expect(session.playback.trackId).toBe(TRACK_B.id);
  expect(session.playback.currentTime).toBe(37);
  expect(session.playback.resumeRequested).toBe(false);
});
