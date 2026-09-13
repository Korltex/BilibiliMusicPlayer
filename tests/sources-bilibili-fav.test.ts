import { describe, expect, it, vi } from "vitest";
import {
  favoritePlaylistId,
  favoriteTrackId,
  fetchFavFolder,
  fetchFavFolderInfo,
  mapFavToTrack,
  parseFavUrl,
  type FavProgress,
  type FavTarget,
} from "../src/sources/bilibili-fav";

function favMedia(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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

function folderTarget(input: string): FavTarget {
  const result = parseFavUrl(input);
  expect(result.kind).toBe("folder");
  if (result.kind !== "folder") {
    throw new Error("expected a favorite folder link");
  }
  return result.target;
}

describe("parseFavUrl", () => {
  it("parses the fid query parameter and the owner mid", () => {
    expect(
      folderTarget("https://space.bilibili.com/123/favlist?fid=2015788186"),
    ).toEqual({ fid: "2015788186", ownerMid: "123" });
  });

  it("parses fid among other query parameters", () => {
    expect(
      folderTarget(
        "https://space.bilibili.com/123/favlist?fid=2015788186&ctid=0",
      ),
    ).toEqual({ fid: "2015788186", ownerMid: "123" });
  });

  it("parses a medialist detail path without an owner mid", () => {
    expect(
      folderTarget("https://www.bilibili.com/medialist/detail/ml2015788186"),
    ).toEqual({ fid: "2015788186" });
  });

  it("rejects a bare numeric id, which has no owner to verify", () => {
    expect(parseFavUrl("2015788186")).toEqual({ kind: "unknown" });
  });

  it("rejects invalid or unrelated input", () => {
    expect(parseFavUrl("https://example.com/favlist?fid=123")).toEqual({
      kind: "unknown",
    });
    expect(parseFavUrl("not a url")).toEqual({ kind: "unknown" });
    expect(parseFavUrl("https://space.bilibili.com/123/favlist")).toEqual({
      kind: "unknown",
    });
    expect(parseFavUrl("")).toEqual({ kind: "unknown" });
  });

  it("routes collection (season) links to the season source", () => {
    expect(
      parseFavUrl(
        "https://space.bilibili.com/100969474/favlist?fid=3221717&ftype=collect&ctype=21",
      ),
    ).toEqual({
      kind: "season",
      target: { seasonId: "3221717", mid: "100969474" },
    });
  });

  it("still treats collected favorite folders as folders", () => {
    expect(
      folderTarget(
        "https://space.bilibili.com/100969474/favlist?fid=1306978874&ftype=collect",
      ),
    ).toEqual({ fid: "1306978874", ownerMid: "100969474" });
  });

  it("rejects list-page links that are not favlist links", () => {
    for (const input of [
      "https://space.bilibili.com/3546619314178489/lists?sid=3221717&type=season",
      "https://space.bilibili.com/100969474/lists/1947439?type=series",
      "https://www.bilibili.com/list/100969474?sid=1947439",
    ]) {
      expect(parseFavUrl(input)).toEqual({
        kind: "unsupported",
        message: "这是合集/列表页链接，请改用收藏页 favlist 里的链接。",
      });
    }
  });
});

describe("favorite ids", () => {
  it("derives stable playlist and track ids", () => {
    expect(favoritePlaylistId("2015788186")).toBe("favorite-2015788186");
    expect(favoriteTrackId("2015788186", "BV1CZ4y1T7gC")).toBe(
      "favorite-2015788186-BV1CZ4y1T7gC-1",
    );
    expect(favoriteTrackId("2015788186", "BV1CZ4y1T7gC", 3)).toBe(
      "favorite-2015788186-BV1CZ4y1T7gC-3",
    );
  });
});

describe("mapFavToTrack", () => {
  const now = 1234567890;

  it("maps a valid video entry to a Track", () => {
    expect(mapFavToTrack("2015788186", favMedia(), now)).toEqual({
      id: "favorite-2015788186-BV1CZ4y1T7gC-1",
      bvid: "BV1CZ4y1T7gC",
      title: "测试歌曲",
      uploader: "测试UP主",
      cover: "https://i2.hdslb.com/bfs/archive/cover.jpg",
      startTime: 0,
      duration: 546,
      addedAt: now,
      source: "favorite",
    });
  });

  it("keeps multi-part pages and drops page 1", () => {
    const multiPage = mapFavToTrack(
      "fid",
      favMedia({ page: 3, bvid: "BV1MultiPart" }),
      now,
    );
    expect(multiPage).toMatchObject({
      id: "favorite-fid-BV1MultiPart-3",
      page: 3,
    });
    expect(mapFavToTrack("fid", favMedia({ page: 1 }), now)).not.toHaveProperty(
      "page",
    );
  });

  it("filters invalid, deleted, non-video, and bvid-less entries", () => {
    expect(mapFavToTrack("fid", favMedia({ attr: 1 }), now)).toBeUndefined();
    expect(mapFavToTrack("fid", favMedia({ attr: 9 }), now)).toBeUndefined();
    expect(mapFavToTrack("fid", favMedia({ type: 12 }), now)).toBeUndefined();
    expect(mapFavToTrack("fid", favMedia({ bvid: "" }), now)).toBeUndefined();
    expect(mapFavToTrack("fid", null, now)).toBeUndefined();
  });

  it("falls back to bvid when the title is empty", () => {
    expect(mapFavToTrack("fid", favMedia({ title: "  " }), now)).toMatchObject({
      title: "BV1CZ4y1T7gC",
    });
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

describe("fetchFavFolder", () => {
  it("paginates until has_more is false and reports progress", async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      const pn = Number(url.searchParams.get("pn"));

      if (pn === 1) {
        return Response.json({
          code: 0,
          data: {
            info: { title: "我的收藏", media_count: 3 },
            medias: [
              favMedia({ bvid: "BV1First" }),
              favMedia({ bvid: "BV1Invalid", attr: 1 }),
            ],
            has_more: true,
          },
        });
      }

      return Response.json({
        code: 0,
        data: {
          info: { title: "我的收藏", media_count: 3 },
          medias: [favMedia({ bvid: "BV1Last" })],
          has_more: false,
        },
      });
    });

    const progress: FavProgress[] = [];
    const delayCalls: number[] = [];
    const result = await fetchFavFolder("2015788186", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {
        delayCalls.push(1);
      },
      onProgress: (next) => progress.push(next),
    });

    expect(result.name).toBe("我的收藏");
    expect(result.tracks.map((track) => track.bvid)).toEqual([
      "BV1First",
      "BV1Last",
    ]);
    expect(result.skipped).toBe(1);
    expect(progress).toEqual([
      { loaded: 1, total: 3, skipped: 1 },
      { loaded: 2, total: 3, skipped: 1 },
    ]);
    expect(delayCalls).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("builds the expected request URL with pagination parameters", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        code: 0,
        data: { info: { title: "空", media_count: 0 }, medias: [], has_more: false },
      }),
    );

    await fetchFavFolder("12345", {
      fetcher: fetcher as typeof fetch,
      delay: async () => {},
    });

    const requested = String((fetcher as ReturnType<typeof vi.fn>).mock.calls[0][0]);
    const url = new URL(requested);
    expect(url.hostname).toBe("api.bilibili.com");
    expect(url.pathname).toBe("/x/v3/fav/resource/list");
    expect(url.searchParams.get("media_id")).toBe("12345");
    expect(url.searchParams.get("ps")).toBe("20");
    expect(url.searchParams.get("pn")).toBe("1");
    expect(url.searchParams.get("platform")).toBe("web");
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
