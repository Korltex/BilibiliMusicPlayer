import { expect, test, type Page } from "@playwright/test";
import type { AppData, Track } from "../../src/core/types";
import * as longList from "./helpers/long-list";
import { injectBuiltUserscript } from "../helpers/userscript";

/*
 * 歌曲常驻复选框 + 多选批量删除。
 *
 * 锁住的验收行为：
 *  1. 常态就有复选框（不需要先进「多选模式」），没选中时不显示批量操作栏；
 *  2. 点复选框只改选择状态——不播放、不触发排序；点歌名仍播放，编辑/单首删除不受影响；
 *  3. 全选 / 取消 / 已全选时「全选」禁用；
 *  4. 批量删除先弹确认，取消不改数据；确认后**只删当前歌单**里选中的那些，且只写一次存储；
 *  5. 删掉正在播放的歌曲时，页面视频继续播放（沿用单首删除的语义）；
 *  6. 重排后选中项按 `track.id` 跟着同一首歌；复选框不会启动长按拖动；
 *  7. 窄视口不横向溢出，批量操作栏不遮挡歌曲。
 */

const BATCH_URL = "https://www.bilibili.com/video/BV1BatchDelete/";
const DATA_KEY = "bilibili-music-player:data";
// 与 src/app/use-track-reorder.ts 的 REORDER_LONG_PRESS_MS 保持一致。
const LONG_PRESS_MS = 200;

const panel = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器", exact: true });
const rows = (page: Page) => panel(page).locator(".track-row");
const batchBar = (page: Page) => panel(page).locator(".batch-bar");

function createTrack(id: string, title: string, startTime: number): Track {
  return {
    id,
    bvid: "BV1BatchDelete",
    title,
    startTime,
    duration: 240,
    addedAt: 1,
    source: "manual",
  };
}

