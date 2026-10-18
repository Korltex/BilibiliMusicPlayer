import { expect, test, type Page } from "@playwright/test";
import type { AppData, PlaybackSession } from "../../src/core/types";
import { injectBuiltUserscript } from "../helpers/userscript";

/*
 * 专题/活动页（拜年纪等）的播放支持。
 *
 * 现场取证（真实站点，2026-10）：
 *  - `https://www.bilibili.com/video/BV1wzaE63EEw/` 会被 B 站**客户端重定向**到
 *    `https://www.bilibili.com/festival/ournotesBonly?bvid=BV1wzaE63EEw`；
 *  - 专题页把播放器内联渲染在 `#bilibili-player`（light DOM，没有 iframe、没有 shadow root），
 *    视频是普通 `<video>`，`ended` 事件正常触发且 B 站自己不会自动播下一集；
 *  - 当前视频标题在 `#videoToolbar .video-toobar_title`（页面没有 og:title / h1.video-title）；
 *  - `bili_music=1`、`p=2` 这类未知查询参数会被 B 站转发到专题页，但不保证永远如此。
 *
 * 因此这里既锁「专题页能挂载 + 能识别身份」，也锁「跳转后不丢歌单播放上下文、
 * 播完自动进下一首」——后者才是这次修复的核心验收。
 */

const FESTIVAL_BVID = "BV1wzaE63EEw";
const FESTIVAL_SLUG = "ournotesBonly";
const FESTIVAL_URL = `https://www.bilibili.com/festival/${FESTIVAL_SLUG}?bvid=${FESTIVAL_BVID}&spm_id_from=333.1387.homepage.video_card.click`;
const FESTIVAL_ACTIVITY_TITLE = "OurNotes 创作接力";
const FESTIVAL_VIDEO_TITLE = "专题页当前视频";
const SECOND_FESTIVAL_BVID = "BV1tsfpYwEt2";
const NEXT_BVID = "BV1FestivalNext";
const NEXT_TRACK_TITLE = "歌单下一首";
const SECOND_SLUG = "bnj2025";

const HOST_SELECTOR = "#bilibili-music-player-host";
const DATA_KEY = "bilibili-music-player:data";
const SESSION_KEY = "bilibili-music-player:playback-session";

const panel = (page: Page) =>
  page.getByRole("region", { name: "Bilibili 音乐播放器", exact: true });
const launcher = (page: Page) =>
  page.getByRole("button", { name: "打开 Bilibili 音乐播放器" });

