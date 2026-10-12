import { expect, type Locator, type Page } from "@playwright/test";
import type { AppData, Track } from "../../../src/core/types";
import { injectBuiltUserscript } from "../../helpers/userscript";

/**
 * 长列表夹具：歌曲行排序的自动滚动测试需要真正**溢出**的 `.track-list`，
 * 3 首歌的短列表滚不动（`scrollHeight === clientHeight`）。默认视口 1440×900、
 * 面板高 720px 时，12 首以上才稳定溢出。
 */
export const LONG_LIST_SIZE = 14;
export const LONG_LIST_URL = "https://www.bilibili.com/video/BV1ReorderScroll/";
export const LONG_LIST_DATA_KEY = "bilibili-music-player:data";

export function longListTrackId(index: number): string {
  return `track-${index + 1}`;
}

export function longListTitle(index: number): string {
  return `歌曲 ${String(index + 1).padStart(2, "0")}`;
}

export function createLongListData(count = LONG_LIST_SIZE): AppData {
  const tracks: Track[] = Array.from({ length: count }, (_, index) => ({
    id: longListTrackId(index),
    bvid: "BV1ReorderScroll",
    title: longListTitle(index),
    startTime: 0,
    duration: 240,
    addedAt: index + 1,
    source: "manual",
  }));

  return {
    version: 1,
    playlists: [
      {
        id: "playlist-a",
        name: "长歌单",
        tracks,
        createdAt: 1,
        updatedAt: 1,
      },
    ],
    activePlaylistId: "playlist-a",
    playMode: "sequence",
    volume: 1,
    playback: {
      playlistId: "playlist-a",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: 1,
    },
  };
}

export async function installLongListGm(
  page: Page,
  data: AppData,
): Promise<void> {
  await page.addInitScript(
    ({ storageKey, initial }) => {
      const prefix = "__bili_music__:";
      // 刷新后 `addInitScript` 会重跑：已有歌库时不要覆盖，否则测不出「松手后顺序持久化」。
      if (localStorage.getItem(`${prefix}${storageKey}`) === null) {
        localStorage.setItem(`${prefix}${storageKey}`, JSON.stringify(initial));
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
    { storageKey: LONG_LIST_DATA_KEY, initial: data },
  );
}

export async function installLongListMedia(page: Page): Promise<void> {
  await page.evaluate(() => {
    const media = document.querySelector("video")!;
    Object.defineProperties(media, {
      paused: { configurable: true, get: () => true },
      currentTime: { configurable: true, get: () => 0, set: () => {} },
      duration: { configurable: true, get: () => 240 },
      readyState: { configurable: true, get: () => 4 },
      volume: { configurable: true, get: () => 1, set: () => {} },
      muted: { configurable: true, get: () => false, set: () => {} },
    });
    media.play = async () => {};
    media.pause = async () => {};
  });
}

export async function openLongListPage(
  page: Page,
  count = LONG_LIST_SIZE,
): Promise<void> {
  await page.route(`${LONG_LIST_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html>
        <html>
          <head><title>长列表排序测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="长列表排序测试">长列表排序测试</h1>
            <a class="up-name">测试作者</a>
            <video></video>
          </body>
        </html>`,
    });
  });

  await installLongListGm(page, createLongListData(count));
  await page.goto(LONG_LIST_URL);
  await installLongListMedia(page);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await expect(panelRows(page)).toHaveCount(count);
}

export function panelRows(page: Page): Locator {
  return page
    .getByRole("region", { name: "Bilibili 音乐播放器", exact: true })
    .locator(".track-row");
}

/** 读取 `.track-list` 的滚动状态；自动滚动断言都基于它。 */
export function readScrollState(page: Page): Promise<{
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
  top: number;
  bottom: number;
}> {
  return page.evaluate(() => {
    const root = document.getElementById(
      "bilibili-music-player-host",
    )?.shadowRoot;
    const list = root?.querySelector<HTMLElement>(".track-list");
    if (!list) {
      throw new Error("找不到 .track-list");
    }

    const bounds = list.getBoundingClientRect();
    return {
      scrollTop: list.scrollTop,
      clientHeight: list.clientHeight,
      scrollHeight: list.scrollHeight,
      top: bounds.top,
      bottom: bounds.bottom,
    };
  });
}

/**
 * 由落点插入线反推当前 dropIndex（0..length）：指示线的父行下标，
 * 带 `.tail` 时表示插到末尾。
 */
export function readDropIndex(page: Page): Promise<number | undefined> {
  return page.evaluate(() => {
    const root = document.getElementById(
      "bilibili-music-player-host",
    )?.shadowRoot;
    const list = root?.querySelector<HTMLElement>(".track-list");
    const indicator = list?.querySelector<HTMLElement>(".track-drop-indicator");
    if (!list || !indicator) {
      return undefined;
    }

    const row = indicator.closest<HTMLElement>(".track-row");
    if (!row) {
      return undefined;
    }

    const rows = Array.from(list.querySelectorAll<HTMLElement>(".track-row"));
    const index = rows.indexOf(row);
    return indicator.classList.contains("tail") ? rows.length : index;
  });
}

/** 等自动滚动真的把 `.track-list` 滚起来（需要若干帧）。 */
export async function expectScrolledAway(
  page: Page,
  from: number,
): Promise<number> {
  await expect
    .poll(async () => (await readScrollState(page)).scrollTop !== from, {
      timeout: 3_000,
    })
    .toBe(true);
  return (await readScrollState(page)).scrollTop;
}

/** 等滚动推进到某个位置之后（向下/向上都用它锚住「持续滚动」）。 */
export async function expectScrollPast(
  page: Page,
  threshold: number,
  direction: "down" | "up",
): Promise<void> {
  await expect
    .poll(
      async () => {
        const { scrollTop } = await readScrollState(page);
        return direction === "down"
          ? scrollTop > threshold
          : scrollTop < threshold;
      },
      { timeout: 5_000 },
    )
    .toBe(true);
}
