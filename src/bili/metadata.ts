import type { Track } from "../core/types";
import { createId } from "../core/id";

export interface CurrentVideoMetadata {
  bvid: string;
  page?: number;
  title: string;
  uploader?: string;
  cover?: string;
}

export function getBvid(url = location.href): string | undefined {
  return new URL(url).pathname.match(/\/video\/(BV[\w]+)/i)?.[1];
}

export function getPageNumber(url = location.href): number | undefined {
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

  const titleElement = readFirstElement(TITLE_SELECTORS);
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
