import { expect, test, type Page } from "@playwright/test";
import type { AppData, PlaybackSession, Track } from "../../src/core/types";
import { injectBuiltUserscript } from "../helpers/userscript";

/*
 * B 站换视频时会先改 URL、后渲染标题，而插件过去只在离散事件里读一次 DOM，
 * 于是「面板标题停留在上一个视频」会一直不恢复。这组用例锁住「自动收敛」。
 */

const STORAGE_PREFIX = "__bili_music_metadata__:";
const SESSION_KEY = "bilibili-music-player:playback-session";
const DATA_KEY = "bilibili-music-player:data";
const PLAYLIST_URL = "https://www.bilibili.com/video/BV1MetaPlaylist/";
const NEXT_VIDEO_PATH = "/video/BV1MetaNext/";
const VIEW_API_GLOB = "https://api.bilibili.com/x/web-interface/view**";
const TRACK_TITLE = "歌单曲目";

const OLD_VIDEO = { title: "旧页面视频", uploader: "旧页面UP主" };
const NEW_VIDEO = { title: "新页面视频", uploader: "新页面UP主" };
/** 页面上的 og:image：SPA 换视频后可能不更新，正是封面滞后的来源。 */
const STALE_PAGE_COVER =
  "https://i0.hdslb.com/bfs/archive/stale-page-cover.jpg@1200w_630h";
/** B 站分享卡片封面：客户端按当前视频渲染，作为接口不可用时的兜底。 */
const SHARE_PAGE_COVER =
  "https://i0.hdslb.com/bfs/archive/share-page-cover.jpg@518w_290h_1c_!web-video-share-cover.webp";
const PLAYLIST_COVER =
  "https://i1.hdslb.com/bfs/archive/playlist-cover.jpg@120w_120h_1c.webp";
const NEXT_COVER =
  "https://i1.hdslb.com/bfs/archive/next-cover.jpg@120w_120h_1c.webp";

const panelTitle = (page: Page) => page.locator(".now-playing-copy strong");
const panelUploader = (page: Page) => page.locator(".now-playing-copy > span");
const panelCover = (page: Page) => page.locator(".cover img");
const playlistChip = (page: Page) =>
  page.getByRole("button", { name: "退出歌单播放并继续播放完整视频" });

/** 伪造 view 接口，并记录每个 bvid 被请求的次数。 */
async function routeCoverApi(
  page: Page,
  covers: Record<string, string>,
): Promise<string[]> {
  const requested: string[] = [];
  await page.route(VIEW_API_GLOB, async (route) => {
    const bvid = new URL(route.request().url()).searchParams.get("bvid") ?? "";
    requested.push(bvid);
    const pic = covers[bvid];
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        pic ? { code: 0, data: { pic } } : { code: 0, data: {} },
      ),
    });
  });
  return requested;
}

async function routeCoverApiFailure(page: Page): Promise<void> {
  await page.route(VIEW_API_GLOB, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: -412, message: "请求被拦截" }),
    });
  });
}

async function installLocalStorageGm(
  page: Page,
  initialData: unknown = null,
): Promise<void> {
  await page.addInitScript(
    ({ prefix, key, data }) => {
      if (data !== null) {
        localStorage.setItem(`${prefix}${key}`, JSON.stringify(data));
      }

      Object.assign(window, {
        GM_getValue(name: string, fallback?: unknown) {
          const raw = localStorage.getItem(`${prefix}${name}`);
          return raw === null ? fallback : JSON.parse(raw);
        },
        GM_setValue(name: string, value: unknown) {
          localStorage.setItem(`${prefix}${name}`, JSON.stringify(value));
        },
        GM_addValueChangeListener() {
          return 1;
        },
        GM_removeValueChangeListener() {},
      });
    },
    { prefix: STORAGE_PREFIX, key: DATA_KEY, data: initialData },
  );
}

interface VideoPageOptions {
  /** bvid -> view 接口返回的原始封面（http 由插件升级为 https）。 */
  covers?: Record<string, string>;
  failCoverApi?: boolean;
  /** 页面上的分享卡片封面，模拟 B 站客户端渲染的当前视频封面。 */
  shareCover?: string;
}

async function routeVideoPage(
  page: Page,
  options: VideoPageOptions = {},
): Promise<string[]> {
  let requested: string[] = [];
  if (options.failCoverApi) {
    await routeCoverApiFailure(page);
  } else {
    requested = await routeCoverApi(page, options.covers ?? {});
  }

  await page.route(`${PLAYLIST_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html>
        <html>
          <head>
            <title>${OLD_VIDEO.title}_哔哩哔哩_bilibili</title>
            <meta property="og:image" content="${STALE_PAGE_COVER}" />
          </head>
          <body>
            <h1 class="video-title" title="${OLD_VIDEO.title}">${OLD_VIDEO.title}</h1>
            <a class="up-name">${OLD_VIDEO.uploader}</a>
            ${options.shareCover ? `<img src="${options.shareCover}" alt="" />` : ""}
            <video></video>
          </body>
        </html>`,
    });
  });

  return requested;
}