/** 模拟真实专题页的 DOM：内联播放器 + 播放器工具条里的当前视频标题。 */
function festivalHtml(currentVideoTitle = FESTIVAL_VIDEO_TITLE): string {
  return `
    <!doctype html>
    <html>
      <head><title>${FESTIVAL_ACTIVITY_TITLE}</title></head>
      <body>
        <div class="grid-box">
          <div class="grid-left">
            <div class="festival-video-player">
              <div id="bilibili-player"></div>
            </div>
            <div id="videoToolbar" class="video-toolbar">
              <div class="video-toobar_title">${currentVideoTitle}</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;
}

async function installLocalStorageGm(
  page: Page,
  data?: AppData,
): Promise<void> {
  await page.addInitScript(
    ({ storageKey, initial }) => {
      const storagePrefix = "__bili_music__:";
      // `addInitScript` 会在每次导航后重跑：已有歌单库时不要覆盖，
      // 否则「切到下一首后写进存储的会话/数据」会被测试夹具重置，测不出真实结果。
      if (
        initial &&
        localStorage.getItem(`${storagePrefix}${storageKey}`) === null
      ) {
        localStorage.setItem(
          `${storagePrefix}${storageKey}`,
          JSON.stringify(initial),
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
    { storageKey: DATA_KEY, initial: data },
  );
}

/**
 * 歌单会话是**按标签页**存在 sessionStorage 里的，跨页跳转不会丢。
 * `resumeRequested: true` 就是「上一个页面要求本页恢复这首歌」的既有续播状态。
 */
async function installPlaybackSession(
  page: Page,
  session: PlaybackSession,
): Promise<void> {
  await page.addInitScript(
    ({ storageKey, value }) => {
      // 同上：导航后重跑时不要覆盖插件已经写好的会话，
      // 否则「播完切下一首」写进去的 trackId 会被夹具覆盖回旧值。
      if (sessionStorage.getItem(storageKey) === null) {
        sessionStorage.setItem(storageKey, JSON.stringify(value));
      }
    },
    { storageKey: SESSION_KEY, value: session },
  );
}

/** 两张歌单曲目：专题页那一首 + 播完后应该自动切到的下一首（在别的 BV 上）。 */
function createFestivalData(): AppData {
  const now = 1;
  return {
    version: 1,
    playlists: [
      {
        id: "playlist-festival",
        name: "拜年纪歌单",
        tracks: [
          {
            id: "track-festival",
            bvid: FESTIVAL_BVID,
            title: "专题页歌单曲目",
            uploader: "歌单作者",
            startTime: 30,
            endTime: 120,
            duration: 300,
            addedAt: now,
            source: "manual",
          },
          {
            id: "track-next",
            bvid: NEXT_BVID,
            title: NEXT_TRACK_TITLE,
            uploader: "下一首作者",
            startTime: 0,
            duration: 300,
            addedAt: now + 1,
            source: "manual",
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    ],
    activePlaylistId: "playlist-festival",
    playMode: "list-loop",
    volume: 1,
    playback: {
      playlistId: "playlist-festival",
      trackId: "track-festival",
      currentTime: 0,
      resumeRequested: true,
      updatedAt: now,
    },
  };
}

function createFestivalSession(resumeRequested = true): PlaybackSession {
  return {
    activePlaylistId: "playlist-festival",
    playMode: "list-loop",
    playback: {
      playlistId: "playlist-festival",
      trackId: "track-festival",
      currentTime: 0,
      resumeRequested,
      updatedAt: 1,
    },
  };
}

/** 专题页的播放器是客户端渲染的：初始 HTML 里没有 <video>，媒体稍后才出现。 */
async function appendMockMedia(page: Page, duration = 300): Promise<void> {
  await page.evaluate((mediaDuration) => {
    const media = document.createElement("video");
    let paused = true;
    let currentTime = 0;
    let volume = 1;
    let muted = false;

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
      volume: {
        configurable: true,
        get: () => volume,
        set: (value: number) => {
          volume = value;
          media.dispatchEvent(new Event("volumechange"));
        },
      },
      muted: {
        configurable: true,
        get: () => muted,
        set: (value: boolean) => {
          muted = value;
          media.dispatchEvent(new Event("volumechange"));
        },
      },
    });

    media.play = async () => {
      paused = false;
      media.dispatchEvent(new Event("play"));
    };
    media.pause = () => {
      paused = true;
      media.dispatchEvent(new Event("pause"));
    };

    document.querySelector("#bilibili-player")?.append(media);
  }, duration);
}

async function routeFestivalPages(page: Page): Promise<void> {
  await page.route("https://www.bilibili.com/festival/**", async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: festivalHtml(),
    });
  });
}

async function openPanel(page: Page): Promise<void> {
  await launcher(page).click();
  await expect(panel(page)).toBeVisible();
}

async function readPlaybackSession(page: Page): Promise<PlaybackSession> {
  return page.evaluate((storageKey) => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) {
      throw new Error("播放会话不存在");
    }
    return JSON.parse(raw) as PlaybackSession;
  }, SESSION_KEY);
}

test("mounts on a festival page that carries a valid bvid", async ({
  page,
}) => {
  await routeFestivalPages(page);
  await installLocalStorageGm(page);
  await page.goto(FESTIVAL_URL);
  await injectBuiltUserscript(page);

  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
  await expect(launcher(page)).toBeVisible();

  // 悬浮按钮在专题页必须打开播放器面板，而不是误走「批量导入」分支。
  await openPanel(page);
  await expect(page.getByRole("dialog", { name: "批量导入" })).toHaveCount(0);
});

test("stays inert on festival pages without a valid bvid", async ({ page }) => {
  await routeFestivalPages(page);
  await installLocalStorageGm(page);

  for (const url of [
    `https://www.bilibili.com/festival/${FESTIVAL_SLUG}`,
    `https://www.bilibili.com/festival/${FESTIVAL_SLUG}?bvid=`,
    `https://www.bilibili.com/festival/${FESTIVAL_SLUG}?bvid=not-a-bv`,
    `https://www.bilibili.com/festival/${FESTIVAL_SLUG}?oid=775106615`,
  ]) {
    await page.goto(url);
    await injectBuiltUserscript(page);
    await page.waitForTimeout(350);

    await expect(
      page.locator(HOST_SELECTOR),
      `should stay inert: ${url}`,
    ).toHaveCount(0);
    await expect(launcher(page), `should not mount: ${url}`).toHaveCount(0);
  }
});

