import { expect, test, type Page } from "@playwright/test";
import { injectBuiltUserscript } from "../helpers/userscript";

const FAVLIST_URL = "https://space.bilibili.com/1776113786/favlist";
const SPACE_VIDEO_URL = "https://space.bilibili.com/1776113786/video";
const HOST_SELECTOR = "#bilibili-music-player-host";

const SPACE_PAGE_BODY = `
  <!doctype html>
  <html>
    <head><title>个人空间_哔哩哔哩_bilibili</title></head>
    <body><div id="app-root"></div></body>
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

async function routeSpacePage(page: Page, url: string): Promise<void> {
  await page.route(url, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: SPACE_PAGE_BODY,
    });
  });
}

test("shows the plugin button on the space favlist page", async ({ page }) => {
  await routeSpacePage(page, FAVLIST_URL);
  await installLocalStorageGm(page);
  await page.goto(FAVLIST_URL);
  await injectBuiltUserscript(page);

  const launcher = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  await expect(launcher).toBeVisible();

  await launcher.click();

  // 这个页面上没有播放器：直接进入完整面板并打开导入弹窗。
  await expect(
    page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" }),
  ).toBeVisible();
  await expect(page.getByLabel("收藏夹链接")).toBeVisible();
});

test("stays inert on other space pages", async ({ page }) => {
  await routeSpacePage(page, SPACE_VIDEO_URL);
  await installLocalStorageGm(page);
  await page.goto(SPACE_VIDEO_URL);
  await injectBuiltUserscript(page);

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }),
  ).toHaveCount(0);
});

test("mounts after an SPA route change into the favlist page", async ({
  page,
}) => {
  await routeSpacePage(page, SPACE_VIDEO_URL);
  await installLocalStorageGm(page);
  await page.goto(SPACE_VIDEO_URL);
  await injectBuiltUserscript(page);

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(0);

  await page.evaluate(() => {
    history.pushState({}, "", "/1776113786/favlist");
  });

  const launcher = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  await expect(launcher).toBeVisible({ timeout: 5_000 });
  await launcher.click();
  await expect(
    page.getByRole("dialog", { name: "导入 Bilibili 收藏夹" }),
  ).toBeVisible();
});
