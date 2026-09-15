import type { Track } from "../core/types";
import { asNetworkError, readRecord } from "./http";

/*
 * 视频入口适配层：
 *  1. 用 `/x/web-interface/view` 嗅探视频是否属于「视频合集」(ugc_season)；
 *  2. 把「列表里的一个视频」展开成一条或多条 `Track`（多P 拆分为独立曲目）。
 *
 * 注意：view 响应里内联的 `ugc_season.sections[].episodes[]` **不保证是全集**
 * （实测某合集 ep_count=778，内联只带回 66 条）。所以只用它拿 `season_id`，
 * 全集仍然交给 `bilibili-season.ts` 的分页接口去拉。
 */

export interface VideoPart {
  cid: number;
  page: number;
  title: string;
  duration: number;
}

export interface VideoDetail {
  bvid: string;
  title: string;
  cover?: string;
  duration: number;
  ownerName?: string;
  ownerMid?: string;
  /** 视频自身的分P列表（单P视频长度为 1）。 */
  pages: VideoPart[];
  /** 所属合集 id（`ugc_season.id`，退回顶层 `season_id`）。 */
  seasonId?: string;
  seasonTitle?: string;
  seasonOwnerMid?: string;
}

export interface FetchVideoOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

/** 列表级元数据：单P视频直接用它，不额外请求。 */
export interface TrackPartsInput {
  bvid: string;
  title: string;
  cover?: string;
  uploader?: string;
  /** 列表给的时长；单P 视频即整稿时长。 */
  duration: number;
}

const VIEW_URL = "https://api.bilibili.com/x/web-interface/view";

/** 视频入口的曲目 id 前缀：曲目 id 形如 `video-<bvid>-p<分P>`。 */
export const VIDEO_TRACK_PREFIX = "video";

export function videoPlaylistId(bvid: string): string {
  return `video-${bvid}`;
}

/**
 * 同一歌单内唯一的曲目 id：`<前缀>-<bvid>-p<分P序号>`。
 * 分P序号在 `pages[]` 里必然存在（缺失时由下标补），因此不会重复。
 */
export function trackIdFor(
  idPrefix: string,
  bvid: string,
  page: number,
): string {
  return `${idPrefix}-${bvid}-p${page}`;
}

/**
 * 把「列表里的一个视频」展开为 `Track`：
 * - `parts.length > 1`（多P）：**按分P 拆分**，每条用自己的 cid / page / 时长，
 *   标题按决议拼接为 `原视频标题 [P1] 分P标题`；
 * - 否则（单P）：直接使用列表元数据，不发起额外请求，`duration` 用整稿时长。
 */
export function buildEntryTracks(
  idPrefix: string,
  entry: TrackPartsInput,
  parts: VideoPart[],
  source: Track["source"],
  now = Date.now(),
): Track[] {
  if (!entry.bvid.trim()) {
    return [];
  }

  if (parts.length > 1) {
    return parts.flatMap((part) =>
      buildTrack(idPrefix, entry, source, now, {
        page: part.page,
        cid: part.cid,
        title: readSplitTitle(entry.title, part),
        duration: part.duration > 0 ? part.duration : entry.duration,
      }),
    );
  }

  const part = parts[0];
  return buildTrack(idPrefix, entry, source, now, {
    page: part?.page ?? 1,
    cid: part?.cid ?? 0,
    title: entry.title || entry.bvid,
    duration: entry.duration,
  });
}

export async function fetchVideoDetail(
  bvid: string,
  options: FetchVideoOptions = {},
): Promise<VideoDetail> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(VIEW_URL);
  url.searchParams.set("bvid", bvid);

  let response: Response;
  try {
    response = await fetcher(url, {
      credentials: "include",
      signal: options.signal,
    });
  } catch (error) {
    throw asNetworkError(error, "网络异常，导入失败");
  }

  if (response.status === 412) {
    throw new Error("请求过于频繁，已触发 B 站风控，请稍后再试");
  }
  if (!response.ok) {
    throw new Error(`网络异常（HTTP ${response.status}）`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("网络异常，导入失败");
  }

  const root = readRecord(payload);
  if (root?.code !== 0) {
    throw new Error(videoCodeMessage(root?.code, root?.message));
  }

  const data = readRecord(root?.data);
  if (!data) {
    throw new Error("视频不存在或链接无效");
  }

  const detail = readVideoDetail(data);
  if (!detail.bvid.trim()) {
    throw new Error("视频不存在或链接无效");
  }

  return detail;
}

