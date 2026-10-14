import { expect, test, type Page } from "@playwright/test";
import { injectBuiltUserscript } from "../helpers/userscript";

// 用户实际报告的收藏夹「播放全部」链接（apex bilibili.com 会 301 到 www）。
// 当前视频的 BV 只在查询串里，路径 `/list/ml…` 没有 BV。
const LIST_BVID = "BV1414y1W7QZ";
const LIST_URL = `https://www.bilibili.com/list/ml1259927886?spm_id_from=333.1387.0.0&oid=775106615&bvid=${LIST_BVID}`;
const SECOND_BVID = "BV1ListSecond";
const HOST_SELECTOR = "#bilibili-music-player-host";
const VIEW_API_GLOB = "https://api.bilibili.com/x/web-interface/view**";

const FIRST_VIDEO = { title: "列表页视频", uploader: "列表页作者" };
const SECOND_VIDEO = { title: "列表页第二个视频", uploader: "第二个作者" };
const FIRST_COVER = "https://i2.hdslb.com/bfs/archive/list-cover.jpg@120w_120h_1c.webp";
const SECOND_COVER =
  "https://i2.hdslb.com/bfs/archive/second-cover.jpg@120w_120h_1c.webp";

const panelTitle = (page: Page) => page.locator(".now-playing-copy strong");
const panelUploader = (page: Page) => page.locator(".now-playing-copy > span");
const panelCover = (page: Page) => page.locator(".cover img");

// 列表播放页的播放器是客户端渲染的：初始 HTML 里没有 <video>，媒体元素稍后才出现。
// 页面**不提供** og:image / 分享卡片封面，因此面板封面只能来自按 bvid 取的 view 接口。
const LIST_PAGE_BODY = `
  <!doctype html>
  <html>
    <head><title>${FIRST_VIDEO.title}_哔哩哔哩_bilibili</title></head>
    <body>
      <h1 class="video-title" title="${FIRST_VIDEO.title}">${FIRST_VIDEO.title}</h1>
      <a class="up-name">${FIRST_VIDEO.uploader}</a>
      <div class="bpx-player-container" data-screen="normal">
        <div class="bpx-player-video-wrap"></div>
      </div>
    </body>
  </html>
`;

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

/** 伪造 view 接口，并记录每个被请求的 bvid。 */
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

async function openListPage(page: Page): Promise<void> {
  await page.route(LIST_URL, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: LIST_PAGE_BODY,
    });
  });
  await installLocalStorageGm(page);
  await page.goto(LIST_URL);
  await injectBuiltUserscript(page);
}

/** 模拟列表页稍后才渲染出来的媒体元素。 */
async function appendMockMedia(page: Page, duration = 300): Promise<void> {
  await page.evaluate((mediaDuration) => {
    const media = document.createElement("video");
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
      duration: { get: () => mediaDuration },
      readyState: { get: () => 4 },
    });

    media.play = async () => {
      paused = false;
      media.dispatchEvent(new Event("play"));
    };
    media.pause = () => {
      paused = true;
      media.dispatchEvent(new Event("pause"));
    };

    document.body.append(media);
  }, duration);
}

async function openPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await expect(
    page.getByRole("region", { name: "Bilibili 音乐播放器" }),
  ).toBeVisible();
}

test("mounts the plugin button on the list playback page", async ({ page }) => {
  await openListPage(page);

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }),
  ).toBeVisible();
});

test("opens the player instead of the import flow on the list page", async ({
  page,
}) => {
  await openListPage(page);

  await openPanel(page);

  // 与普通视频页一致：进入播放器面板，而不是误进「批量导入」。
  await expect(page.getByRole("dialog", { name: "批量导入" })).toHaveCount(0);
});

test("binds media that appears after the script mounted", async ({ page }) => {
  await openListPage(page);
  await openPanel(page);

  // 播放器尚未渲染：进度条与播放键都不可用。
  const progress = page.getByLabel("播放进度");
  await expect(progress).toBeDisabled();

  await appendMockMedia(page);

  // 媒体元素稍后挂上后，引擎应当自动接管（MutationObserver + 轮询）。
  await expect(progress).toBeEnabled();
  await expect(page.getByLabel("播放", { exact: true })).toBeEnabled();
});

test("shows the current video's title, uploader and cover on the list page", async ({
  page,
}) => {
  const requested = await routeCoverApi(page, {
    [LIST_BVID]: "http://i2.hdslb.com/bfs/archive/list-cover.jpg",
  });

  await openListPage(page);
  await appendMockMedia(page);
  await openPanel(page);

  // 标题与 UP 主取自当前播放页，封面走按 bvid 取封面的既有管线。
  await expect(panelTitle(page)).toHaveText(FIRST_VIDEO.title);
  await expect(panelUploader(page)).toHaveText(FIRST_VIDEO.uploader);
  await expect(panelCover(page)).toHaveAttribute("src", FIRST_COVER);
  expect(requested).toContain(LIST_BVID);
});

test("follows the current video when the list switches bvid", async ({
  page,
}) => {
  const requested = await routeCoverApi(page, {
    [LIST_BVID]: "http://i2.hdslb.com/bfs/archive/list-cover.jpg",
    [SECOND_BVID]: "http://i2.hdslb.com/bfs/archive/second-cover.jpg",
  });

  await openListPage(page);
  await appendMockMedia(page);
  await openPanel(page);
  await expect(panelCover(page)).toHaveAttribute("src", FIRST_COVER);

  // B 站列表页换视频：URL 的 bvid 先变，随后 DOM 才写入新视频信息。
  await page.evaluate((bvid) => {
    history.pushState({}, "", `/list/ml1259927886?oid=2&bvid=${bvid}`);
  }, SECOND_BVID);
  await page.evaluate((video) => {
    document.title = `${video.title}_哔哩哔哩_bilibili`;
    const heading = document.querySelector("h1.video-title")!;
    heading.setAttribute("title", video.title);
    heading.textContent = video.title;
    document.querySelector(".up-name")!.textContent = video.uploader;
  }, SECOND_VIDEO);

  // 元数据必须跟着当前视频走，而不是停在页面旧内容上。
  await expect(panelTitle(page)).toHaveText(SECOND_VIDEO.title);
  await expect(panelUploader(page)).toHaveText(SECOND_VIDEO.uploader);
  await expect(panelCover(page)).toHaveAttribute("src", SECOND_COVER);
  expect(requested).toContain(SECOND_BVID);
});
