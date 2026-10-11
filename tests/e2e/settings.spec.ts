import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AppData, Track } from "../../src/core/types";
import { parsePlaylistBackup } from "../../src/storage/backup";
import { injectBuiltUserscript } from "../helpers/userscript";

const packageVersion = (
  JSON.parse(
    readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  ) as { version: string }
).version;

/*
 * 设置视图：标题栏齿轮入口、三个折叠分区、打开方式偏好、重置位置、备份导出。
 * 导入的完整确认流程在 backup.spec.ts，这里只验证入口能打开弹窗。
 */

const STORAGE_PREFIX = "__bili_music_settings__:";
const SETTINGS_URL = "https://www.bilibili.com/video/BV1SettingsTest/";
const DATA_KEY = "bilibili-music-player:data";
const LAYOUT_KEY = "bilibili-music-player:layout";
const SETTINGS_KEY = "bilibili-music-player:settings";

const fullPanel = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器", exact: true });
const settingsPanel = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器（设置）" });
const minimalPlayer = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器（极简模式）" });
const launcherButton = (page: Page) =>
  page.getByRole("button", { name: "打开 Bilibili 音乐播放器" });

async function installLocalStorageGm(
  page: Page,
  initial: { data?: AppData; layout?: unknown; settings?: unknown } = {},
): Promise<void> {
  await page.addInitScript(
    ({ prefix, entries }) => {
      for (const [key, value] of Object.entries(entries)) {
        if (value !== undefined) {
          localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
        }
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
      prefix: STORAGE_PREFIX,
      entries: {
        [DATA_KEY]: initial.data,
        [LAYOUT_KEY]: initial.layout,
        [SETTINGS_KEY]: initial.settings,
      },
    },
  );
}

async function routeVideoPage(page: Page): Promise<void> {
  await page.route(`${SETTINGS_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html>
        <html>
          <head><title>设置测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="设置测试">设置测试</h1>
            <a class="up-name">测试作者</a>
            <video></video>
          </body>
        </html>`,
    });
  });
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
  await launcherButton(page).click();
  await expect(fullPanel(page)).toBeVisible();
}

async function openSettings(page: Page): Promise<void> {
  await page.getByRole("button", { name: "设置", exact: true }).click();
  await expect(settingsPanel(page)).toBeVisible();
}

/** 数据管理默认折叠；需要里面的按钮时先展开（已展开则不重复点击）。 */
async function openDataSection(page: Page): Promise<void> {
  const header = settingsPanel(page).getByRole("button", {
    name: /数据管理/,
  });
  if ((await header.getAttribute("aria-expanded")) !== "true") {
    await header.click();
  }
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

async function readStored(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    ({ prefix, name }) => {
      const raw = localStorage.getItem(`${prefix}${name}`);
      return raw === null ? null : JSON.parse(raw);
    },
    { prefix: STORAGE_PREFIX, name: key },
  );
}

function createTrack(): Track {
  return {
    id: "track-settings",
    bvid: "BV1SettingsTest",
    title: "测试歌曲",
    startTime: 0,
    duration: 180,
    addedAt: 1_000,
    source: "manual",
  };
}

function createInitialData(): AppData {
  return {
    version: 1,
    playlists: [
      {
        id: "playlist-settings",
        name: "默认歌单",
        tracks: [createTrack()],
        createdAt: 1_000,
        updatedAt: 1_000,
      },
    ],
    activePlaylistId: "playlist-settings",
    playMode: "list-loop",
    volume: 0.42,
    playback: {
      playlistId: "playlist-settings",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: 1_000,
    },
  };
}

test("opens the settings view from the title bar and comes back", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, { data: createInitialData() });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  const settingsButton = fullPanel(page).getByRole("button", {
    name: "设置",
    exact: true,
  });
  await settingsButton.click();

  const settings = settingsPanel(page);
  await expect(settings).toBeVisible();
  await expect(settings.getByText("设置", { exact: true })).toBeVisible();
  for (const section of ["窗口与外观", "数据管理", "关于"]) {
    await expect(
      settings.getByRole("button", { name: new RegExp(section) }),
    ).toBeVisible();
  }

  // 返回箭头回到进入设置前的完整面板。
  await settings.getByRole("button", { name: "返回播放器" }).click();
  await expect(fullPanel(page)).toBeVisible();
  await expect(settings).toHaveCount(0);

  // × 直接回悬浮按钮。
  await openSettings(page);
  await settingsPanel(page).getByRole("button", { name: "收起播放器" }).click();
  await expect(launcherButton(page)).toBeVisible();
});

