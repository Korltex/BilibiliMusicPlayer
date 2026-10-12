import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppData, Track } from "../../src/core/types";
import * as longList from "./helpers/long-list";
import { injectBuiltUserscript } from "../helpers/userscript";

/*
 * 歌曲行排序：行首专用手柄 + 约 350ms 长按进入拖动。
 * 这里锁住五条验收行为：
 *  1. 长按拖动真的改变顺序，并写入当前歌单的 tracks 数组；
 *  2. 未达到长按时长的点击（手柄与歌曲行）仍是播放，不会误排序；
 *  3. 拖动不会误触编辑/删除；
 *  4. 刷新后顺序保留；
 *  5. 播放中重排：当前曲目继续播放，下一首按新顺序选择。
 */

const REORDER_URL = "https://www.bilibili.com/video/BV1ReorderTest/";
const DATA_KEY = "bilibili-music-player:data";
// 与 src/app/use-track-reorder.ts 的 REORDER_LONG_PRESS_MS 保持一致。
const LONG_PRESS_MS = 200;

const panel = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器", exact: true });
const trackRows = (page: Page) => panel(page).locator(".track-row");
/** 歌曲行本身就是拖动入口：不再有专用手柄。 */
const rows = (page: Page) => panel(page).locator(".track-row");

function createTrack(id: string, title: string, startTime: number): Track {
  return {
    id,
    bvid: "BV1ReorderTest",
    title,
    startTime,
    duration: 240,
    addedAt: 1,
    source: "manual",
  };
}

