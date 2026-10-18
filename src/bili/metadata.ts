import type { Track } from "../core/types";
import { createId } from "../core/id";
import { getPageRoute, isFestivalPage, isValidBvidQuery } from "./page-route";

export interface CurrentVideoMetadata {
  bvid: string;
  page?: number;
  title: string;
  uploader?: string;
  cover?: string;
}

const VIDEO_PATH_BVID = /\/video\/(BV[\w]+)/i;

/**
 * 解析当前页面对应的 BV 号。
 *
 * - 视频页：取路径里的 `/video/BV…`（保持既有行为）。
 * - 列表播放页（`www.bilibili.com/list/ml…`）与专题页（`www.bilibili.com/festival/…`）：
 *   当前视频由查询串的 `bvid` 指定，路径里没有 BV；参数缺失或格式非法时安全返回 `undefined`
 *   （专题页的 `spm_id_from`、`oid` 等参数都不是 BV 号）。
 * - 其它页面：返回 `undefined`。
 */
export function getBvid(url = location.href): string | undefined {
  const parsed = new URL(url);
  const fromPath = parsed.pathname.match(VIDEO_PATH_BVID)?.[1];
  if (fromPath) {
    return fromPath;
  }

  // 只有路由认可的播放页才读查询串，避免在任意页面上把 `?bvid=` 当成视频。
  const route = getPageRoute(url);
  if (route !== "playlist" && route !== "festival") {
    return undefined;
  }

  const fromQuery = parsed.searchParams.get("bvid")?.trim();
  return fromQuery && isValidBvidQuery(fromQuery) ? fromQuery : undefined;
}

/**
 * 当前分 P。
 *
 * 专题页刻意忽略 `?p=`：B 站的活动页是「一个 bvid 一个视频」，播放哪个 cid 由活动配置决定，
 * 查询串里的 `p` 既不被播放器采用，也不一定反映正在播放的分 P。若拿它当分 P，
 * 从 `/video/BV…?p=2` 重定向过来时会把整段视频当成第 2 分 P，续播就会跳到错误的位置。
 * 因此专题页一律按第 1 分 P 处理（与 `isCurrentPage()` 的 `page ?? 1` 对齐）。
 */
export function getPageNumber(url = location.href): number | undefined {
  if (isFestivalPage(url)) {
    return undefined;
  }

  const page = Number(new URL(url).searchParams.get("p"));
  return Number.isInteger(page) && page > 1 ? page : undefined;
}

const TITLE_SELECTORS = [
  "#viewbox_report h1.video-title",
  "#viewbox_report h1[title]",
  ".video-info-detail h1.video-title",
  ".video-info-detail h1[title]",
  "h1.video-title",
  "h1[title]",
  ".video-title",
] as const;

/**
 * 专题页（拜年纪等活动页）没有 `og:title`、也没有 `h1.video-title`：
 * 当前视频标题只出现在播放器下方工具条里（B 站自己的类名就是 `video-toobar_title`，拼写如此）。
 * 不读它的话，标题会退化到 `document.title`，也就是活动名而不是视频名。
 */
const FESTIVAL_TITLE_SELECTORS = [
  "#videoToolbar .video-toobar_title",
  "#videoToolbar .video-toolbar-title",
  ".video-toobar_title",
] as const;

const UPLOADER_SELECTORS = [
  ".up-name",
  ".up-info-container .username",
  "a.up-name",
  ".members-info .staff-name",
] as const;

export function readCurrentVideoMetadata(): CurrentVideoMetadata | undefined {
  const bvid = getBvid();
  if (!bvid) {
    return undefined;
  }

  // 专题页的标题只在播放器工具条里，必须先于通用的 h1/og:title 兜底去读。
  const titleSelectors: readonly string[] = isFestivalPage()
    ? [...FESTIVAL_TITLE_SELECTORS, ...TITLE_SELECTORS]
    : TITLE_SELECTORS;

  const titleElement = readFirstElement(titleSelectors);
  const rawTitle =
    readText(titleElement?.getAttribute("title")) ??
    readText(titleElement?.textContent) ??
    readText(
      document
        .querySelector<HTMLMetaElement>('meta[property="og:title"]')
        ?.getAttribute("content"),
    ) ??
    document.title;

  const uploader = readText(readFirstElement(UPLOADER_SELECTORS)?.textContent);

  const cover = readShareCover() ?? readMetaCover() ?? readVideoPoster();

  return {
    bvid,
    page: getPageNumber(),
    title: cleanPageTitle(rawTitle),
    uploader,
    cover,
  };
}

/**
 * 按选择器优先级取第一个有内容的节点，并优先可见节点：B 站同文档跳转期间
 * 可能同时存在隐藏的旧标题或同名的推荐卡片标题，按文档顺序取首个会读到错的那一个。
 */
function readFirstElement(
  selectors: readonly string[],
): HTMLElement | undefined {
  for (const selector of selectors) {
    const candidates = [
      ...document.querySelectorAll<HTMLElement>(selector),
    ].filter(
      (element) =>
        readText(element.textContent) !== undefined ||
        readText(element.getAttribute("title")) !== undefined,
    );

    const element = candidates.find(isRendered) ?? candidates[0];
    if (element) {
      return element;
    }
  }

  return undefined;
}

function isRendered(element: HTMLElement): boolean {
  return (
    element.isConnected &&
    (element.offsetParent !== null || element.getClientRects().length > 0)
  );
}

/**
 * B 站分享卡片里的封面由客户端按当前视频渲染，且浏览器已经为页面加载过这张图，
 * 因此它既比首屏 SSR 的 `og:image` 更跟得上同文档切歌，也不产生额外请求。
 */
function readShareCover(): string | undefined {
  const candidates = [
    ...document.querySelectorAll<HTMLImageElement>(
      'img[src*="!web-video-share-cover"]',
    ),
  ].filter((image) => readText(image.currentSrc || image.src) !== undefined);

  const image = candidates.find(isRendered) ?? candidates[0];
  return readText(image?.currentSrc || image?.src);
}

function readMetaCover(): string | undefined {
  return readText(
    document
      .querySelector<HTMLMetaElement>('meta[property="og:image"]')
      ?.getAttribute("content"),
  );
}

/** 页面上没有其它封面来源时，退回播放器自身的海报图。 */
function readVideoPoster(): string | undefined {
  for (const video of document.querySelectorAll<HTMLVideoElement>("video")) {
    const poster = readText(video.poster);
    if (poster) {
      return poster;
    }
  }

  return undefined;
}

function readText(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

export function createTrackFromCurrentPage(
  media: HTMLMediaElement,
  title: string,
  startTime: number,
  endTime?: number,
  cid?: number,
): Track | undefined {
  const metadata = readCurrentVideoMetadata();
  if (!metadata) {
    return undefined;
  }

  return {
    id: createId("track"),
    ...metadata,
    ...(cid !== undefined ? { cid } : {}),
    title: title.trim() || metadata.title,
    startTime,
    endTime,
    duration: Number.isFinite(media.duration) ? media.duration : 0,
    addedAt: Date.now(),
    source: "manual",
  };
}

function cleanPageTitle(title: string): string {
  return title
    .replace(/_哔哩哔哩_bilibili$/i, "")
    .replace(/\s*-\s*哔哩哔哩.*$/i, "")
    .trim();
}
