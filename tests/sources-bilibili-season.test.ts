import { describe, expect, it, vi } from "vitest";
import {
  fetchSeason,
  fetchSeasonInfo,
  readSeasonEntry,
  seasonPageDelay,
  seasonPlaylistId,
  type SeasonProgress,
} from "../src/sources/bilibili-season";

function archive(
  bvid: string,
  title: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    bvid,
    title,
    duration: 120,
    pic: "http://i2.hdslb.com/bfs/archive/cover.jpg",
    state: 0,
    ...overrides,
  };
}

function seasonMeta(
  total: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    mid: 3546619314178489,
    name: "合集·我的合集",
    title: "我的合集",
    season_id: 3221717,
    total,
    ...overrides,
  };
}

function seasonPayload(
  archives: Record<string, unknown>[],
  pageNum: number,
  total: number,
  metaOverrides: Record<string, unknown> = {},
): unknown {
  return {
    code: 0,
    data: {
      meta: seasonMeta(total, metaOverrides),
      archives,
      page: { page_num: pageNum, page_size: 100, total },
    },
  };
}

describe("season ids and entries", () => {
  it("derives the playlist id", () => {
    expect(seasonPlaylistId("3221717")).toBe("season-3221717");
  });

  it("reads an archive entry and maps the cover to https", () => {
    expect(readSeasonEntry(archive("BV1A", " 测试合集视频 "))).toEqual({
      bvid: "BV1A",
      title: "测试合集视频",
      cover: "https://i2.hdslb.com/bfs/archive/cover.jpg",
      duration: 120,
    });
  });

  it("falls back to bvid and drops entries without one", () => {
    expect(readSeasonEntry(archive("BV1A", "  "))?.title).toBe("BV1A");
    expect(readSeasonEntry(archive("", "x"))).toBeUndefined();
    expect(readSeasonEntry(null)).toBeUndefined();
  });

  it("keeps entries even when state is non-zero (no state filter by decision)", () => {
    expect(readSeasonEntry(archive("BV1A", "x", { state: 1 }))?.bvid).toBe(
      "BV1A",
    );
  });
});

describe("fetchSeasonInfo", () => {
  it("prefers the clean meta.title over the prefixed meta.name", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(seasonPayload([], 1, 3)),
    );

    await expect(
      fetchSeasonInfo("3221717", { fetcher: fetcher as typeof fetch }),
    ).resolves.toEqual({
      name: "我的合集",
      total: 3,
      ownerMid: "3546619314178489",
    });
  });

  it("falls back to meta.name when title is missing", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(seasonPayload([], 1, 3, { title: undefined })),
    );

    await expect(
      fetchSeasonInfo("3221717", { fetcher: fetcher as typeof fetch }),
    ).resolves.toMatchObject({ name: "合集·我的合集" });
  });

  it("throws when the response has no season metadata", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        code: 0,
        data: { meta: null, archives: [], page: { total: 0 } },
      }),
    );

    await expect(
      fetchSeasonInfo("1", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("合集不存在或链接无效");
  });
});

