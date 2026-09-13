import { expect, test, type Page } from "@playwright/test";
import type { AppData } from "../../src/core/types";
import { injectBuiltUserscript } from "../helpers/userscript";

const VIDEO_URL = "https://www.bilibili.com/video/BV1ImportFav/";
const FAV_API_GLOB = "https://api.bilibili.com/x/v3/fav/resource/list**";
const SEASON_API_GLOB =
  "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list**";

async function installLocalStorageGm(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const storagePrefix = "__bili_music__:";

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
}

async function openImportTestPage(page: Page): Promise<void> {
  await page.route(VIDEO_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `
        <!doctype html>
        <html>
          <head><title>导入测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="导入测试">导入测试</h1>
            <video></video>
          </body>
        </html>
      `,
    });
  });
  await installLocalStorageGm(page);
  await page.goto(VIDEO_URL);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
}

async function readStoredAppData(page: Page): Promise<AppData> {
  return page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    return JSON.parse(raw!) as AppData;
  });
}

function favMedia(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    type: 2,
    title: "歌曲一",
    cover: "http://i0.hdslb.com/cover-a.jpg",
    page: 1,
    duration: 120,
    upper: { name: "UP主一" },
    attr: 0,
    bvid: "BV1ImportA",
    ...overrides,
  };
}

test("imports a favorite folder as a new playlist", async ({ page }) => {
  await page.route(FAV_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          info: { mid: 1, title: "我的收藏", media_count: 3 },
          medias: [
            favMedia(),
            favMedia({
              id: 2,
              title: "失效歌曲",
              attr: 1,
              bvid: "BV1ImportInvalid",
            }),
            favMedia({
              id: 3,
              title: "歌曲二",
              cover: "http://i0.hdslb.com/cover-b.jpg",
              duration: 90,
              upper: { name: "UP主二" },
              bvid: "BV1ImportB",
            }),
          ],
          has_more: false,
        },
      }),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "导入 Bilibili 收藏夹" }).click();
  const modal = page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" });
  await modal
    .getByLabel("收藏夹链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText(/即将导入歌单「我的收藏」，共 3 条内容/),
  ).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();

  await expect(modal.getByText(/成功导入 2 个视频，已跳过 1 个/)).toBeVisible();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find(
    (item) => item.id === "favorite-2015788186",
  );
  expect(playlist?.name).toBe("我的收藏");
  expect(playlist?.tracks.map((track) => track.bvid)).toEqual([
    "BV1ImportA",
    "BV1ImportB",
  ]);
  expect(playlist?.tracks.every((track) => track.source === "favorite")).toBe(
    true,
  );

  await modal.getByRole("button", { name: "完成" }).click();
  await expect(page.getByLabel("当前歌单", { exact: true })).toHaveValue(
    "favorite-2015788186",
  );
});

test("re-importing the same folder overwrites instead of duplicating", async ({
  page,
}) => {
  await page.route(FAV_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          info: { mid: 1, title: "我的收藏", media_count: 1 },
          medias: [favMedia()],
          has_more: false,
        },
      }),
    });
  });

  await openImportTestPage(page);

  const importButton = page.getByRole("button", {
    name: "导入 Bilibili 收藏夹",
  });

  await importButton.click();
  const firstModal = page.getByRole("dialog", {
    name: "导入 Bilibili 收藏夹",
  });
  await firstModal
    .getByLabel("收藏夹链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await firstModal.getByRole("button", { name: "解析" }).click();
  await firstModal.getByRole("button", { name: "导入" }).click();
  await firstModal.getByRole("button", { name: "完成" }).click();

  await importButton.click();
  const secondModal = page.getByRole("dialog", {
    name: "导入 Bilibili 收藏夹",
  });
  await secondModal
    .getByLabel("收藏夹链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await secondModal.getByRole("button", { name: "解析" }).click();

  await expect(
    secondModal.getByText(/本地已存在该歌单，覆盖导入将替换其中的歌曲/),
  ).toBeVisible();
  await secondModal.getByRole("button", { name: "覆盖导入" }).click();
  await expect(
    secondModal.getByText(/成功导入 1 个视频，已跳过 0 个/),
  ).toBeVisible();

  const stored = await readStoredAppData(page);
  const imported = stored.playlists.filter(
    (item) => item.id === "favorite-2015788186",
  );
  expect(imported).toHaveLength(1);
  expect(imported[0].tracks).toHaveLength(1);
});

