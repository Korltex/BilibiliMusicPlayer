import { describe, expect, it, vi } from "vitest";
import {
  favoritePlaylistId,
  fetchFavFolder,
  fetchFavFolderInfo,
  readFavEntry,
  type FavProgress,
} from "../src/sources/bilibili-fav";

function favMedia(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 371494037,
    type: 2,
    title: "测试歌曲",
    cover: "http://i2.hdslb.com/bfs/archive/cover.jpg",
    page: 1,
    duration: 546,
    upper: { mid: 1, name: "测试UP主" },
    attr: 0,
    bvid: "BV1CZ4y1T7gC",
    ...overrides,
  };
}

function favListPayload(
  medias: Record<string, unknown>[],
  extra: Record<string, unknown> = {},
): unknown {
  return {
    code: 0,
    data: {
      info: { mid: 1, title: "我的收藏", media_count: medias.length },
      medias,
      has_more: false,
      ...extra,
    },
  };
}

describe("favorite ids and entries", () => {
  it("derives the playlist id", () => {
    expect(favoritePlaylistId("2015788186")).toBe("favorite-2015788186");
  });

  it("reads a valid video entry with its part count", () => {
    expect(readFavEntry(favMedia())).toEqual({
      track: {
        bvid: "BV1CZ4y1T7gC",
        title: "测试歌曲",
        uploader: "测试UP主",
        cover: "https://i2.hdslb.com/bfs/archive/cover.jpg",
        duration: 546,
      },
      partCount: 1,
    });
  });

  // `medias[].page` 是「分P总数」（实测 12/12 样本 page === view.videos），
  // 不是「收藏的是第几分P」；它只决定要不要去拉详情拆分。
  it("treats medias.page as the part count", () => {
    expect(readFavEntry(favMedia({ page: 17 }))?.partCount).toBe(17);
    expect(readFavEntry(favMedia({ page: 0 }))?.partCount).toBe(1);
    expect(readFavEntry(favMedia({ page: undefined }))?.partCount).toBe(1);
  });

  it("filters invalid, deleted, non-video, and bvid-less entries", () => {
    expect(readFavEntry(favMedia({ attr: 1 }))).toBeUndefined();
    expect(readFavEntry(favMedia({ attr: 9 }))).toBeUndefined();
    expect(readFavEntry(favMedia({ type: 12 }))).toBeUndefined();
    expect(readFavEntry(favMedia({ bvid: "" }))).toBeUndefined();
    expect(readFavEntry(null)).toBeUndefined();
  });

  it("falls back to bvid when the title is empty", () => {
    expect(readFavEntry(favMedia({ title: "  " }))?.track.title).toBe(
      "BV1CZ4y1T7gC",
    );
  });
});

describe("fetchFavFolderInfo", () => {
  it("reads the folder name and count from the first page", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        code: 0,
        data: {
          info: { title: "我的收藏", media_count: 42 },
          medias: [],
          has_more: false,
        },
      }),
    );

    await expect(
      fetchFavFolderInfo("fid", { fetcher: fetcher as typeof fetch }),
    ).resolves.toEqual({ name: "我的收藏", mediaCount: 42 });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

