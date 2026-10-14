import { expect, test, type Page } from "@playwright/test";
import type { AppData } from "../../src/core/types";
import { injectBuiltUserscript } from "../helpers/userscript";

const VIDEO_URL = "https://www.bilibili.com/video/BV1ImportFav/";
const FAV_API_GLOB = "https://api.bilibili.com/x/v3/fav/resource/list**";
const SEASON_API_GLOB =
  "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list**";
const VIEW_API_GLOB = "https://api.bilibili.com/x/web-interface/view**";

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

/**
 * 歌单库快照；数据键从未被写入过时返回 `null`。
 * 用于断言「取消 / 解析失败 / 导入失败 / 中止」都不会写库。
 */
async function readStoredPlaylists(
  page: Page,
): Promise<AppData["playlists"] | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem(
      "__bili_music__:bilibili-music-player:data",
    );
    return raw === null ? null : (JSON.parse(raw) as AppData).playlists;
  });
}

/** 按 bvid 分发 `/x/web-interface/view` 的响应。 */
async function routeViews(
  page: Page,
  viewers: Record<string, unknown>,
): Promise<void> {
  await page.route(VIEW_API_GLOB, async (route) => {
    const bvid = new URL(route.request().url()).searchParams.get("bvid") ?? "";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        viewers[bvid] ?? { code: -404, message: "啥都木有" },
      ),
    });
  });
}

function viewPayload(
  bvid: string,
  title: string,
  parts: { cid: number; page: number; part: string; duration: number }[],
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    code: 0,
    data: {
      bvid,
      title,
      pic: "http://i2.hdslb.com/cover.jpg",
      duration: parts.reduce((sum, item) => sum + item.duration, 0),
      owner: { mid: 3546619314178489, name: "测试UP" },
      pages: parts,
      ...overrides,
    },
  };
}

const ONE_PART = [{ cid: 111, page: 1, part: "正片", duration: 120 }];

function favMedia(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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

function seasonPayload(
  archives: Record<string, unknown>[],
  meta: Record<string, unknown> = {},
): unknown {
  return {
    code: 0,
    data: {
      meta: {
        mid: 1,
        name: "合集·我的合集",
        title: "我的合集",
        season_id: 8888,
        total: archives.length,
        ...meta,
      },
      archives,
      page: { page_num: 1, page_size: 30, total: archives.length },
    },
  };
}

function archive(bvid: string, title: string): Record<string, unknown> {
  return {
    bvid,
    title,
    duration: 120,
    pic: "http://i2.hdslb.com/season.jpg",
  };
}

test("imports a favorite folder and splits its multi-part videos", async ({
  page,
}) => {
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
              duration: 300,
              upper: { name: "UP主二" },
              bvid: "BV1ImportB",
              page: 2,
            }),
          ],
          has_more: false,
        },
      }),
    });
  });
  await routeViews(page, {
    BV1ImportB: viewPayload("BV1ImportB", "歌曲二", [
      { cid: 111, page: 1, part: "第一段", duration: 100 },
      { cid: 222, page: 2, part: "第二段", duration: 200 },
    ]),
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText(/即将导入歌单「我的收藏」，共 3 条内容/),
  ).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();

  await expect(modal.getByText(/成功导入 3 个视频，已跳过 1 个/)).toBeVisible();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find(
    (item) => item.id === "favorite-2015788186",
  );
  expect(playlist?.name).toBe("我的收藏");
  expect(playlist?.tracks.map((track) => track.bvid)).toEqual([
    "BV1ImportA",
    "BV1ImportB",
    "BV1ImportB",
  ]);
  // 单P 用列表元数据；多P 按分P 拆分，标题为 `原视频标题 [P1] 分P标题`。
  expect(playlist?.tracks.map((track) => track.title)).toEqual([
    "歌曲一",
    "歌曲二 [P1] 第一段",
    "歌曲二 [P2] 第二段",
  ]);
  expect(playlist?.tracks.map((track) => track.duration)).toEqual([
    120, 100, 200,
  ]);
  expect(playlist?.tracks.map((track) => track.id)).toEqual([
    "favorite-2015788186-BV1ImportA-p1",
    "favorite-2015788186-BV1ImportB-p1",
    "favorite-2015788186-BV1ImportB-p2",
  ]);
  expect(playlist?.tracks.every((track) => track.source === "favorite")).toBe(
    true,
  );
  expect(playlist?.tracks[1]).toMatchObject({ cid: 111 });
  expect(playlist?.tracks[2]).toMatchObject({ cid: 222, page: 2 });

  await modal.getByRole("button", { name: "完成" }).click();
  await expect(page.getByLabel("当前歌单", { exact: true })).toHaveValue(
    "favorite-2015788186",
  );
});