test("shows a readable error and keeps the panel intact on rate limiting", async ({
  page,
}) => {
  await page.route(FAV_API_GLOB, async (route) => {
    await route.fulfill({ status: 412, contentType: "application/json" });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "导入 Bilibili 收藏夹" }).click();
  const modal = page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" });
  await modal
    .getByLabel("收藏夹链接")
    .fill("https://space.bilibili.com/1/favlist?fid=123");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText("请求过于频繁，已触发 B 站风控，请稍后再试"),
  ).toBeVisible();

  // 面板未被破坏：歌单下拉框仍然存在。
  await expect(page.getByLabel("当前歌单", { exact: true })).toBeVisible();
});

test("rejects a list-page link without calling any import API", async ({
  page,
}) => {
  let apiRequests = 0;
  await page.route(FAV_API_GLOB, async (route) => {
    apiRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json" });
  });
  await page.route(SEASON_API_GLOB, async (route) => {
    apiRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json" });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "导入 Bilibili 收藏夹" }).click();
  const modal = page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" });
  await modal
    .getByLabel("收藏夹链接")
    .fill("https://space.bilibili.com/1/lists?sid=3221717&type=season");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText("这是合集/列表页链接，请改用收藏页 favlist 里的链接。"),
  ).toBeVisible();
  // 明确拒绝：不应该发出任何导入接口请求。
  expect(apiRequests).toBe(0);
  await expect(page.getByLabel("当前歌单", { exact: true })).toBeVisible();
});

test("imports a collection (season) as a new playlist", async ({ page }) => {
  await page.route(SEASON_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          meta: {
            mid: 174041198,
            name: "合集·奇妙串烧",
            title: "奇妙串烧",
            season_id: 5471,
            total: 2,
          },
          archives: [
            {
              bvid: "BV1SeasonA",
              title: "合集歌曲一",
              duration: 144,
              pic: "http://i2.hdslb.com/season-a.jpg",
            },
            {
              bvid: "BV1SeasonB",
              title: "合集歌曲二",
              duration: 283,
              pic: "http://i2.hdslb.com/season-b.jpg",
            },
          ],
          page: { page_num: 1, page_size: 30, total: 2 },
        },
      }),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "导入 Bilibili 收藏夹" }).click();
  const modal = page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" });
  await modal
    .getByLabel("收藏夹链接")
    .fill(
      "https://space.bilibili.com/1776113786/favlist?fid=5471&ftype=collect&ctype=21",
    );
  await modal.getByRole("button", { name: "解析" }).click();

  // 歌单名取 meta.title（不带「合集·」前缀）。
  await expect(
    modal.getByText(/即将导入歌单「奇妙串烧」，共 2 条内容/),
  ).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();
  await expect(modal.getByText(/成功导入 2 个视频，已跳过 0 个/)).toBeVisible();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find((item) => item.id === "season-5471");
  expect(playlist?.name).toBe("奇妙串烧");
  expect(playlist?.tracks.map((track) => track.bvid)).toEqual([
    "BV1SeasonA",
    "BV1SeasonB",
  ]);

  await modal.getByRole("button", { name: "完成" }).click();
  await expect(page.getByLabel("当前歌单", { exact: true })).toHaveValue(
    "season-5471",
  );
});

test("surfaces risk control when the season API is blocked", async ({
  page,
}) => {
  await page.route(SEASON_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: -352, message: "-352" }),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "导入 Bilibili 收藏夹" }).click();
  const modal = page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" });
  await modal
    .getByLabel("收藏夹链接")
    .fill(
      "https://space.bilibili.com/1776113786/favlist?fid=5471&ftype=collect&ctype=21",
    );
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(modal.getByText(/风控/)).toBeVisible();
  await expect(page.getByLabel("当前歌单", { exact: true })).toBeVisible();
});

test("stops the import when the folder belongs to another uploader", async ({
  page,
}) => {
  await page.route(FAV_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          info: { mid: 71544520, title: "别人的收藏夹", media_count: 1 },
          medias: [favMedia()],
          has_more: false,
        },
      }),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "导入 Bilibili 收藏夹" }).click();
  const modal = page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" });
  await modal
    .getByLabel("收藏夹链接")
    .fill("https://space.bilibili.com/686127/favlist?fid=10526220");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(modal.getByText(/不属于该 UP 主/)).toBeVisible();

  // 没有生成任何新歌单：下拉框里仍只有默认歌单。
  await expect(
    page.getByLabel("当前歌单", { exact: true }).locator("option"),
  ).toHaveCount(1);
});
