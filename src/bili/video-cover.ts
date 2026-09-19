export type VideoCoverOutcome =
  | { status: "resolved"; cover: string }
  | { status: "missing" }
  | { status: "failed" }
  | { status: "aborted" };

export interface FetchVideoCoverOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

const VIEW_URL = "https://api.bilibili.com/x/web-interface/view";
/** 面板封面只有 58px，取 120px 见方裁剪缩略图，避免每次切歌下载整张原图。 */
const THUMBNAIL_SUFFIX = "@120w_120h_1c.webp";
/** 风控或断网后不要被每秒一次的页面校正反复触发。 */
const RETRY_DELAY = 5 * 60_000;
const MAX_ENTRIES = 50;

/**
 * 封面统一读公开的 `view` 接口，而不是页面的 `og:image`：
 * B 站同文档换视频时 `og:image` 是首屏 SSR 写入的，不保证跟着更新，
 * 而接口按 bvid 返回的封面永远对应当前视频。
 *
 * 失败一律开放：拿不到就继续用页面上已有的封面。
 */
export async function fetchVideoCover(
  bvid: string,
  options: FetchVideoCoverOptions = {},
): Promise<VideoCoverOutcome> {
  const fetcher = options.fetcher ?? fetch;
  const url = new URL(VIEW_URL);
  url.searchParams.set("bvid", bvid);

  try {
    const response = await fetcher(url, {
      credentials: "include",
      signal: options.signal,
    });
    if (!response.ok) {
      return { status: "failed" };
    }

    const payload = (await response.json()) as {
      code?: unknown;
      data?: { pic?: unknown };
    };
    if (payload?.code !== 0) {
      return { status: "failed" };
    }

    const cover = normalizeCoverUrl(payload.data?.pic);
    return cover
      ? { status: "resolved", cover: toThumbnailCover(cover) }
      : { status: "missing" };
  } catch (error) {
    return isAbortError(error) ? { status: "aborted" } : { status: "failed" };
  }
}

/** 接口返回 `http://` 封面，直接用在 https 页面上会被混合内容拦截。 */
export function normalizeCoverUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.replace(/^http:/i, "https:") : undefined;
}

/** 只对 B 站图床且没有尺寸参数的原图追加缩略参数；其它地址原样返回。 */
export function toThumbnailCover(cover: string): string {
  if (!/hdslb\.com\/bfs\//i.test(cover) || cover.includes("@")) {
    return cover;
  }

  return `${cover}${THUMBNAIL_SUFFIX}`;
}

interface CoverEntry {
  cover?: string;
  /** 已经拿到明确答案（有封面或确认没有封面），不需要再问。 */
  resolved?: boolean;
  failedAt?: number;
}

/**
 * 按 bvid 缓存封面：同一个视频只请求一次，失败进入退避，
 * 因此每秒一次的页面校正不会放大成请求风暴。
 */
export class VideoCoverCache {
  private readonly entries = new Map<string, CoverEntry>();
  private readonly pending = new Set<string>();

  constructor(
    private readonly fetcher?: typeof fetch,
    private readonly now: () => number = Date.now,
  ) {}

  peek(bvid: string): string | undefined {
    return this.entries.get(bvid)?.cover;
  }

  async resolve(
    bvid: string,
    signal?: AbortSignal,
  ): Promise<string | undefined> {
    if (!bvid) {
      return undefined;
    }

    const entry = this.entries.get(bvid);
    if (entry?.cover !== undefined) {
      return entry.cover;
    }
    if (entry?.resolved || this.pending.has(bvid) || this.isBackingOff(entry)) {
      return undefined;
    }

    this.pending.add(bvid);
    try {
      const outcome = await fetchVideoCover(bvid, {
        fetcher: this.fetcher,
        signal,
      });

      switch (outcome.status) {
        case "resolved":
          this.remember(bvid, { cover: outcome.cover });
          return outcome.cover;
        case "missing":
          // 接口成功但没有封面，没必要再问一次
          this.remember(bvid, { resolved: true });
          return undefined;
        case "failed":
          this.remember(bvid, { failedAt: this.now() });
          return undefined;
        case "aborted":
          // 主动取消不计入退避，切回该视频时可以重新请求
          return undefined;
      }
    } finally {
      this.pending.delete(bvid);
    }
  }

  private isBackingOff(entry: CoverEntry | undefined): boolean {
    return (
      entry?.failedAt !== undefined && this.now() - entry.failedAt < RETRY_DELAY
    );
  }

  private remember(bvid: string, entry: CoverEntry): void {
    this.entries.delete(bvid);
    this.entries.set(bvid, entry);

    if (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next();
      if (!oldest.done) {
        this.entries.delete(oldest.value);
      }
    }
  }
}

function isAbortError(error: unknown): boolean {
  return (error as { name?: unknown } | undefined)?.name === "AbortError";
}