interface TrackSlot {
  page: number;
  cid: number;
  title: string;
  duration: number;
}

function buildTrack(
  idPrefix: string,
  entry: TrackPartsInput,
  source: Track["source"],
  now: number,
  slot: TrackSlot,
): Track[] {
  return [
    {
      id: trackIdFor(idPrefix, entry.bvid, slot.page),
      bvid: entry.bvid,
      ...(slot.cid > 0 ? { cid: slot.cid } : {}),
      ...(slot.page > 1 ? { page: slot.page } : {}),
      title: slot.title,
      ...(entry.uploader ? { uploader: entry.uploader } : {}),
      ...(entry.cover ? { cover: entry.cover } : {}),
      startTime: 0,
      duration: slot.duration,
      addedAt: now,
      source,
    },
  ];
}

function readSplitTitle(videoTitle: string, part: VideoPart): string {
  const base = videoTitle || part.title || `P${part.page}`;
  const partTitle = part.title.trim();
  return partTitle
    ? `${base} [P${part.page}] ${partTitle}`
    : `${base} [P${part.page}]`;
}

function readVideoDetail(data: Record<string, unknown>): VideoDetail {
  const owner = readRecord(data.owner);
  const ownerMid = readIdValue(owner?.mid);
  const ownerName =
    typeof owner?.name === "string" && owner.name.trim()
      ? owner.name.trim()
      : undefined;
  const season = readRecord(data.ugc_season);
  const seasonId = readIdValue(season?.id) ?? readIdValue(data.season_id);
  const seasonTitle =
    typeof season?.title === "string" && season.title.trim()
      ? season.title.trim()
      : undefined;
  const seasonOwnerMid = readIdValue(season?.mid) ?? ownerMid;

  return {
    bvid: typeof data.bvid === "string" ? data.bvid : "",
    title: typeof data.title === "string" ? data.title.trim() : "",
    ...(readHttpsUrl(data.pic) ? { cover: readHttpsUrl(data.pic) } : {}),
    duration: readPositiveNumber(data.duration) ?? 0,
    ...(ownerName ? { ownerName } : {}),
    ...(ownerMid ? { ownerMid } : {}),
    pages: readParts(data.pages),
    ...(seasonId ? { seasonId } : {}),
    ...(seasonTitle ? { seasonTitle } : {}),
    ...(seasonId && seasonOwnerMid ? { seasonOwnerMid } : {}),
  };
}

function readParts(value: unknown): VideoPart[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry, index): VideoPart[] => {
    const record = readRecord(entry);
    if (!record) {
      return [];
    }

    return [
      {
        page: readPositiveInteger(record.page) ?? index + 1,
        cid: readPositiveInteger(record.cid) ?? 0,
        title: typeof record.part === "string" ? record.part.trim() : "",
        duration: readPositiveNumber(record.duration) ?? 0,
      },
    ];
  });
}

function videoCodeMessage(code: unknown, message: unknown): string {
  if (code === -101) {
    return "需要登录 Bilibili 账号";
  }
  if (code === -403) {
    return "无权访问该视频";
  }
  if (code === -404 || code === -400 || code === 62002 || code === 62004) {
    return "视频不存在或已被删除";
  }

  const text =
    typeof message === "string" && message.trim() && message !== "0"
      ? message.trim()
      : "导入失败";
  return `视频信息获取失败：${text}`;
}

function readHttpsUrl(value: unknown): string | undefined {
  return typeof value === "string" && value.trim()
    ? value.trim().replace(/^http:/i, "https:")
    : undefined;
}

function readIdValue(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  return undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function readPositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}
