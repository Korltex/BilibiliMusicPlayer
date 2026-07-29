import path from "node:path";
import { expect, test } from "@playwright/test";

const VIDEO_URL = "https://www.bilibili.com/video/BV1xQ4y157Qi/";

test("mounts on a real public Bilibili video page", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    const memory = new Map<string, unknown>();
    Object.assign(window, {
      GM_getValue(name: string, fallback?: unknown) {
        return memory.get(name) ?? fallback;
      },
      GM_setValue(name: string, value: unknown) {
        memory.set(name, value);
      },
      GM_addValueChangeListener() {
        return 1;
      },
      GM_removeValueChangeListener() {},
    });
  });

  await page.goto(VIDEO_URL, { waitUntil: "domcontentloaded" });
  await expect(page.locator("video").first()).toBeAttached({
    timeout: 30_000,
  });

  await page.addScriptTag({
    path: path.resolve("dist/bilibili-music-player.user.js"),
  });

  const openButton = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  await expect(openButton).toBeVisible({ timeout: 15_000 });
  await openButton.click();
  await expect(
    page.getByRole("region", { name: "Bilibili 音乐播放器" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "将当前视频添加到歌单" }),
  ).toBeEnabled();

  await page.screenshot({
    path: testInfo.outputPath("real-bilibili.png"),
    fullPage: false,
  });
});
