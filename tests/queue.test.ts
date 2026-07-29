import { describe, expect, it } from "vitest";
import type { Playlist, Track } from "../src/core/types";
import { selectAdjacentTrack } from "../src/playback/queue";

function track(id: string): Track {
  return {
    id,
    bvid: `BV-${id}`,
    title: id,
    startTime: 0,
    duration: 120,
    addedAt: 0,
    source: "manual",
  };
}

const playlist: Playlist = {
  id: "playlist",
  name: "测试",
  tracks: [track("a"), track("b"), track("c")],
  createdAt: 0,
  updatedAt: 0,
};

describe("queue selection", () => {
  it("stops at the end in sequence mode", () => {
    expect(
      selectAdjacentTrack(playlist, "c", "sequence", { direction: 1 }),
    ).toBeUndefined();
  });

  it("wraps in list loop mode", () => {
    expect(
      selectAdjacentTrack(playlist, "c", "list-loop", { direction: 1 })?.id,
    ).toBe("a");
  });

  it("repeats automatically in single loop mode", () => {
    expect(
      selectAdjacentTrack(playlist, "b", "single-loop", {
        direction: 1,
        automatic: true,
      })?.id,
    ).toBe("b");
  });

  it("does not select the current track in shuffle mode", () => {
    expect(
      selectAdjacentTrack(playlist, "a", "shuffle", {
        direction: 1,
        random: () => 0,
      })?.id,
    ).toBe("b");
  });
});
