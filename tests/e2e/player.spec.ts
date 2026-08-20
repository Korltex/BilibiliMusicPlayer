import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { injectBuiltUserscript } from "../helpers/userscript";

const packageVersion = (
  JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

const VIDEO_URL = "https://www.bilibili.com/video/BV1TestMusic/";
const CURRENT_VIDEO_URL = "https://www.bilibili.com/video/BV1CurrentMusic/";
const STALE_VIDEO_URL = "https://www.bilibili.com/video/BV1StaleMusic/";
const NORMAL_PLAYBACK_URL = "https://www.bilibili.com/video/BV1NormalPlayback/";
const WEB_FULLSCREEN_URL = "https://www.bilibili.com/video/BV1WebFullscreen/";
const DRAGGABLE_UI_URL = "https://www.bilibili.com/video/BV1DraggableUi/";
const INTEGER_TIME_URL = "https://www.bilibili.com/video/BV1IntegerTime/";
const LEGACY_TIME_URL = "https://www.bilibili.com/video/BV1LegacyTime/";
const EDITOR_SWITCH_URL = "https://www.bilibili.com/video/BV1EditorSwitch/";
const FULL_VIDEO_RANGE_URL =
  "https://www.bilibili.com/video/BV1FullVideoRange/";
const MINIMAL_PLAYER_URL = "https://www.bilibili.com/video/BV1MinimalPlayer/";
const CHAPTER_VIDEO_URL = "https://www.bilibili.com/video/BV1ChapterMusic/?p=2";
const EMPTY_CHAPTER_VIDEO_URL =
  "https://www.bilibili.com/video/BV1EmptyChapter/";
const VIEW_API_GLOB = "https://api.bilibili.com/x/web-interface/view**";
const PLAYER_INFO_API_GLOB = "https://api.bilibili.com/x/player/wbi/v2**";

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

async function installMockMedia(
  page: Page,
  duration = 900,
  initialTime = 0,
  rejectFirstPlay = false,
): Promise<void> {
  await page.evaluate(
    ({ mediaDuration, currentTimeAtStart, shouldRejectFirstPlay }) => {
      const media = document.querySelector("video")!;
      let paused = true;
      let currentTime = currentTimeAtStart;
      let volume = 1;
      let muted = false;
      let playAttempts = 0;

      Object.defineProperties(media, {
        paused: { get: () => paused },
        currentTime: {
          get: () => currentTime,
          set: (value: number) => {
            currentTime = value;
            media.dispatchEvent(new Event("timeupdate"));
          },
        },
        duration: { get: () => mediaDuration },
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
        playAttempts += 1;
        if (shouldRejectFirstPlay && playAttempts === 1) {
          throw new DOMException("autoplay blocked", "NotAllowedError");
        }
        paused = false;
        media.dispatchEvent(new Event("play"));
      };
      media.pause = () => {
        paused = true;
        media.dispatchEvent(new Event("pause"));
      };
    },
    {
      mediaDuration: duration,
      currentTimeAtStart: initialTime,
      shouldRejectFirstPlay: rejectFirstPlay,
    },
  );
}

interface MinimalPlayerTestOptions {
  currentTime?: number;
  duration?: number;
  installMedia?: boolean;
  rejectFirstPlay?: boolean;
}

async function openMinimalPlayerTestPage(
  page: Page,
  {
    currentTime = 0,
    duration = 240,
    installMedia = true,
    rejectFirstPlay = false,
  }: MinimalPlayerTestOptions = {},
): Promise<void> {
  await page.route(MINIMAL_PLAYER_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head><title>极简播放器测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="极简播放器测试">极简播放器测试</h1>
            <a class="up-name">测试作者</a>
            <video></video>
          </body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page);
  await page.goto(MINIMAL_PLAYER_URL);
  if (installMedia) {
    await installMockMedia(page, duration, currentTime, rejectFirstPlay);
  }
  await injectBuiltUserscript(page);
}

test("displays the 0.1.6 package version in the full player", async ({
  page,
}) => {
  expect(packageVersion).toBe("0.1.6");
  await openMinimalPlayerTestPage(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();

  const full = page.getByRole("region", {
    name: "Bilibili 音乐播放器",
    exact: true,
  });
  await expect(full.locator(".version")).toHaveText(packageVersion);
});

test("switches between full, minimal, and launcher modes", async ({ page }) => {
  await openMinimalPlayerTestPage(page);

  const launcher = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  await launcher.click();

  const full = page.getByRole("region", {
    name: "Bilibili 音乐播放器",
    exact: true,
  });
  const fullBeforeMinimal = (await full.boundingBox())!;
  const headerButtons = full.locator(".header-actions > button");
  await expect(headerButtons).toHaveCount(3);
  await expect(headerButtons.nth(0)).toHaveAttribute(
    "aria-label",
    "重置图标和播放器位置",
  );
  await expect(headerButtons.nth(1)).toHaveAttribute(
    "aria-label",
    "进入极简模式",
  );
  await expect(headerButtons.nth(2)).toHaveAttribute(
    "aria-label",
    "收起播放器",
  );

  await headerButtons.nth(1).click();
  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  await expect(minimal).toBeVisible();
  await expect(full).toHaveCount(0);

  const box = (await minimal.boundingBox())!;
  expect(box.x).toBeCloseTo(fullBeforeMinimal.x, 0);
  expect(box.y).toBeCloseTo(fullBeforeMinimal.y, 0);
  expect(box.width).toBeLessThanOrEqual(396.5);
  expect(box.height).toBeCloseTo(56, 0);

  for (const name of ["展开完整播放器", "收起播放器"]) {
    const actionBox = (await minimal
      .getByRole("button", { name })
      .boundingBox())!;
    expect(actionBox.width).toBeGreaterThanOrEqual(26);
    expect(actionBox.width).toBeLessThanOrEqual(28);
    expect(actionBox.height).toBeGreaterThanOrEqual(26);
    expect(actionBox.height).toBeLessThanOrEqual(28);
  }

  await minimal.getByRole("button", { name: "收起播放器" }).click();
  await launcher.click();
  await expect(minimal).toBeVisible();

  await minimal.getByRole("button", { name: "展开完整播放器" }).click();
  await expect(full).toBeVisible();
});

test("minimal player keeps controls visible and persists its mode", async ({
  page,
}) => {
  await openMinimalPlayerTestPage(page, { installMedia: false });
  await page.evaluate(() => {
    localStorage.setItem(
      "__bili_music__:bilibili-music-player:layout",
      JSON.stringify({
        version: 1,
        lastOpenMode: "full",
        launcher: { x: 1200, y: 760 },
        panel: { x: 960, y: 760 },
      }),
    );
  });

  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  const fullBeforeMinimal = (await page
    .getByRole("region", {
      name: "Bilibili 音乐播放器",
      exact: true,
    })
    .boundingBox())!;
  await page.getByRole("button", { name: "进入极简模式" }).click();

  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  await expect(
    minimal.getByRole("button", { name: "播放", exact: true }),
  ).toBeDisabled();
  await expect(minimal.getByRole("button", { name: "上一首" })).toBeDisabled();
  await expect(minimal.getByRole("button", { name: "下一首" })).toBeDisabled();
  await expect(
    minimal.getByRole("button", { name: "开启纯音频模式并重载页面" }),
  ).toBeEnabled();
  const playModeButton = minimal.locator(
    '[aria-label="顺序播放"], [aria-label="列表循环"], [aria-label="单曲循环"], [aria-label="随机播放"]',
  );
  await expect(playModeButton).toHaveCount(1);
  await expect(playModeButton).toBeEnabled();
  await expect(minimal.getByRole("slider", { name: "音量" })).toBeEnabled();
  await expect(
    minimal.getByRole("button", { name: "展开完整播放器" }),
  ).toBeEnabled();
  await expect(
    minimal.getByRole("button", { name: "收起播放器" }),
  ).toBeEnabled();

  await minimal.getByRole("button", { name: "收起播放器" }).click();
  await page.reload();
  await installMockMedia(page, 240, 60);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();

  await expect(minimal).toBeVisible();
  await expect(minimal).toContainText("极简播放器测试");
  await expect(minimal).toContainText("测试作者");
  await expect(
    minimal.locator(".cover, .brand, .time-row, .progress-range"),
  ).toHaveCount(0);
  await expect(
    minimal.getByRole("progressbar", { name: "播放进度" }),
  ).toHaveAttribute("aria-valuenow", "25");
  await expect(
    minimal.getByRole("progressbar", { name: "播放进度" }),
  ).not.toHaveAttribute("tabindex");
  await expect(minimal.getByRole("slider", { name: "音量" })).toHaveCount(1);
  await expect(minimal.locator('input[type="range"]')).toHaveCount(1);

  await minimal.getByRole("button", { name: "播放", exact: true }).click();
  await expect(
    minimal.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await minimal.getByRole("button", { name: "列表循环" }).click();
  await expect(minimal.getByRole("button", { name: "单曲循环" })).toBeVisible();
  await minimal.getByRole("button", { name: "静音" }).click();
  await expect(minimal.getByRole("button", { name: "取消静音" })).toBeVisible();

  const storedLayout = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:layout",
    );
    return raw ? JSON.parse(raw) : null;
  });
  expect(storedLayout).toMatchObject({
    version: 1,
    lastOpenMode: "minimal",
    launcher: { x: 1200, y: 760 },
  });
  expect(storedLayout.panel.x).toBeCloseTo(fullBeforeMinimal.x, 0);
  expect(storedLayout.panel.y).toBeCloseTo(fullBeforeMinimal.y, 0);
});

test("minimal player keeps every control visible on a narrow viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await openMinimalPlayerTestPage(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await page.getByRole("button", { name: "进入极简模式" }).click();

  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  const minimalBounds = (await minimal.boundingBox())!;
  const metadataBounds = (await minimal
    .locator(".minimal-now-playing")
    .boundingBox())!;
  const controls = minimal.locator("button, input");
  await expect(controls).toHaveCount(9);

  const controlBounds = await controls.evaluateAll((elements) =>
    elements.map((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
      };
    }),
  );

  expect(metadataBounds.width).toBeGreaterThanOrEqual(32);
  expect(metadataBounds.x + metadataBounds.width).toBeLessThanOrEqual(
    controlBounds[0].left + 0.5,
  );
  for (const bounds of controlBounds) {
    expect(bounds.left).toBeGreaterThanOrEqual(minimalBounds.x - 0.5);
    expect(bounds.right).toBeLessThanOrEqual(
      minimalBounds.x + minimalBounds.width + 0.5,
    );
    expect(bounds.top).toBeGreaterThanOrEqual(minimalBounds.y - 0.5);
    expect(bounds.bottom).toBeLessThanOrEqual(
      minimalBounds.y + minimalBounds.height + 0.5,
    );
  }
  for (let index = 1; index < controlBounds.length; index += 1) {
    expect(controlBounds[index].left).toBeGreaterThanOrEqual(
      controlBounds[index - 1].right - 0.5,
    );
  }
});

