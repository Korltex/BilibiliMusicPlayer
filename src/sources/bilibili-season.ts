import type { Track } from "../core/types";
import { buildEntryTracks, type TrackPartsInput } from "./bilibili-video";
import { asNetworkError, createAbortError, readRecord, sleep } from "./http";

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
 *
 * 导入策略：`archives` 已经带齐 `title` / `pic` / `duration`，所以导入期**不逐条请求**
 * `/x/web-interface/view`（一个 408 条的合集原本要发 408 次详情请求），
 * 而是「一个条目 = 一条 `Track`」：没有 `page`（播放时落在 P1）、没有 `cid`。
 * 代价是**多P 视频不会按分P 拆分**——列表不含分P数，无法在导入期知道；
 * 需要精确分P 时再由按需补全处理（单条 `/view` + 缓存），不必整单重导。
 *
 * 分页与节奏：`page_size` 实测上限是 100（>100 返回 `code -400`），408 条因此只要 5 页；
 * 翻页之间用 200~400ms 的礼让间隔即可（列表接口比详情接口耐受得多：同一客户端实测连续 14 页 0 风控），
 * 只有真的命中风控（HTTP 412 / `code` -352、-412）才按 1s / 2s / 4s 退避**重试同一页**，用尽后如实报错。
 * 不要把翻页换回 `randomDelay`（0.8~1.5s）：那只是让用户为 408 条多等十几秒。
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
  /** 翻页之间的礼让间隔；默认 `seasonPageDelay`（200~400ms）。 */
  delay?: (signal: AbortSignal | undefined) => Promise<void>;
  /** 命中风控后的退避等待；默认真实 `sleep`，测试可注入空实现跳过等待。 */
  wait?: (ms: number, signal: AbortSignal | undefined) => Promise<void>;
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
/** 接口上限：`page_size > 100` 返回 `code -400`（实测 101/120/150 均如此）。 */
const PAGE_SIZE = 100;
const MAX_PAGES = 200;
const FALLBACK_MID = "1";
/** 翻页礼让间隔：下限 + 随机抖动（毫秒）。 */
const PAGE_DELAY_MIN_MS = 200;
const PAGE_DELAY_JITTER_MS = 200;
/** 命中风控后的退避阶梯（毫秒）；用尽仍失败才把错误抛给用户。 */
const RISK_BACKOFF_MS = [1000, 2000, 4000];

/** 风控（HTTP 412 / `code` -352、-412）：可以退避重试，而不是让整次导入直接失败。 */
class SeasonRiskControlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeasonRiskControlError";
  }
}

/**
 * 翻页之间的礼让间隔（200~400ms）。
 *
 * 列表接口对所有客户端都比较宽容（同一客户端实测连续 14 页 0 风控），
 * 而 `randomDelay`（0.8~1.5s）是为重风控的详情接口 `/view` 准备的；
 * 用在翻页上只会让「408 条 = 13 次翻页」白白多等十几秒。
 */
export function seasonPageDelay(
  signal: AbortSignal | undefined,
): Promise<void> {
  return sleep(
    PAGE_DELAY_MIN_MS + Math.random() * PAGE_DELAY_JITTER_MS,
    signal,
  );
}

export function seasonPlaylistId(seasonId: string): string {
  return `season-${seasonId}`;
}

/**
 * 读取合集里的一条 `archives`；缺 bvid 的条目返回 `undefined`。
 *
 * 注意：合集列表**不提供分P数**（archives 字段只有 aid/bvid/duration/title/state…），
 * 所以从列表无法判断一条是否多P。导入期因此一律按「一个条目 = 一条曲目」处理，
 * 不为了分P 而逐条请求详情（见 `fetchSeason` 的导入策略说明）。
 */
export function readSeasonEntry(archive: unknown): TrackPartsInput | undefined {
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
    bvid,
    title: title || bvid,
    ...(cover ? { cover } : {}),
    duration,
  };
}

export async function fetchSeasonInfo(
  seasonId: string,
  options: FetchSeasonOptions = {},
): Promise<SeasonInfo> {
  // 确认阶段只发一次、快速失败：风控或异常立刻反馈给用户，不做退避重试。
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
  const delay = options.delay ?? seasonPageDelay;
  const idPrefix = seasonPlaylistId(seasonId);
  const tracks: Track[] = [];
  let name = "";
  let total = 0;
  let skipped = 0;
  /**
   * 已处理的条目数（已导入 + 已跳过）。
   * `total` 是合集内**视频条目数**，两者同为「条目」单位，进度百分比才不会被多P 拆分放大。
   */
  let processed = 0;
  let pageNum = 1;

  for (;;) {
    if (options.signal?.aborted) {
      throw createAbortError();
    }

    const page = await requestSeasonPageWithBackoff(seasonId, pageNum, options);

    if (pageNum === 1) {
      name = readSeasonName(page.meta);
      total = readTotal(page.meta, page.page);
    }

    for (const archive of page.archives) {
      const entry = readSeasonEntry(archive);

      if (entry) {
        // 列表元数据直接建 Track：一个条目一条曲目，不额外请求详情。
        tracks.push(...buildEntryTracks(idPrefix, entry, [], "collection"));
      } else {
        skipped += 1;
      }

      // 逐条回报（不是每页一次），否则长时间停在 0% 会被误判成卡死。
      processed += 1;
      options.onProgress?.({ loaded: processed, total: total || processed });
    }

    // 单位一致（条目 vs 条目）；`total` 缺失时由下面的翻页条件兜底。
    if (total > 0 && processed >= total) {
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

/**
 * 取一页列表；命中风控时按 `RISK_BACKOFF_MS` 退避后**重试同一页**，用尽才抛错。
 * 退避期间可被 `signal` 中止（`sleep` 会抛 AbortError，中止导入仍然即时生效）。
 */
async function requestSeasonPageWithBackoff(
  seasonId: string,
  pageNum: number,
  options: FetchSeasonOptions,
): Promise<SeasonPage> {
  const wait = options.wait ?? sleep;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await requestSeasonPage(seasonId, pageNum, options);
    } catch (error) {
      const giveUp =
        !(error instanceof SeasonRiskControlError) ||
        attempt >= RISK_BACKOFF_MS.length;
      if (giveUp) {
        throw error;
      }

      await wait(RISK_BACKOFF_MS[attempt], options.signal);
    }
  }
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
    throw new SeasonRiskControlError(
      "请求过于频繁，已触发 B 站风控，请稍后再试",
    );
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
    const message = seasonCodeMessage(root?.code, root?.message);
    throw isRiskControlCode(root?.code)
      ? new SeasonRiskControlError(message)
      : new Error(message);
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

/** 与 `seasonCodeMessage` 里的风控分支保持一致：这两个 code 值得退避重试。 */
function isRiskControlCode(code: unknown): boolean {
  return code === -352 || code === -412;
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
