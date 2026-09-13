import type { Track } from "../core/types";
import {
  asNetworkError,
  createAbortError,
  randomDelay,
  readRecord,
} from "./http";

/*
 * Bilibili 收藏夹导入适配层。
 *
 * 这里负责把 B 站「收藏夹」接口的原始数据转换成核心数据契约 `Track`，
 * 完全隔离 B 站字段与播放核心（遵守 AI-CONTEXT 硬约束 3）。
 * 本模块不依赖 `$`（GM 存储），只依赖 `fetch`，因此可以在 node 环境下单测。
 */

export interface FavFolderInfo {
  name: string;
  mediaCount: number;
  ownerMid?: string;
}

export interface FavFolderResult {
  name: string;
  tracks: Track[];
  skipped: number;
}

export interface FavProgress {
  loaded: number;
  total: number;
  skipped: number;
}

export interface FavTarget {
  fid: string;
  /** 链接形如 `space.bilibili.com/<mid>/…` 时记录链接声称的 UP 主 mid，用于校验收藏夹归属。 */
  ownerMid?: string;
}

export interface SeasonTarget {
  seasonId: string;
  /** 链接路径里的用户 mid，仅作合集接口的占位参数（该接口不校验 mid）。 */
  mid?: string;
}

export type FavUrlResult =
  | { kind: "folder"; target: FavTarget }
  | { kind: "season"; target: SeasonTarget }
  | { kind: "unsupported"; message: string }
  | { kind: "unknown" };

export interface FetchFavOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  delay?: (signal: AbortSignal | undefined) => Promise<void>;
  onProgress?: (progress: FavProgress) => void;
  /** 期望的收藏夹归属 mid；不一致时抛错，避免静默导入到无关歌单。 */
  expectedOwnerMid?: string;
}

interface FavPage {
  info: Record<string, unknown> | undefined;
  medias: unknown[];
  hasMore: boolean;
}

const FAV_LIST_URL = "https://api.bilibili.com/x/v3/fav/resource/list";
const PAGE_SIZE = 20;

export function favoritePlaylistId(fid: string): string {
  return `favorite-${fid}`;
}

export function favoriteTrackId(
  fid: string,
  bvid: string,
  page?: number,
): string {
  return `favorite-${fid}-${bvid}-${page && page > 1 ? page : 1}`;
}

/**
 * 从输入链接中解析收藏夹 fid。
 *
 * 支持：`?fid=2015788186`（带/不带其它参数）、
 * `?fid=5471&ftype=collect&ctype=21`（合集，`fid` 是 season_id）、
 * `/medialist/detail/ml2015788186`。
 * 不接受裸数字 id：它没有可校验的归属，会静默落到任意歌单上，因此只接受链接。
 * 不支持 `b23.tv` 短链（需一次网络重定向解析，超出本功能范围）。
 *
 * `ctype=21` 走合集分支；`lists`/`sid` 形式的合集页链接仍明确标记为不支持。
 */
export function parseFavUrl(url: string): FavUrlResult {
  const input = url.trim();
  if (!input) {
    return { kind: "unknown" };
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { kind: "unknown" };
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== "bilibili.com" && !host.endsWith(".bilibili.com")) {
    return { kind: "unknown" };
  }

  const ownerMid = readOwnerMid(parsed);

  // 合集：`ctype=21` 时 `fid` 是 season_id（不是收藏夹 mlid），必须走合集接口。
  // 不能一刀切拒绝 `ftype=collect`——「收藏的收藏夹」同样是 collect，但它是普通 mlid。
  if (parsed.searchParams.get("ctype") === "21") {
    const seasonId = parsed.searchParams.get("fid");
    if (seasonId && /^\d+$/.test(seasonId)) {
      return {
        kind: "season",
        target: { seasonId, ...(ownerMid ? { mid: ownerMid } : {}) },
      };
    }
    return { kind: "unknown" };
  }

  if (
    parsed.searchParams.has("sid") ||
    /\/lists(\/|$)/i.test(parsed.pathname)
  ) {
    return {
      kind: "unsupported",
      message: "这是合集/列表页链接，请改用收藏页 favlist 里的链接。",
    };
  }

  const fid = parsed.searchParams.get("fid");
  if (fid && /^\d+$/.test(fid)) {
    return {
      kind: "folder",
      target: { fid, ...(ownerMid ? { ownerMid } : {}) },
    };
  }

  const mediaListMatch = parsed.pathname.match(/\/medialist\/detail\/ml(\d+)/i);
  if (mediaListMatch) {
    return { kind: "folder", target: { fid: mediaListMatch[1] } };
  }

  return { kind: "unknown" };
}