test("minimal interaction prompt retries playback and clears immediately", async ({
  page,
}) => {
  await openMinimalPlayerTestPage(page, { rejectFirstPlay: true });
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await page.getByRole("button", { name: "进入极简模式" }).click();

  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  await minimal.getByRole("button", { name: "播放", exact: true }).click();
  const prompt = minimal.getByRole("button", { name: "点击继续播放" });
  await expect(prompt).toBeVisible();
  const promptBounds = (await prompt.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(promptBounds.y).toBeGreaterThanOrEqual(0);
  expect(promptBounds.y + promptBounds.height).toBeLessThanOrEqual(
    viewport.height,
  );
  await prompt.click();
  await expect(
    minimal.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await expect(prompt).toHaveCount(0);
});

test("minimal interaction prompt expires after five seconds", async ({
  page,
}) => {
  await openMinimalPlayerTestPage(page, { rejectFirstPlay: true });
  await page.evaluate(() => {
    localStorage.setItem(
      "__bili_music__:bilibili-music-player:layout",
      JSON.stringify({
        version: 1,
        lastOpenMode: "minimal",
        panel: { x: 20, y: 0 },
      }),
    );
  });
  await page.reload();
  await installMockMedia(page, 240, 0, true);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();

  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  await minimal.getByRole("button", { name: "播放", exact: true }).click();
  const prompt = minimal.getByRole("button", { name: "点击继续播放" });
  await expect(prompt).toBeVisible();
  await expect(prompt).toHaveClass(/below/);
  const promptBounds = (await prompt.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(promptBounds.y).toBeGreaterThanOrEqual(0);
  expect(promptBounds.y + promptBounds.height).toBeLessThanOrEqual(
    viewport.height,
  );
  await expect(prompt).toHaveCount(0, { timeout: 5_500 });
});

test("minimal controls are keyboard accessible without triggering page shortcuts", async ({
  page,
}) => {
  await openMinimalPlayerTestPage(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await page.getByRole("button", { name: "进入极简模式" }).click();
  await page.evaluate(() => {
    const pageState = window as Window & { spaceShortcutCount?: number };
    pageState.spaceShortcutCount = 0;
    document.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        pageState.spaceShortcutCount = (pageState.spaceShortcutCount ?? 0) + 1;
      }
    });
  });

  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  const audioButton = minimal.locator(".audio-mode-button");
  const playButton = minimal.getByRole("button", {
    name: "播放",
    exact: true,
  });

  await page.keyboard.press("Tab");
  await expect(audioButton).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(playButton).toBeFocused();
  await page.keyboard.press("Space");

  await expect(
    minimal.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        (window as Window & { spaceShortcutCount?: number }).spaceShortcutCount,
    ),
  ).toBe(0);
});

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
    const pageState = window as Window & { spaceShortcutCount?: number };
    pageState.spaceShortcutCount = 0;
    document.addEventListener("keydown", (event) => {
      if (event.code === "Space") {
        pageState.spaceShortcutCount = (pageState.spaceShortcutCount ?? 0) + 1;
        event.preventDefault();
      }
    });
  });
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

  await injectBuiltUserscript(page);

  const launcher = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  const launcherIcon = launcher.locator("svg");
  await expect(launcherIcon).toHaveAttribute("stroke-width", "2");
  await expect(launcherIcon).toHaveAttribute("stroke-linecap", "round");
  await expect(launcherIcon).toHaveAttribute("stroke-linejoin", "round");
  await launcher.click();
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
  const titleInput = page.getByLabel("标题");
  await titleInput.fill("测试");
  await titleInput.press("End");
  await titleInput.press("Space");
  await expect(titleInput).toHaveValue("测试 ");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { spaceShortcutCount?: number }).spaceShortcutCount,
    ),
  ).toBe(0);
  await titleInput.fill("测试片段");
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

