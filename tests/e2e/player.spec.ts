import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const VIDEO_URL = "https://www.bilibili.com/video/BV1TestMusic/";
const CURRENT_VIDEO_URL = "https://www.bilibili.com/video/BV1CurrentMusic/";
const STALE_VIDEO_URL = "https://www.bilibili.com/video/BV1StaleMusic/";
const NORMAL_PLAYBACK_URL = "https://www.bilibili.com/video/BV1NormalPlayback/";
const WEB_FULLSCREEN_URL = "https://www.bilibili.com/video/BV1WebFullscreen/";
const INTEGER_TIME_URL = "https://www.bilibili.com/video/BV1IntegerTime/";
const LEGACY_TIME_URL = "https://www.bilibili.com/video/BV1LegacyTime/";
const FULL_VIDEO_RANGE_URL =
  "https://www.bilibili.com/video/BV1FullVideoRange/";

async function installLocalStorageGm(
  page: Page,
  initialData: unknown = null,
): Promise<void> {
  await page.addInitScript(
    ({ data }) => {
      const storagePrefix = "__bili_music__:";
      const storageKey = "bilibili-music-player:data";

      if (data !== null) {
        localStorage.setItem(
          `${storagePrefix}${storageKey}`,
          JSON.stringify(data),
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
    { data: initialData },
  );
}

test("mounts, controls media, and saves a track", async ({
  page,
}, testInfo) => {
  await page.route(VIDEO_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>测试歌曲_哔哩哔哩_bilibili</title>
            <meta property="og:title" content="测试歌曲">
          </head>
          <body style="margin:0;background:#f3f4f7;font-family:sans-serif">
            <header style="height:64px;background:#fff"></header>
            <main style="width:1100px;margin:24px auto">
              <h1 class="video-title" title="测试歌曲">测试歌曲</h1>
              <a class="up-name">测试 UP 主</a>
              <video style="display:block;width:900px;height:506px;background:#111"></video>
            </main>
          </body>
        </html>
      `,
    });
  });

  await page.addInitScript(() => {
    const listeners = new Map<number, (...args: unknown[]) => void>();
    let listenerId = 0;
    const storagePrefix = "__bili_music__:";

    Object.assign(window, {
      GM_getValue(name: string, fallback?: unknown) {
        const raw = localStorage.getItem(`${storagePrefix}${name}`);
        return raw === null ? fallback : JSON.parse(raw);
      },
      GM_setValue(name: string, value: unknown) {
        localStorage.setItem(`${storagePrefix}${name}`, JSON.stringify(value));
      },
      GM_addValueChangeListener(
        _name: string,
        listener: (...args: unknown[]) => void,
      ) {
        listenerId += 1;
        listeners.set(listenerId, listener);
        return listenerId;
      },
      GM_removeValueChangeListener(id: number) {
        listeners.delete(id);
      },
    });
  });

  await page.goto(VIDEO_URL);
  await page.evaluate(() => {
    const media = document.querySelector("video")!;
    let paused = true;
    let currentTime = 12;
    let volume = 1;
    let muted = false;

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
      volume: {
        get: () => volume,
        set: (value: number) => {
          volume = value;
          media.dispatchEvent(new Event("volumechange"));
        },
      },
      muted: {
        get: () => muted,
        set: (value: boolean) => {
          muted = value;
          media.dispatchEvent(new Event("volumechange"));
        },
      },
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

  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });

  await page
    .getByRole("button", {
      name: "打开 Bilibili 音乐播放器",
    })
    .click();
  await expect(
    page.getByRole("region", { name: "Bilibili 音乐播放器" }),
  ).toBeVisible();
  await expect(page.getByText("测试歌曲").first()).toBeVisible();

  const panel = page.locator(".player-panel");
  const transportButtons = panel.locator(".transport > .icon-button");
  await panel.locator(".play-button").click();
  await transportButtons.nth(2).click();
  await transportButtons.nth(3).click();
  expect(
    await page
      .locator("video")
      .evaluate((media) => (media as HTMLVideoElement).paused),
  ).toBe(false);
  await expect(panel.locator(".status-message")).toHaveCount(0);

  await page.getByRole("button", { name: "将当前视频添加到歌单" }).click();
  await page.getByLabel("标题").fill("测试片段");
  await page.getByLabel("开始时间（秒）").fill("10");
  await page.getByLabel("结束时间（秒）").fill("90");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByText("测试片段", { exact: true })).toBeVisible();
  await page.locator(".track-main").click();
  expect(new URL(page.url()).searchParams.get("bili_music")).toBe("1");
  await expect(
    page.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await expect(panel.locator(".playlist-context-chip")).toHaveText(
    "播放完整视频",
  );
  await expect(panel.locator(".playlist-context-chip svg")).toHaveCount(0);
  await expect(panel.locator(".status-message")).toHaveCount(0);

  const playModeButton = transportButtons.nth(1);
  await playModeButton.click();
  await playModeButton.click();
  await playModeButton.click();
  const beforeBoundaryClick = await page.locator("video").evaluate((media) => ({
    currentTime: (media as HTMLVideoElement).currentTime,
    paused: (media as HTMLVideoElement).paused,
  }));
  await transportButtons.nth(2).click();
  await transportButtons.nth(3).click();
  expect(
    await page.locator("video").evaluate((media) => ({
      currentTime: (media as HTMLVideoElement).currentTime,
      paused: (media as HTMLVideoElement).paused,
    })),
  ).toEqual(beforeBoundaryClick);
  await expect(panel.locator(".status-message")).toHaveCount(0);

  await panel.locator(".playlist-context-chip").click();
  expect(new URL(page.url()).searchParams.has("bili_music")).toBe(false);
  await expect(page.locator(".track-row")).not.toHaveClass(/active/);

  await page.locator(".track-main").click();
  await page.evaluate(() => {
    document.querySelector("video")!.currentTime = 90;
  });
  await expect(panel.locator(".playlist-context-chip")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("bili_music")).toBe(false);
  expect(
    await page
      .locator("video")
      .evaluate((media) => (media as HTMLVideoElement).paused),
  ).toBe(true);
  await expect(panel.locator(".status-message")).toHaveCount(0);

  await page.screenshot({
    path: testInfo.outputPath("player-panel.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  const panelBox = await page
    .getByRole("region", { name: "Bilibili 音乐播放器" })
    .boundingBox();
  expect(panelBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.y).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(390);
  expect(panelBox!.y + panelBox!.height).toBeLessThanOrEqual(844);
  await page.screenshot({
    path: testInfo.outputPath("player-panel-mobile.png"),
    fullPage: true,
  });
});

test("uses the actual page metadata when the queue cursor points elsewhere", async ({
  page,
}) => {
  const currentCover = "https://example.com/current-cover.jpg";
  const staleCover = "https://example.com/stale-cover.jpg";

  await page.route(CURRENT_VIDEO_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>当前页面视频_哔哩哔哩_bilibili</title>
            <meta property="og:title" content="当前页面视频">
            <meta property="og:image" content="${currentCover}">
          </head>
          <body>
            <h1 class="video-title" title="当前页面视频">当前页面视频</h1>
            <a class="up-name">当前页面作者</a>
            <video style="display:block;width:900px;height:506px"></video>
          </body>
        </html>
      `,
    });
  });

  await page.route(`${STALE_VIDEO_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><html><body>stale video</body></html>",
    });
  });

  await page.addInitScript(
    ({ storageKey, staleCoverUrl }) => {
      const storagePrefix = "__bili_music__:";
      const now = Date.now();
      const playlistId = "playlist-default";
      const trackId = "track-stale";
      const storedData = {
        version: 1,
        playlists: [
          {
            id: playlistId,
            name: "默认歌单",
            tracks: [
              {
                id: trackId,
                bvid: "BV1StaleMusic",
                title: "旧歌单视频",
                uploader: "旧歌单作者",
                cover: staleCoverUrl,
                startTime: 0,
                endTime: 50,
                duration: 3_000,
                addedAt: now,
                source: "manual",
              },
            ],
            createdAt: now,
            updatedAt: now,
          },
        ],
        activePlaylistId: playlistId,
        playMode: "list-loop",
        volume: 1,
        playback: {
          playlistId,
          trackId,
          currentTime: 7,
          resumeRequested: false,
          updatedAt: now,
        },
      };

      localStorage.setItem(
        `${storagePrefix}${storageKey}`,
        JSON.stringify(storedData),
      );

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
    {
      storageKey: "bilibili-music-player:data",
      staleCoverUrl: staleCover,
    },
  );

  await page.goto(CURRENT_VIDEO_URL);
  await page.evaluate(() => {
    const media = document.querySelector("video")!;
    let paused = true;
    let currentTime = 12;

    Object.defineProperties(media, {
      paused: { get: () => paused },
      currentTime: {
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
          media.dispatchEvent(new Event("timeupdate"));
        },
      },
      duration: { get: () => 377 },
      readyState: { get: () => 4 },
      volume: {
        get: () => 1,
        set: () => {},
      },
      muted: {
        get: () => false,
        set: () => {},
      },
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

  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });
  await page
    .getByRole("button", {
      name: "打开 Bilibili 音乐播放器",
    })
    .click();

  const panel = page.getByRole("region", {
    name: "Bilibili 音乐播放器",
  });
  await expect(panel.locator(".now-playing-copy strong")).toHaveText(
    "当前页面视频",
  );
  await expect(panel.locator(".now-playing-copy span")).toHaveText(
    "当前页面作者",
  );
  await expect(panel.locator(".cover img")).toHaveAttribute(
    "src",
    currentCover,
  );
  await expect(panel.locator(".time-row span").last()).toHaveText("06:17");
  await expect(panel.locator(".track-row")).not.toHaveClass(/active/);

  await panel.getByRole("button", { name: "播放", exact: true }).click();
  await expect(
    panel.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  expect(page.url()).toBe(CURRENT_VIDEO_URL);

  await page.evaluate(() => {
    document.querySelector("video")!.currentTime = 55;
  });
  await page.waitForTimeout(600);
  expect(page.url()).toBe(CURRENT_VIDEO_URL);

  const playback = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    return JSON.parse(raw!).playback;
  });
  expect(playback).toMatchObject({
    trackId: "track-stale",
    currentTime: 7,
    resumeRequested: false,
  });
});

test("plays the full video on a normal visit even when the same BV is the queue cursor", async ({
  page,
}) => {
  await page.route(NORMAL_PLAYBACK_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>完整视频标题_哔哩哔哩_bilibili</title>
            <meta property="og:title" content="完整视频标题">
          </head>
          <body>
            <h1 class="video-title" title="完整视频标题">完整视频标题</h1>
            <a class="up-name">当前页面作者</a>
            <video style="display:block;width:900px;height:506px"></video>
          </body>
        </html>
      `,
    });
  });

  await page.addInitScript(() => {
    const storagePrefix = "__bili_music__:";
    const storageKey = "bilibili-music-player:data";
    const now = Date.now();
    const playlistId = "playlist-default";
    const trackId = "track-same-video";
    const storedData = {
      version: 1,
      playlists: [
        {
          id: playlistId,
          name: "默认歌单",
          tracks: [
            {
              id: trackId,
              bvid: "BV1NormalPlayback",
              title: "歌单片段标题",
              uploader: "歌单作者",
              startTime: 0,
              endTime: 5,
              duration: 9,
              addedAt: now,
              source: "manual",
            },
          ],
          createdAt: now,
          updatedAt: now,
        },
      ],
      activePlaylistId: playlistId,
      playMode: "list-loop",
      volume: 1,
      playback: {
        playlistId,
        trackId,
        currentTime: 0,
        resumeRequested: false,
        updatedAt: now,
      },
    };

    localStorage.setItem(
      `${storagePrefix}${storageKey}`,
      JSON.stringify(storedData),
    );

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

  await page.goto(NORMAL_PLAYBACK_URL);
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
      duration: { get: () => 9 },
      readyState: { get: () => 4 },
      volume: {
        get: () => 1,
        set: () => {},
      },
      muted: {
        get: () => false,
        set: () => {},
      },
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

  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });
  await page.locator(".floating-button").click();

  const panel = page.locator(".player-panel");
  await expect(panel.locator(".now-playing-copy strong")).toHaveText(
    "完整视频标题",
  );
  await expect(panel.locator(".time-row span").last()).toHaveText("00:09");
  await expect(panel.locator(".track-row")).not.toHaveClass(/active/);

  await panel.locator(".play-button").click();
  await page.evaluate(() => {
    document.querySelector("video")!.currentTime = 6;
  });
  await page.waitForTimeout(600);

  const mediaState = await page.evaluate(() => {
    const media = document.querySelector("video")!;
    return {
      currentTime: media.currentTime,
      paused: media.paused,
    };
  });
  expect(mediaState).toEqual({
    currentTime: 6,
    paused: false,
  });
  expect(new URL(page.url()).searchParams.has("bili_music")).toBe(false);
});

