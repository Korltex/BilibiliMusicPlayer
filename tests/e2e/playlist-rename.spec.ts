import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { AppData, PlaybackSession } from "../../src/core/types";
import { injectBuiltUserscript } from "../helpers/userscript";

/**
 * 歌单重命名：工具栏在「新建歌单」与「删除当前歌单」之间多一个铅笔按钮，
 * 点开把选择器原地换成预填当前名称的输入框。
 *
 * 关键契约：
 * - 只改 `name` 与 `updatedAt`，`id`、`tracks`、`createdAt` 原样保留；
 * - 不改「当前选中的歌单」，也不动本标签页的播放会话（重命名不是切换歌单）；
 * - 空名称（trim 后）不能保存，取消时选择器与名称都回到原样；
 * - 只有一个歌单时也能重命名，重名不做唯一性限制；
 * - 不使用原生 `prompt()`。
 *
 * GM 模拟必须用「键不存在才写入」的守卫（与 `playlist-restore.spec.ts` 同一套），
 * 否则每次导航都会把 fixture 重新灌回去，持久化断言会被掩盖。
 */

const URL_A = "https://www.bilibili.com/video/BV1RenameA/";
const URL_B = "https://www.bilibili.com/video/BV1RenameB/";
const DATA_KEY = "bilibili-music-player:data";
const SESSION_KEY = "bilibili-music-player:playback-session";

const TRACK_A = {
  id: "track-rename-a",
  bvid: "BV1RenameA",
  title: "重命名测试 A",
  startTime: 0,
  duration: 240,
  addedAt: 1_000,
  source: "manual" as const,
};

const TRACK_B = {
  id: "track-rename-b",
  bvid: "BV1RenameB",
  title: "重命名测试 B",
  startTime: 0,
  duration: 240,
  addedAt: 1_000,
  source: "manual" as const,
};

function createRenameData(activePlaylistId = "playlist-a"): AppData {
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
        createdAt: 2_000,
        updatedAt: 2_000,
      },
    ],
    activePlaylistId,
    playMode: "list-loop",
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
  data: unknown = createRenameData(),
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
  url = URL_A,
  title = "重命名测试 A",
): Promise<void> {
  await routeVideoPage(page, url, title);
  await page.goto(url);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.locator(".floating-button").click();
}

const playlistSelect = (page: Page) =>
  page.getByLabel("当前歌单", { exact: true });
const renameInput = (page: Page) =>
  page.getByLabel("重命名歌单", { exact: true });
const renameButton = (page: Page) =>
  page.getByRole("button", { name: "重命名当前歌单" });

async function readStoredData(page: Page): Promise<AppData> {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(`__bili_music__:${key}`);
    return JSON.parse(raw!) as AppData;
  }, DATA_KEY);
}

async function readSession(page: Page): Promise<PlaybackSession> {
  return page.evaluate((key) => {
    const raw = sessionStorage.getItem(key);
    return JSON.parse(raw!) as PlaybackSession;
  }, SESSION_KEY);
}

async function isPaused(page: Page): Promise<boolean> {
  return page
    .locator("video")
    .evaluate((media) => (media as HTMLVideoElement).paused);
}

/** 面板在 Shadow DOM 里：用宿主根节点的 activeElement 判断输入框是否持有焦点。 */
function isRenameInputFocused(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.getElementById(
      "bilibili-music-player-host",
    )?.shadowRoot;
    return root?.activeElement?.getAttribute("aria-label") === "重命名歌单";
  });
}

/** 输入框里的文本是否被整体选中（`select()` 的效果）。 */
function isRenameTextSelected(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.getElementById(
      "bilibili-music-player-host",
    )?.shadowRoot;
    const input = root?.querySelector<HTMLInputElement>(
      'input[aria-label="重命名歌单"]',
    );
    if (!input) {
      return false;
    }
    return (
      input.selectionStart === 0 && input.selectionEnd === input.value.length
    );
  });
}

