import type { Track } from "../core/types";
import {
  asNetworkError,
  createAbortError,
  randomDelay,
  readRecord,
} from "./http";

/*
 * Bilibili「视频合集(season)」导入适配层。
 *
 * 与收藏夹是两套完全不同的数据源：
 *  - URL 里 `ctype=21` 时，`fid` 是 season_id，不是收藏夹 mlid；
 *    把它塞给 `/x/v3/fav/*` 会静默返回**别人**的收藏夹（同一个数字在收藏夹 id 空间里可能已被占用）。
 *  - 合集内容走 `/x/polymer/web-space/seasons_archives_list`。
 *
 * 该接口的 `mid` 参数不参与鉴权（文档与实测均确认：任意 mid 返回同一个合集），
 * 因此这里优先用链接路径里的 mid，缺失时退回常量。
 */

export interface SeasonInfo {
  name: string;
  total: number;
  ownerMid?: string;
}

export interface SeasonResult {
  name: string;
  tracks: Track[];
  skipped: number;
}

export interface SeasonProgress {
  loaded: number;
  total: number;
}

export interface FetchSeasonOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  delay?: (signal: AbortSignal | undefined) => Promise<void>;
  onProgress?: (progress: SeasonProgress) => void;
  /** 链接里的用户 mid；仅作接口占位，不参与鉴权。 */
  mid?: string;
}

interface SeasonPage {
  meta: Record<string, unknown> | undefined;
  page: Record<string, unknown> | undefined;
  archives: unknown[];
}

const SEASON_ARCHIVES_URL =
  "https://api.bilibili.com/x/polymer/web-space/seasons_archives_list";
const PAGE_SIZE = 30;
const MAX_PAGES = 200;
const FALLBACK_MID = "1";

export function seasonPlaylistId(seasonId: string): string {
  return `season-${seasonId}`;
}

export function seasonTrackId(seasonId: string, bvid: string): string {
  return `season-${seasonId}-${bvid}`;
}

/** 把合集里的一条 `archives` 映射为 `Track`；缺 bvid 的条目返回 `undefined`。 */
export function mapSeasonArchiveToTrack(
  seasonId: string,
  archive: unknown,
  now = Date.now(),
): Track | undefined {
  const item = readRecord(archive);
  if (!item) {
    return undefined;
  }

  const bvid = item.bvid;
  if (typeof bvid !== "string" || !bvid.trim()) {
    return undefined;
  }

  const title = typeof item.title === "string" ? item.title.trim() : "";
  const rawCover = item.pic;
  const cover =
    typeof rawCover === "string" && rawCover.trim()
      ? rawCover.trim().replace(/^http:/i, "https:")
      : undefined;
  const duration =
    typeof item.duration === "number" &&
    Number.isFinite(item.duration) &&
    item.duration > 0
      ? item.duration
      : 0;

  return {
    id: seasonTrackId(seasonId, bvid),
    bvid,
    title: title || bvid,
    ...(cover ? { cover } : {}),
    startTime: 0,
    duration,
    addedAt: now,
    source: "favorite",
  };
}

export async function fetchSeasonInfo(
  seasonId: string,
  options: FetchSeasonOptions = {},
): Promise<SeasonInfo> {
  const page = await requestSeasonPage(seasonId, 1, options);
  const name = readSeasonName(page.meta);
  if (!name) {
    throw new Error("合集不存在或链接无效");
  }

  const ownerMid = readMid(page.meta);
  return {
    name,
    total: readTotal(page.meta, page.page),
    ...(ownerMid ? { ownerMid } : {}),
  };
}

export async function fetchSeason(
  seasonId: string,
  options: FetchSeasonOptions = {},
): Promise<SeasonResult> {
  const delay = options.delay ?? randomDelay;
  const tracks: Track[] = [];
  let name = "";
  let total = 0;
  let skipped = 0;
  let pageNum = 1;

  for (;;) {
    if (options.signal?.aborted) {
      throw createAbortError();
    }

    const page = await requestSeasonPage(seasonId, pageNum, options);

    if (pageNum === 1) {
      name = readSeasonName(page.meta);
      total = readTotal(page.meta, page.page);
    }

    for (const archive of page.archives) {
      const track = mapSeasonArchiveToTrack(seasonId, archive);
      if (track) {
        tracks.push(track);
      } else {
        skipped += 1;
      }
    }

    const loaded = tracks.length;
    options.onProgress?.({ loaded, total: total || loaded });

    if (total > 0 && loaded + skipped >= total) {
      break;
    }
    if (page.archives.length === 0 || pageNum >= MAX_PAGES) {
      break;
    }

    await delay(options.signal);
    pageNum += 1;
  }

  return { name, tracks, skipped };
}

async function requestSeasonPage(
  seasonId: string,
  pageNum: number,
  options: FetchSeasonOptions,
): Promise<SeasonPage> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(SEASON_ARCHIVES_URL);
  url.searchParams.set("mid", options.mid ?? FALLBACK_MID);
  url.searchParams.set("season_id", seasonId);
  url.searchParams.set("sort_reverse", "false");
  url.searchParams.set("page_num", String(pageNum));
  url.searchParams.set("page_size", String(PAGE_SIZE));

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
    throw new Error(seasonCodeMessage(root?.code, root?.message));
  }

  const data = readRecord(root?.data);
  return {
    meta: readRecord(data?.meta),
    page: readRecord(data?.page),
    archives: Array.isArray(data?.archives) ? data.archives : [],
  };
}

function readSeasonName(meta: Record<string, unknown> | undefined): string {
  // 优先 `title`（干净的合集名，如「奇妙串烧」）；`name` 常带「合集·」前缀。
  const title = typeof meta?.title === "string" ? meta.title.trim() : "";
  if (title) {
    return title;
  }
  return typeof meta?.name === "string" ? meta.name.trim() : "";
}

function readTotal(
  meta: Record<string, unknown> | undefined,
  page: Record<string, unknown> | undefined,
): number {
  return toCount(meta?.total) || toCount(page?.total);
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function readMid(meta: Record<string, unknown> | undefined): string | undefined {
  const raw = meta?.mid;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return raw.trim();
  }
  return undefined;
}

function seasonCodeMessage(code: unknown, message: unknown): string {
  if (code === -101) {
    return "需要登录 Bilibili 账号";
  }
  if (code === -352 || code === -412) {
    return "请求被 B 站风控拦截，请稍后再试或刷新页面";
  }
  if (code === -404 || code === 11010) {
    return "合集不存在或链接无效";
  }

  const text =
    typeof message === "string" && message.trim() && message !== "0"
      ? message.trim()
      : "导入失败";
  return `合集获取失败：${text}`;
}
