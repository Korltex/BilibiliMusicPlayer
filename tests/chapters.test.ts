import { describe, expect, it, vi } from "vitest";
import { fetchVideoChapters, parseVideoChapters } from "../src/bili/chapters";

describe("Bilibili video chapters", () => {
  it("normalizes valid chapters and filters invalid entries", () => {
    expect(
      parseVideoChapters([
        {
          content: " ceremony ",
          from: 364.8,
          to: 558.2,
          imgUrl: "http://i0.hdslb.com/chapter.jpg",
        },
        { content: "", from: 0, to: 10 },
        { content: "invalid range", from: 20, to: 10 },
        { content: "invalid time", from: "20", to: 30 },
      ]),
    ).toEqual([
      {
        title: "ceremony",
        startTime: 364,
        endTime: 559,
        cover: "https://i0.hdslb.com/chapter.jpg",
      },
    ]);
  });

  it("resolves the selected page cid and fetches its chapters", async () => {
    const requestedUrls: string[] = [];
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes("/x/web-interface/view")) {
        return Response.json({
          code: 0,
          data: { pages: [{ cid: 101 }, { cid: 202 }] },
        });
      }

      return Response.json({
        code: 0,
        data: {
          view_points: [{ content: "ceremony", from: 364, to: 559 }],
        },
      });
    });

    await expect(
      fetchVideoChapters(
        { bvid: "BV1ChapterTest", page: 2 },
        { fetcher: fetcher as typeof fetch },
      ),
    ).resolves.toEqual({
      cid: 202,
      chapters: [{ title: "ceremony", startTime: 364, endTime: 559 }],
    });
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls[1]).toContain("bvid=BV1ChapterTest");
    expect(requestedUrls[1]).toContain("cid=202");
  });

  it("uses an existing cid without requesting video pages", async () => {
    const fetcher = vi.fn(async () =>
      Response.json({ code: 0, data: { view_points: [] } }),
    );

    await expect(
      fetchVideoChapters(
        { bvid: "BV1ChapterTest", cid: 303 },
        { fetcher: fetcher as typeof fetch },
      ),
    ).resolves.toEqual({ cid: 303, chapters: [] });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("falls back to an empty chapter list when requests fail", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("network failed");
    });

    await expect(
      fetchVideoChapters(
        { bvid: "BV1ChapterTest" },
        { fetcher: fetcher as typeof fetch },
      ),
    ).resolves.toEqual({ chapters: [] });
  });
});
