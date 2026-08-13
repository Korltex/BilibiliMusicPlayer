import { describe, expect, it, vi } from "vitest";
import { parseVideoChapters, readVideoChapters } from "../src/bili/chapters";

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Bilibili video chapters", () => {
  it("selects the requested multi-part cid before reading view points", async () => {
    const request = vi.fn(
      async (input: RequestInfo | URL, _init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.pathname === "/x/web-interface/view") {
          return jsonResponse({
            code: 0,
            data: {
              pages: [
                { page: 1, cid: 101 },
                { page: 2, cid: 202 },
              ],
            },
          });
        }

        expect(url.pathname).toBe("/x/player/wbi/v2");
        expect(url.searchParams.get("bvid")).toBe("BV1MultiPart");
        expect(url.searchParams.get("cid")).toBe("202");
        return jsonResponse({
          code: 0,
          data: {
            view_points: [
              {
                content: " ceremony ",
                from: 364.8,
                to: 558.1,
                imgUrl: "https://example.com/ceremony.jpg",
              },
            ],
          },
        });
      },
    );

    const result = await readVideoChapters(
      { bvid: "BV1MultiPart", page: 2 },
      { fetch: request },
    );

    expect(result).toEqual({
      cid: 202,
      chapters: [
        {
          title: "ceremony",
          startTime: 364,
          endTime: 559,
          cover: "https://example.com/ceremony.jpg",
        },
      ],
    });
    expect(request).toHaveBeenCalledTimes(2);
    for (const [, init] of request.mock.calls) {
      expect(init).toMatchObject({ credentials: "include" });
    }
  });

  it("uses an existing cid without requesting the video page list", async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe("/x/player/wbi/v2");
      expect(url.searchParams.get("cid")).toBe("303");
      return jsonResponse({ code: 0, data: { view_points: [] } });
    });

    await expect(
      readVideoChapters(
        { bvid: "BV1ExistingCid", page: 7, cid: 303 },
        { fetch: request },
      ),
    ).resolves.toEqual({ cid: 303, chapters: [] });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("filters empty titles and invalid time ranges", () => {
    expect(
      parseVideoChapters({
        code: 0,
        data: {
          view_points: [
            { content: "", from: 0, to: 10 },
            { content: "negative", from: -1, to: 10 },
            { content: "backwards", from: 10, to: 9 },
            { content: "not numeric", from: "10", to: 20 },
            { content: "valid", from: 1.9, to: 2.1 },
          ],
        },
      }),
    ).toEqual([{ title: "valid", startTime: 1, endTime: 3, cover: undefined }]);
  });

  it("returns an empty list for empty, invalid, and failed responses", async () => {
    expect(parseVideoChapters({ code: 0, data: { view_points: [] } })).toEqual(
      [],
    );
    expect(parseVideoChapters({ code: 0, data: null })).toEqual([]);

    const failedRequest = vi.fn(async () => {
      throw new TypeError("network failed");
    });
    await expect(
      readVideoChapters(
        { bvid: "BV1Failure", cid: 404 },
        { fetch: failedRequest },
      ),
    ).resolves.toEqual({ cid: 404, chapters: [] });
  });
});