async function installMockMedia(page: Page, duration = 240): Promise<void> {
  await page.evaluate((mediaDuration) => {
    const media = document.querySelector("video")!;
    let currentTime = 0;
    let paused = true;

    Object.defineProperties(media, {
      paused: { configurable: true, get: () => paused },
      currentTime: {
        configurable: true,
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
          media.dispatchEvent(new Event("timeupdate"));
        },
      },
      duration: { configurable: true, get: () => mediaDuration },
      readyState: { configurable: true, get: () => 4 },
    });

    media.play = async () => {
      paused = false;
      media.dispatchEvent(new Event("play"));
    };
    media.pause = () => {
      paused = true;
      media.dispatchEvent(new Event("pause"));
    };
  }, duration);
}

async function openPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await expect(
    page.getByRole("region", { name: "Bilibili 音乐播放器" }),
  ).toBeVisible();
}

/** 模拟同文档跳转：URL 立刻变化，新视频的标题 DOM 还没渲染。 */
async function navigateWithoutMetadata(page: Page): Promise<void> {
  await page.evaluate((path) => {
    history.pushState({}, "", path);
  }, NEXT_VIDEO_PATH);
}

/** 模拟 B 站数据返回后把新视频信息写进 DOM。 */
async function renderPageMetadata(
  page: Page,
  video: { title: string; uploader: string },
): Promise<void> {
  await page.evaluate(({ title, uploader }) => {
    document.title = `${title}_哔哩哔哩_bilibili`;
    const heading = document.querySelector("h1.video-title")!;
    heading.setAttribute("title", title);
    heading.textContent = title;
    document.querySelector(".up-name")!.textContent = uploader;
  }, video);
}

function playlistTrack(): Track {
  const now = Date.now();
  return {
    id: "track-meta",
    bvid: "BV1MetaPlaylist",
    title: TRACK_TITLE,
    uploader: "歌单UP主",
    startTime: 0,
    duration: 240,
    addedAt: now,
    source: "manual",
  };
}

function playlistData(): AppData {
  const now = Date.now();
  const playlistId = "playlist-meta";

  return {
    version: 1,
    playlists: [
      {
        id: playlistId,
        name: "元数据歌单",
        tracks: [playlistTrack()],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activePlaylistId: playlistId,
    playMode: "list-loop",
    volume: 1,
    playback: {
      playlistId,
      trackId: "track-meta",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: now,
    },
  };
}

function playbackSession(): PlaybackSession {
  const now = Date.now();

  return {
    activePlaylistId: "playlist-meta",
    playMode: "list-loop",
    playback: {
      playlistId: "playlist-meta",
      trackId: "track-meta",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: now,
    },
  };
}

async function seedPlaybackSession(page: Page): Promise<void> {
  await page.evaluate(
    ({ key, value }) => sessionStorage.setItem(key, JSON.stringify(value)),
    { key: SESSION_KEY, value: playbackSession() },
  );
}

test("refreshes the page metadata rendered after an SPA navigation", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelTitle(page)).toHaveText(OLD_VIDEO.title);

  await navigateWithoutMetadata(page);
  // 比旧实现唯一一次 1 秒重试更晚，模拟 B 站数据返回慢的情形。
  await page.waitForTimeout(1_500);
  await renderPageMetadata(page, NEW_VIDEO);

  await expect(panelTitle(page)).toHaveText(NEW_VIDEO.title, {
    timeout: 5_000,
  });
  await expect(panelUploader(page)).toHaveText(NEW_VIDEO.uploader, {
    timeout: 5_000,
  });
});

test("refreshes the page metadata while playback is paused", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  // 不安装 mock media：没有 play/timeupdate 事件，只能靠定时校正。
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelTitle(page)).toHaveText(OLD_VIDEO.title);

  await navigateWithoutMetadata(page);
  await page.waitForTimeout(1_500);
  await renderPageMetadata(page, NEW_VIDEO);

  await expect(panelTitle(page)).toHaveText(NEW_VIDEO.title, {
    timeout: 5_000,
  });
  await expect(panelUploader(page)).toHaveText(NEW_VIDEO.uploader, {
    timeout: 5_000,
  });
});

test("keeps the page metadata after returning to the same video", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelTitle(page)).toHaveText(OLD_VIDEO.title);
  await page.waitForTimeout(2_500);

  await expect(panelTitle(page)).toHaveText(OLD_VIDEO.title);
  await expect(panelUploader(page)).toHaveText(OLD_VIDEO.uploader);
});

