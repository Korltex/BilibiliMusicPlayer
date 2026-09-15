import { describe, expect, it, vi } from "vitest";
import {
  buildEntryTracks,
  fetchVideoDetail,
  trackIdFor,
  videoPlaylistId,
  type TrackPartsInput,
  type VideoPart,
} from "../src/sources/bilibili-video";

function viewPayload(overrides: Record<string, unknown> = {}): unknown {
  return {
    code: 0,
    data: {
      bvid: "BV1Mn4y1R7fa",
      title: "同时存在？从零手搓完美还原植物大战僵尸！",
      pic: "http://i2.hdslb.com/bfs/archive/cover.jpg",
      duration: 291,
      owner: { mid: 3546619314178489, name: "蓝飘飘fly" },
      pages: [{ cid: 1581675415, page: 1, part: "同时存在？", duration: 291 }],
      ...overrides,
    },
  };
}

function part(overrides: Partial<VideoPart> = {}): VideoPart {
  return { cid: 111, page: 1, title: "第一首", duration: 100, ...overrides };
}

function entry(overrides: Partial<TrackPartsInput> = {}): TrackPartsInput {
  return { bvid: "BV1Mn4y1R7fa", title: "测试视频", duration: 291, ...overrides };
}

describe("video ids", () => {
  it("derives the playlist id and unique track ids", () => {
    expect(videoPlaylistId("BV1Mn4y1R7fa")).toBe("video-BV1Mn4y1R7fa");
    expect(trackIdFor("video-BV1Mn4y1R7fa", "BV1Mn4y1R7fa", 1)).toBe(
      "video-BV1Mn4y1R7fa-BV1Mn4y1R7fa-p1",
    );
    expect(trackIdFor("favorite-123", "BV1Mn4y1R7fa", 7)).toBe(
      "favorite-123-BV1Mn4y1R7fa-p7",
    );
  });
});

describe("fetchVideoDetail", () => {
  it("reads the video fields and maps the cover to https", async () => {
    const fetcher = vi.fn(async () => Response.json(viewPayload()));

    await expect(
      fetchVideoDetail("BV1Mn4y1R7fa", { fetcher: fetcher as typeof fetch }),
    ).resolves.toEqual({
      bvid: "BV1Mn4y1R7fa",
      title: "同时存在？从零手搓完美还原植物大战僵尸！",
      cover: "https://i2.hdslb.com/bfs/archive/cover.jpg",
      duration: 291,
      ownerName: "蓝飘飘fly",
      ownerMid: "3546619314178489",
      pages: [{ cid: 1581675415, page: 1, title: "同时存在？", duration: 291 }],
    });
  });

  it("sniffs the collection id from ugc_season", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        viewPayload({
          ugc_season: {
            id: 3221717,
            title: "植物大战僵尸融合版",
            mid: 3546619314178489,
            ep_count: 778,
            sections: [{ episodes: [{ bvid: "BV1other" }] }],
          },
        }),
      ),
    );

    const detail = await fetchVideoDetail("BV1Mn4y1R7fa", {
      fetcher: fetcher as typeof fetch,
    });

    expect(detail.seasonId).toBe("3221717");
    expect(detail.seasonTitle).toBe("植物大战僵尸融合版");
    expect(detail.seasonOwnerMid).toBe("3546619314178489");
    // 只用它拿 season_id：内联剧集不参与导入（可能不是全集）。
    expect(detail.pages).toHaveLength(1);
  });

  it("falls back to the top-level season_id when ugc_season is absent", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(viewPayload({ season_id: 5471 })),
    );

    const detail = await fetchVideoDetail("BV1Mn4y1R7fa", {
      fetcher: fetcher as typeof fetch,
    });

    expect(detail.seasonId).toBe("5471");
    expect(detail.seasonOwnerMid).toBe("3546619314178489");
  });

  it("leaves the season empty for a plain single video", async () => {
    const fetcher = vi.fn(async () => Response.json(viewPayload()));

    const detail = await fetchVideoDetail("BV1Mn4y1R7fa", {
      fetcher: fetcher as typeof fetch,
    });

    expect(detail.seasonId).toBeUndefined();
    expect(detail.seasonTitle).toBeUndefined();
  });

  it("maps failures to readable errors", async () => {
    const notFound = vi.fn(async () =>
      Response.json({ code: -404, message: "啥都木有" }),
    );
    await expect(
      fetchVideoDetail("BV1xx", { fetcher: notFound as typeof fetch }),
    ).rejects.toThrow("视频不存在");

    const blocked = vi.fn(async () => new Response(null, { status: 412 }));
    await expect(
      fetchVideoDetail("BV1xx", { fetcher: blocked as typeof fetch }),
    ).rejects.toThrow("请求过于频繁");
  });

  it("rejects a payload without a usable bvid", async () => {
    const blankBvid = vi.fn(async () =>
      Response.json(viewPayload({ bvid: "" })),
    );
    await expect(
      fetchVideoDetail("BV1xx", { fetcher: blankBvid as typeof fetch }),
    ).rejects.toThrow("视频不存在或链接无效");

    const nullData = vi.fn(async () => Response.json({ code: 0, data: null }));
    await expect(
      fetchVideoDetail("BV1xx", { fetcher: nullData as typeof fetch }),
    ).rejects.toThrow("视频不存在或链接无效");
  });
});