test("renames the current playlist in place", async ({ context, page }) => {
  await installGmApi(context);
  await openPlayer(page);
  await expect(playlistSelect(page)).toHaveValue("playlist-a");

  // 铅笔按钮位于「新建歌单」与「删除当前歌单」之间。
  const toolbarButtons = page.locator(".playlist-toolbar").getByRole("button");
  await expect(toolbarButtons).toHaveCount(3);
  await expect(toolbarButtons.nth(0)).toHaveAttribute("aria-label", "新建歌单");
  await expect(toolbarButtons.nth(1)).toHaveAttribute(
    "aria-label",
    "重命名当前歌单",
  );
  await expect(toolbarButtons.nth(2)).toHaveAttribute(
    "aria-label",
    "删除当前歌单",
  );
  await expect(renameButton(page)).toHaveAttribute("title", "重命名当前歌单");

  await renameButton(page).click();

  // 选择器被临时替换成输入框，预填当前名称，并自动聚焦 + 全选。
  await expect(playlistSelect(page)).toHaveCount(0);
  await expect(renameInput(page)).toHaveValue("歌单 A");
  await expect.poll(() => isRenameInputFocused(page)).toBe(true);
  await expect.poll(() => isRenameTextSelected(page)).toBe(true);
  await expect(
    page.getByRole("button", { name: "保存歌单名称" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "取消重命名" })).toBeVisible();

  await renameInput(page).fill("  我的歌单  ");
  await page.getByRole("button", { name: "保存歌单名称" }).click();

  // 回到选择器视图，名称已 trim 并写进共享存储。
  await expect(renameInput(page)).toHaveCount(0);
  await expect(playlistSelect(page)).toHaveValue("playlist-a");
  await expect(
    playlistSelect(page).locator('option[value="playlist-a"]'),
  ).toHaveText("我的歌单");
  const stored = await readStoredData(page);
  expect(stored.playlists[0]).toMatchObject({
    id: "playlist-a",
    name: "我的歌单",
    createdAt: 1_000,
  });
  expect(stored.playlists[0].updatedAt).toBeGreaterThan(1_000);
  // 歌曲内容、当前选择与另一个歌单都不受影响。
  expect(stored.playlists[0].tracks).toEqual([TRACK_A]);
  expect(stored.playlists[1]).toMatchObject({
    name: "歌单 B",
    updatedAt: 2_000,
  });
  expect(stored.activePlaylistId).toBe("playlist-a");
});

test("saves the rename with Enter and cancels it with Escape", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page);

  await renameButton(page).click();
  await renameInput(page).fill("回车保存");
  await renameInput(page).press("Enter");
  await expect(playlistSelect(page)).toHaveValue("playlist-a");
  expect((await readStoredData(page)).playlists[0].name).toBe("回车保存");

  // Escape 取消：名称与选择器都回到原样，不写存储。
  const before = await readStoredData(page);
  await renameButton(page).click();
  await expect(renameInput(page)).toHaveValue("回车保存");
  await renameInput(page).fill("这次不该保存");
  await renameInput(page).press("Escape");

  await expect(renameInput(page)).toHaveCount(0);
  await expect(playlistSelect(page)).toHaveValue("playlist-a");
  await expect(
    playlistSelect(page).locator('option[value="playlist-a"]'),
  ).toHaveText("回车保存");
  expect((await readStoredData(page)).playlists[0].name).toBe("回车保存");
  expect((await readStoredData(page)).playlists[0].updatedAt).toBe(
    before.playlists[0].updatedAt,
  );

  // 取消按钮与 Escape 等价。
  await renameButton(page).click();
  await renameInput(page).fill("点了取消");
  await page.getByRole("button", { name: "取消重命名" }).click();
  await expect(renameInput(page)).toHaveCount(0);
  await expect(
    playlistSelect(page).locator('option[value="playlist-a"]'),
  ).toHaveText("回车保存");
});

test("rejects an empty or whitespace-only name", async ({ context, page }) => {
  await installGmApi(context);
  await openPlayer(page);

  await renameButton(page).click();
  const saveButton = page.getByRole("button", { name: "保存歌单名称" });
  await expect(saveButton).toBeEnabled();

  // 空名称时保存按钮被禁用，回车也不会写存储。
  await renameInput(page).fill("   ");
  await expect(saveButton).toBeDisabled();
  await renameInput(page).press("Enter");
  await expect(renameInput(page)).toHaveValue("   ");
  expect((await readStoredData(page)).playlists[0].name).toBe("歌单 A");

  await renameInput(page).fill("");
  await expect(saveButton).toBeDisabled();
  await expect(renameInput(page)).toHaveValue("");
  expect((await readStoredData(page)).playlists[0].name).toBe("歌单 A");

  // 恢复成有效名称后保存按钮重新可用。
  await renameInput(page).fill("有效名称");
  await expect(saveButton).toBeEnabled();
  await saveButton.click();
  expect((await readStoredData(page)).playlists[0].name).toBe("有效名称");
});

