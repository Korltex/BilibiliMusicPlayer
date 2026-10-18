import { expect, test, type Page } from "@playwright/test";
import type { AppData, PlaybackSession } from "../../src/core/types";
import { injectBuiltUserscript } from "../helpers/userscript";

/*
 * B 站首页（`https://www.bilibili.com/`，含 `/?spm_id_from=...` 这类带跟踪参数的形态与
 * 旧版 `/index.html` 入口）支持。
 *
 * 现场取证（真实站点，2026-10）：首页初始 DOM 里 **没有任何 `<video>`**，但鼠标悬停
 * 视频卡片时会动态插入一个**正在播放**的预览 `<video>`（约 248×140，blob 源）。
 * 首页没有 B 站播放器，因此这里只做「悬浮按钮 + 歌单管理」：点歌单里的歌曲由引擎
 * 导航到 `/video/<bvid>/?bili_music=1[&p=N]` 再按现有逻辑播放。
 *
 * 因此首页必须：挂 UI、按形态偏好打开面板、不装纯音频拦截器、**不绑定预览媒体**。
 */

const HOME_URL = "https://www.bilibili.com/";
const DATA_KEY = "bilibili-music-player:data";
const SESSION_KEY = "bilibili-music-player:playback-session";
const LAYOUT_KEY = "bilibili-music-player:layout";
const AUDIO_ONLY_KEY = "bilibili-music-player:audio-only";
// `audio-only-interceptor.ts` 用 `Symbol.for(...)` 作安装标记，键名就是这一串。
const INTERCEPTOR_SYMBOL_KEY = "bilibili-music-player:audio-only-interceptors";
const HOST_SELECTOR = "#bilibili-music-player-host";

const panel = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器", exact: true });
const launcher = (page: Page) =>
  page.getByRole("button", { name: "打开 Bilibili 音乐播放器" });
const minimalPlayer = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器（极简模式）" });

const HOME_BODY = `<!doctype html>
  <html>
    <head><title>哔哩哔哩 (゜-゜)つロ 干杯~-bilibili</title></head>
    <body>
      <div id="app">
        <div class="bili-video-card"><a class="bili-video-card__info--tit">占位卡片</a></div>
      </div>
    </body>
  </html>`;