test("selects video chapters while keeping the title editable", async ({
  page,
}) => {
  let requestedPlayerCid: string | null = null;

  await page.route(CHAPTER_VIDEO_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>章节视频_哔哩哔哩_bilibili</title>
            <meta property="og:title" content="章节视频">
          </head>
          <body>
            <h1 class="video-title" title="章节视频">章节视频</h1>
            <a class="up-name">章节作者</a>
            <video style="display:block;width:900px;height:506px"></video>
          </body>
        </html>
      `,
    });
  });
  await page.route(VIEW_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: { pages: [{ cid: 101 }, { cid: 202 }] },
      }),
    });
  });
  await page.route(PLAYER_INFO_API_GLOB, async (route) => {
    requestedPlayerCid = new URL(route.request().url()).searchParams.get("cid");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          view_points: [
            { content: "ceremony", from: 364, to: 559 },
            { content: "finale", from: 559, to: 700 },
          ],
        },
      }),
    });
  });
  await installLocalStorageGm(page);

  await page.goto(CHAPTER_VIDEO_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();
  await page.getByRole("button", { name: "将当前视频添加到歌单" }).click();

  const editor = page.locator(".track-editor");
  const titleInput = page.getByLabel("标题");
  const startInput = page.getByLabel("开始时间（秒）");
  const endInput = page.getByLabel("结束时间（秒）");
  await editor.getByRole("button", { name: "展开视频章节" }).click();

  const ceremony = editor.getByRole("option", {
    name: "ceremony 06:04–09:19",
  });
  await expect(ceremony).toBeVisible();
  await ceremony.click();
  await expect(titleInput).toHaveValue("ceremony");
  await expect(startInput).toHaveValue("364");
  await expect(endInput).toHaveValue("559");
  expect(requestedPlayerCid).toBe("202");

  await titleInput.press("ArrowDown");
  await expect(titleInput).toHaveAttribute(
    "aria-activedescendant",
    "bilibili-music-chapter-0",
  );
  await titleInput.press("ArrowDown");
  await expect(titleInput).toHaveAttribute(
    "aria-activedescendant",
    "bilibili-music-chapter-1",
  );
  await titleInput.press("Enter");
  await expect(titleInput).toHaveValue("finale");
  await expect(startInput).toHaveValue("559");
  await expect(endInput).toHaveValue("700");

  await titleInput.fill("自定义章节标题");
  await expect(startInput).toHaveValue("559");
  await expect(endInput).toHaveValue("700");
  await page.getByRole("button", { name: "保存", exact: true }).click();

  const storedTrack = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    return JSON.parse(raw!).playlists[0].tracks[0];
  });
  expect(storedTrack).toMatchObject({
    bvid: "BV1ChapterMusic",
    cid: 202,
    page: 2,
    title: "自定义章节标题",
    startTime: 559,
    endTime: 700,
  });

  await page.getByRole("button", { name: "编辑 自定义章节标题" }).click();
  await page
    .locator(".track-editor")
    .getByRole("button", { name: "展开视频章节" })
    .click();
  const editedChapterList = page
    .locator(".track-editor")
    .getByRole("listbox", { name: "视频章节" });
  await expect(
    page.locator(".track-editor").getByRole("option", {
      name: "ceremony 06:04–09:19",
    }),
  ).toBeVisible();
  await page
    .locator(".track-editor")
    .getByRole("combobox", { name: "标题", exact: true })
    .press("Escape");
  await expect(editedChapterList).toHaveCount(0);

  await page
    .locator(".track-editor")
    .getByRole("button", { name: "展开视频章节" })
    .click();
  await expect(editedChapterList).toBeVisible();
  await page.locator(".track-editor .editor-heading strong").click();
  await expect(editedChapterList).toHaveCount(0);
});

test("keeps manual track editing available when the video has no chapters", async ({
  page,
}) => {
  await page.route(EMPTY_CHAPTER_VIDEO_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head>
            <title>无章节视频_哔哩哔哩_bilibili</title>
            <meta property="og:title" content="无章节视频">
          </head>
          <body>
            <h1 class="video-title" title="无章节视频">无章节视频</h1>
            <video style="display:block;width:900px;height:506px"></video>
          </body>
        </html>
      `,
    });
  });
  await page.route(VIEW_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: { pages: [{ cid: 404 }] },
      }),
    });
  });
  await page.route(PLAYER_INFO_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: 0, data: { view_points: [] } }),
    });
  });
  await installLocalStorageGm(page);

  await page.goto(EMPTY_CHAPTER_VIDEO_URL);
  await installMockMedia(page, 180);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();
  await page.getByRole("button", { name: "将当前视频添加到歌单" }).click();

  const editor = page.locator(".track-editor");
  await editor.getByRole("button", { name: "展开视频章节" }).click();
  await expect(editor.getByRole("listbox", { name: "视频章节" })).toBeVisible();
  await expect(editor.getByRole("option")).toHaveCount(0);

  await page.getByLabel("标题").fill("手动标题");
  await page.getByLabel("开始时间（秒）").fill("12");
  await page.getByLabel("结束时间（秒）").fill("30");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".track-copy strong")).toHaveText("手动标题");
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

  await injectBuiltUserscript(page);
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

  await injectBuiltUserscript(page);
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
  await injectBuiltUserscript(page);

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

  await panel.getByRole("button", { name: "进入极简模式" }).click();
  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  await expect(minimal).toBeVisible();

  await page.evaluate(() => {
    document
      .querySelector(".bpx-player-container")!
      .setAttribute("data-screen", "web");
  });
  await expect(minimal).toBeHidden();

  await page.evaluate(() => {
    document
      .querySelector(".bpx-player-container")!
      .setAttribute("data-screen", "normal");
  });
  await expect(minimal).toBeVisible();
});

