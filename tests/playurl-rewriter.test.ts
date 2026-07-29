import { describe, expect, it } from "vitest";
import {
  isPlayurlUrl,
  rewritePlayurlPayload,
  rewritePlayurlText,
} from "../src/bili/playurl-rewriter";

describe("playurl rewriter", () => {
  it("matches ordinary and WBI playurl endpoints only", () => {
    expect(
      isPlayurlUrl("https://api.bilibili.com/x/player/playurl?bvid=BV1Test"),
    ).toBe(true);
    expect(isPlayurlUrl("/x/player/wbi/playurl?bvid=BV1Test")).toBe(true);
    expect(isPlayurlUrl("https://api.bilibili.com/x/player/playurl/")).toBe(
      true,
    );
    expect(
      isPlayurlUrl("https://api.bilibili.com/pgc/player/web/playurl"),
    ).toBe(false);
    expect(isPlayurlUrl("https://api.bilibili.com/x/player/v2")).toBe(false);
  });

  it("rewrites data.dash without mutating the input or audio metadata", () => {
    const payload = {
      code: 0,
      data: {
        dash: {
          video: [{ id: 80, baseUrl: "video.m4s" }],
          audio: [{ id: 30280, baseUrl: "audio.m4s" }],
          dolby: { audio: [{ id: 30250 }] },
          flac: { audio: { id: 30251 } },
        },
      },
    };

    const result = rewritePlayurlPayload(payload);

    expect(result).toMatchObject({
      changed: true,
      supported: true,
      reason: "rewritten",
    });
    expect(result.value).not.toBe(payload);
    expect((result.value as typeof payload).data.dash.video).toEqual([]);
    expect((result.value as typeof payload).data.dash.audio).toEqual(
      payload.data.dash.audio,
    );
    expect((result.value as typeof payload).data.dash.dolby).toEqual(
      payload.data.dash.dolby,
    );
    expect(payload.data.dash.video).toHaveLength(1);
  });

  it.each([
    {
      name: "result.dash",
      payload: {
        result: {
          dash: {
            video: [{ id: 64 }],
            audio: [{ id: 30280 }],
          },
        },
      },
      readVideo: (value: unknown) =>
        (
          value as {
            result: { dash: { video: unknown[] } };
          }
        ).result.dash.video,
    },
    {
      name: "data.video_info.dash",
      payload: {
        data: {
          video_info: {
            dash: {
              video: [{ id: 32 }],
              audio: [{ id: 30216 }],
            },
          },
        },
      },
      readVideo: (value: unknown) =>
        (
          value as {
            data: { video_info: { dash: { video: unknown[] } } };
          }
        ).data.video_info.dash.video,
    },
  ])("rewrites $name", ({ payload, readVideo }) => {
    const result = rewritePlayurlPayload(payload);

    expect(result.supported).toBe(true);
    expect(result.changed).toBe(true);
    expect(readVideo(result.value)).toEqual([]);
  });

  it("treats an empty video array with usable audio as already audio-only", () => {
    const payload = {
      data: {
        dash: {
          video: [],
          audio: [{ id: 30280 }],
        },
      },
    };

    const result = rewritePlayurlPayload(payload);

    expect(result).toEqual({
      value: payload,
      changed: false,
      supported: true,
      reason: "already-audio-only",
    });
  });

  it("leaves DASH without usable audio unchanged", () => {
    const payload = {
      data: {
        dash: {
          video: [{ id: 80 }],
          audio: [],
        },
      },
    };

    const result = rewritePlayurlPayload(payload);

    expect(result).toEqual({
      value: payload,
      changed: false,
      supported: false,
      reason: "missing-audio",
    });
  });

  it("reports durl-only responses without changing them", () => {
    const payload = {
      data: {
        durl: [{ url: "muxed.mp4" }],
      },
    };

    const result = rewritePlayurlPayload(payload);

    expect(result).toEqual({
      value: payload,
      changed: false,
      supported: false,
      reason: "durl-only",
    });
  });

  it("fails open for malformed JSON and non-playurl URLs", () => {
    const malformed = rewritePlayurlText(
      "https://api.bilibili.com/x/player/playurl",
      "{not-json",
    );
    expect(malformed).toEqual({
      value: "{not-json",
      changed: false,
      supported: false,
      reason: "invalid-json",
    });

    const unrelated = rewritePlayurlText(
      "https://api.bilibili.com/x/player/v2",
      '{"data":{"dash":{"video":[1],"audio":[2]}}}',
    );
    expect(unrelated.reason).toBe("not-playurl");
    expect(unrelated.changed).toBe(false);
  });
});