test("skips an entry whose video is gone instead of failing the import", async ({
  page,
}) => {
  await page.route(FAV_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          info: { mid: 1, title: "我的收藏", media_count: 2 },
          medias: [
            favMedia({
              id: 1,
              title: "已经没了的视频",
              bvid: "BV1ImportGone",
              page: 2,
            }),
            favMedia({ id: 2, title: "还活着的视频", bvid: "BV1ImportAlive" }),
          ],
          has_more: false,
        },
      }),
    });
  });
  // 列表的 attr 是 0（没标失效），只有详情请求能发现它已经拿不到了。
  await routeViews(page, {
    BV1ImportGone: { code: -404, message: "啥都木有" },
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788187");
  await modal.getByRole("button", { name: "解析" }).click();
  await modal.getByRole("button", { name: "导入" }).click();

  // 整单照常完成，只少那一条。
  await expect(
    modal.getByText(/成功导入 1 个视频，已跳过 1 个失效视频/),
  ).toBeVisible();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find(
    (item) => item.id === "favorite-2015788187",
  );
  expect(playlist?.tracks.map((track) => track.bvid)).toEqual([
    "BV1ImportAlive",
  ]);
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

  const importButton = page.getByRole("button", { name: "批量导入" });

  await importButton.click();
  const firstModal = page.getByRole("dialog", { name: "批量导入" });
  await firstModal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await firstModal.getByRole("button", { name: "解析" }).click();
  await firstModal.getByRole("button", { name: "导入" }).click();
  await firstModal.getByRole("button", { name: "完成" }).click();

  await importButton.click();
  const secondModal = page.getByRole("dialog", { name: "批量导入" });
  await secondModal
    .getByLabel("导入链接")
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

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=123");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText("请求过于频繁，已触发 B 站风控，请稍后再试"),
  ).toBeVisible();

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

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/lists?sid=3221717&type=season");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText("这是合集/列表页链接，请改用收藏页 favlist 里的链接。"),
  ).toBeVisible();
  expect(apiRequests).toBe(0);
  await expect(page.getByLabel("当前歌单", { exact: true })).toBeVisible();
});

test("imports a collection (season) as a new playlist", async ({ page }) => {
  await page.route(SEASON_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        seasonPayload([
          archive("BV1SeasonA", "合集歌曲一"),
          archive("BV1SeasonB", "合集歌曲二"),
        ]),
      ),
    });
  });
  // 方案A：合集导入期不请求任何视频详情。
  // （面板本身会为当前页面视频取一次封面，所以这里只统计合集条目的 bvid。）
  const seasonBvids = ["BV1SeasonA", "BV1SeasonB"];
  const detailRequests: string[] = [];
  await page.route(VIEW_API_GLOB, async (route) => {
    detailRequests.push(
      new URL(route.request().url()).searchParams.get("bvid") ?? "",
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ code: -404, message: "合集导入不应请求详情" }),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill(
      "https://space.bilibili.com/1776113786/favlist?fid=5471&ftype=collect&ctype=21",
    );
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText(/即将导入歌单「我的合集」，共 2 条内容/),
  ).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();
  await expect(modal.getByText(/成功导入 2 个视频，已跳过 0 个/)).toBeVisible();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find((item) => item.id === "season-5471");
  expect(playlist?.name).toBe("我的合集");
  expect(playlist?.tracks.map((track) => track.bvid)).toEqual([
    "BV1SeasonA",
    "BV1SeasonB",
  ]);
  // 元数据全部来自列表：标题用列表标题，且不含 cid / page。
  expect(playlist?.tracks.map((track) => track.title)).toEqual([
    "合集歌曲一",
    "合集歌曲二",
  ]);
  expect(playlist?.tracks.every((track) => track.cid === undefined)).toBe(true);
  expect(playlist?.tracks.every((track) => track.page === undefined)).toBe(
    true,
  );
  expect(playlist?.tracks.every((track) => track.source === "collection")).toBe(
    true,
  );
  expect(detailRequests.filter((bvid) => seasonBvids.includes(bvid))).toEqual(
    [],
  );

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

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
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

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/686127/favlist?fid=10526220");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(modal.getByText(/不属于该 UP 主/)).toBeVisible();
  await expect(
    page.getByLabel("当前歌单", { exact: true }).locator("option"),
  ).toHaveCount(1);
});

