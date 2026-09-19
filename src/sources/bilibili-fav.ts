import type { Track } from "../core/types";
import {
  buildEntryTracks,
  fetchVideoDetail,
  isVideoUnavailableError,
  type TrackPartsInput,
} from "./bilibili-video";
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
  /**
   * 已处理条目数（已导入 + 已跳过）。
   * 与 `total`（收藏夹条目数）同单位——**不是**多P 拆分后的曲目数，
   * 否则一个 27 条的收藏夹会显示成 `88/27（100%）`。
   */
  loaded: number;
  total: number;
  skipped: number;
}

/** 收藏夹列表里的一条视频 + 它的分P总数。 */
export interface FavTrackEntry {
  track: TrackPartsInput;
  partCount: number;
}

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

/**
 * 读取收藏夹接口返回的单条 `medias`。
 * 只接受视频稿件（`type === 2`）且 `bvid` 非空的条目；
 * `attr !== 0` 视为失效/被删除（1 其他原因删除、9 UP 主自删），返回 `undefined`。
 *
 * `medias[].page` 是**该视频的分P总数**（接口文档写「视频分P数」），不是「收藏的是第几分P」：
 * 实测 12/12 样本满足 `page === view.videos`（17P/40P/69P 全部吻合），条目里的 `link` 是
 * `bilibili://video/<aid>`（不带 `p`）、`ugc.first_cid` 恒为第 1P 的 cid。因此这里把它
 * 作为「是否多P」的判据，多P 时再拉详情按分P 拆分（见 `fetchFavFolder`）。
 */
export function readFavEntry(media: unknown): FavTrackEntry | undefined {
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
  const partCount =
    typeof item.page === "number" && Number.isInteger(item.page) && item.page > 0
      ? item.page
      : 1;

  return {
    track: {
      bvid,
      title: title || bvid,
      ...(typeof uploader === "string" && uploader.trim()
        ? { uploader: uploader.trim() }
        : {}),
      ...(cover ? { cover } : {}),
      duration,
    },
    partCount,
  };
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
  const idPrefix = favoritePlaylistId(fid);
  const tracks: Track[] = [];
  let name = "";
  let total = 0;
  let skipped = 0;
  /** 已处理的条目数；`total` 是收藏夹条目数，两者同单位。 */
  let processed = 0;
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
      const entry = readFavEntry(media);

      if (!entry) {
        skipped += 1;
      } else if (entry.partCount > 1) {
        // 多P 视频必须拉详情拿 pages，再拆成独立的 Track；单P 直接用列表元数据。
        await delay(options.signal);
        try {
          const detail = await fetchVideoDetail(entry.track.bvid, {
            signal: options.signal,
            fetcher: options.fetcher,
          });
          tracks.push(
            ...buildEntryTracks(
              idPrefix,
              entry.track,
              detail.pages,
              "favorite",
            ),
          );
        } catch (error) {
          // 列表的 attr 只标"删除"类失效：记录已被清掉但条目仍是 attr = 0 的稿件，
          // 只有详情请求才发现。这种「这一条拿不到」按条目跳过，不要让整单导入失败；
          // 风控（412/-352）与网络异常仍然上抛。
          if (!isVideoUnavailableError(error)) {
            throw error;
          }

          // 跳过但不静默：日志里能查到是哪一条、为什么。
          skipped += 1;
          console.warn("[Bilibili Music Player] 跳过不可用视频", {
            bvid: entry.track.bvid,
            title: entry.track.title,
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        tracks.push(...buildEntryTracks(idPrefix, entry.track, [], "favorite"));
      }

      // 逐条回报，且计的是「条目」而不是拆分后的曲目数：
      // 多P 会把曲目数放大到超过 media_count，进度条会提前冲到 100%。
      processed += 1;
      options.onProgress?.({
        loaded: processed,
        total: total || processed,
        skipped,
      });
    }

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