describe("buildEntryTracks / single part", () => {
  const now = 1234567890;

  it("uses the list metadata and does not need extra parts", () => {
    expect(
      buildEntryTracks(
        "favorite-9",
        entry({ cover: "https://i0.hdslb.com/c.jpg", uploader: "测试UP" }),
        [],
        "favorite",
        now,
      ),
    ).toEqual([
      {
        id: "favorite-9-BV1Mn4y1R7fa-p1",
        bvid: "BV1Mn4y1R7fa",
        title: "测试视频",
        uploader: "测试UP",
        cover: "https://i0.hdslb.com/c.jpg",
        startTime: 0,
        duration: 291,
        addedAt: now,
        source: "favorite",
      },
    ]);
  });

  it("carries cid and page when a single part is known", () => {
    expect(
      buildEntryTracks(
        "season-1",
        entry(),
        [part({ cid: 999, page: 3, title: "P3", duration: 55 })],
        "collection",
        now,
      ),
    ).toEqual([
      {
        id: "season-1-BV1Mn4y1R7fa-p3",
        bvid: "BV1Mn4y1R7fa",
        cid: 999,
        page: 3,
        title: "测试视频",
        startTime: 0,
        duration: 291,
        addedAt: now,
        source: "collection",
      },
    ]);
  });

  it("returns nothing for an entry without a bvid", () => {
    expect(
      buildEntryTracks("x", entry({ bvid: "  " }), [], "favorite", now),
    ).toEqual([]);
  });
});

describe("buildEntryTracks / multi part splitting", () => {
  const now = 1234567890;
  const parts = [
    part({ cid: 111, page: 1, title: "第一首", duration: 100 }),
    part({ cid: 222, page: 2, title: "第二首", duration: 200 }),
  ];

  it("splits every part into its own track with a unique id", () => {
    const tracks = buildEntryTracks(
      "favorite-9",
      entry({ title: "多P视频", duration: 300 }),
      parts,
      "favorite",
      now,
    );

    expect(tracks).toEqual([
      {
        id: "favorite-9-BV1Mn4y1R7fa-p1",
        bvid: "BV1Mn4y1R7fa",
        cid: 111,
        title: "多P视频 [P1] 第一首",
        startTime: 0,
        duration: 100,
        addedAt: now,
        source: "favorite",
      },
      {
        id: "favorite-9-BV1Mn4y1R7fa-p2",
        bvid: "BV1Mn4y1R7fa",
        cid: 222,
        page: 2,
        title: "多P视频 [P2] 第二首",
        startTime: 0,
        duration: 200,
        addedAt: now,
        source: "favorite",
      },
    ]);

    expect(new Set(tracks.map((track) => track.id)).size).toBe(tracks.length);
  });

  it("uses the per-part duration instead of the whole-video duration", () => {
    const tracks = buildEntryTracks(
      "season-1",
      entry({ title: "多P视频", duration: 300 }),
      parts,
      "collection",
      now,
    );

    expect(tracks.map((track) => track.duration)).toEqual([100, 200]);
    expect(tracks.every((track) => track.duration !== 300)).toBe(true);
  });

  it("keeps the title readable when a part title is empty", () => {
    const tracks = buildEntryTracks(
      "video-BV1Mn4y1R7fa",
      entry({ title: "多P视频" }),
      [part({ page: 1, title: "" }), part({ cid: 222, page: 2, title: "  " })],
      "manual",
      now,
    );

    expect(tracks.map((track) => track.title)).toEqual([
      "多P视频 [P1]",
      "多P视频 [P2]",
    ]);
  });

  it("falls back to the whole-video duration when a part has none", () => {
    const tracks = buildEntryTracks(
      "video-BV1Mn4y1R7fa",
      entry({ duration: 300 }),
      [part({ page: 1, duration: 0 }), part({ cid: 222, page: 2, duration: 0 })],
      "manual",
      now,
    );

    expect(tracks.map((track) => track.duration)).toEqual([300, 300]);
  });
});