test("allows renaming when the library holds a single playlist", async ({
  context,
  page,
}) => {
  const data = createRenameData();
  data.playlists = [data.playlists[0]];
  await installGmApi(context, data);
  await openPlayer(page);

  // 只有一个歌单时「删除当前歌单」禁用，但重命名必须仍然可用。
  await expect(
    page.getByRole("button", { name: "删除当前歌单" }),
  ).toBeDisabled();
  await expect(renameButton(page)).toBeEnabled();

  await renameButton(page).click();
  await renameInput(page).fill("唯一的歌单");
  await renameInput(page).press("Enter");

  await expect(playlistSelect(page).locator("option")).toHaveText([
    "唯一的歌单",
  ]);
  const stored = await readStoredData(page);
  expect(stored.playlists).toHaveLength(1);
  expect(stored.playlists[0].name).toBe("唯一的歌单");
});

test("allows a duplicate name without adding uniqueness rules", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page);

  // 把 A 改成与 B 同名：项目现有规则不限制重名，这里只要求能够保存。
  await renameButton(page).click();
  await renameInput(page).fill("歌单 B");
  await renameInput(page).press("Enter");

  const stored = await readStoredData(page);
  expect(stored.playlists.map((playlist) => playlist.name)).toEqual([
    "歌单 B",
    "歌单 B",
  ]);
  await expect(playlistSelect(page)).toHaveValue("playlist-a");
});

test("keeps playback and the session untouched while renaming", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page);

  // 先播放 A 里的歌曲，让会话带上 trackId / currentTime / resumeRequested。
  await page.locator(".track-main").click();
  await expect.poll(() => isPaused(page)).toBe(false);
  const sessionBefore = await readSession(page);
  expect(sessionBefore.playback.trackId).toBe(TRACK_A.id);

  await renameButton(page).click();
  await renameInput(page).fill("播放中重命名");
  await renameInput(page).press("Enter");
  await expect(playlistSelect(page)).toHaveValue("playlist-a");

  // 重命名不是切换歌单：会话里的歌单、曲目与播放状态都必须原样保留。
  const sessionAfter = await readSession(page);
  expect(sessionAfter.activePlaylistId).toBe("playlist-a");
  expect(sessionAfter.playback).toEqual(sessionBefore.playback);
  expect(await isPaused(page)).toBe(false);
  await expect(page.locator(".track-row.active")).toHaveCount(1);

  const stored = await readStoredData(page);
  expect(stored.playlists[0].tracks).toEqual([TRACK_A]);
  expect(stored.activePlaylistId).toBe("playlist-a");
});

test("renames a non-first playlist selected in the toolbar", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page);

  await playlistSelect(page).selectOption("playlist-b");
  await renameButton(page).click();
  await expect(renameInput(page)).toHaveValue("歌单 B");
  await renameInput(page).fill("第二张歌单");
  await renameInput(page).press("Enter");

  const stored = await readStoredData(page);
  // 只改选中的那张，第一张歌单不受影响。
  expect(stored.playlists[0]).toMatchObject({
    name: "歌单 A",
    updatedAt: 1_000,
  });
  expect(stored.playlists[1]).toMatchObject({
    id: "playlist-b",
    name: "第二张歌单",
  });
  expect(stored.playlists[1].tracks).toEqual([TRACK_B]);
  expect(stored.activePlaylistId).toBe("playlist-b");
});

test("persists the renamed playlist for the next session", async ({
  context,
  page,
}) => {
  await installGmApi(context);
  await openPlayer(page);

  await playlistSelect(page).selectOption("playlist-b");
  await renameButton(page).click();
  await renameInput(page).fill("重开也要在");
  await renameInput(page).press("Enter");
  await expect(playlistSelect(page)).toHaveValue("playlist-b");
  await page.close();

  // 新标签页 = 全新 sessionStorage，名称只能来自共享存储。
  const reopened = await context.newPage();
  await openPlayer(reopened, URL_B, "重命名测试 B");
  await expect(playlistSelect(reopened)).toHaveValue("playlist-b");
  await expect(
    playlistSelect(reopened).locator('option[value="playlist-b"]'),
  ).toHaveText("重开也要在");
});

test("never opens a native prompt dialog", async ({ context, page }) => {
  await installGmApi(context);
  const nativeDialogs: string[] = [];
  page.on("dialog", (dialog) => {
    nativeDialogs.push(dialog.type());
    void dialog.dismiss();
  });

  await openPlayer(page);
  await renameButton(page).click();
  await renameInput(page).fill("不弹原生框");
  await renameInput(page).press("Enter");

  await expect(playlistSelect(page)).toHaveValue("playlist-a");
  expect(nativeDialogs).toEqual([]);
});