test("imports a collection sniffed from a video link", async ({ page }) => {
  await routeViews(page, {
    BV1VideoWithSeason: viewPayload(
      "BV1VideoWithSeason",
      "合集里的某个视频",
      ONE_PART,
      {
        ugc_season: {
          id: 8888,
          title: "我的合集",
          mid: 3546619314178489,
          ep_count: 2,
          sections: [{ episodes: [{ bvid: "BV1SeasonA" }] }],
        },
      },
    ),
    BV1SeasonA: viewPayload("BV1SeasonA", "接口标题一", ONE_PART),
    BV1SeasonB: viewPayload("BV1SeasonB", "接口标题二", ONE_PART),
  });
  await page.route(SEASON_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(
        seasonPayload([
          archive("BV1SeasonA", "合集歌曲一"),
          archive("BV1SeasonB", "合集歌曲二"),
        ]),
      ),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://www.bilibili.com/video/BV1VideoWithSeason");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText(/即将导入歌单「我的合集」，共 2 条内容/),
  ).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();
  await expect(modal.getByText(/成功导入 2 个视频/)).toBeVisible();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find((item) => item.id === "season-8888");
  expect(playlist?.tracks.map((track) => track.bvid)).toEqual([
    "BV1SeasonA",
    "BV1SeasonB",
  ]);
  expect(playlist?.tracks.map((track) => track.title)).toEqual([
    "合集歌曲一",
    "合集歌曲二",
  ]);
  // 只有嗅探合集时才查详情；合集展开阶段不再逐条请求（所以没有 cid）。
  expect(playlist?.tracks.every((track) => track.cid === undefined)).toBe(true);
  expect(playlist?.tracks.every((track) => track.source === "collection")).toBe(
    true,
  );
});