test("reads the current festival video identity and title", async ({
  page,
}) => {
  await routeFestivalPages(page);
  await installLocalStorageGm(page);
  await page.goto(FESTIVAL_URL);
  await appendMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  // 标题取播放器工具条里的当前视频，而不是页面的活动名（document.title）。
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    FESTIVAL_VIDEO_TITLE,
  );
  await expect(panel(page).locator(".now-playing-copy strong")).not.toHaveText(
    FESTIVAL_ACTIVITY_TITLE,
  );

  const url = new URL(page.url());
  expect(url.pathname).toBe(`/festival/${FESTIVAL_SLUG}`);
  expect(url.searchParams.get("bvid")).toBe(FESTIVAL_BVID);
});

test("restores playlist playback after the /video → /festival redirect", async ({
  page,
}) => {
  // B 站把 /video/BV…?bili_music=1 重定向成 /festival/…?bvid=… 时参数不保证保留，
  // 所以这里**刻意**给一个没有 bili_music 的专题页 URL：续播必须靠会话里的
  // 「待恢复请求」+ bvid 匹配恢复，并且把标记补回 URL。
  await routeFestivalPages(page);
  await installLocalStorageGm(page, createFestivalData());
  await installPlaybackSession(page, createFestivalSession());
  await page.goto(
    `https://www.bilibili.com/festival/${FESTIVAL_SLUG}?bvid=${FESTIVAL_BVID}`,
  );
  await appendMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  // 歌单上下文恢复：条目、上下文标签、行内高亮、播放位置全都对得上。
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "专题页歌单曲目",
  );
  await expect(panel(page).locator(".playlist-context-chip")).toBeVisible();
  await expect(panel(page).locator(".track-row.active")).toContainText(
    "专题页歌单曲目",
  );
  await expect
    .poll(() =>
      page
        .locator("#bilibili-player video")
        .evaluate((media) => (media as HTMLVideoElement).currentTime),
    )
    .toBe(30);
  await expect
    .poll(() =>
      page
        .locator("#bilibili-player video")
        .evaluate((media) => (media as HTMLVideoElement).paused),
    )
    .toBe(false);

  // 标记被补回 URL：刷新或下一次跳转后仍能识别为歌单播放。
  await expect
    .poll(() => new URL(page.url()).searchParams.get("bili_music"))
    .toBe("1");
  expect(new URL(page.url()).searchParams.get("bvid")).toBe(FESTIVAL_BVID);
});

test("plays the next playlist track when the festival video ends", async ({
  page,
}) => {
  await routeFestivalPages(page);
  await page.route(
    `https://www.bilibili.com/video/${NEXT_BVID}/**`,
    async (route) => {
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><head><title>${NEXT_TRACK_TITLE}</title></head><body><video></video></body></html>`,
      });
    },
  );
  await installLocalStorageGm(page, createFestivalData());
  await installPlaybackSession(page, createFestivalSession());
  await page.goto(
    `https://www.bilibili.com/festival/${FESTIVAL_SLUG}?bvid=${FESTIVAL_BVID}`,
  );
  await appendMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);

  // 前置条件：确实处于歌单播放上下文，否则「播完自动下一首」无从谈起。
  await expect(panel(page).locator(".playlist-context-chip")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator("#bilibili-player video")
        .evaluate((media) => (media as HTMLVideoElement).currentTime),
    )
    .toBe(30);

  // 媒体播完：引擎必须按歌单顺序切到下一首（跨 BV，因此是一次真实导航）。
  await page
    .locator("#bilibili-player video")
    .evaluate((media) => media.dispatchEvent(new Event("ended")));

  await page.waitForURL(`**/video/${NEXT_BVID}/**`, { timeout: 10_000 });
  const url = new URL(page.url());
  expect(url.pathname).toBe(`/video/${NEXT_BVID}/`);
  // 导航目标必须带上标记，否则下一张页面无法恢复歌单播放。
  expect(url.searchParams.get("bili_music")).toBe("1");

  const session = await readPlaybackSession(page);
  expect(session.playback.trackId).toBe("track-next");
  expect(session.playback.resumeRequested).toBe(true);
});

