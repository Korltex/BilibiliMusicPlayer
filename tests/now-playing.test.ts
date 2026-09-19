import { describe, expect, it } from "vitest";
import type { CurrentVideoMetadata } from "../src/bili/metadata";
import type { NowPlayingState, Track } from "../src/core/types";
import {
  FALLBACK_NOW_PLAYING_TITLE,
  nowPlayingEquals,
  resolveNowPlaying,
} from "../src/playback/now-playing";

const metadata: CurrentVideoMetadata = {
  bvid: "BV1Metadata",
  page: 2,
  title: "页面视频",
  uploader: "页面UP主",
  cover: "https://i0.hdslb.com/page.jpg",
};

function track(): Track {
  return {
    id: "track-a",
    bvid: "BV1Metadata",
    page: 2,
    title: "歌单歌曲",
    uploader: "歌曲UP主",
    cover: "https://i0.hdslb.com/track.jpg",
    startTime: 30,
    endTime: 90,
    duration: 240,
    addedAt: 1,
    source: "manual",
  };
}

describe("resolveNowPlaying", () => {
  it("prefers the playlist track for the title and segment boundaries", () => {
    expect(resolveNowPlaying({ track: track(), metadata })).toEqual({
      trackId: "track-a",
      title: "歌单歌曲",
      uploader: "页面UP主",
      cover: "https://i0.hdslb.com/page.jpg",
      startTime: 30,
      endTime: 90,
      storedDuration: 240,
    });
  });

  it("prefers the current page for the uploader and cover", () => {
    const entry = resolveNowPlaying({
      track: track(),
      metadata: { ...metadata, uploader: "新UP主", cover: "new.jpg" },
    });

    expect(entry.uploader).toBe("新UP主");
    expect(entry.cover).toBe("new.jpg");
  });

  it("prefers the cover resolved for the current video over the page meta", () => {
    const entry = resolveNowPlaying({
      track: track(),
      metadata,
      pageCover: "https://i1.hdslb.com/bfs/archive/api.webp",
    });

    expect(entry.cover).toBe("https://i1.hdslb.com/bfs/archive/api.webp");
  });

  it("keeps using the page cover while the resolved cover is unavailable", () => {
    const entry = resolveNowPlaying({
      track: track(),
      metadata,
      pageCover: undefined,
    });

    expect(entry.cover).toBe("https://i0.hdslb.com/page.jpg");
  });

  it("uses the page metadata outside playlist playback", () => {
    expect(resolveNowPlaying({ track: undefined, metadata })).toEqual({
      trackId: undefined,
      title: "页面视频",
      uploader: "页面UP主",
      cover: "https://i0.hdslb.com/page.jpg",
      startTime: 0,
      endTime: undefined,
      storedDuration: 0,
    });
  });

  it("falls back to the track when the page metadata is missing", () => {
    const entry = resolveNowPlaying({ track: track(), metadata: undefined });

    expect(entry.title).toBe("歌单歌曲");
    expect(entry.uploader).toBe("歌曲UP主");
    expect(entry.cover).toBe("https://i0.hdslb.com/track.jpg");
  });

  it("falls back to a neutral title when no source is available", () => {
    const entry = resolveNowPlaying({ track: undefined, metadata: undefined });

    expect(entry.title).toBe(FALLBACK_NOW_PLAYING_TITLE);
    expect(entry.startTime).toBe(0);
    expect(entry.endTime).toBeUndefined();
  });
});

describe("nowPlayingEquals", () => {
  const base = resolveNowPlaying({ track: track(), metadata });

  it("treats entries with the same optional fields as equal", () => {
    expect(
      nowPlayingEquals(base, resolveNowPlaying({ track: track(), metadata })),
    ).toBe(true);
    expect(nowPlayingEquals(base, { ...base })).toBe(true);
  });

  it("ignores the page title while a playlist track owns the title", () => {
    expect(
      nowPlayingEquals(
        base,
        resolveNowPlaying({
          track: track(),
          metadata: { ...metadata, title: "新标题" },
        }),
      ),
    ).toBe(true);
  });

  it("detects a late page metadata update", () => {
    expect(
      nowPlayingEquals(
        base,
        resolveNowPlaying({
          track: track(),
          metadata: { ...metadata, uploader: "新UP主" },
        }),
      ),
    ).toBe(false);

    const pageContext = resolveNowPlaying({ track: undefined, metadata });
    expect(
      nowPlayingEquals(
        pageContext,
        resolveNowPlaying({
          track: undefined,
          metadata: { ...metadata, title: "新标题" },
        }),
      ),
    ).toBe(false);
  });

  it("detects a resolved cover arriving after the page meta", () => {
    const pageContext = resolveNowPlaying({ track: undefined, metadata });

    expect(
      nowPlayingEquals(
        pageContext,
        resolveNowPlaying({
          track: undefined,
          metadata,
          pageCover: "https://i1.hdslb.com/bfs/archive/api.webp",
        }),
      ),
    ).toBe(false);
  });

  it("detects a removed or added playlist track", () => {
    const withoutTrack: NowPlayingState = resolveNowPlaying({
      track: undefined,
      metadata,
    });

    expect(nowPlayingEquals(base, withoutTrack)).toBe(false);
    expect(nowPlayingEquals(withoutTrack, { ...withoutTrack })).toBe(true);
  });
});