test("imports a plain video without a collection", async ({ page }) => {
  await routeViews(page, {
    BV1PlainVideo: viewPayload("BV1PlainVideo", "普通视频标题", ONE_PART),
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://www.bilibili.com/video/BV1PlainVideo");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(
    modal.getByText("该视频没有合集，是否导入为歌单？"),
  ).toBeVisible();
  await expect(modal.getByText("《普通视频标题》")).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find(
    (item) => item.id === "video-BV1PlainVideo",
  );
  expect(playlist?.name).toBe("普通视频标题");
  expect(playlist?.tracks).toHaveLength(1);
  expect(playlist?.tracks[0]).toMatchObject({
    id: "video-BV1PlainVideo-p1",
    bvid: "BV1PlainVideo",
    title: "普通视频标题",
    source: "manual",
    startTime: 0,
  });
});

test("splits every part of a multi-part video link and ignores p", async ({
  page,
}) => {
  await routeViews(page, {
    BV1MultiPartVideo: viewPayload("BV1MultiPartVideo", "多P视频", [
      { cid: 111, page: 1, part: "第一首", duration: 100 },
      { cid: 222, page: 2, part: "第二首", duration: 200 },
    ]),
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://www.bilibili.com/video/BV1MultiPartVideo?p=2");
  await modal.getByRole("button", { name: "解析" }).click();

  // 批量导入忽略 ?p：两个分P 都要导。
  await expect(modal.getByText("将导入 2 个视频")).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();

  const stored = await readStoredAppData(page);
  expect(
    stored.playlists.some((item) => item.id === "video-BV1MultiPartVideo-p2"),
  ).toBe(false);
  const playlist = stored.playlists.find(
    (item) => item.id === "video-BV1MultiPartVideo",
  );
  expect(playlist?.tracks.map((track) => track.title)).toEqual([
    "多P视频 [P1] 第一首",
    "多P视频 [P2] 第二首",
  ]);
  expect(playlist?.tracks.map((track) => track.duration)).toEqual([100, 200]);
  expect(playlist?.tracks.map((track) => track.id)).toEqual([
    "video-BV1MultiPartVideo-p1",
    "video-BV1MultiPartVideo-p2",
  ]);
});

test("refuses to import a video with no playable parts", async ({ page }) => {
  await routeViews(page, {
    BV1NoParts: viewPayload("BV1NoParts", "无分P视频", []),
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://www.bilibili.com/video/BV1NoParts");
  await modal.getByRole("button", { name: "解析" }).click();

  await expect(modal.getByText("将导入 0 个视频")).toBeVisible();
  await modal.getByRole("button", { name: "导入" }).click();

  await expect(
    modal.getByText("该视频没有可导入的分P，请换一个视频链接"),
  ).toBeVisible();
  await expect(
    page.getByLabel("当前歌单", { exact: true }).locator("option"),
  ).toHaveCount(1);
});

test("imports a favorite folder under a custom playlist name", async ({
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

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await modal.getByRole("button", { name: "解析" }).click();

  // 默认值是解析出来的来源名称。
  const nameInput = modal.getByLabel("歌单名称");
  await expect(nameInput).toHaveValue("我的收藏");
  // 落库前统一 trim。
  await nameInput.fill("  自定义歌单  ");
  await modal.getByRole("button", { name: "导入" }).click();
  await modal.getByRole("button", { name: "完成" }).click();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find(
    (item) => item.id === "favorite-2015788186",
  );
  expect(playlist?.name).toBe("自定义歌单");

  // 来源 id 不变，并且能在当前歌单选择器里看到新名称。
  const playlistSelect = page.getByLabel("当前歌单", { exact: true });
  await expect(playlistSelect).toHaveValue("favorite-2015788186");
  await expect(
    playlistSelect.locator("option", { hasText: "自定义歌单" }),
  ).toHaveCount(1);
});

test("imports a collection under a custom playlist name", async ({ page }) => {
  await page.route(SEASON_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(seasonPayload([archive("BV1SeasonA", "合集歌曲一")])),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill(
      "https://space.bilibili.com/1776113786/favlist?fid=5471&ftype=collect&ctype=21",
    );
  await modal.getByRole("button", { name: "解析" }).click();

  const nameInput = modal.getByLabel("歌单名称");
  await expect(nameInput).toHaveValue("我的合集");
  await nameInput.fill("合集自定义名");
  await modal.getByRole("button", { name: "导入" }).click();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find((item) => item.id === "season-5471");
  expect(playlist?.name).toBe("合集自定义名");
  expect(playlist?.tracks).toHaveLength(1);
});

test("imports a plain video under a custom playlist name", async ({ page }) => {
  await routeViews(page, {
    BV1PlainVideo: viewPayload("BV1PlainVideo", "普通视频标题", ONE_PART),
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://www.bilibili.com/video/BV1PlainVideo");
  await modal.getByRole("button", { name: "解析" }).click();

  const nameInput = modal.getByLabel("歌单名称");
  await expect(nameInput).toHaveValue("普通视频标题");
  await nameInput.fill("单视频自定义名");
  await modal.getByRole("button", { name: "导入" }).click();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find(
    (item) => item.id === "video-BV1PlainVideo",
  );
  expect(playlist?.name).toBe("单视频自定义名");
  expect(playlist?.tracks).toHaveLength(1);
});

test("defaults a video link's name to its collection and can rename it", async ({
  page,
}) => {
  await routeViews(page, {
    BV1VideoWithSeason: viewPayload(
      "BV1VideoWithSeason",
      "合集里的某个视频",
      ONE_PART,
      {
        ugc_season: {
          id: 8888,
          title: "我的合集",
          mid: 3546619314178489,
          ep_count: 1,
          sections: [],
        },
      },
    ),
  });
  await page.route(SEASON_API_GLOB, async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(seasonPayload([archive("BV1SeasonA", "合集歌曲一")])),
    });
  });

  await openImportTestPage(page);

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://www.bilibili.com/video/BV1VideoWithSeason");
  await modal.getByRole("button", { name: "解析" }).click();

  // 视频实际归属合集：默认名称取合集名，歌单 id 也走合集来源。
  const nameInput = modal.getByLabel("歌单名称");
  await expect(nameInput).toHaveValue("我的合集");
  await nameInput.fill("视频链接导入的合集名");
  await modal.getByRole("button", { name: "导入" }).click();

  const stored = await readStoredAppData(page);
  const playlist = stored.playlists.find((item) => item.id === "season-8888");
  expect(playlist?.name).toBe("视频链接导入的合集名");
});

test("blocks the import when the playlist name is blank", async ({ page }) => {
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

  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await modal.getByRole("button", { name: "解析" }).click();

  const nameInput = modal.getByLabel("歌单名称");
  await nameInput.fill("   ");
  await expect(modal.getByText("歌单名称不能为空")).toBeVisible();
  await expect(nameInput).toHaveAttribute("aria-invalid", "true");

  const importButton = modal.getByRole("button", { name: "导入" });
  await expect(importButton).toBeDisabled();

  // 键盘回车也不能绕过校验。
  await nameInput.press("Enter");
  await expect(importButton).toBeDisabled();
  expect((await readStoredPlaylists(page)) ?? []).toEqual([]);
});

test("overwrites the same source with the new name and replaced tracks", async ({
  page,
}) => {
  let listCalls = 0;
  await page.route(FAV_API_GLOB, async (route) => {
    listCalls += 1;
    // 前两次调用属于第一次导入（解析 + 导入），之后是第二次导入。
    const firstImport = listCalls <= 2;

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          info: { mid: 1, title: "我的收藏", media_count: firstImport ? 1 : 2 },
          medias: firstImport
            ? [favMedia()]
            : [
                favMedia(),
                favMedia({ id: 2, title: "歌曲二", bvid: "BV1ImportB" }),
              ],
          has_more: false,
        },
      }),
    });
  });

  await openImportTestPage(page);

  const importButton = page.getByRole("button", { name: "批量导入" });

  await importButton.click();
  const firstModal = page.getByRole("dialog", { name: "批量导入" });
  await firstModal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await firstModal.getByRole("button", { name: "解析" }).click();
  await firstModal.getByLabel("歌单名称").fill("第一次导入");
  await firstModal.getByRole("button", { name: "导入" }).click();
  await firstModal.getByRole("button", { name: "完成" }).click();

  const firstStored = await readStoredAppData(page);
  const createdAt = firstStored.playlists.find(
    (item) => item.id === "favorite-2015788186",
  )?.createdAt;
  expect(createdAt).toBeGreaterThan(0);

  await importButton.click();
  const secondModal = page.getByRole("dialog", { name: "批量导入" });
  await secondModal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await secondModal.getByRole("button", { name: "解析" }).click();

  // 覆盖提示与按钮文案保持原样；默认名称回到来源名称。
  await expect(
    secondModal.getByText(/本地已存在该歌单，覆盖导入将替换其中的歌曲/),
  ).toBeVisible();
  await expect(secondModal.getByLabel("歌单名称")).toHaveValue("我的收藏");

  await secondModal.getByLabel("歌单名称").fill("第二次导入");
  await secondModal.getByRole("button", { name: "覆盖导入" }).click();
  await expect(
    secondModal.getByText(/成功导入 2 个视频，已跳过 0 个/),
  ).toBeVisible();

  const stored = await readStoredAppData(page);
  const imported = stored.playlists.filter(
    (item) => item.id === "favorite-2015788186",
  );
  // 命中同一个来源 id：覆盖而不是新增。
  expect(imported).toHaveLength(1);
  expect(imported[0].name).toBe("第二次导入");
  expect(imported[0].createdAt).toBe(createdAt);
  expect(imported[0].tracks.map((track) => track.bvid)).toEqual([
    "BV1ImportA",
    "BV1ImportB",
  ]);
});

test("resets the name field when switching to another source", async ({
  page,
}) => {
  await page.route(FAV_API_GLOB, async (route) => {
    const fid = new URL(route.request().url()).searchParams.get("media_id");
    const first = fid === "111";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          info: {
            mid: 1,
            title: first ? "收藏甲" : "收藏乙",
            media_count: 1,
          },
          medias: [favMedia({ bvid: first ? "BV1ImportA" : "BV1ImportB" })],
          has_more: false,
        },
      }),
    });
  });

  await openImportTestPage(page);

  const importButton = page.getByRole("button", { name: "批量导入" });
  await importButton.click();
  const modal = page.getByRole("dialog", { name: "批量导入" });

  // 解析失败 -> 返回输入阶段 -> 再解析别的链接。
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/lists?sid=3221717&type=season");
  await modal.getByRole("button", { name: "解析" }).click();
  await expect(
    modal.getByText("这是合集/列表页链接，请改用收藏页 favlist 里的链接。"),
  ).toBeVisible();
  await modal.getByRole("button", { name: "返回" }).click();
  await expect(modal.getByLabel("导入链接")).toBeVisible();

  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=111");
  await modal.getByRole("button", { name: "解析" }).click();
  await expect(modal.getByLabel("歌单名称")).toHaveValue("收藏甲");
  await modal.getByLabel("歌单名称").fill("甲的自定义名");
  await modal.getByRole("button", { name: "取消" }).click();

  // 换一个来源重新解析：名称是新来源的默认名，而不是上次编辑过的值。
  await importButton.click();
  const nextModal = page.getByRole("dialog", { name: "批量导入" });
  await nextModal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=222");
  await nextModal.getByRole("button", { name: "解析" }).click();
  await expect(nextModal.getByLabel("歌单名称")).toHaveValue("收藏乙");
});