test("remembers the open mode preference and applies it to the launcher", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, {
    data: createInitialData(),
    layout: { version: 1, lastOpenMode: "full" },
    settings: { version: 1, openMode: "remember" },
  });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);
  await openSettings(page);

  const settings = settingsPanel(page);
  const radio = (name: string) => settings.getByRole("radio", { name });

  // 固定极简模式。
  await radio("极简模式").check();
  expect(await readStored(page, SETTINGS_KEY)).toEqual({
    version: 1,
    openMode: "minimal",
  });
  await settings.getByRole("button", { name: "收起播放器" }).click();
  await launcherButton(page).click();
  await expect(minimalPlayer(page)).toBeVisible();

  // 固定完整模式。
  await minimalPlayer(page)
    .getByRole("button", { name: "展开完整播放器" })
    .click();
  await openSettings(page);
  await settingsPanel(page).getByRole("radio", { name: "完整模式" }).check();
  expect(await readStored(page, SETTINGS_KEY)).toEqual({
    version: 1,
    openMode: "full",
  });
  await settingsPanel(page).getByRole("button", { name: "收起播放器" }).click();
  await launcherButton(page).click();
  await expect(fullPanel(page)).toBeVisible();

  // 「记住上次」透传布局里记录的形态（这里直接把布局改成极简）。
  await openSettings(page);
  await settingsPanel(page).getByRole("radio", { name: "记住上次" }).check();
  await page.evaluate(
    ({ prefix, key }) =>
      localStorage.setItem(
        `${prefix}${key}`,
        JSON.stringify({ version: 1, lastOpenMode: "minimal" }),
      ),
    { prefix: STORAGE_PREFIX, key: LAYOUT_KEY },
  );
  await settingsPanel(page).getByRole("button", { name: "收起播放器" }).click();
  await launcherButton(page).click();
  await expect(minimalPlayer(page)).toBeVisible();
});

test("resets the launcher and panel positions from the settings view", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, {
    data: createInitialData(),
    layout: {
      version: 1,
      lastOpenMode: "full",
      launcher: { x: 60, y: 80 },
      panel: { x: 60, y: 160 },
    },
  });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);
  await openSettings(page);

  const settings = settingsPanel(page);
  await settings.getByRole("button", { name: "重置位置" }).click();

  await expect
    .poll(async () => {
      const bounds = await settings.boundingBox();
      return Boolean(
        bounds &&
        Math.abs(1440 - bounds.x - bounds.width - 20) <= 0.5 &&
        Math.abs(900 - bounds.y - bounds.height - 20) <= 0.5,
      );
    })
    .toBe(true);

  expect(await readStored(page, LAYOUT_KEY)).toEqual({
    version: 1,
    lastOpenMode: "full",
  });

  await settings.getByRole("button", { name: "收起播放器" }).click();
  const launcher = (await launcherButton(page).boundingBox())!;
  expect(1440 - launcher.x - launcher.width).toBeCloseTo(24, 0);
  expect(900 - launcher.y - launcher.height).toBeCloseTo(76, 0);
});

test("exports the library without touching stored data", async ({ page }) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, { data: createInitialData() });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);
  await openSettings(page);

  const settings = settingsPanel(page);
  // 歌单数量就在分区标题旁，折叠时也可见。
  await expect(settings.getByText("1 个歌单 · 1 首歌曲")).toBeVisible();

  await openDataSection(page);
  const downloadPromise = page.waitForEvent("download");
  await settings.getByRole("button", { name: "导出备份" }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^bilibili-music-player-playlists-\d{8}-\d{6}\.json$/,
  );
  await expect(settings.getByRole("status")).toHaveText("已开始下载备份文件");

  const text = await (await download.createReadStream()).toArray();
  expect(
    parsePlaylistBackup(Buffer.concat(text).toString("utf8")).playlists,
  ).toEqual(createInitialData().playlists);
  expect(await readStored(page, DATA_KEY)).toEqual(createInitialData());
});

test("opens the import dialog and lists the about summary", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, { data: createInitialData() });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);
  await openSettings(page);

  const settings = settingsPanel(page);
  await openDataSection(page);
  await settings.getByRole("button", { name: "从备份恢复" }).click();
  await expect(page.getByRole("dialog", { name: "导入歌单" })).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();
  await expect(page.getByRole("dialog", { name: "导入歌单" })).toHaveCount(0);

  // 「关于」默认折叠，展开后给出常用信息（应用 / 版本 / 许可 / 存储）。
  const aboutHeader = settings.getByRole("button", { name: /关于/ });
  await expect(aboutHeader).toHaveAttribute("aria-expanded", "false");
  await aboutHeader.click();
  await expect(aboutHeader).toHaveAttribute("aria-expanded", "true");
  for (const label of ["应用", "版本", "许可", "存储"]) {
    await expect(settings.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(
    settings.getByText(packageVersion, { exact: true }),
  ).toBeVisible();
  await expect(
    settings.getByText("MIT License", { exact: true }),
  ).toBeVisible();
});