function readOwnerMid(url: URL): string | undefined {
  if (url.hostname.toLowerCase() !== "space.bilibili.com") {
    return undefined;
  }

  return url.pathname.match(/^\/(\d+)\//)?.[1];
}

/**
 * 将收藏夹接口返回的单条 `medias` 映射为 `Track`。
 * 只接受视频稿件（`type === 2`）且 `bvid` 非空的条目；
 * `attr !== 0` 视为失效/被删除（1 其他原因删除、9 UP 主自删），返回 `undefined`。
 */
export function mapFavToTrack(
  fid: string,
  media: unknown,
  now = Date.now(),
): Track | undefined {
  const item = readRecord(media);
  if (!item) {
    return undefined;
  }

  const type = item.type;
  const bvid = item.bvid;
  if (type !== 2 || typeof bvid !== "string" || !bvid.trim()) {
    return undefined;
  }

  const attr = item.attr;
  if (typeof attr === "number" && attr !== 0) {
    return undefined;
  }

  const title = typeof item.title === "string" ? item.title.trim() : "";
  const page =
    typeof item.page === "number" && Number.isInteger(item.page) && item.page > 1
      ? item.page
      : undefined;
  const uploader = readRecord(item.upper)?.name;
  const rawCover = item.cover;
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

  const track: Track = {
    id: favoriteTrackId(fid, bvid, page),
    bvid,
    ...(page !== undefined ? { page } : {}),
    title: title || bvid,
    ...(typeof uploader === "string" && uploader.trim()
      ? { uploader: uploader.trim() }
      : {}),
    ...(cover ? { cover } : {}),
    startTime: 0,
    duration,
    addedAt: now,
    source: "favorite",
  };

  return track;
}

export async function fetchFavFolderInfo(
  fid: string,
  options: FetchFavOptions = {},
): Promise<FavFolderInfo> {
  const page = await requestFavPage(fid, 1, options);
  const name = readTitle(page.info);
  if (!name) {
    throw new Error("收藏夹不存在或链接无效");
  }

  const ownerMid = readMid(page.info);
  return {
    name,
    mediaCount: readMediaCount(page.info),
    ...(ownerMid ? { ownerMid } : {}),
  };
}

export async function fetchFavFolder(
  fid: string,
  options: FetchFavOptions = {},
): Promise<FavFolderResult> {
  const delay = options.delay ?? randomDelay;
  const tracks: Track[] = [];
  let name = "";
  let total = 0;
  let skipped = 0;
  let pn = 1;

  for (;;) {
    if (options.signal?.aborted) {
      throw createAbortError();
    }

    const page = await requestFavPage(fid, pn, options);

    if (pn === 1) {
      name = readTitle(page.info);
      total = readMediaCount(page.info);
    }

    for (const media of page.medias) {
      const track = mapFavToTrack(fid, media);
      if (track) {
        tracks.push(track);
      } else {
        skipped += 1;
      }
    }

    const loaded = tracks.length;
    options.onProgress?.({ loaded, total: total || loaded, skipped });

    if (!page.hasMore) {
      break;
    }

    await delay(options.signal);
    pn += 1;
  }

  return { name, tracks, skipped };
}

async function requestFavPage(
  fid: string,
  pn: number,
  options: FetchFavOptions,
): Promise<FavPage> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(FAV_LIST_URL);
  url.searchParams.set("media_id", fid);
  url.searchParams.set("ps", String(PAGE_SIZE));
  url.searchParams.set("pn", String(pn));
  url.searchParams.set("platform", "web");

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
    throw new Error(favCodeMessage(root?.code, root?.message));
  }

  const data = readRecord(root?.data);
  const info = readRecord(data?.info);
  assertFavOwner(info, pn, options);

  return {
    info,
    medias: Array.isArray(data?.medias) ? data.medias : [],
    hasMore: data?.has_more === true,
  };
}

/**
 * 归属校验：链接里带着 UP 主 mid 时，取回的收藏夹必须属于同一个 UP 主。
 * 这能兜住「把原始 fid 当成完整 id」这类错误——那种情况下接口不会报错，
 * 而是静默返回另一个用户的收藏夹。
 */
function assertFavOwner(
  info: Record<string, unknown> | undefined,
  pn: number,
  options: FetchFavOptions,
): void {
  if (pn !== 1 || options.expectedOwnerMid === undefined) {
    return;
  }

  const folderMid = readMid(info);
  if (folderMid !== undefined && folderMid !== options.expectedOwnerMid) {
    throw new Error(
      "链接与收藏夹不匹配：解析出的收藏夹不属于该 UP 主，可能不是收藏夹链接。已停止导入。",
    );
  }
}

function readTitle(info: Record<string, unknown> | undefined): string {
  return typeof info?.title === "string" ? info.title.trim() : "";
}

function readMediaCount(info: Record<string, unknown> | undefined): number {
  const value = info?.media_count;
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function readMid(info: Record<string, unknown> | undefined): string | undefined {
  const raw = info?.mid ?? readRecord(info?.upper)?.mid;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(raw);
  }
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) {
    return raw.trim();
  }
  return undefined;
}

function favCodeMessage(code: unknown, message: unknown): string {
  if (code === -101) {
    return "需要登录 Bilibili 账号";
  }
  if (code === -403) {
    return "收藏夹为私密或无权访问";
  }
  if (code === -400) {
    return "收藏夹不存在或链接无效";
  }

  const text =
    typeof message === "string" && message.trim() && message !== "0"
      ? message.trim()
      : "导入失败";
  return `收藏夹获取失败：${text}`;
}