function createHomeData(): AppData {
  const now = 1;
  return {
    version: 1,
    playlists: [
      {
        id: "playlist-home",
        name: "首页歌单",
        tracks: [
          {
            id: "track-home-a",
            bvid: "BV1HomeTrackA",
            title: "首页第一首",
            uploader: "首页作者",
            startTime: 30,
            endTime: 120,
            duration: 300,
            addedAt: now,
            source: "manual",
          },
          {
            id: "track-home-b",
            bvid: "BV1HomeTrackB",
            page: 2,
            title: "首页第二首",
            uploader: "首页作者",
            startTime: 0,
            duration: 300,
            addedAt: now + 1,
            source: "manual",
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activePlaylistId: "playlist-home",
    playMode: "list-loop",
    volume: 1,
    playback: {
      playlistId: "playlist-home",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: now,
    },
  };
}

function createHomeSession(): PlaybackSession {
  return {
    activePlaylistId: "playlist-home",
    playMode: "list-loop",
    playback: {
      playlistId: "playlist-home",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: 1,
    },
  };
}

interface HomeFixtures {
  data?: AppData;
  session?: PlaybackSession;
  layout?: unknown;
  audioOnly?: boolean;
}

/** 一次装好 GM 替身与所有可选夹具；导航后重跑时不覆盖插件已写入的值。 */
async function installHomeFixtures(
  page: Page,
  fixtures: HomeFixtures = {},
): Promise<void> {
  await page.addInitScript(
    ({ data, session, layout, audioOnly, keys }) => {
      const prefix = "__bili_music__:";
      const seedLocal = (key: string, value: unknown) => {
        if (
          value !== undefined &&
          localStorage.getItem(`${prefix}${key}`) === null
        ) {
          localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
        }
      };

      seedLocal(keys.data, data);
      seedLocal(keys.layout, layout);
      seedLocal(keys.audioOnly, audioOnly);
      if (
        session !== undefined &&
        sessionStorage.getItem(keys.session) === null
      ) {
        sessionStorage.setItem(keys.session, JSON.stringify(session));
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
    {
      data: fixtures.data,
      session: fixtures.session,
      layout: fixtures.layout,
      audioOnly: fixtures.audioOnly,
      keys: {
        data: DATA_KEY,
        session: SESSION_KEY,
        layout: LAYOUT_KEY,
        audioOnly: AUDIO_ONLY_KEY,
      },
    },
  );
}

async function openHome(
  page: Page,
  fixtures: HomeFixtures = {},
  homeUrl = HOME_URL,
): Promise<void> {
  // 首页地址可能是裸根路径、带跟踪参数的 `/?spm_id_from=...` 或旧版 `/index.html`
  // 入口，所以按 origin + pathname 兜住所有首页形态，而不是只认某一串完整 URL。
  await page.route(
    (url) =>
      url.origin === "https://www.bilibili.com" &&
      (url.pathname === "/" || url.pathname === "/index.html"),
    async (route) => {
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: HOME_BODY,
      });
    },
  );
  await installHomeFixtures(page, fixtures);
  await page.goto(homeUrl);
  await injectBuiltUserscript(page);
}

async function openPanel(page: Page): Promise<void> {
  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
}

async function readPlaybackSession(page: Page): Promise<PlaybackSession> {
  return page.evaluate((storageKey) => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      throw new Error("播放会话不存在");
    }
    return JSON.parse(raw) as PlaybackSession;
  }, SESSION_KEY);
}

test("mounts the floating button on the Bilibili homepage", async ({
  page,
}) => {
  await openHome(page);

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
  await expect(launcher(page)).toBeVisible();
});

test("mounts when the homepage carries tracking query strings", async ({
  page,
}) => {
  const trackedUrl = "https://www.bilibili.com/?spm_id_from=333.788.0.0";
  await openHome(page, { data: createHomeData() }, trackedUrl);

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
  await expect(launcher(page)).toBeVisible();
  await openPanel(page);
  await expect(panel(page).locator(".track-row")).toHaveCount(2);
  expect(page.url()).toBe(trackedUrl);
});

test("mounts on the legacy /index.html homepage", async ({ page }) => {
  await openHome(
    page,
    { data: createHomeData() },
    "https://www.bilibili.com/index.html",
  );

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
  await expect(launcher(page)).toBeVisible();
  await openPanel(page);
  await expect(panel(page).locator(".track-row")).toHaveCount(2);
});

test("opens the player panel instead of the import dialog on the homepage", async ({
  page,
}) => {
  await openHome(page, { data: createHomeData() });
  await openPanel(page);

  // 首页是「管理歌单」的地方：进入播放器面板，而不是像空间收藏页那样弹导入框。
  await expect(page.getByRole("dialog", { name: "批量导入" })).toHaveCount(0);
  await expect(panel(page).locator(".track-row")).toHaveCount(2);
});

test("respects the minimal-mode preference and can expand from it", async ({
  page,
}) => {
  await openHome(page, {
    data: createHomeData(),
    layout: { version: 1, lastOpenMode: "minimal" },
  });

  await launcher(page).click();
  await expect(minimalPlayer(page)).toBeVisible();
  await expect(panel(page)).toHaveCount(0);

  // 极简条仍然可以展开成完整面板，歌单管理不会被偏好挡住。
  await minimalPlayer(page)
    .getByRole("button", { name: "展开完整播放器" })
    .click();
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).locator(".track-row")).toHaveCount(2);
});

test("manages playlists and tracks from the homepage", async ({ page }) => {
  await openHome(page, { data: createHomeData() });
  await openPanel(page);

  const playlistSelect = panel(page).getByLabel("当前歌单", { exact: true });

  // 新建歌单 → 自动切换为当前歌单。
  await panel(page).getByRole("button", { name: "新建歌单" }).click();
  await panel(page).getByLabel("歌单名称").fill("首页新歌单");
  await panel(page).getByTitle("保存歌单").click();
  await expect(playlistSelect.locator("option")).toHaveCount(2);
  await expect(playlistSelect.locator("option:checked")).toHaveText(
    "首页新歌单",
  );

  // 切回原歌单后编辑一首歌。
  await playlistSelect.selectOption("playlist-home");
  await panel(page).getByRole("button", { name: "编辑 首页第一首" }).click();
  const editor = page.locator(".track-editor");
  await expect(editor).toBeVisible();
  await editor.getByLabel("标题").fill("改名后的第一首");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(panel(page).getByText("改名后的第一首")).toBeVisible();

  // 删除另一首歌（确认弹窗 → 确定）。
  await panel(page).getByRole("button", { name: "删除 首页第二首" }).click();
  await expect(page.getByRole("dialog", { name: "删除歌曲" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "删除歌曲" })
    .getByRole("button", { name: "确定" })
    .click();
  await expect(panel(page).locator(".track-row")).toHaveCount(1);

  // 改动都落进共享歌单存储（不涉及新字段）。
  const storedPlaylists = await page.evaluate((storageKey) => {
    const raw = localStorage.getItem(`__bili_music__:${storageKey}`);
    return (JSON.parse(raw!) as AppData).playlists.map((playlist) => ({
      name: playlist.name,
      tracks: playlist.tracks.map((track) => track.title),
    }));
  }, DATA_KEY);
  expect(storedPlaylists).toEqual([
    { name: "首页歌单", tracks: ["改名后的第一首"] },
    { name: "首页新歌单", tracks: [] },
  ]);
});

test("navigates to the video page when a track is clicked on the homepage", async ({
  page,
}) => {
  await page.route("https://www.bilibili.com/video/BV1HomeTrackA/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><head><title>首页第一首_哔哩哔哩_bilibili</title></head><body><video></video></body></html>`,
    }),
  );
  await openHome(page, {
    data: createHomeData(),
    session: createHomeSession(),
  });
  await openPanel(page);

  await panel(page).locator(".track-main").first().click();

  await page.waitForURL("**/video/BV1HomeTrackA/**");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/video/BV1HomeTrackA/");
  // 与视频页相同的续播契约：带标记，目标页才能恢复歌单播放并停在片段起点。
  expect(url.searchParams.get("bili_music")).toBe("1");

  const session = await readPlaybackSession(page);
  expect(session.playback.trackId).toBe("track-home-a");
  expect(session.playback.resumeRequested).toBe(true);
});