test("keeps playlist playback when B站 swaps the festival bvid in-place", async ({
  page,
}) => {
  await routeFestivalPages(page);
  await installLocalStorageGm(page, createFestivalData());
  await installPlaybackSession(page, createFestivalSession());
  await page.goto(
    `https://www.bilibili.com/festival/${FESTIVAL_SLUG}?bvid=${FESTIVAL_BVID}`,
  );
  await appendMockMedia(page);
  await injectBuiltUserscript(page);
  await openPanel(page);
  await expect(panel(page).locator(".playlist-context-chip")).toBeVisible();

  // 同文档换视频：B 站先改 URL，随后才更新工具条标题（真实专题页是这种顺序）。
  await page.evaluate((bvid) => {
    history.replaceState({}, "", `/festival/${"bnj2025"}?bvid=${bvid}`);
  }, SECOND_FESTIVAL_BVID);
  await page.evaluate((title) => {
    document.querySelector(".video-toobar_title")!.textContent = title;
    document.title = title;
  }, "专题页切换后的视频");

  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "专题页切换后的视频",
  );
  // 新 BV 不属于当前歌单曲目 → 上下文退回普通页面播放，但 UI 仍然只有一份。
  await expect(panel(page).locator(".playlist-context-chip")).toHaveCount(0);
  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
});

test("keeps playlist playback when the same-document route becomes a festival page", async ({
  page,
}) => {
  // 覆盖「/video/BV…?bili_music=1 → SPA 改成 /festival/…?bvid=…」这条路径：
  // 标记可能被 B 站改 URL 时丢掉，上下文必须靠已生效的歌单播放状态延续。
  const videoUrl = `https://www.bilibili.com/video/${FESTIVAL_BVID}/?bili_music=1`;
  await page.route(
    `https://www.bilibili.com/video/${FESTIVAL_BVID}/**`,
    async (route) => {
      await route.fulfill({
        contentType: "text/html; charset=utf-8",
        body: `<!doctype html><html><head><title>${FESTIVAL_VIDEO_TITLE}</title></head>
        <body><h1 class="video-title" title="${FESTIVAL_VIDEO_TITLE}">${FESTIVAL_VIDEO_TITLE}</h1><video></video></body></html>`,
      });
    },
  );
  await routeFestivalPages(page);
  await installLocalStorageGm(page, createFestivalData());
  await installPlaybackSession(page, createFestivalSession());
  await page.goto(videoUrl);
  await injectBuiltUserscript(page);
  await openPanel(page);

  await expect(panel(page).locator(".playlist-context-chip")).toBeVisible();

  // 同文档切到专题页（B 站重定向的 SPA 形态）：路径、标题与媒体身份都变了。
  await page.evaluate(
    ({ slug, bvid }) => {
      history.replaceState({}, "", `/festival/${slug}?bvid=${bvid}`);
      document.title = "OurNotes 创作接力";
    },
    { slug: SECOND_SLUG, bvid: FESTIVAL_BVID },
  );

  await expect
    .poll(() => new URL(page.url()).searchParams.get("bili_music"))
    .toBe("1");
  await expect
    .poll(() => panel(page).locator(".playlist-context-chip").count())
    .toBe(1);
  await expect(panel(page).locator(".now-playing-copy strong")).toHaveText(
    "专题页歌单曲目",
  );
  await expect(page.locator(HOST_SELECTOR)).toHaveCount(1);
});