test("hides the player UI in web fullscreen and restores its previous state", async ({
  page,
}) => {
  await page.route(WEB_FULLSCREEN_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>Web fullscreen test_bilibili</title>
          </head>
          <body>
            <div class="bpx-player-container" data-screen="normal">
              <video></video>
            </div>
          </body>
        </html>
      `,
    });
  });

  await page.addInitScript(() => {
    const storage = new Map<string, unknown>();

    Object.assign(window, {
      GM_getValue(name: string, fallback?: unknown) {
        return storage.get(name) ?? fallback;
      },
      GM_setValue(name: string, value: unknown) {
        storage.set(name, value);
      },
      GM_addValueChangeListener() {
        return 1;
      },
      GM_removeValueChangeListener() {},
    });
  });

  await page.goto(WEB_FULLSCREEN_URL);
  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });

  const host = page.locator("#bilibili-music-player-host");
  const launcher = page.locator(".floating-button");
  const panel = page.locator(".player-panel");

  await expect(launcher).toBeVisible();

  await page.evaluate(() => {
    document
      .querySelector(".bpx-player-container")!
      .setAttribute("data-screen", "web");
  });
  await expect(host).toHaveAttribute("data-web-fullscreen", "");
  await expect(launcher).toBeHidden();

  await page.evaluate(() => {
    document
      .querySelector(".bpx-player-container")!
      .setAttribute("data-screen", "normal");
  });
  await expect(host).not.toHaveAttribute("data-web-fullscreen", "");
  await expect(launcher).toBeVisible();

  await launcher.click();
  await expect(panel).toBeVisible();

  await page.evaluate(() => {
    document
      .querySelector(".bpx-player-container")!
      .setAttribute("data-screen", "web");
  });
  await expect(panel).toBeHidden();

  await page.evaluate(() => {
    document
      .querySelector(".bpx-player-container")!
      .setAttribute("data-screen", "normal");
  });
  await expect(panel).toBeVisible();
});

test("uses whole seconds for new track boundaries", async ({ page }) => {
  await page.route(INTEGER_TIME_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>整数时间测试_哔哩哔哩_bilibili</title>
            <meta property="og:title" content="整数时间测试">
          </head>
          <body>
            <h1 class="video-title" title="整数时间测试">整数时间测试</h1>
            <video style="display:block;width:900px;height:506px"></video>
          </body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page);

  await page.goto(INTEGER_TIME_URL);
  await page.evaluate(() => {
    const media = document.querySelector("video")!;
    let currentTime = 7.860401;

    Object.defineProperties(media, {
      paused: { get: () => true },
      currentTime: {
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
        },
      },
      duration: { get: () => 181 },
      readyState: { get: () => 4 },
      volume: { get: () => 1, set: () => {} },
      muted: { get: () => false, set: () => {} },
    });
  });
  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });

  await page.locator(".floating-button").click();
  await page.locator(".add-current-button").click();

  const editor = page.locator(".track-editor");
  const startInput = editor.locator('input[type="number"]').nth(0);
  const endInput = editor.locator('input[type="number"]').nth(1);
  const currentButtons = editor.locator(".current-time-button");

  await expect(startInput).toHaveAttribute("step", "1");
  await expect(endInput).toHaveAttribute("step", "1");
  await currentButtons.nth(0).click();
  await currentButtons.nth(1).click();
  await expect(startInput).toHaveValue("7");
  await expect(endInput).toHaveValue("8");

  await startInput.fill("12.7");
  await endInput.fill("20");
  await editor.locator(".save-track-button").click();
  await expect(editor.locator(".editor-error")).toHaveText(
    "开始时间必须是整数秒",
  );
  await expect(page.locator(".track-row")).toHaveCount(0);

  await startInput.fill("12");
  await endInput.fill("20.1");
  await editor.locator(".save-track-button").click();
  await expect(editor.locator(".editor-error")).toHaveText(
    "结束时间必须是整数秒",
  );
  await expect(page.locator(".track-row")).toHaveCount(0);

  await endInput.fill("21");
  await editor.locator(".save-track-button").click();
  await expect(page.locator(".track-row")).toHaveCount(1);

  const savedBoundary = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    const track = JSON.parse(raw!).playlists[0].tracks[0];
    return { startTime: track.startTime, endTime: track.endTime };
  });
  expect(savedBoundary).toEqual({ startTime: 12, endTime: 21 });
});

test("normalizes legacy fractional boundaries only when an edit is saved", async ({
  page,
}) => {
  const now = 1_000;
  const legacyData = {
    version: 1,
    playlists: [
      {
        id: "playlist-default",
        name: "默认歌单",
        tracks: [
          {
            id: "track-legacy-time",
            bvid: "BV1LegacyTime",
            title: "旧小数时间歌曲",
            startTime: 7.860401,
            endTime: 15.2,
            duration: 100,
            addedAt: now,
            source: "manual",
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activePlaylistId: "playlist-default",
    playMode: "list-loop",
    volume: 1,
    playback: {
      playlistId: "playlist-default",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: now,
    },
  };

  await page.route(LEGACY_TIME_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>旧时间测试_哔哩哔哩_bilibili</title>
          </head>
          <body>
            <video style="display:block;width:900px;height:506px"></video>
          </body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page, legacyData);

  await page.goto(LEGACY_TIME_URL);
  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });
  await page.locator(".floating-button").click();

  const editButton = page.locator(".track-row .row-action").first();
  await editButton.click();

  const editor = page.locator(".track-editor");
  const startInput = editor.locator('input[type="number"]').nth(0);
  const endInput = editor.locator('input[type="number"]').nth(1);
  await expect(startInput).toHaveValue("7");
  await expect(endInput).toHaveValue("16");

  await editor.locator(".editor-heading .icon-button").click();
  const boundaryAfterCancel = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    const track = JSON.parse(raw!).playlists[0].tracks[0];
    return { startTime: track.startTime, endTime: track.endTime };
  });
  expect(boundaryAfterCancel).toEqual({ startTime: 7.860401, endTime: 15.2 });

  await editButton.click();
  await page.locator(".track-editor .save-track-button").click();
  const boundaryAfterSave = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    const track = JSON.parse(raw!).playlists[0].tracks[0];
    return { startTime: track.startTime, endTime: track.endTime };
  });
  expect(boundaryAfterSave).toEqual({ startTime: 7, endTime: 16 });
});

test("shows the effective full-video range without storing an end time", async ({
  page,
}) => {
  const now = 1_000;
  const storedData = {
    version: 1,
    playlists: [
      {
        id: "playlist-default",
        name: "默认歌单",
        tracks: [
          {
            id: "track-existing-full-video",
            bvid: "BV1FullVideoRange",
            title: "已有整段歌曲",
            startTime: 0,
            duration: 181,
            addedAt: now,
            source: "manual",
          },
          {
            id: "track-existing-segment",
            bvid: "BV1FullVideoRange",
            title: "已有片段",
            startTime: 10,
            endTime: 90,
            duration: 181,
            addedAt: now,
            source: "manual",
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activePlaylistId: "playlist-default",
    playMode: "list-loop",
    volume: 1,
    playback: {
      playlistId: "playlist-default",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: now,
    },
  };

  await page.route(FULL_VIDEO_RANGE_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>整段范围测试_哔哩哔哩_bilibili</title>
            <meta property="og:title" content="整段范围测试">
          </head>
          <body>
            <h1 class="video-title" title="整段范围测试">整段范围测试</h1>
            <video style="display:block;width:900px;height:506px"></video>
          </body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page, storedData);

  await page.goto(FULL_VIDEO_RANGE_URL);
  await page.evaluate(() => {
    const media = document.querySelector("video")!;
    let currentTime = 0;

    Object.defineProperties(media, {
      paused: { get: () => true },
      currentTime: {
        get: () => currentTime,
        set: (value: number) => {
          currentTime = value;
        },
      },
      duration: { get: () => 181 },
      readyState: { get: () => 4 },
      volume: { get: () => 1, set: () => {} },
      muted: { get: () => false, set: () => {} },
    });
  });
  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });
  await page.locator(".floating-button").click();

  const rows = page.locator(".track-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).locator(".track-copy > span")).toContainText(
    "00:00–03:01",
  );
  await expect(rows.nth(1).locator(".track-copy > span")).toContainText(
    "00:10–01:30",
  );

  await page.locator(".add-current-button").click();
  let editor = page.locator(".track-editor");
  let timeInputs = editor.locator('input[type="number"]');
  await expect(timeInputs.nth(0)).toHaveValue("0");
  await expect(timeInputs.nth(1)).toHaveValue("");
  await editor.locator(".save-track-button").click();

  await page.locator(".add-current-button").click();
  editor = page.locator(".track-editor");
  timeInputs = editor.locator('input[type="number"]');
  await timeInputs.nth(0).fill("");
  await expect(timeInputs.nth(1)).toHaveValue("");
  await editor.locator(".save-track-button").click();

  await expect(rows).toHaveCount(4);
  await expect(rows.nth(2).locator(".track-copy > span")).toContainText(
    "00:00–03:01",
  );
  await expect(rows.nth(3).locator(".track-copy > span")).toContainText(
    "00:00–03:01",
  );

  const storedBoundaries = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    return JSON.parse(raw!).playlists[0].tracks.map(
      (track: { startTime: number; endTime?: number }) => ({
        startTime: track.startTime,
        endTime: track.endTime ?? null,
        hasEndTime: Object.prototype.hasOwnProperty.call(track, "endTime"),
      }),
    );
  });
  expect(storedBoundaries).toEqual([
    { startTime: 0, endTime: null, hasEndTime: false },
    { startTime: 10, endTime: 90, hasEndTime: true },
    { startTime: 0, endTime: null, hasEndTime: false },
    { startTime: 0, endTime: null, hasEndTime: false },
  ]);
});
