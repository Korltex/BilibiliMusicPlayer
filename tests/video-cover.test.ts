import { describe, expect, it, vi } from "vitest";
import {
  fetchVideoCover,
  normalizeCoverUrl,
  toThumbnailCover,
  VideoCoverCache,
} from "../src/bili/video-cover";

const PIC = "http://i1.hdslb.com/bfs/archive/cover.jpg";
const THUMBNAIL =
  "https://i1.hdslb.com/bfs/archive/cover.jpg@120w_120h_1c.webp";

function payloadResponse(payload: unknown, ok = true): Response {
  return { ok, json: async () => payload } as unknown as Response;
}

function abortedError(): Error {
  return Object.assign(new Error("aborted"), { name: "AbortError" });
}

describe("normalizeCoverUrl", () => {
  it("升级 http 封面，避免 https 页面触发混合内容拦截", () => {
    expect(normalizeCoverUrl(PIC)).toBe(
      "https://i1.hdslb.com/bfs/archive/cover.jpg",
    );
  });

  it("忽略空值与非字符串", () => {
    expect(normalizeCoverUrl("   ")).toBeUndefined();
    expect(normalizeCoverUrl(undefined)).toBeUndefined();
    expect(normalizeCoverUrl(null)).toBeUndefined();
    expect(normalizeCoverUrl(42)).toBeUndefined();
  });
});

describe("toThumbnailCover", () => {
  it("给 B 站图床原图追加方图缩略参数", () => {
    expect(toThumbnailCover("https://i1.hdslb.com/bfs/archive/cover.jpg")).toBe(
      THUMBNAIL,
    );
  });

  it("已有尺寸参数或非 B 站图床时保持原样", () => {
    const sized = "https://i1.hdslb.com/bfs/archive/cover.jpg@1200w_630h";
    expect(toThumbnailCover(sized)).toBe(sized);
    expect(toThumbnailCover("https://example.com/cover.jpg")).toBe(
      "https://example.com/cover.jpg",
    );
  });
});

describe("fetchVideoCover", () => {
  it("读取 view 接口的 pic 并转成缩略图", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
      payloadResponse({ code: 0, data: { pic: PIC } }),
    );

    await expect(
      fetchVideoCover("BV1Cover", {
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ status: "resolved", cover: THUMBNAIL });
    expect(String(fetcher.mock.calls[0][0])).toContain("bvid=BV1Cover");
  });

  it("接口成功但没有封面时报 missing", async () => {
    const fetcher = async () => payloadResponse({ code: 0, data: {} });

    await expect(
      fetchVideoCover("BV1Cover", {
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ status: "missing" });
  });

  it("接口报错、风控或网络异常时失败开放", async () => {
    const failing = async () => payloadResponse({ code: -412 }, true);
    await expect(
      fetchVideoCover("BV1Cover", {
        fetcher: failing as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ status: "failed" });

    const throwing = async () => {
      throw new Error("network down");
    };
    await expect(
      fetchVideoCover("BV1Cover", {
        fetcher: throwing as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ status: "failed" });

    const notOk = async () => payloadResponse({ code: 0 }, false);
    await expect(
      fetchVideoCover("BV1Cover", {
        fetcher: notOk as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ status: "failed" });
  });

  it("主动取消不算失败", async () => {
    const fetcher = async () => {
      throw abortedError();
    };

    await expect(
      fetchVideoCover("BV1Cover", {
        fetcher: fetcher as unknown as typeof fetch,
      }),
    ).resolves.toEqual({ status: "aborted" });
  });
});

describe("VideoCoverCache", () => {
  it("每个 bvid 只请求一次并复用结果", async () => {
    const fetcher = vi.fn(async () =>
      payloadResponse({ code: 0, data: { pic: PIC } }),
    );
    const cache = new VideoCoverCache(fetcher as unknown as typeof fetch);

    await expect(cache.resolve("BV1Cover")).resolves.toBe(THUMBNAIL);
    await expect(cache.resolve("BV1Cover")).resolves.toBe(THUMBNAIL);
    expect(cache.peek("BV1Cover")).toBe(THUMBNAIL);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("没有封面时也只问一次", async () => {
    const fetcher = vi.fn(async () => payloadResponse({ code: 0, data: {} }));
    const cache = new VideoCoverCache(fetcher as unknown as typeof fetch);

    await expect(cache.resolve("BV1Cover")).resolves.toBeUndefined();
    await expect(cache.resolve("BV1Cover")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("失败后退避，避免被每秒校正反复触发", async () => {
    let now = 1_000;
    const fetcher = vi.fn(async () => payloadResponse({ code: -412 }));
    const cache = new VideoCoverCache(
      fetcher as unknown as typeof fetch,
      () => now,
    );

    await expect(cache.resolve("BV1Cover")).resolves.toBeUndefined();
    now += 60_000;
    await expect(cache.resolve("BV1Cover")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(1);

    now += 5 * 60_000;
    await expect(cache.resolve("BV1Cover")).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("主动取消不计入退避，切回该视频时会重新请求", async () => {
    let attempts = 0;
    const fetcher = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw abortedError();
      }
      return payloadResponse({ code: 0, data: { pic: PIC } });
    });
    const cache = new VideoCoverCache(fetcher as unknown as typeof fetch);

    await expect(cache.resolve("BV1Cover")).resolves.toBeUndefined();
    await expect(cache.resolve("BV1Cover")).resolves.toBe(THUMBNAIL);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("并发解析同一 bvid 时不重复请求", async () => {
    let resolveFetch: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      resolveFetch = resolve;
    });
    const fetcher = vi.fn(async () => {
      await gate;
      return payloadResponse({ code: 0, data: { pic: PIC } });
    });
    const cache = new VideoCoverCache(fetcher as unknown as typeof fetch);

    const first = cache.resolve("BV1Cover");
    await expect(cache.resolve("BV1Cover")).resolves.toBeUndefined();
    resolveFetch?.();
    await expect(first).resolves.toBe(THUMBNAIL);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