test("drags and persists the launcher and player panel", async ({ page }) => {
  await page.route(DRAGGABLE_UI_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head><title>Draggable UI test_bilibili</title></head>
          <body><video></video></body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page);

  await page.goto(DRAGGABLE_UI_URL);
  await injectBuiltUserscript(page);

  let launcher = page.locator(".floating-button");
  let panel = page.locator(".player-panel");
  const launcherBefore = (await launcher.boundingBox())!;
  const launcherStart = {
    x: launcherBefore.x + launcherBefore.width / 2,
    y: launcherBefore.y + launcherBefore.height / 2,
  };

  await page.mouse.move(launcherStart.x, launcherStart.y);
  await page.mouse.down();
  await page.mouse.move(launcherStart.x - 400, launcherStart.y - 250, {
    steps: 8,
  });
  await page.mouse.up();

  await expect(panel).toHaveCount(0);
  const launcherMoved = (await launcher.boundingBox())!;
  expect(launcherMoved.x).toBeCloseTo(launcherBefore.x - 400, 0);
  expect(launcherMoved.y).toBeCloseTo(launcherBefore.y - 250, 0);

  await launcher.click();
  await expect(panel).toBeVisible();
  const panelBefore = (await panel.boundingBox())!;
  const panelHeader = panel.locator(".panel-header");
  const headerBounds = (await panelHeader.boundingBox())!;
  const panelDragStart = {
    x: headerBounds.x + 100,
    y: headerBounds.y + headerBounds.height / 2,
  };

  await page.mouse.move(panelDragStart.x, panelDragStart.y);
  await page.mouse.down();
  await page.mouse.move(panelDragStart.x - 300, panelDragStart.y - 140, {
    steps: 8,
  });
  await page.mouse.up();

  let panelMoved = (await panel.boundingBox())!;
  expect(panelMoved.x).toBeCloseTo(panelBefore.x - 300, 0);
  expect(panelMoved.y).toBeCloseTo(panelBefore.y - 140, 0);

  await panel.getByRole("button", { name: "进入极简模式" }).click();
  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  const minimalMetadata = minimal.locator(".minimal-now-playing");
  const metadataBounds = (await minimalMetadata.boundingBox())!;
  const minimalDragStart = {
    x: metadataBounds.x + metadataBounds.width / 2,
    y: metadataBounds.y + metadataBounds.height / 2,
  };

  await page.mouse.move(minimalDragStart.x, minimalDragStart.y);
  await page.mouse.down();
  await page.mouse.move(minimalDragStart.x + 500, minimalDragStart.y + 400, {
    steps: 8,
  });
  await page.mouse.up();

  const minimalMoved = (await minimal.boundingBox())!;
  await minimal.getByRole("button", { name: "展开完整播放器" }).click();
  await expect(panel).toBeVisible();
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const bounds = await panel.boundingBox();
      if (!bounds) return false;
      const expectedX = Math.min(
        Math.max(minimalMoved.x, 0),
        viewport.width - bounds.width,
      );
      const expectedY = Math.min(
        Math.max(minimalMoved.y, 0),
        viewport.height - bounds.height,
      );
      return (
        Math.abs(bounds.x - expectedX) <= 0.5 &&
        Math.abs(bounds.y - expectedY) <= 0.5
      );
    })
    .toBe(true);
  panelMoved = (await panel.boundingBox())!;

  await panel.locator(".close-panel-button").click();
  await expect(launcher).toBeVisible();
  const launcherAfterPanelDrag = (await launcher.boundingBox())!;
  expect(launcherAfterPanelDrag.x).toBeCloseTo(launcherMoved.x, 0);
  expect(launcherAfterPanelDrag.y).toBeCloseTo(launcherMoved.y, 0);

  await page.reload();
  await injectBuiltUserscript(page);
  launcher = page.locator(".floating-button");
  panel = page.locator(".player-panel");

  const restoredLauncher = (await launcher.boundingBox())!;
  expect(restoredLauncher.x).toBeCloseTo(launcherMoved.x, 0);
  expect(restoredLauncher.y).toBeCloseTo(launcherMoved.y, 0);

  await launcher.click();
  const restoredPanel = (await panel.boundingBox())!;
  expect(restoredPanel.x).toBeCloseTo(panelMoved.x, 0);
  expect(restoredPanel.y).toBeCloseTo(panelMoved.y, 0);

  await page.setViewportSize({ width: 360, height: 480 });
  await expect
    .poll(async () => {
      const bounds = await panel.boundingBox();
      return Boolean(
        bounds &&
        bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.x + bounds.width <= 360.5 &&
        bounds.y + bounds.height <= 480.5,
      );
    })
    .toBe(true);

  await panel.locator(".close-panel-button").click();
  await expect
    .poll(async () => {
      const bounds = await launcher.boundingBox();
      return Boolean(
        bounds &&
        bounds.x >= 0 &&
        bounds.y >= 0 &&
        bounds.x + bounds.width <= 360.5 &&
        bounds.y + bounds.height <= 480.5,
      );
    })
    .toBe(true);

  await page.setViewportSize({ width: 1440, height: 900 });
  await launcher.click();
  const resetButton = panel.getByRole("button", {
    name: "重置图标和播放器位置",
  });
  const closeButton = panel.getByRole("button", { name: "收起播放器" });
  const resetBounds = (await resetButton.boundingBox())!;
  const closeBounds = (await closeButton.boundingBox())!;
  expect(resetBounds.width).toBe(closeBounds.width);
  expect(resetBounds.height).toBe(closeBounds.height);

  await resetButton.click();
  await expect
    .poll(async () => {
      const bounds = await panel.boundingBox();
      return Boolean(
        bounds &&
        Math.abs(1440 - bounds.x - bounds.width - 20) <= 0.5 &&
        Math.abs(900 - bounds.y - bounds.height - 20) <= 0.5,
      );
    })
    .toBe(true);

  const storedLayout = await page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:layout",
    );
    return raw ? JSON.parse(raw) : null;
  });
  expect(storedLayout).toEqual({ version: 1, lastOpenMode: "full" });

  await closeButton.click();
  const resetLauncher = (await launcher.boundingBox())!;
  expect(1440 - resetLauncher.x - resetLauncher.width).toBeCloseTo(24, 0);
  expect(900 - resetLauncher.y - resetLauncher.height).toBeCloseTo(76, 0);
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
  await injectBuiltUserscript(page);

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
  await injectBuiltUserscript(page);
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

