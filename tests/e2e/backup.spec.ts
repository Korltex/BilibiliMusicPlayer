import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { AppData, Playlist } from "../../src/core/types";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  createPlaylistBackup,
  serializePlaylistBackup,
} from "../../src/storage/backup";
import { injectBuiltUserscript } from "../helpers/userscript";

const BACKUP_URL = "https://www.bilibili.com/video/BV1BackupTest/";
const DATA_KEY = "bilibili-music-player:data";
const AUDIO_ONLY_KEY = "bilibili-music-player:audio-only";
const LAYOUT_KEY = "bilibili-music-player:layout";

async function installLocalStorageGm(
  page: Page,
  initialData: unknown,
): Promise<void> {
  await page.addInitScript(
    ({ data }) => {
      const storagePrefix = "__bili_music__:";

      localStorage.setItem(
        `${storagePrefix}bilibili-music-player:data`,
        JSON.stringify(data),
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
    { data: initialData },
  );
}

function createTrack(id: string, title: string, bvid: string) {
  return {
    id,
    bvid,
    title,
    startTime: 0,
    duration: 180,
    addedAt: 1_000,
    source: "manual" as const,
  };
}

function createPlaylist(
  id: string,
  name: string,
  tracks: ReturnType<typeof createTrack>[] = [],
): Playlist {
  return { id, name, tracks, createdAt: 1, updatedAt: 1 };
}

function createInitialData(): AppData {
  return {
    version: 1,
    playlists: [
      createPlaylist("playlist-default", "默认歌单", [
        createTrack("track-a", "原有歌曲", "BV1BackupA"),
      ]),
      createPlaylist("playlist-test", "Test"),
    ],
    activePlaylistId: "playlist-default",
    playMode: "list-loop",
    volume: 0.42,
    playback: {
      playlistId: "playlist-default",
      trackId: "track-a",
      currentTime: 30,
      resumeRequested: true,
      updatedAt: 1,
    },
  };
}

function createImportedPlaylists(): Playlist[] {
  return [
    createPlaylist("playlist-imported", "导入歌单", [
      createTrack("imported-1", "导入歌曲一", "BV1ImportedA"),
      createTrack("imported-2", "导入歌曲二", "BV1ImportedB"),
    ]),
  ];
}

async function readStored(page: Page, key: string): Promise<unknown> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(`__bili_music__:${storageKey}`);
    return raw === null ? null : JSON.parse(raw);
  }, key);
}

async function isPaused(page: Page): Promise<boolean> {
  return page
    .locator("video")
    .evaluate((media) => (media as HTMLVideoElement).paused);
}