test("writes nothing when the user cancels or parsing fails", async ({
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
  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });

  // 解析失败。
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/lists?sid=3221717&type=season");
  await modal.getByRole("button", { name: "解析" }).click();
  await modal.getByRole("button", { name: "返回" }).click();
  expect((await readStoredPlaylists(page)) ?? []).toEqual([]);

  // 解析成功后在确认阶段取消。
  await modal
    .getByLabel("导入链接")
    .fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await modal.getByRole("button", { name: "解析" }).click();
  await modal.getByRole("button", { name: "取消" }).click();
  await expect(page.getByRole("dialog", { name: "批量导入" })).toHaveCount(0);
  expect((await readStoredPlaylists(page)) ?? []).toEqual([]);
});

test("writes nothing when the import fails or the user aborts it", async ({
  page,
}) => {
  let listCalls = 0;
  await page.route(FAV_API_GLOB, async (route) => {
    listCalls += 1;
    const pn = Number(new URL(route.request().url()).searchParams.get("pn"));

    // 第 2 次调用是第一次导入的首屏请求：直接 412 让导入失败。
    if (listCalls === 2) {
      await route.fulfill({ status: 412, contentType: "application/json" });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        code: 0,
        data: {
          info: { mid: 1, title: "我的收藏", media_count: 3 },
          medias: [favMedia()],
          // 第二次导入留出翻页窗口，确保「中止」落在导入过程中。
          has_more: listCalls >= 4 && pn <= 3,
        },
      }),
    });
  });

  await openImportTestPage(page);
  await page.getByRole("button", { name: "批量导入" }).click();
  const modal = page.getByRole("dialog", { name: "批量导入" });
  const linkInput = modal.getByLabel("导入链接");

  // 导入请求失败。
  await linkInput.fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await modal.getByRole("button", { name: "解析" }).click();
  await modal.getByRole("button", { name: "导入" }).click();
  await expect(
    modal.getByText("请求过于频繁，已触发 B 站风控，请稍后再试"),
  ).toBeVisible();
  expect((await readStoredPlaylists(page)) ?? []).toEqual([]);

  // 中止导入。
  await modal.getByRole("button", { name: "返回" }).click();
  await linkInput.fill("https://space.bilibili.com/1/favlist?fid=2015788186");
  await modal.getByRole("button", { name: "解析" }).click();
  await modal.getByRole("button", { name: "导入" }).click();
  await modal.getByRole("button", { name: "中止导入" }).click();

  // 中止后回到输入阶段，且没有写入任何歌单。
  await expect(linkInput).toBeVisible();
  expect((await readStoredPlaylists(page)) ?? []).toEqual([]);
});