test("toggles the appearance section and keeps playback untouched", async ({
  page,
}) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, { data: createInitialData() });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await page.locator(".track-main").click();
  await expect(page.locator(".playlist-context-chip")).toBeVisible();

  await openSettings(page);
  const settings = settingsPanel(page);
  const appearanceHeader = settings.getByRole("button", {
    name: /窗口与外观/,
  });
  const dataHeader = settings.getByRole("button", { name: /数据管理/ });
  const aboutHeader = settings.getByRole("button", { name: /关于/ });

  // 默认只展开「窗口与外观」。
  await expect(appearanceHeader).toHaveAttribute("aria-expanded", "true");
  await expect(dataHeader).toHaveAttribute("aria-expanded", "false");
  await expect(aboutHeader).toHaveAttribute("aria-expanded", "false");

  // 两行控件左边缘对齐：模式选择器与重置按钮从同一列开始；选择器右边缘与分区右边缘对齐。
  const modeControl = settings.getByRole("radiogroup", { name: "打开时" });
  const resetButton = settings.getByRole("button", { name: "重置位置" });
  const modeBox = (await modeControl.boundingBox())!;
  const resetBox = (await resetButton.boundingBox())!;
  const appearanceBox = (await appearanceHeader.boundingBox())!;
  expect(Math.abs(modeBox.x - resetBox.x)).toBeLessThanOrEqual(0.5);
  expect(
    Math.abs(
      modeBox.x + modeBox.width - (appearanceBox.x + appearanceBox.width),
    ),
  ).toBeLessThanOrEqual(0.5);

  // 一次只展开一个：打开数据管理会收起窗口与外观。
  await expect(
    settings.getByRole("radiogroup", { name: "打开时" }),
  ).toBeVisible();
  await dataHeader.click();
  await expect(dataHeader).toHaveAttribute("aria-expanded", "true");
  await expect(appearanceHeader).toHaveAttribute("aria-expanded", "false");
  await expect(
    settings.getByRole("radiogroup", { name: "打开时" }),
  ).toHaveCount(0);

  // 再打开关于，数据管理收起。
  await aboutHeader.click();
  await expect(aboutHeader).toHaveAttribute("aria-expanded", "true");
  await expect(dataHeader).toHaveAttribute("aria-expanded", "false");

  // 点已展开的分区标题可以收起它。
  await aboutHeader.click();
  await expect(aboutHeader).toHaveAttribute("aria-expanded", "false");

  // 两个备份按钮都是中性色，不把覆盖操作做成首选动作。
  await appearanceHeader.click();
  await expect(
    settings.getByRole("radiogroup", { name: "打开时" }),
  ).toBeVisible();
  await dataHeader.click();
  await expect(settings.locator(".settings-action.primary")).toHaveCount(0);

  // 打开设置不打断歌单播放。
  expect(
    await page.evaluate(() => document.querySelector("video")!.paused),
  ).toBe(false);
  expect(new URL(page.url()).searchParams.get("bili_music")).toBe("1");

  await settings.getByRole("button", { name: "返回播放器" }).click();
  await expect(page.locator(".playlist-context-chip")).toBeVisible();
});

test("selects the open mode with the keyboard", async ({ page }) => {
  await routeVideoPage(page);
  await installLocalStorageGm(page, { data: createInitialData() });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);
  await openSettings(page);

  const settings = settingsPanel(page);
  const minimalRadio = settings.getByRole("radio", { name: "极简模式" });
  await minimalRadio.focus();
  await page.keyboard.press("Space");

  await expect(minimalRadio).toBeChecked();
  expect(await readStored(page, SETTINGS_KEY)).toEqual({
    version: 1,
    openMode: "minimal",
  });
});

test("keeps the settings view inside a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await routeVideoPage(page);
  await installLocalStorageGm(page, { data: createInitialData() });
  await page.goto(SETTINGS_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);
  await openSettings(page);

  const bounds = (await settingsPanel(page).boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390.5);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844.5);

  // 窄视口下展开数据管理后，两个按钮仍在一行内完整可见。
  await openDataSection(page);
  const exportButton = settingsPanel(page).getByRole("button", {
    name: "导出备份",
  });
  const restoreButton = settingsPanel(page).getByRole("button", {
    name: "从备份恢复",
  });
  for (const button of [exportButton, restoreButton]) {
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390.5);
  }
  expect(await exportButton.evaluate((el) => el.clientWidth)).toBeGreaterThan(
    100,
  );
});