describe("fetchFavFolder", () => {
  it("maps single-part entries without extra requests", async () => {
    const fetcher = vi.fn(async () =>
      Response.json(
        favListPayload([
          favMedia({ bvid: "BV1A" }),
          favMedia({ bvid: "BV1Invalid", attr: 1 }),
          favMedia({ bvid: "BV1B", page: 1 }),
        ]),
      ),
    );

    const progress: FavProgress[] = [];
    const result = await fetchFavFolder("2015788186", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
      onProgress: (value) => progress.push(value),
    });

    expect(result.name).toBe("我的收藏");
    expect(result.tracks.map((track) => track.title)).toEqual([
      "测试歌曲",
      "测试歌曲",
    ]);
    expect(result.tracks.map((track) => track.id)).toEqual([
      "favorite-2015788186-BV1A-p1",
      "favorite-2015788186-BV1B-p1",
    ]);
    expect(result.skipped).toBe(1);
    // 单P 条目不得触发详情请求。
    expect(fetcher).toHaveBeenCalledOnce();
    expect(progress).toEqual([{ loaded: 2, total: 3, skipped: 1 }]);
  });

  it("splits a multi-part entry into one track per part", async () => {
    const requested: string[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      requested.push(url);

      if (url.includes("/x/web-interface/view")) {
        return Response.json({
          code: 0,
          data: {
            bvid: "BV1Multi",
            title: "多P视频",
            duration: 300,
            pages: [
              { cid: 111, page: 1, part: "第一首", duration: 100 },
              { cid: 222, page: 2, part: "第二首", duration: 200 },
            ],
          },
        });
      }

      return Response.json(
        favListPayload([
          favMedia({ bvid: "BV1Multi", title: "多P视频", page: 2, duration: 300 }),
        ]),
      );
    });

    const result = await fetchFavFolder("77", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
    });

    expect(result.tracks.map((track) => track.id)).toEqual([
      "favorite-77-BV1Multi-p1",
      "favorite-77-BV1Multi-p2",
    ]);
    expect(result.tracks.map((track) => track.title)).toEqual([
      "多P视频 [P1] 第一首",
      "多P视频 [P2] 第二首",
    ]);
    expect(result.tracks.map((track) => track.duration)).toEqual([100, 200]);
    expect(result.tracks.every((track) => track.source === "favorite")).toBe(
      true,
    );
    expect(requested.filter((url) => url.includes("/view"))).toHaveLength(1);
  });

  it("paginates until has_more is false", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const pn = Number(new URL(String(input)).searchParams.get("pn"));

      return Response.json(
        pn === 1
          ? {
              code: 0,
              data: {
                info: { mid: 1, title: "我的收藏", media_count: 2 },
                medias: [favMedia({ bvid: "BV1A" })],
                has_more: true,
              },
            }
          : {
              code: 0,
              data: {
                info: { mid: 1, title: "我的收藏", media_count: 2 },
                medias: [favMedia({ bvid: "BV1B" })],
                has_more: false,
              },
            },
      );
    });

    const delays: number[] = [];
    const result = await fetchFavFolder("77", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {
        delays.push(1);
      },
    });

    expect(result.tracks.map((track) => track.bvid)).toEqual(["BV1A", "BV1B"]);
    expect(delays).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("favorite owner guard", () => {
  function folderFetcher(info: Record<string, unknown>) {
    return vi.fn(async () =>
      Response.json({
        code: 0,
        data: { info, medias: [], has_more: false },
      }),
    );
  }

  it("stops when the returned folder belongs to another uploader", async () => {
    const fetcher = folderFetcher({
      mid: 71544520,
      title: "别人的收藏夹",
      media_count: 1,
    });

    await expect(
      fetchFavFolderInfo("10526220", {
        fetcher: fetcher as typeof fetch,
        expectedOwnerMid: "686127",
      }),
    ).rejects.toThrow("不属于该 UP 主");
  });

  it("accepts a matching uploader and reports the owner mid", async () => {
    const fetcher = folderFetcher({
      mid: 686127,
      title: "我的收藏",
      media_count: 2,
    });

    await expect(
      fetchFavFolderInfo("1052622027", {
        fetcher: fetcher as typeof fetch,
        expectedOwnerMid: "686127",
      }),
    ).resolves.toEqual({
      name: "我的收藏",
      mediaCount: 2,
      ownerMid: "686127",
    });
  });

  it("skips the check when the response has no uploader mid", async () => {
    const fetcher = folderFetcher({ title: "无 mid", media_count: 1 });

    await expect(
      fetchFavFolderInfo("fid", {
        fetcher: fetcher as typeof fetch,
        expectedOwnerMid: "686127",
      }),
    ).resolves.toEqual({ name: "无 mid", mediaCount: 1 });
  });
});

describe("favorite import errors", () => {
  it("maps HTTP 412 to a rate-limit message", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 412 }));

    await expect(
      fetchFavFolderInfo("fid", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("请求过于频繁");
  });

  it("maps code -101 to a login-required message", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ code: -101, message: "账号未登录" }),
    );

    await expect(
      fetchFavFolderInfo("fid", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("需要登录");
  });

  it("maps code -403 to a private-folder message", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ code: -403, message: "访问权限不足" }),
    );

    await expect(
      fetchFavFolderInfo("fid", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("私密或无权访问");
  });

  it("maps non-ok responses to a network message", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(
      fetchFavFolderInfo("fid", { fetcher: fetcher as typeof fetch }),
    ).rejects.toThrow("网络异常（HTTP 500）");
  });
});