test("resets editor fields when switching directly between tracks", async ({
  page,
}) => {
  const now = 1_000;
  await page.route(EDITOR_SWITCH_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head><title>编辑器切换测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="编辑器切换测试">编辑器切换测试</h1>
            <video></video>
          </body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page, {
    version: 1,
    playlists: [
      {
        id: "playlist-default",
        name: "默认歌单",
        tracks: [
          {
            id: "track-first",
            bvid: "BV1EditorSwitch",
            title: "第一首",
            startTime: 5,
            endTime: 15,
            duration: 120,
            addedAt: now,
            source: "manual",
          },
          {
            id: "track-second",
            bvid: "BV1EditorSwitch",
            title: "第二首",
            startTime: 30,
            endTime: 50,
            duration: 120,
            addedAt: now,
            source: "manual",
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activePlaylistId: "playlist-default",
    playMode: "sequence",
    volume: 1,
    playback: {
      playlistId: "playlist-default",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: now,
    },
  });

  await page.goto(EDITOR_SWITCH_URL);
  await installMockMedia(page, 120);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();

  await page.getByRole("button", { name: "编辑 第一首" }).click();
  const editor = page.locator(".track-editor");
  await expect(editor.getByLabel("标题")).toHaveValue("第一首");
  await expect(editor.getByLabel("开始时间（秒）")).toHaveValue("5");
  await expect(editor.getByLabel("结束时间（秒）")).toHaveValue("15");

  await page.getByRole("button", { name: "编辑 第二首" }).click();
  await expect(editor.getByLabel("标题")).toHaveValue("第二首");
  await expect(editor.getByLabel("开始时间（秒）")).toHaveValue("30");
  await expect(editor.getByLabel("结束时间（秒）")).toHaveValue("50");
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
  await injectBuiltUserscript(page);
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