test("keeps the part number in the target URL for multi-part tracks", async ({
  page,
}) => {
  await page.route("https://www.bilibili.com/video/BV1HomeTrackB/**", (route) =>
    route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><head><title>首页第二首_哔哩哔哩_bilibili</title></head><body><video></video></body></html>`,
    }),
  );
  await openHome(page, { data: createHomeData() });
  await openPanel(page);

  await panel(page).locator(".track-main").nth(1).click();

  await page.waitForURL("**/video/BV1HomeTrackB/**");
  const url = new URL(page.url());
  expect(url.pathname).toBe("/video/BV1HomeTrackB/");
  expect(url.searchParams.get("p")).toBe("2");
  expect(url.searchParams.get("bili_music")).toBe("1");
});

test("does not bind the homepage's hover-preview video", async ({ page }) => {
  await openHome(page, { data: createHomeData() });
  await openPanel(page);

  // 前置条件：首页本来就没有媒体，播放键与「添加到歌单」都不可用。
  await expect(
    panel(page).getByRole("button", { name: "播放", exact: true }),
  ).toBeDisabled();
  await expect(
    panel(page).getByRole("button", { name: "将当前视频添加到歌单" }),
  ).toBeDisabled();

  // 模拟真实首页的卡片悬停预览：一个正在播放、readyState 就绪的 <video>。
  await page.evaluate(() => {
    const media = document.createElement("video");
    const state = { paused: false, currentTime: 3, duration: 15 };
    Object.defineProperties(media, {
      paused: { configurable: true, get: () => state.paused },
      currentTime: {
        configurable: true,
        get: () => state.currentTime,
        set: (value: number) => {
          state.currentTime = value;
        },
      },
      duration: { configurable: true, get: () => state.duration },
      readyState: { configurable: true, get: () => 4 },
      volume: { configurable: true, get: () => 1, set: () => {} },
      muted: { configurable: true, get: () => false, set: () => {} },
    });
    media.play = async () => {};
    media.pause = () => {};
    Object.assign(media.style, {
      display: "block",
      width: "248px",
      height: "140px",
    });
    document.querySelector(".bili-video-card")?.append(media);
  });
  await page.waitForTimeout(1_500);

  // 预览媒体不得被当成「当前视频」：控件保持不可用，界面也只有一份。
  await expect(
    panel(page).getByRole("button", { name: "播放", exact: true }),
  ).toBeDisabled();
  await expect(
    panel(page).getByRole("button", { name: "将当前视频添加到歌单" }),
  ).toBeDisabled();
  await expect(page.getByLabel("播放进度")).toBeDisabled();
  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
  await expect(panel(page).locator(".now-playing-copy strong")).not.toHaveText(
    "首页第一首",
  );
});

test("does not install audio-only interception on the homepage", async ({
  page,
}) => {
  await openHome(page, { data: createHomeData(), audioOnly: true });

  // 纯音频拦截器只在播放页安装；首页没有播放器，装上去只会白白改写请求。
  const installed = await page.evaluate((symbolKey) => {
    const marker = (window as unknown as Record<symbol, unknown>)[
      Symbol.for(symbolKey)
    ];
    return marker === true;
  }, INTERCEPTOR_SYMBOL_KEY);
  expect(installed).toBe(false);
  await expect(page.locator("html")).not.toHaveAttribute(
    "data-bmp-audio-only",
    "active",
  );
});
