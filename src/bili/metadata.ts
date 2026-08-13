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

export function readCurrentVideoMetadata(): CurrentVideoMetadata | undefined {
  const bvid = getBvid();
  if (!bvid) {
    return undefined;
  }

  const titleElement = document.querySelector<HTMLElement>(
    "h1.video-title, h1[title], .video-title",
  );
  const rawTitle =
    titleElement?.getAttribute("title") ??
    titleElement?.textContent ??
    document
      .querySelector<HTMLMetaElement>('meta[property="og:title"]')
      ?.getAttribute("content") ??
    document.title;

  const uploader =
    document
      .querySelector<HTMLElement>(
        ".up-name, .up-info-container .username, a.up-name, .members-info .staff-name",
      )
      ?.textContent?.trim() || undefined;

  const cover =
    document
      .querySelector<HTMLMetaElement>('meta[property="og:image"]')
      ?.getAttribute("content") || undefined;

  return {
    bvid,
    page: getPageNumber(),
    title: cleanPageTitle(rawTitle),
    uploader,
    cover,
  };
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
    ...(cid === undefined ? {} : { cid }),
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