/** 伪造页面 `<video>`，让「点击歌曲 → 插件歌单播放」这条链路可观测。 */
async function installMockMedia(page: Page): Promise<void> {
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
      duration: { get: () => 180 },
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

async function openPanel(page: Page, initialData: AppData): Promise<void> {
  await page.route(BACKUP_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head><title>歌单备份测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="歌单备份测试">歌单备份测试</h1>
            <video></video>
          </body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page, initialData);
  await page.goto(BACKUP_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
}

async function openBackupModal(
  page: Page,
  initialData: AppData,
): Promise<void> {
  await openPanel(page, initialData);
  await page.getByRole("button", { name: "导入 / 导出歌单" }).click();
}

async function chooseBackupFile(
  page: Page,
  body: string,
  name = "playlists.json",
): Promise<void> {
  await page.getByLabel("选择歌单文件").setInputFiles({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(body, "utf8"),
  });
}

test("pauses playlist playback before replacing the library", async ({
  page,
}) => {
  const track = createTrack("track-page", "本页歌曲", "BV1BackupTest");
  await openPanel(page, {
    ...createInitialData(),
    playlists: [createPlaylist("playlist-default", "默认歌单", [track])],
  });

  await page.locator(".track-main").click();
  await expect(page.locator(".playlist-context-chip")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("bili_music")).toBe("1");
  expect(await isPaused(page)).toBe(false);

  await page.getByRole("button", { name: "导入 / 导出歌单" }).click();
  await chooseBackupFile(
    page,
    serializePlaylistBackup(
      createPlaylistBackup({ playlists: createImportedPlaylists() }, "9.9.9"),
    ),
  );
  await page.getByRole("button", { name: "导入并覆盖" }).click();
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(
    page.getByText("导入成功：已恢复 1 个歌单、2 首歌曲。"),
  ).toBeVisible();

  // 导入前必须先暂停媒体并退出插件歌单播放上下文。
  expect(await isPaused(page)).toBe(true);
  await expect(page.locator(".playlist-context-chip")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("bili_music")).toBe(false);
});

test("exports the whole library as a readable JSON download", async ({
  page,
}) => {
  await openBackupModal(page, createInitialData());

  const dialog = page.getByRole("dialog", { name: "歌单导入导出" });
  await expect(dialog.getByText("当前：2 个歌单 · 1 首歌曲")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "导出歌单", exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(
    /^bilibili-music-player-playlists-\d{8}-\d{6}\.json$/,
  );
  await expect(dialog.getByRole("status")).toHaveText("已开始下载备份文件");

  const file = readFileSync((await download.path())!, "utf8");
  const raw = JSON.parse(file) as Record<string, unknown>;
  expect(raw.format).toBe(BACKUP_FORMAT);
  expect(raw.formatVersion).toBe(BACKUP_FORMAT_VERSION);
  expect(raw.library).toEqual({
    version: 1,
    playlists: createInitialData().playlists,
  });
  // 只导出歌单库：音量、播放会话、纯音频与布局都不进文件。
  expect(file).not.toContain("volume");
  expect(file).not.toContain("playback");
  expect(file).not.toContain("audio-only");
  expect(file).not.toContain("layout");
  expect(file).toContain("\n  ");

  // 导出不修改任何数据。
  expect(await readStored(page, DATA_KEY)).toEqual(createInitialData());
});

test("restores a backup by replacing the whole library", async ({ page }) => {
  await openBackupModal(page, createInitialData());

  const backup = serializePlaylistBackup(
    createPlaylistBackup({ playlists: createImportedPlaylists() }, "9.9.9"),
  );
  await chooseBackupFile(page, backup);

  await expect(page.getByText("来源：Bilibili 音乐播放器备份")).toBeVisible();
  await expect(page.getByText("将导入：1 个歌单、2 首歌曲")).toBeVisible();
  await expect(page.getByText("当前歌库：2 个歌单 · 1 首歌曲")).toBeVisible();

  await page.getByRole("button", { name: "导入并覆盖" }).click();
  await expect(
    page.getByText("此操作不会自动备份，且无法撤销。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "确认导入" }).click();

  await expect(
    page.getByText("导入成功：已恢复 1 个歌单、2 首歌曲。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "完成" }).click();
  await expect(page.getByRole("dialog", { name: "歌单导入导出" })).toHaveCount(
    0,
  );

  // 歌单选择器只剩导入的那一张，并自动选中它。
  const playlistSelect = page.getByLabel("当前歌单", { exact: true });
  await expect(playlistSelect.locator("option")).toHaveText(["导入歌单"]);
  await expect(playlistSelect).toHaveValue("playlist-imported");
  await expect(page.locator(".track-row")).toHaveCount(2);

  const stored = (await readStored(page, DATA_KEY)) as AppData;
  expect(stored.playlists).toEqual(createImportedPlaylists());
  expect(stored.activePlaylistId).toBe("playlist-imported");
  expect(stored.playback.trackId).toBeUndefined();
  expect(stored.playback.resumeRequested).toBe(false);
  // 音量与本机播放模式历史字段保留，不被备份文件覆盖。
  expect(stored.volume).toBeCloseTo(0.42);
  expect(stored.playMode).toBe("list-loop");
});

test("imports a raw Tampermonkey storage dump without touching other keys", async ({
  page,
}) => {
  await openBackupModal(page, createInitialData());

  await page.evaluate(
    ({ layoutKey, audioOnlyKey }) => {
      localStorage.setItem(
        `__bili_music__:${layoutKey}`,
        JSON.stringify({
          version: 1,
          lastOpenMode: "minimal",
          panel: { x: 11, y: 22 },
        }),
      );
      localStorage.setItem(
        `__bili_music__:${audioOnlyKey}`,
        JSON.stringify(true),
      );
    },
    { layoutKey: LAYOUT_KEY, audioOnlyKey: AUDIO_ONLY_KEY },
  );

  const dump = {
    "bilibili-music-player:audio-only": false,
    "bilibili-music-player:data": {
      version: 1,
      playlists: createImportedPlaylists(),
    },
    "bilibili-music-player:layout": { version: 1, lastOpenMode: "full" },
  };
  await chooseBackupFile(page, JSON.stringify(dump, null, 2));

  await expect(page.getByText("来源：Tampermonkey 存储数据")).toBeVisible();
  await page.getByRole("button", { name: "导入并覆盖" }).click();
  await page.getByRole("button", { name: "确认导入" }).click();
  await expect(
    page.getByText("导入成功：已恢复 1 个歌单、2 首歌曲。"),
  ).toBeVisible();

  const stored = (await readStored(page, DATA_KEY)) as AppData;
  expect(stored.playlists).toEqual(createImportedPlaylists());
  // 备份文件里的 audio-only / layout 不得覆盖本机设置。
  expect(await readStored(page, AUDIO_ONLY_KEY)).toBe(true);
  expect(await readStored(page, LAYOUT_KEY)).toEqual({
    version: 1,
    lastOpenMode: "minimal",
    panel: { x: 11, y: 22 },
  });
});

test("keeps the current library when the import is cancelled", async ({
  page,
}) => {
  await openBackupModal(page, createInitialData());

  const backup = serializePlaylistBackup(
    createPlaylistBackup({ playlists: createImportedPlaylists() }, "9.9.9"),
  );

  // 预览阶段取消。
  await chooseBackupFile(page, backup);
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("button", { name: "导入并覆盖" })).toHaveCount(0);

  // 二次确认阶段取消，再直接关闭弹窗。
  await chooseBackupFile(page, backup);
  await page.getByRole("button", { name: "导入并覆盖" }).click();
  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("button", { name: "导入并覆盖" })).toBeVisible();
  await page.getByRole("button", { name: "关闭" }).click();

  await expect(page.getByRole("dialog", { name: "歌单导入导出" })).toHaveCount(
    0,
  );
  expect(await readStored(page, DATA_KEY)).toEqual(createInitialData());
  await expect(
    page.getByLabel("当前歌单", { exact: true }).locator("option"),
  ).toHaveText(["默认歌单", "Test"]);
});

test("reports invalid files and never modifies the library", async ({
  page,
}) => {
  await openBackupModal(page, createInitialData());

  await chooseBackupFile(page, "{ oops");
  await expect(page.getByRole("alert")).toHaveText("文件不是有效的 JSON");
  await expect(page.getByRole("button", { name: "导入并覆盖" })).toHaveCount(0);

  await chooseBackupFile(page, JSON.stringify({ version: 1, playlists: [] }));
  await expect(page.getByRole("alert")).toHaveText("文件里没有任何歌单");

  await chooseBackupFile(
    page,
    JSON.stringify({
      format: BACKUP_FORMAT,
      formatVersion: 99,
      library: { version: 1, playlists: createImportedPlaylists() },
    }),
  );
  await expect(page.getByRole("alert")).toHaveText(
    "备份文件版本不受支持：99（当前支持 1）",
  );

  expect(await readStored(page, DATA_KEY)).toEqual(createInitialData());
  await expect(
    page.getByLabel("当前歌单", { exact: true }).locator("option"),
  ).toHaveText(["默认歌单", "Test"]);
});