/** 三首歌指向同一个 BV，因此切歌发生在当前页，不需要导航。 */
function createReorderData(): AppData {
  return {
    version: 1,
    playlists: [
      {
        id: "playlist-a",
        name: "歌单 A",
        tracks: [
          createTrack("track-1", "第一首", 0),
          createTrack("track-2", "第二首", 60),
          createTrack("track-3", "第三首", 120),
        ],
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

async function installLocalStorageGm(page: Page, data: AppData): Promise<void> {
  await page.addInitScript(
    ({ storageKey, initial }) => {
      const prefix = "__bili_music__:";
      // 初始化脚本会在刷新后重跑；已有歌单库时不要覆盖，否则顺序持久化就测不出来了。
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
    { storageKey: DATA_KEY, initial: data },
  );
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
      volume: { configurable: true, get: () => 1, set: () => {} },
      muted: { configurable: true, get: () => false, set: () => {} },
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

async function openTestPage(page: Page, data = createReorderData()) {
  await page.route(`${REORDER_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html>
        <html>
          <head><title>排序测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="排序测试">排序测试</h1>
            <a class="up-name">测试作者</a>
            <video></video>
          </body>
        </html>`,
    });
  });

  await installLocalStorageGm(page, data);
  await page.goto(REORDER_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  // 歌单来自 GM 存储，等首行渲染出来再断言，避免读到「还没有歌曲」的空列表。
  await expect(trackRows(page).first()).toHaveAttribute(
    "data-track-id",
    data.playlists[0].tracks[0].id,
  );
}

async function readStoredTrackIds(page: Page): Promise<string[]> {
  return page.evaluate((storageKey) => {
    const raw = localStorage.getItem(`__bili_music__:${storageKey}`);
    return (JSON.parse(raw!) as AppData).playlists[0].tracks.map(
      (track) => track.id,
    );
  }, DATA_KEY);
}

async function readRenderedTrackIds(page: Page): Promise<string[]> {
  return trackRows(page).evaluateAll((rows) =>
    rows.map((row) => row.dataset.trackId ?? ""),
  );
}

/**
 * 落库发生在 pointerup / keydown 的同一次事件循环里，轮询比一次性断言稳：
 * 一次性断言偶尔会撞上 Playwright 已经派发完事件、应用还没写完存储的间隙。
 */
async function expectStoredTrackIds(
  page: Page,
  expected: string[],
): Promise<void> {
  await expect.poll(() => readStoredTrackIds(page)).toEqual(expected);
}

/** 拖动落库后再断言渲染顺序：先把存储等稳，DOM 一定已经跟着更新。 */
async function expectOrder(page: Page, expected: string[]): Promise<void> {
  await expectStoredTrackIds(page, expected);
  expect(await readRenderedTrackIds(page)).toEqual(expected);
}

function pointerInit(pointerId: number, clientY: number, clientX = 100) {
  return {
    pointerId,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  };
}

/** 一次拖动全程共用同一个 pointerId，否则 pointermove 会被当成别的指针忽略。 */
const DRAG_POINTER_ID = 1;

/**
 * 在歌曲行上按下并等到长按生效（`.reorder-source` 出现）。
 *
 * 现在整行都是拖动入口，按下位置刻意选在**行中部**：避开行内按钮，
 * 也避开左右两端的图标区域。
 */
async function beginLongPress(row: Locator): Promise<void> {
  const box = (await row.boundingBox())!;
  await row.dispatchEvent(
    "pointerdown",
    pointerInit(DRAG_POINTER_ID, box.y + box.height / 2),
  );
  await expect(row).toHaveClass(/reorder-source/, { timeout: 3_000 });
}

/** pointermove 序列会先经过其他行，末尾停在目标位置。 */
async function dragTo(row: Locator, clientY: number): Promise<void> {
  for (const y of [clientY - 6, clientY]) {
    await row.dispatchEvent("pointermove", pointerInit(DRAG_POINTER_ID, y));
  }
}

async function endDrag(row: Locator, clientY: number): Promise<void> {
  await row.dispatchEvent("pointerup", pointerInit(DRAG_POINTER_ID, clientY));
}

function rowCenterY(row: Locator): Promise<number> {
  return row.boundingBox().then((box) => box!.y + box!.height / 2);
}

/*
 * ── 长列表（可滚动）夹具：自动滚动测试 ──────────────────────────────
 * 3 首的短列表 `.track-list` 不会溢出，滚不动；自动滚动必须用长歌单验证。
 */

/** 拖动入口：真实鼠标按住（`dispatchEvent` 的合成 pointerdown 无法建立指针捕获）。 */
async function startDragAtRowCenter(
  page: Page,
  row: Locator,
): Promise<{ clientX: number }> {
  const box = (await row.boundingBox())!;
  const clientX = box.x + box.width / 2;
  await page.mouse.move(clientX, box.y + box.height / 2);
  await page.mouse.down();
  await expect(row).toHaveClass(/reorder-source/, { timeout: 3_000 });
  return { clientX };
}

/**
 * 按住拖动时把指针停在指定纵坐标。
 *
 * 用合成事件而不是 `page.mouse.move`：起始 pointerdown 是真实鼠标事件并按 `pointerId`
 * 建立了指针捕获，后续合成事件只要 pointerId 一致就会被送达（`playwright.config.ts`
 * 里没有开 `hasTouch`，真实触摸不可用）。好处是**指针可以停住不动**，
 * 正好验证「静止也继续滚」。
 */
async function holdPointerAt(row: Locator, clientY: number): Promise<void> {
  await row.dispatchEvent(
    "pointermove",
    pointerInit(DRAG_POINTER_ID, clientY, 0),
  );
}

async function releasePointerAt(row: Locator, clientY: number): Promise<void> {
  await row.dispatchEvent(
    "pointerup",
    pointerInit(DRAG_POINTER_ID, clientY, 0),
  );
}

function readScrollState(page: Page) {
  return longList.readScrollState(page);
}

function readDropIndex(page: Page) {
  return longList.readDropIndex(page);
}

test("long-press drag reorders the current playlist and persists the order", async ({
  page,
}, testInfo) => {
  await openTestPage(page);
  await expect(trackRows(page)).toHaveCount(3);

  const firstRow = rows(page).nth(0);
  await beginLongPress(firstRow);
  await expect(trackRows(page).nth(0)).toHaveClass(/reorder-source/);

  // 拖到第三首中线以下 → 插入位 3（末尾）。
  const dropY = (await rowCenterY(trackRows(page).nth(2))) + 20;
  await dragTo(firstRow, dropY);
  await expect(
    trackRows(page).nth(2).locator(".track-drop-indicator.tail"),
  ).toBeVisible();
  // 锚定拖动中的视觉契约（源行淡出 + 落点插入线），失败时留下截图。
  await panel(page).screenshot({
    path: testInfo.outputPath("reorder-drop.png"),
  });

  await endDrag(firstRow, dropY);

  await expectOrder(page, ["track-2", "track-3", "track-1"]);
  await expect(panel(page).locator(".reorder-source")).toHaveCount(0);
  await expect(panel(page).locator(".track-drop-indicator")).toHaveCount(0);
});

test("dragging the last track upwards inserts it before the first one", async ({
  page,
}) => {
  await openTestPage(page);

  const lastRow = rows(page).nth(2);
  await beginLongPress(lastRow);
  const dropY = (await rowCenterY(trackRows(page).nth(0))) - 20;
  await dragTo(lastRow, dropY);
  await expect(
    trackRows(page).nth(0).locator(".track-drop-indicator"),
  ).toBeVisible();
  await endDrag(lastRow, dropY);

  await expectOrder(page, ["track-3", "track-1", "track-2"]);
});

test("a short press on a row only plays instead of reordering", async ({
  page,
}) => {
  await openTestPage(page);
  const before = await readRenderedTrackIds(page);

  const row = rows(page).nth(0);
  const box = (await row.boundingBox())!;
  const startY = box.y + box.height / 2;
  await row.dispatchEvent("pointerdown", pointerInit(3, startY));
  await row.dispatchEvent("pointermove", pointerInit(3, startY + 2));
  await row.dispatchEvent("pointerup", pointerInit(3, startY));
  // 未满长按时长就松手：同一次按下仍然是正常点击（播放第一首），不排序。
  await row.click({ position: { x: 6, y: 10 } });
  await page.waitForTimeout(LONG_PRESS_MS + 150);

  expect(await readRenderedTrackIds(page)).toEqual(before);
  expect(await readStoredTrackIds(page)).toEqual(before);
  await expect(
    panel(page).getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await expect(trackRows(page).nth(0)).toHaveClass(/active/);
});

test("moving the pointer before the long press cancels the drag", async ({
  page,
}) => {
  await openTestPage(page);
  const before = await readRenderedTrackIds(page);

  const row = rows(page).nth(0);
  const box = (await row.boundingBox())!;
  const startY = box.y + box.height / 2;
  await row.dispatchEvent("pointerdown", pointerInit(5, startY));
  // 长按计时器还没到点就明显移动 → 视为滚动，放弃这次拖动。
  await row.dispatchEvent("pointermove", pointerInit(5, startY + 40));
  await page.waitForTimeout(LONG_PRESS_MS + 200);
  await expect(row).not.toHaveClass(/reorder-source/);

  await row.dispatchEvent("pointerup", pointerInit(5, startY + 40));
  expect(await readRenderedTrackIds(page)).toEqual(before);
  expect(await readStoredTrackIds(page)).toEqual(before);
});

test("clicking the song main area still plays", async ({ page }) => {
  await openTestPage(page);

  const row = trackRows(page).nth(1);
  await row.locator(".track-main").click();

  await expect(row).toHaveClass(/active/);
  await expect(
    panel(page).getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "第二首",
  );
  expect(await readRenderedTrackIds(page)).toEqual([
    "track-1",
    "track-2",
    "track-3",
  ]);
});

test("dragging does not trigger edit or delete on other rows", async ({
  page,
}) => {
  await openTestPage(page);

  const firstRow = rows(page).nth(0);
  await beginLongPress(firstRow);
  const dropY = (await rowCenterY(trackRows(page).nth(2))) + 20;
  await dragTo(firstRow, dropY);
  await endDrag(firstRow, dropY);

  await expect(page.locator(".track-editor")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "删除歌曲" })).toHaveCount(0);
  await expectOrder(page, ["track-2", "track-3", "track-1"]);

  // 行内按钮本身仍按原语义工作。
  await panel(page).getByRole("button", { name: "编辑 第二首" }).click();
  const editor = page.locator(".track-editor");
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("标题")).toHaveValue("第二首");
  await editor.getByRole("button", { name: "关闭编辑器" }).click();
  await panel(page).getByRole("button", { name: "删除 第二首" }).click();
  await expect(page.getByRole("dialog", { name: "删除歌曲" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "删除歌曲" })
    .getByRole("button", { name: "取消" })
    .click();
  await expectStoredTrackIds(page, ["track-2", "track-3", "track-1"]);
});

test("keeps playing the current track and follows the new order afterwards", async ({
  page,
}) => {
  await openTestPage(page);

  // 先播放第二首，再把它拖到首位。
  await trackRows(page).nth(1).locator(".track-main").click();
  await expect(
    panel(page).getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "第二首",
  );

  const row = rows(page).nth(1);
  await beginLongPress(row);
  const dropY = (await rowCenterY(trackRows(page).nth(0))) - 20;
  await dragTo(row, dropY);
  await endDrag(row, dropY);

  // 顺序变成 第二首 → 第一首 → 第三首，当前曲目不变、也不暂停。
  await expectStoredTrackIds(page, ["track-2", "track-1", "track-3"]);
  await expect(trackRows(page).nth(0)).toHaveAttribute(
    "data-track-id",
    "track-2",
  );
  await expect(trackRows(page).nth(0)).toHaveClass(/active/);
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "第二首",
  );
  await expect(
    panel(page).getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();

  // 下一首按新顺序：track-2 的下一首是 track-1。
  await panel(page).getByRole("button", { name: "下一首" }).click();
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "第一首",
  );
  await expect(trackRows(page).nth(1)).toHaveClass(/active/);
  // 上一首回到 track-2（新顺序里的前一首）。
  await panel(page).getByRole("button", { name: "上一首" }).click();
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "第二首",
  );
  await expect(trackRows(page).nth(0)).toHaveClass(/active/);
});

test("keeps the new order after a page reload", async ({ page }) => {
  await openTestPage(page);

  const firstRow = rows(page).nth(0);
  await beginLongPress(firstRow);
  const dropY = (await rowCenterY(trackRows(page).nth(2))) + 20;
  await dragTo(firstRow, dropY);
  await endDrag(firstRow, dropY);
  await expectStoredTrackIds(page, ["track-2", "track-3", "track-1"]);

  await page.reload();
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await expect(trackRows(page).first()).toHaveAttribute(
    "data-track-id",
    "track-2",
  );

  expect(await readRenderedTrackIds(page)).toEqual([
    "track-2",
    "track-3",
    "track-1",
  ]);
  await expect(page.locator(".track-index").nth(0)).toHaveText("01");
  await expect(page.locator(".track-index").nth(2)).toHaveText("03");
});

/**
 * 面板挂在 Shadow DOM 里，用宿主根节点的 activeElement 判断第 index 行是否持有焦点。
 *
 * 焦点可能落在行本身（Tab 进来）或行内的歌曲主体（点击/重排后归还），两者都算。
 */
function isRowFocused(page: Page, index: number): Promise<boolean> {
  return page.evaluate((rowIndex) => {
    const root = document.getElementById(
      "bilibili-music-player-host",
    )?.shadowRoot;
    const row = root?.querySelectorAll(".track-row")[rowIndex];
    if (!row) {
      return false;
    }

    const active = root?.activeElement;
    return active === row || (Boolean(active) && row.contains(active));
  }, index);
}

/**
 * 焦点由 `requestAnimationFrame` 在重排之后还原，因此用轮询等它稳定，
 * 不要在按键后立刻断言（并发跑整套 e2e 时容易撞上这一帧）。
 */
async function expectRowFocused(page: Page, index: number): Promise<void> {
  await expect.poll(() => isRowFocused(page, index)).toBe(true);
}

test("a focused row reorders with the keyboard", async ({ page }) => {
  await openTestPage(page);

  const row = rows(page).nth(0);
  // 点击行的边缘留白：落在歌曲主体的内边距上，等同点击歌曲（播放第一首），但不排序。
  await row.click({ position: { x: 10, y: 10 } });
  await expectRowFocused(page, 0);
  await expect(trackRows(page).nth(0)).toHaveClass(/active/);

  await page.keyboard.press("ArrowDown");
  await expect(panel(page).locator(".track-reorder-status")).toHaveText(
    "已移动到第 2 首",
  );
  await expectStoredTrackIds(page, ["track-2", "track-1", "track-3"]);
  // 重排会重建这一行，焦点必须还停在同一首歌上才能连续调整。
  await expectRowFocused(page, 1);

  await page.keyboard.press("ArrowDown");
  await expect(panel(page).locator(".track-reorder-status")).toHaveText(
    "已移动到第 3 首",
  );
  await expectStoredTrackIds(page, ["track-2", "track-3", "track-1"]);
  await expectRowFocused(page, 2);

  // 边界：已经在队尾，再按 ArrowDown 不动也不改数据。
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await expectRowFocused(page, 2);
  expect(await readStoredTrackIds(page)).toEqual([
    "track-2",
    "track-3",
    "track-1",
  ]);

  // Home 把同一首歌拉回队首，并继续把焦点交给它。
  await page.keyboard.press("Home");
  await expect(panel(page).locator(".track-reorder-status")).toHaveText(
    "已移动到第 1 首",
  );
  await expectStoredTrackIds(page, ["track-1", "track-2", "track-3"]);
  await expectRowFocused(page, 0);
});

/*
 * 真实鼠标路径：上面用 page.dispatchEvent 派发合成 PointerEvent 来精确控制
 * pointerId 与坐标，这里补一组 page.mouse 真鼠标用例，确保「按下 → 按住 → 移动
 * → 松开」在浏览器真实指针事件序列（含指针捕获）下同样成立。
 */
test("a real mouse drag on a row reorders the playlist", async ({ page }) => {
  await openTestPage(page);

  const firstRow = rows(page).nth(0);
  const box = (await firstRow.boundingBox())!;
  // 按在行中部（歌曲标题附近），不碰行内按钮。
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const dropY = (await rowCenterY(trackRows(page).nth(2))) + 20;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // 按住不动直到长按生效，然后才移动。
  await expect(firstRow).toHaveClass(/reorder-source/, { timeout: 3_000 });
  await page.mouse.move(startX, dropY - 6);
  await page.mouse.move(startX, dropY);
  await page.mouse.up();

  await expectOrder(page, ["track-2", "track-3", "track-1"]);
  // 松手后没有拖动残留，也没有因为抑制 click 而误触播放。
  await expect(panel(page).locator(".reorder-source")).toHaveCount(0);
  await expect(panel(page).locator(".track-row.active")).toHaveCount(0);
  await expect(
    panel(page).getByRole("button", { name: "播放", exact: true }),
  ).toBeVisible();
});

test("a real mouse click on a row gap focuses it without reordering or playing", async ({
  page,
}) => {
  await openTestPage(page);
  const before = await readRenderedTrackIds(page);

  // 点行的边缘留白（在歌曲主体的内边距上，不是行内按钮）。
  await rows(page)
    .nth(0)
    .click({ position: { x: 6, y: 10 } });

  await expectRowFocused(page, 0);
  await page.waitForTimeout(LONG_PRESS_MS + 150);
  expect(await readRenderedTrackIds(page)).toEqual(before);
  expect(await readStoredTrackIds(page)).toEqual(before);
});

test("a real mouse click on the song row plays without reordering", async ({
  page,
}) => {
  await openTestPage(page);
  const before = await readRenderedTrackIds(page);

  const row = trackRows(page).nth(1);
  await row.locator(".track-main").click();

  await expect(
    panel(page).getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await expect(row).toHaveClass(/active/);
  expect(await readRenderedTrackIds(page)).toEqual(before);
  expect(await readStoredTrackIds(page)).toEqual(before);
});

test("a real mouse drag on the song main area also reorders", async ({
  page,
}) => {
  await openTestPage(page);

  // 全局长按：按住歌曲主体（不是行内按钮）同样能拖动排序。
  const row = trackRows(page).nth(0);
  const box = (await row.locator(".track-main").boundingBox())!;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const dropY = (await rowCenterY(trackRows(page).nth(2))) + 20;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await expect(row).toHaveClass(/reorder-source/, { timeout: 3_000 });
  await page.mouse.move(startX, dropY - 6);
  await page.mouse.move(startX, dropY);
  await page.mouse.up();

  await expectOrder(page, ["track-2", "track-3", "track-1"]);
});

/*
 * ── 长列表自动滚动 ─────────────────────────────────────────────────
 * 指针进入 `.track-list` 上下 28px 边缘带后，帧循环持续滚动；指针静止也继续。
 */

test("auto-scrolls down and updates the drop target while the pointer is still", async ({
  page,
}) => {
  await longList.openLongListPage(page);
  const order = Array.from({ length: longList.LONG_LIST_SIZE }, (_, index) =>
    longList.longListTrackId(index),
  );
  const sourceRow = longList.panelRows(page).nth(0);
  const { clientX } = await startDragAtRowCenter(page, sourceRow);

  const geometry = await readScrollState(page);
  // 前置条件：列表真的溢出，否则这条用例什么也证明不了。
  expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight + 60);
  expect(geometry.scrollTop).toBe(0);

  // 指针停在列表底边内 8px 处（不碰面板边缘），随后**完全静止**。
  await holdPointerAt(sourceRow, geometry.bottom - 8);
  await longList.expectScrollPast(page, 40, "down");

  const scrolled = await readScrollState(page);
  expect(scrolled.scrollTop).toBeLessThanOrEqual(
    scrolled.scrollHeight - scrolled.clientHeight,
  );
  // 自动滚动后落点跟着变：现在是「插到末尾」。
  await expect
    .poll(() => readDropIndex(page), { timeout: 5_000 })
    .toBe(longList.LONG_LIST_SIZE);

  // 松手落库，并用鼠标把指针归位，避免残留位置影响后续断言。
  await releasePointerAt(sourceRow, geometry.bottom - 8);
  await page.mouse.move(clientX, geometry.top + 20);

  await expectStoredTrackIds(page, [...order.slice(1), order[0]]);
  expect(await readRenderedTrackIds(page)).toEqual([
    ...order.slice(1),
    order[0],
  ]);

  // 拖动已结束：帧循环要停，不能再自己滚。
  const atRest = await readScrollState(page);
  await page.waitForTimeout(200);
  expect((await readScrollState(page)).scrollTop).toBe(atRest.scrollTop);
});

test("stops auto-scrolling when the pointer leaves the edge zone", async ({
  page,
}) => {
  await longList.openLongListPage(page);
  const sourceRow = longList.panelRows(page).nth(0);
  await startDragAtRowCenter(page, sourceRow);

  const geometry = await readScrollState(page);
  const edgeY = geometry.bottom - 8;
  await holdPointerAt(sourceRow, edgeY);
  await longList.expectScrollPast(page, 40, "down");

  // 移回列表中部：已在边缘带之外，接下来的帧都不应再改变 scrollTop。
  await holdPointerAt(sourceRow, geometry.top + geometry.clientHeight / 2);
  const leftEdge = await readScrollState(page);
  expect(leftEdge.scrollTop).toBeLessThan(
    leftEdge.scrollHeight - leftEdge.clientHeight,
  );

  await page.waitForTimeout(250);
  expect((await readScrollState(page)).scrollTop).toBe(leftEdge.scrollTop);

  // 再移回边缘带：自动滚动要能重新启动（而不是循环被彻底废掉）。
  await holdPointerAt(sourceRow, edgeY);
  await longList.expectScrollPast(page, leftEdge.scrollTop + 20, "down");
});

test("auto-scrolls up and persists the order after release", async ({
  page,
}) => {
  await longList.openLongListPage(page);
  const order = Array.from({ length: longList.LONG_LIST_SIZE }, (_, index) =>
    longList.longListTrackId(index),
  );

  // 先滚到底部，再从**当前可见的**靠后一行开始拖。
  await page.evaluate(() => {
    const list = document
      .getElementById("bilibili-music-player-host")
      ?.shadowRoot?.querySelector<HTMLElement>(".track-list");
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  });
  const sourceIndex = await page.evaluate(() => {
    const root = document.getElementById(
      "bilibili-music-player-host",
    )?.shadowRoot;
    const list = root?.querySelector<HTMLElement>(".track-list")!;
    const bounds = list.getBoundingClientRect();
    const rows = Array.from(list.querySelectorAll<HTMLElement>(".track-row"));
    // 取当前滚动位置下「整个行都在可视区内」的最后一行。
    const visible = rows.filter((row) => {
      const box = row.getBoundingClientRect();
      return box.top >= bounds.top && box.bottom <= bounds.bottom;
    });
    const row = visible[visible.length - 1];
    return rows.indexOf(row);
  });
  expect(sourceIndex).toBeGreaterThan(0);

  const sourceRow = longList.panelRows(page).nth(sourceIndex);
  const { clientX } = await startDragAtRowCenter(page, sourceRow);

  const geometry = await readScrollState(page);
  expect(geometry.scrollTop).toBeGreaterThan(60);

  // 指针停在列表顶边内 8px 处并保持静止，列表应向**上**滚回去。
  await holdPointerAt(sourceRow, geometry.top + 8);
  await longList.expectScrollPast(page, geometry.scrollTop - 40, "up");
  expect((await readScrollState(page)).scrollTop).toBeLessThan(
    geometry.scrollTop,
  );

  // 滚到顶部后落点应为「插到第 1 首之前」。
  await expect.poll(() => readDropIndex(page), { timeout: 5_000 }).toBe(0);

  await releasePointerAt(sourceRow, geometry.top + 8);
  await page.mouse.move(clientX, geometry.top + 20);

  const sourceId = order[sourceIndex];
  const expected = [
    sourceId,
    ...order.filter((_, index) => index !== sourceIndex),
  ];
  await expectStoredTrackIds(page, expected);
  expect(await readRenderedTrackIds(page)).toEqual(expected);

  const atRest = await readScrollState(page);
  await page.waitForTimeout(200);
  expect((await readScrollState(page)).scrollTop).toBe(atRest.scrollTop);
});