/** 两张歌单：A 是当前歌单（5 首），B 用于验证「别的歌单不受影响」。 */
function createBatchData(): AppData {
  return {
    version: 1,
    playlists: [
      {
        id: "playlist-a",
        name: "歌单 A",
        tracks: [
          createTrack("track-1", "第一首", 0),
          createTrack("track-2", "第二首", 30),
          createTrack("track-3", "第三首", 60),
          createTrack("track-4", "第四首", 90),
          createTrack("track-5", "第五首", 120),
        ],
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: "playlist-b",
        name: "歌单 B",
        tracks: [
          createTrack("track-b1", "别的歌单一", 0),
          createTrack("track-b2", "别的歌单二", 30),
        ],
        createdAt: 2,
        updatedAt: 2,
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

interface GmProbe {
  writes: string[];
}

/**
 * 装上 `GM_*` 替身，并记录每一次 `GM_setValue` 的目标键：
 * 「一次批量删除 = 一次存储更新」这条验收要求必须能数出写次数。
 */
async function installGm(page: Page, data: AppData): Promise<void> {
  await page.addInitScript(
    ({ storageKey, initial }) => {
      const prefix = "__bili_music__:";
      if (localStorage.getItem(`${prefix}${storageKey}`) === null) {
        localStorage.setItem(`${prefix}${storageKey}`, JSON.stringify(initial));
      }

      const probe = { writes: [] as string[] };
      (window as unknown as { __gmProbe__: typeof probe }).__gmProbe__ = probe;

      Object.assign(window, {
        GM_getValue(name: string, fallback?: unknown) {
          const raw = localStorage.getItem(`${prefix}${name}`);
          return raw === null ? fallback : JSON.parse(raw);
        },
        GM_setValue(name: string, value: unknown) {
          probe.writes.push(name);
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

async function openPanel(page: Page, data = createBatchData()): Promise<void> {
  await page.route(`${BATCH_URL}**`, async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html>
        <html>
          <head><title>批量删除测试_哔哩哔哩_bilibili</title></head>
          <body>
            <h1 class="video-title" title="批量删除测试">批量删除测试</h1>
            <a class="up-name">测试作者</a>
            <video></video>
          </body>
        </html>`,
    });
  });

  await installGm(page, data);
  await page.goto(BATCH_URL);
  await installMockMedia(page);
  await injectBuiltUserscript(page);
  await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
  await expect(rows(page).first()).toHaveAttribute(
    "data-track-id",
    data.playlists[0].tracks[0].id,
  );
}

function checkbox(page: Page, title: string) {
  return panel(page).getByRole("checkbox", { name: `选择 ${title}` });
}

async function readStoredTrackIds(page: Page, playlistIndex = 0) {
  return page.evaluate(
    ({ storageKey, index }) => {
      const raw = localStorage.getItem(`__bili_music__:${storageKey}`);
      return (JSON.parse(raw!) as AppData).playlists[index].tracks.map(
        (track) => track.id,
      );
    },
    { storageKey: DATA_KEY, index: playlistIndex },
  );
}

function readRenderedTrackIds(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((elements) =>
    elements.map((element) => element.dataset.trackId ?? ""),
  );
}

/** 选中行的 id（按 DOM 顺序），用来验证「选中项跟着同一首歌」。 */
function readSelectedTrackIds(page: Page): Promise<string[]> {
  return rows(page).evaluateAll((elements) =>
    elements
      .filter((element) => element.classList.contains("selected"))
      .map((element) => element.dataset.trackId ?? ""),
  );
}

async function gmWriteCount(page: Page, key = DATA_KEY): Promise<number> {
  return page.evaluate((storageKey) => {
    const probe = (window as unknown as { __gmProbe__: { writes: string[] } })
      .__gmProbe__;
    // `GM_setValue` 收到的是原始键名（`__bili_music__:` 前缀只存在于测试的 localStorage 替身里）。
    return probe.writes.filter((name) => name === storageKey).length;
  }, key);
}

async function confirmBatchDelete(page: Page): Promise<void> {
  await page
    .getByRole("dialog", { name: "批量删除歌曲" })
    .getByRole("button", { name: "确定" })
    .click();
}

test("shows a checkbox on every row and no batch bar before selecting", async ({
  page,
}) => {
  await openPanel(page);

  await expect(rows(page)).toHaveCount(5);
  await expect(panel(page).getByRole("checkbox")).toHaveCount(5);
  for (let index = 0; index < 5; index += 1) {
    const box = panel(page).getByRole("checkbox").nth(index);
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();
  }

  // 常态：没有批量操作栏，也没有「歌曲数量 / 选择歌曲」这类额外行。
  await expect(batchBar(page)).toHaveCount(0);
  await expect(panel(page).getByText("歌曲数量")).toHaveCount(0);
  await expect(panel(page).getByText("选择歌曲")).toHaveCount(0);
  await expect(panel(page).locator(".track-row.selected")).toHaveCount(0);
});

test("clicking a checkbox only toggles selection without playing or reordering", async ({
  page,
}) => {
  await openPanel(page);
  const before = await readRenderedTrackIds(page);

  await checkbox(page, "第二首").click();

  await expect(checkbox(page, "第二首")).toBeChecked();
  await expect(rows(page).nth(1)).toHaveClass(/selected/);
  await expect(batchBar(page)).toBeVisible();
  await expect(batchBar(page).locator(".batch-count")).toHaveText("已选 1 首");
  // 只改选择：没有播放，也没有排序。
  await expect(panel(page).locator(".track-row.active")).toHaveCount(0);
  await expect(
    panel(page).getByRole("button", { name: "播放", exact: true }),
  ).toBeVisible();
  expect(await readRenderedTrackIds(page)).toEqual(before);

  await checkbox(page, "第二首").click();
  await expect(checkbox(page, "第二首")).not.toBeChecked();
  await expect(rows(page).nth(1)).not.toHaveClass(/selected/);
  await expect(batchBar(page)).toHaveCount(0);
});

test("keeps play, edit and single delete working next to the checkbox", async ({
  page,
}) => {
  await openPanel(page);

  await rows(page).nth(1).locator(".track-main").click();
  await expect(rows(page).nth(1)).toHaveClass(/active/);
  await expect(
    panel(page).getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();

  await panel(page).getByRole("button", { name: "编辑 第三首" }).click();
  const editor = page.locator(".track-editor");
  await expect(editor.getByLabel("标题")).toHaveValue("第三首");
  await editor.getByRole("button", { name: "关闭编辑器" }).click();

  await panel(page).getByRole("button", { name: "删除 第四首" }).click();
  await expect(page.getByRole("dialog", { name: "删除歌曲" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "删除歌曲" })
    .getByRole("button", { name: "取消" })
    .click();
  await expect(page.getByRole("dialog", { name: "删除歌曲" })).toHaveCount(0);
  await expect(rows(page)).toHaveCount(5);
});

test("select all, clear, and disable select-all once everything is selected", async ({
  page,
}) => {
  await openPanel(page);

  await checkbox(page, "第一首").click();
  const selectAll = batchBar(page).getByRole("button", { name: "全选" });
  await expect(selectAll).toBeEnabled();

  await selectAll.click();
  await expect(batchBar(page).locator(".batch-count")).toHaveText("已选 5 首");
  await expect(panel(page).getByRole("checkbox")).toHaveCount(5);
  await expect(panel(page).locator(".track-row.selected")).toHaveCount(5);
  // 已全选：动作会变成空操作，因此必须禁用，含义才不含糊。
  await expect(selectAll).toBeDisabled();

  await batchBar(page).getByRole("button", { name: "取消" }).click();
  await expect(batchBar(page)).toHaveCount(0);
  await expect(panel(page).locator(".track-row.selected")).toHaveCount(0);
  await expect(panel(page).getByRole("checkbox").first()).not.toBeChecked();
});

test("cancelling the batch delete dialog changes nothing", async ({ page }) => {
  await openPanel(page);
  await checkbox(page, "第一首").click();
  await checkbox(page, "第三首").click();
  await expect(batchBar(page).locator(".batch-count")).toHaveText("已选 2 首");

  await batchBar(page).getByRole("button", { name: "删除" }).click();
  const dialog = page.getByRole("dialog", { name: "批量删除歌曲" });
  await expect(dialog).toBeVisible();
  // 文案必须带上当前歌单名与将删除的数量。
  await expect(
    dialog.getByText("确定删除“歌单 A”中的 2 首歌曲？"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "取消" }).click();
  await expect(dialog).toHaveCount(0);

  // 数据没动，选择也还在。
  expect(await readStoredTrackIds(page)).toEqual([
    "track-1",
    "track-2",
    "track-3",
    "track-4",
    "track-5",
  ]);
  await expect(rows(page)).toHaveCount(5);
  await expect(batchBar(page).locator(".batch-count")).toHaveText("已选 2 首");
});

test("batch delete removes only the selected tracks of the current playlist in one write", async ({
  page,
}) => {
  await openPanel(page);
  await checkbox(page, "第一首").click();
  await checkbox(page, "第三首").click();

  const writesBefore = await gmWriteCount(page);
  await batchBar(page).getByRole("button", { name: "删除" }).click();
  await confirmBatchDelete(page);

  await expect(rows(page)).toHaveCount(3);
  expect(await readStoredTrackIds(page)).toEqual([
    "track-2",
    "track-4",
    "track-5",
  ]);
  // 别的歌单完全不受影响。
  expect(await readStoredTrackIds(page, 1)).toEqual(["track-b1", "track-b2"]);
  // 一次批量删除只写一次歌单库。
  expect((await gmWriteCount(page)) - writesBefore).toBe(1);

  // 删除后清理选择，操作栏随之消失。
  await expect(batchBar(page)).toHaveCount(0);
  await expect(panel(page).locator(".track-row.selected")).toHaveCount(0);
  await expect(panel(page).getByRole("checkbox").first()).not.toBeChecked();
});

test("deleting the playing track keeps the video playing", async ({ page }) => {
  await openPanel(page);

  // 播放第二首（同一个 BV，因此停留在本页）。
  await rows(page).nth(1).locator(".track-main").click();
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "第二首",
  );

  await checkbox(page, "第二首").click();
  await checkbox(page, "第五首").click();
  await batchBar(page).getByRole("button", { name: "删除" }).click();
  await confirmBatchDelete(page);

  // 页面视频没有被暂停，只是退出了歌单播放上下文。
  await expect
    .poll(() =>
      page
        .locator("video")
        .evaluate((media) => (media as HTMLVideoElement).paused),
    )
    .toBe(false);
  await expect(panel(page).locator(".playlist-context-chip")).toHaveCount(0);
  expect(await readStoredTrackIds(page)).toEqual([
    "track-1",
    "track-3",
    "track-4",
  ]);
  expect(await readStoredTrackIds(page, 1)).toEqual(["track-b1", "track-b2"]);
  await expect(rows(page)).toHaveCount(3);
});

test("keeps the same songs selected after a drag reorder", async ({ page }) => {
  await openPanel(page);

  await checkbox(page, "第一首").click();
  await expect.poll(() => readSelectedTrackIds(page)).toEqual(["track-1"]);

  // 长按拖动把第一首拖到末尾：选中项必须跟着同一首歌（按 id），而不是原来的下标。
  const firstRow = rows(page).nth(0);
  const box = (await firstRow.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(firstRow).toHaveClass(/reorder-source/, { timeout: 3_000 });
  const lastBox = (await rows(page).nth(4).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, lastBox.y + lastBox.height - 4);
  await page.mouse.up();

  await expect
    .poll(() => readStoredTrackIds(page))
    .toEqual(["track-2", "track-3", "track-4", "track-5", "track-1"]);
  expect(await readRenderedTrackIds(page)).toEqual([
    "track-2",
    "track-3",
    "track-4",
    "track-5",
    "track-1",
  ]);
  // 选中的还是 track-1，现在它在最后一行；勾选框也跟着过去。
  expect(await readSelectedTrackIds(page)).toEqual(["track-1"]);
  await expect(rows(page).nth(4)).toHaveClass(/selected/);
  await expect(checkbox(page, "第一首")).toBeChecked();
  await expect(batchBar(page).locator(".batch-count")).toHaveText("已选 1 首");
});

test("the checkbox never starts a drag while the row body still reorders", async ({
  page,
}) => {
  await openPanel(page);
  const before = await readRenderedTrackIds(page);

  // 在复选框上按下并超过长按时长：不得进入拖动。
  const checkboxBox = (await checkbox(page, "第一首").boundingBox())!;
  await panel(page)
    .getByRole("checkbox", { name: "选择 第一首" })
    .dispatchEvent("pointerdown", {
      pointerId: 11,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: checkboxBox.x + checkboxBox.width / 2,
      clientY: checkboxBox.y + checkboxBox.height / 2,
    });
  await page.waitForTimeout(LONG_PRESS_MS + 200);
  await expect(rows(page).nth(0)).not.toHaveClass(/reorder-source/);
  await panel(page)
    .getByRole("checkbox", { name: "选择 第一首" })
    .dispatchEvent("pointerup", {
      pointerId: 11,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: checkboxBox.x + checkboxBox.width / 2,
      clientY: checkboxBox.y + checkboxBox.height / 2,
    });
  expect(await readRenderedTrackIds(page)).toEqual(before);

  // 同一个列表里，按住歌曲主体长按仍然能排序。
  const row = rows(page).nth(0);
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(row).toHaveClass(/reorder-source/, { timeout: 3_000 });
  const target = (await rows(page).nth(1).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, target.y + target.height - 4);
  await page.mouse.up();

  await expect
    .poll(() => readStoredTrackIds(page))
    .toEqual(["track-2", "track-1", "track-3", "track-4", "track-5"]);
});

test("keeps the batch bar inside a narrow viewport without covering rows", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPanel(page);

  await checkbox(page, "第一首").click();
  await batchBar(page).getByRole("button", { name: "全选" }).click();
  await expect(batchBar(page).locator(".batch-count")).toHaveText("已选 5 首");

  const metrics = await panel(page).evaluate((element) => {
    const panelBox = element.getBoundingClientRect();
    const list = element.querySelector<HTMLElement>(".track-list")!;
    const bar = element.querySelector<HTMLElement>(".batch-bar")!;
    const listBox = list.getBoundingClientRect();
    const barBox = bar.getBoundingClientRect();
    const rowMetrics = Array.from(
      element.querySelectorAll<HTMLElement>(".track-row"),
    ).map((row) => ({
      scrollWidth: row.scrollWidth,
      clientWidth: row.clientWidth,
      cells: Array.from(
        row.querySelectorAll<HTMLElement>(
          ".row-select, .track-main, .row-action",
        ),
      ).map((cell) => {
        const cellBox = cell.getBoundingClientRect();
        return { left: cellBox.left, right: cellBox.right };
      }),
    }));

    return {
      panelScrollWidth: element.scrollWidth,
      panelClientWidth: element.clientWidth,
      listScrollWidth: list.scrollWidth,
      listClientWidth: list.clientWidth,
      barLeft: barBox.left,
      barRight: barBox.right,
      barTop: barBox.top,
      barBottom: barBox.bottom,
      panelLeft: panelBox.left,
      panelRight: panelBox.right,
      panelBottom: panelBox.bottom,
      listBottom: listBox.bottom,
      barButtons: Array.from(bar.querySelectorAll("button")).map((button) => {
        const buttonBox = button.getBoundingClientRect();
        return {
          left: buttonBox.left,
          right: buttonBox.right,
          label: button.textContent?.trim() ?? "",
        };
      }),
      rowMetrics,
    };
  });

  // 无横向溢出：面板、列表、每一行都不超出自身宽度。
  expect(metrics.panelScrollWidth).toBeLessThanOrEqual(
    metrics.panelClientWidth + 1,
  );
  expect(metrics.listScrollWidth).toBeLessThanOrEqual(
    metrics.listClientWidth + 1,
  );
  for (const row of metrics.rowMetrics) {
    expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth + 1);
    // 行内三段（复选框 / 歌曲主体 / 操作按钮）依次排列且不重叠。
    for (let index = 1; index < row.cells.length; index += 1) {
      expect(row.cells[index].left).toBeGreaterThanOrEqual(
        row.cells[index - 1].right - 0.5,
      );
    }
  }

  // 操作栏是列表的下一个兄弟：从列表底边之下开始，且在面板内。
  expect(metrics.barTop).toBeGreaterThanOrEqual(metrics.listBottom - 0.5);
  expect(metrics.barBottom).toBeLessThanOrEqual(metrics.panelBottom + 0.5);
  expect(metrics.barLeft).toBeGreaterThanOrEqual(metrics.panelLeft - 0.5);
  expect(metrics.barRight).toBeLessThanOrEqual(metrics.panelRight + 0.5);
  for (const button of metrics.barButtons) {
    expect(button.right).toBeLessThanOrEqual(metrics.panelRight + 0.5);
  }

  // 窄视口下操作仍然可触达。
  await batchBar(page).getByRole("button", { name: "删除" }).click();
  await expect(
    page.getByRole("dialog", { name: "批量删除歌曲" }),
  ).toBeVisible();
  await page
    .getByRole("dialog", { name: "批量删除歌曲" })
    .getByRole("button", { name: "取消" })
    .click();
});

test("selecting across a long scrolled playlist deletes exactly those tracks", async ({
  page,
}) => {
  // 复用长列表夹具：14 首，列表真的溢出，需要滚动才能看到后面的行。
  await longList.openLongListPage(page);
  const first = panel(page).getByRole("checkbox", { name: "选择 歌曲 01" });
  await first.click();
  await panel(page)
    .getByRole("checkbox", { name: "选择 歌曲 14" })
    .scrollIntoViewIfNeeded();
  await panel(page).getByRole("checkbox", { name: "选择 歌曲 14" }).click();
  await expect(batchBar(page).locator(".batch-count")).toHaveText("已选 2 首");

  await batchBar(page).getByRole("button", { name: "删除" }).click();
  await page
    .getByRole("dialog", { name: "批量删除歌曲" })
    .getByRole("button", { name: "确定" })
    .click();

  await expect(rows(page)).toHaveCount(12);
  const remaining = await readStoredTrackIds(page);
  expect(remaining).not.toContain("track-1");
  expect(remaining).not.toContain("track-14");
  expect(remaining[0]).toBe("track-2");
  await expect(batchBar(page)).toHaveCount(0);
});