describe("fetchSeason", () => {
  it("builds tracks from list metadata without any video detail request", async () => {
    const requested: string[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      requested.push(String(input));
      return Response.json(seasonPayload([archive("BV1A", "列表标题")], 1, 1));
    });

    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
    });

    expect(result.name).toBe("我的合集");
    expect(result.tracks).toEqual([
      {
        id: "season-3221717-BV1A-p1",
        bvid: "BV1A",
        title: "列表标题",
        cover: "https://i2.hdslb.com/bfs/archive/cover.jpg",
        startTime: 0,
        duration: 120,
        addedAt: expect.any(Number),
        source: "collection",
      },
    ]);
    // 导入期只发列表请求，详情请求 0 次。
    expect(requested.filter((url) => url.includes("/view"))).toHaveLength(0);
    expect(requested).toHaveLength(1);
  });

  it("keeps a multi-part archive as a single P1 entry", async () => {
    // 列表没有分P数：即使该视频实际有多个分P，导入期也只产出 `-p1` 一条（拆分交给按需补全）。
    const requested: string[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      requested.push(String(input));
      return Response.json(
        seasonPayload(
          [archive("BV1Multi", "多P视频", { duration: 300 })],
          1,
          1,
        ),
      );
    });

    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
    });

    expect(result.tracks.map((track) => track.id)).toEqual([
      "season-3221717-BV1Multi-p1",
    ]);
    expect(result.tracks[0]).toMatchObject({
      bvid: "BV1Multi",
      title: "多P视频",
      duration: 300,
      source: "collection",
    });
    expect(result.tracks[0]).not.toHaveProperty("page");
    expect(result.tracks[0]).not.toHaveProperty("cid");
    expect(requested).toHaveLength(1);
  });

  it("imports a 408-entry collection with 100-per-page requests and zero details", async () => {
    const total = 408;
    const pageSize = 100;
    const requested: string[] = [];

    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      requested.push(url);
      const pageNum = Number(new URL(url).searchParams.get("page_num"));
      const start = (pageNum - 1) * pageSize;
      const count = Math.max(0, Math.min(pageSize, total - start));
      const archives = Array.from({ length: count }, (_value, index) =>
        archive(`BV1S${start + index}`, `合集视频 ${start + index}`),
      );
      return Response.json(seasonPayload(archives, pageNum, total));
    });

    const progress: SeasonProgress[] = [];
    const result = await fetchSeason("186033", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
      onProgress: (value) => progress.push(value),
    });

    expect(result.tracks).toHaveLength(total);
    // 408 条 → 5 次列表请求（100×4 + 8），详情请求 0 次。
    expect(requested.filter((url) => url.includes("/view"))).toHaveLength(0);
    expect(requested).toHaveLength(5);
    // 分页大小用满接口上限（>100 会返回 code -400）。
    expect(new URL(requested[0]).searchParams.get("page_size")).toBe("100");
    // 逐条回报：408 次回调，第一条就是 1/408。
    expect(progress).toHaveLength(total);
    expect(progress[0]).toEqual({ loaded: 1, total });
    expect(progress[total - 1]).toEqual({ loaded: total, total });
  });

  it("retries the same page after HTTP 412 and finishes the import", async () => {
    const pagesRequested: number[] = [];
    const waits: number[] = [];
    let blocked = 1;

    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const pageNum = Number(
        new URL(String(input)).searchParams.get("page_num"),
      );
      pagesRequested.push(pageNum);

      if (pageNum === 2 && blocked > 0) {
        blocked -= 1;
        return new Response(null, { status: 412 });
      }

      const archives =
        pageNum === 1
          ? [archive("BV1A", "第一首")]
          : pageNum === 2
            ? [archive("BV1B", "第二首")]
            : [];
      return Response.json(seasonPayload(archives, pageNum, 2));
    });

    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
      wait: async (ms) => {
        waits.push(ms);
      },
    });

    expect(result.tracks.map((track) => track.bvid)).toEqual(["BV1A", "BV1B"]);
    // 第 2 页被请求两次：第一次 412，退避 1s 后重试成功。
    expect(pagesRequested.filter((pageNum) => pageNum === 2)).toHaveLength(2);
    expect(waits).toEqual([1000]);
  });

  it("gives up after the backoff ladder and reports a readable risk-control error", async () => {
    const waits: number[] = [];
    const fetcher = vi.fn(async () =>
      Response.json({ code: -352, message: "-352" }),
    );

    await expect(
      fetchSeason("3221717", {
        fetcher: fetcher as typeof fetch,
        delay: async () => {},
        wait: async (ms) => {
          waits.push(ms);
        },
      }),
    ).rejects.toThrow(/风控/);

    // 4 次尝试（首次 + 3 次退避），退避阶梯 1s / 2s / 4s。
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(waits).toEqual([1000, 2000, 4000]);
  });

  it("paginates until the reported total is collected", async () => {
    const archives: Record<number, Record<string, unknown>[]> = {
      1: [archive("BV1A", "第一首")],
      2: [archive("BV1B", "第二首")],
    };
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const pageNum = Number(
        new URL(String(input)).searchParams.get("page_num"),
      );
      return Response.json(seasonPayload(archives[pageNum], pageNum, 2));
    });

    const progress: SeasonProgress[] = [];
    const delays: number[] = [];
    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {
        delays.push(1);
      },
      onProgress: (value) => progress.push(value),
    });

    expect(result.tracks.map((track) => track.bvid)).toEqual(["BV1A", "BV1B"]);
    expect(fetcher).toHaveBeenCalledTimes(2); // 2 页列表，没有详情请求
    expect(delays).toHaveLength(1); // 只有第 2 页前
    expect(progress).toEqual([
      { loaded: 1, total: 2 },
      { loaded: 2, total: 2 },
    ]);
  });

  it("advances progress for skipped entries so loaded and total share one unit", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        seasonPayload(
          [archive("BV1A", "第一首"), { title: "缺少 bvid 的条目" }],
          1,
          2,
        ),
      ),
    );

    const progress: SeasonProgress[] = [];
    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
      onProgress: (value) => progress.push(value),
    });

    // `loaded` 数的是条目数（与 `total` 同单位），跳过的条目也要推进进度。
    expect(progress).toEqual([
      { loaded: 1, total: 2 },
      { loaded: 2, total: 2 },
    ]);
    expect(result.tracks).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("keeps the between-page pacing at 200~400ms instead of the 0.8~1.5s detail-API delay", async () => {
    const sleeps: number[] = [];
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      handler: () => void,
      ms?: number,
    ) => {
      sleeps.push(Number(ms));
      queueMicrotask(handler);
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout);

    try {
      await seasonPageDelay(undefined);
    } finally {
      spy.mockRestore();
    }

    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(200);
    expect(sleeps[0]).toBeLessThanOrEqual(400);
  });

  it("stops after the first page when the season is empty", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(seasonPayload([], 1, 0)),
    );

    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
    });

    expect(result.tracks).toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("builds the season request with the link mid as a placeholder", async () => {
    const fetcher = vi.fn(async () => Response.json(seasonPayload([], 1, 0)));

    await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      mid: "100969474",
      delay: async () => {},
    });

    const url = new URL(
      String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0]),
    );
    expect(url.pathname).toBe("/x/polymer/web-space/seasons_archives_list");
    expect(url.searchParams.get("season_id")).toBe("3221717");
    expect(url.searchParams.get("mid")).toBe("100969474");
    expect(url.searchParams.get("page_num")).toBe("1");
    expect(url.searchParams.get("sort_reverse")).toBe("false");
  });
});

describe("season errors", () => {
  it("maps HTTP 412 to a rate-limit message", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 412 }));

    await expect(
      fetchSeasonInfo("1", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("请求过于频繁");
  });

  it("maps risk control to a readable message", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ code: -352, message: "-352" }),
    );

    await expect(
      fetchSeasonInfo("1", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("风控");
  });

  it("maps non-ok responses to a network message", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(
      fetchSeasonInfo("1", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("网络异常（HTTP 500）");
  });
});