test("does not rebuild MediaSession metadata when nothing changes", async ({
  page,
}) => {
  await installLocalStorageGm(page);
  await page.addInitScript(() => {
    const nativeMediaMetadata = window.MediaMetadata as
      typeof MediaMetadata | undefined;
    window.__metadataBuilds = 0;

    if (typeof nativeMediaMetadata === "function") {
      window.MediaMetadata = class extends nativeMediaMetadata {
        constructor(init: MediaMetadataInit) {
          super(init);
          window.__metadataBuilds += 1;
        }
      } as typeof MediaMetadata;
    }
  });
  await routeVideoPage(page);
  await page.goto(PLAYLIST_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelTitle(page)).toHaveText(OLD_VIDEO.title);

  const readBuilds = () =>
    page.evaluate(() => window.__metadataBuilds as number);
  const baseline = await readBuilds();
  expect(baseline).toBeGreaterThan(0);

  // 播放进度推进与多次定时校正都不应该重建 MediaMetadata。
  await page.evaluate(() => {
    document.querySelector("video")!.currentTime = 5;
  });
  await page.waitForTimeout(2_500);
  await page.evaluate(() => {
    document.querySelector("video")!.currentTime = 12;
  });
  await page.waitForTimeout(1_200);

  expect(await readBuilds()).toBe(baseline);
});

test("leaves playlist playback when the SPA navigation drops the marker", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, playlistData());
  await page.goto(`${PLAYLIST_URL}?bili_music=1`);
  await installMockMedia(page);
  await seedPlaybackSession(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelTitle(page)).toHaveText(TRACK_TITLE);
  await expect(playlistChip(page)).toBeVisible();

  await navigateWithoutMetadata(page);
  await page.waitForTimeout(1_500);
  await renderPageMetadata(page, NEW_VIDEO);

  await expect(playlistChip(page)).toHaveCount(0);
  await expect(panelTitle(page)).toHaveText(NEW_VIDEO.title, {
    timeout: 5_000,
  });
  await expect(panelUploader(page)).toHaveText(NEW_VIDEO.uploader, {
    timeout: 5_000,
  });
});

test("uses the cover resolved for the current video instead of the page meta", async ({
  page,
}) => {
  await routeVideoPage(page, {
    covers: {
      BV1MetaPlaylist: "http://i1.hdslb.com/bfs/archive/playlist-cover.jpg",
    },
  });
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await injectBuiltUserscript(page);
  await openPanel(page);

  // 页面的 og:image 是旧封面，接口结果应当胜出（并且 http 已升级为 https 缩略图）
  await expect(panelCover(page)).toHaveAttribute("src", PLAYLIST_COVER);
});

test("refreshes the cover after an SPA navigation while og:image stays stale", async ({
  page,
}) => {
  const requested = await routeVideoPage(page, {
    covers: {
      BV1MetaPlaylist: "http://i1.hdslb.com/bfs/archive/playlist-cover.jpg",
      BV1MetaNext: "http://i1.hdslb.com/bfs/archive/next-cover.jpg",
    },
  });
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelCover(page)).toHaveAttribute("src", PLAYLIST_COVER);

  // 换成另一个视频，但页面 DOM 里的 og:image 永远停留在旧视频
  await navigateWithoutMetadata(page);
  await page.waitForTimeout(1_500);

  await expect(panelCover(page)).toHaveAttribute("src", NEXT_COVER);
  expect(requested).toEqual(["BV1MetaPlaylist", "BV1MetaNext"]);
});

test("falls back to the page share cover when the interface is unavailable", async ({
  page,
}) => {
  await routeVideoPage(page, {
    failCoverApi: true,
    shareCover: SHARE_PAGE_COVER,
  });
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await injectBuiltUserscript(page);
  await openPanel(page);

  // 接口被风控时，客户端渲染的分享封面比首屏 SSR 的 og:image 更可能是当前视频
  await expect(panelCover(page)).toHaveAttribute("src", SHARE_PAGE_COVER);
});

test("falls back to the page share cover when the interface has no cover", async ({
  page,
}) => {
  await routeVideoPage(page, { shareCover: SHARE_PAGE_COVER });
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelCover(page)).toHaveAttribute("src", SHARE_PAGE_COVER);
});

test("keeps the page cover when the cover request fails", async ({ page }) => {
  await routeVideoPage(page, { failCoverApi: true });
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelCover(page)).toHaveAttribute("src", STALE_PAGE_COVER);
  // 失败退避：每秒校正不会把封面清空或反复重试
  await page.waitForTimeout(2_500);
  await expect(panelCover(page)).toHaveAttribute("src", STALE_PAGE_COVER);
});

test("requests the cover once per video instead of every reconcile tick", async ({
  page,
}) => {
  const requested = await routeVideoPage(page, {
    covers: {
      BV1MetaPlaylist: "http://i1.hdslb.com/bfs/archive/playlist-cover.jpg",
    },
  });
  await installLocalStorageGm(page);
  await page.goto(PLAYLIST_URL);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panelCover(page)).toHaveAttribute("src", PLAYLIST_COVER);
  await page.waitForTimeout(3_000);

  expect(requested).toEqual(["BV1MetaPlaylist"]);
});

declare global {
  interface Window {
    __metadataBuilds: number;
  }
}
