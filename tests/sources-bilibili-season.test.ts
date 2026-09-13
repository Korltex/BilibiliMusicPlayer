import { describe, expect, it, vi } from "vitest";
import {
  fetchSeason,
  fetchSeasonInfo,
  mapSeasonArchiveToTrack,
  seasonPlaylistId,
  seasonTrackId,
  type SeasonProgress,
} from "../src/sources/bilibili-season";

function archive(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    aid: 1055647178,
    bvid: "BV1Mn4y1R7fa",
    title: "同时存在？从零手搓完美还原植物大战僵尸！",
    duration: 291,
    pic: "http://i2.hdslb.com/bfs/archive/cover.jpg",
    ...overrides,
  };
}

function seasonMeta(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    mid: 3546619314178489,
    name: "合集·植物大战僵尸融合版",
    title: "植物大战僵尸融合版",
    season_id: 3221717,
    total: 3,
    ...overrides,
  };
}

function jsonResponse(body: unknown): Response {
  return Response.json(body);
}

describe("season ids", () => {
  it("derives stable playlist and track ids", () => {
    expect(seasonPlaylistId("3221717")).toBe("season-3221717");
    expect(seasonTrackId("3221717", "BV1Mn4y1R7fa")).toBe(
      "season-3221717-BV1Mn4y1R7fa",
    );
  });
});

describe("mapSeasonArchiveToTrack", () => {
  const now = 1234567890;

  it("maps an archive to a Track with an https cover", () => {
    expect(mapSeasonArchiveToTrack("3221717", archive(), now)).toEqual({
      id: "season-3221717-BV1Mn4y1R7fa",
      bvid: "BV1Mn4y1R7fa",
      title: "同时存在？从零手搓完美还原植物大战僵尸！",
      cover: "https://i2.hdslb.com/bfs/archive/cover.jpg",
      startTime: 0,
      duration: 291,
      addedAt: now,
      source: "favorite",
    });
  });

  it("falls back to bvid and drops entries without one", () => {
    expect(
      mapSeasonArchiveToTrack("1", archive({ title: "  " }), now),
    ).toMatchObject({ title: "BV1Mn4y1R7fa" });
    expect(
      mapSeasonArchiveToTrack("1", archive({ bvid: "" }), now),
    ).toBeUndefined();
    expect(mapSeasonArchiveToTrack("1", null, now)).toBeUndefined();
  });
});

describe("fetchSeasonInfo", () => {
  it("prefers the clean meta.title over the prefixed meta.name", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        code: 0,
        data: { meta: seasonMeta(), archives: [], page: { total: 3 } },
      }),
    );

    await expect(
      fetchSeasonInfo("3221717", { fetcher: fetcher as typeof fetch }),
    ).resolves.toEqual({
      name: "植物大战僵尸融合版",
      total: 3,
      ownerMid: "3546619314178489",
    });
  });

  it("falls back to meta.name when title is missing", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        code: 0,
        data: {
          meta: seasonMeta({ title: undefined }),
          archives: [],
          page: { total: 3 },
        },
      }),
    );

    await expect(
      fetchSeasonInfo("3221717", { fetcher: fetcher as typeof fetch }),
    ).resolves.toMatchObject({ name: "合集·植物大战僵尸融合版" });
  });

  it("throws when the response has no season metadata", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
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
  it("paginates until the reported total is collected", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const pageNum = Number(
        new URL(String(input)).searchParams.get("page_num"),
      );

      return jsonResponse({
        code: 0,
        data: {
          meta: seasonMeta(),
          archives:
            pageNum === 1
              ? [archive({ bvid: "BV1A" }), archive({ bvid: "BV1B" })]
              : [archive({ bvid: "BV1C" })],
          page: { page_num: pageNum, page_size: 30, total: 3 },
        },
      });
    });

    const progress: SeasonProgress[] = [];
    const delays: number[] = [];
    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      mid: "100969474",
      delay: async () => {
        delays.push(1);
      },
      onProgress: (value) => progress.push(value),
    });

    expect(result.name).toBe("植物大战僵尸融合版");
    expect(result.tracks.map((track) => track.bvid)).toEqual([
      "BV1A",
      "BV1B",
      "BV1C",
    ]);
    expect(result.skipped).toBe(0);
    expect(delays).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(progress).toEqual([
      { loaded: 2, total: 3 },
      { loaded: 3, total: 3 },
    ]);
  });

  it("stops after the first page when the season is empty", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        code: 0,
        data: {
          meta: seasonMeta({ total: 0 }),
          archives: [],
          page: { total: 0 },
        },
      }),
    );

    const result = await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
    });

    expect(result.tracks).toEqual([]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("builds the season request with the link mid as a placeholder", async () => {
    const fetcher = vi.fn(async () =>
      jsonResponse({
        code: 0,
        data: {
          meta: seasonMeta({ total: 0 }),
          archives: [],
          page: { total: 0 },
        },
      }),
    );

    await fetchSeason("3221717", {
      fetcher: fetcher as typeof fetch,
      mid: "100969474",
      delay: async () => {},
    });

    const requested = String(
      (fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0],
    );
    const url = new URL(requested);
    expect(url.hostname).toBe("api.bilibili.com");
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
      jsonResponse({ code: -352, message: "-352" }),
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
