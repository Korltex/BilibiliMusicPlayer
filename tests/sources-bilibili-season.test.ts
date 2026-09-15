import { describe, expect, it, vi } from "vitest";
import {
  fetchSeason,
  fetchSeasonInfo,
  readSeasonEntry,
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
      page: { page_num: pageNum, page_size: 30, total },
    },
  };
}

function viewPayload(
  bvid: string,
  title: string,
  parts: { cid: number; page: number; part: string; duration: number }[],
): unknown {
  return {
    code: 0,
    data: {
      bvid,
      title,
      duration: parts.reduce((sum, item) => sum + item.duration, 0),
      pages: parts,
    },
  };
}

const ONE_PART = [{ cid: 111, page: 1, part: "正片", duration: 120 }];

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
  it("expands single-part archives from the list without extra metadata", async () => {
    const requested: string[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      requested.push(url);

      if (url.includes("/view")) {
        return Response.json(viewPayload("BV1A", "接口标题", ONE_PART));
      }

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
        cid: 111,
        title: "列表标题",
        cover: "https://i2.hdslb.com/bfs/archive/cover.jpg",
        startTime: 0,
        duration: 120,
        addedAt: expect.any(Number),
        source: "collection",
      },
    ]);
    // 合集列表没有分P数，必须逐条查详情。
    expect(requested.filter((url) => url.includes("/view"))).toHaveLength(1);
  });

  it("splits a multi-part archive into one track per part", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      if (String(input).includes("/view")) {
        return Response.json(
          viewPayload("BV1Multi", "多P视频", [
            { cid: 111, page: 1, part: "第一首", duration: 100 },
            { cid: 222, page: 2, part: "第二首", duration: 200 },
          ]),
        );
      }

      return Response.json(
        seasonPayload([archive("BV1Multi", "多P视频", { duration: 300 })], 1, 1),
      );
    });

    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
    });

    expect(result.tracks.map((track) => track.id)).toEqual([
      "season-3221717-BV1Multi-p1",
      "season-3221717-BV1Multi-p2",
    ]);
    expect(result.tracks.map((track) => track.title)).toEqual([
      "多P视频 [P1] 第一首",
      "多P视频 [P2] 第二首",
    ]);
    expect(result.tracks.map((track) => track.duration)).toEqual([100, 200]);
    expect(result.tracks.every((track) => track.source === "collection")).toBe(
      true,
    );
  });

  it("paginates until the reported total is collected", async () => {
    const archives: Record<number, Record<string, unknown>[]> = {
      1: [archive("BV1A", "第一首")],
      2: [archive("BV1B", "第二首")],
    };
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);

      if (url.includes("/view")) {
        const bvid = new URL(url).searchParams.get("bvid") ?? "";
        return Response.json(viewPayload(bvid, bvid, ONE_PART));
      }

      const pageNum = Number(new URL(url).searchParams.get("page_num"));
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
    expect(fetcher).toHaveBeenCalledTimes(4); // 2 页列表 + 2 次详情
    expect(delays).toHaveLength(3); // 第 2 页前 + 两次详情前
    expect(progress.map((item) => item.loaded)).toEqual([1, 2]);
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
