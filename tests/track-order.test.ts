import { describe, expect, it } from "vitest";
import {
  moveTrackToIndex,
  resolveDropIndex,
  resolveKeyboardMove,
} from "../src/app/track-order";
import type { Track } from "../src/core/types";

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

function ids(tracks: readonly { id: string }[]): string[] {
  return tracks.map((item) => item.id);
}

const base = [track("a"), track("b"), track("c"), track("d")];

describe("moveTrackToIndex", () => {
  it("moves a track down using an insert-before index", () => {
    // 把 a 插到 c（下标 2）之前 → a 落到 b 之后。
    expect(ids(moveTrackToIndex(base, "a", 2)!.tracks)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("moves a track up", () => {
    expect(ids(moveTrackToIndex(base, "d", 1)!.tracks)).toEqual([
      "a",
      "d",
      "b",
      "c",
    ]);
  });

  it("appends to the end with the length index", () => {
    const moved = moveTrackToIndex(base, "a", base.length)!;
    expect(ids(moved.tracks)).toEqual(["b", "c", "d", "a"]);
    expect(moved.index).toBe(3);
  });

  it("moves to the head with index 0", () => {
    expect(ids(moveTrackToIndex(base, "c", 0)!.tracks)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });

  it("clamps out-of-range indexes instead of dropping the track", () => {
    expect(ids(moveTrackToIndex(base, "b", 99)!.tracks)).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
    expect(ids(moveTrackToIndex(base, "b", -5)!.tracks)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("reports no change when the insert position keeps the order", () => {
    expect(moveTrackToIndex(base, "b", 1)).toBeUndefined();
    // 插到自己的下一格（源下标 + 1）同样等于原地不动。
    expect(moveTrackToIndex(base, "b", 2)).toBeUndefined();
  });

  it("ignores unknown tracks and non-finite indexes", () => {
    expect(moveTrackToIndex(base, "missing", 1)).toBeUndefined();
    expect(moveTrackToIndex(base, "a", Number.NaN)).toBeUndefined();
  });

  it("does not mutate the input array", () => {
    const source = [...base];
    moveTrackToIndex(source, "a", 3);
    expect(ids(source)).toEqual(["a", "b", "c", "d"]);
  });

  it("handles single-track and empty playlists", () => {
    expect(moveTrackToIndex([track("a")], "a", 1)).toBeUndefined();
    expect(moveTrackToIndex([], "a", 0)).toBeUndefined();
  });
});

describe("resolveKeyboardMove", () => {
  it("moves one step down and reports the resulting position", () => {
    const move = resolveKeyboardMove(base, "b", "ArrowDown")!;
    expect(move).toEqual({ toIndex: 3, index: 2 });
    expect(ids(moveTrackToIndex(base, "b", move.toIndex)!.tracks)).toEqual([
      "a",
      "c",
      "b",
      "d",
    ]);
  });

  it("moves one step up", () => {
    const move = resolveKeyboardMove(base, "b", "ArrowUp")!;
    expect(move).toEqual({ toIndex: 0, index: 0 });
    expect(ids(moveTrackToIndex(base, "b", move.toIndex)!.tracks)).toEqual([
      "b",
      "a",
      "c",
      "d",
    ]);
  });

  it("jumps to the first or last position for Home/End", () => {
    const home = resolveKeyboardMove(base, "c", "Home")!;
    expect(home).toEqual({ toIndex: 0, index: 0 });
    expect(ids(moveTrackToIndex(base, "c", home.toIndex)!.tracks)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);

    const end = resolveKeyboardMove(base, "b", "End")!;
    expect(end).toEqual({ toIndex: 4, index: 3 });
    expect(ids(moveTrackToIndex(base, "b", end.toIndex)!.tracks)).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
  });

  it("stops at the list boundaries", () => {
    expect(resolveKeyboardMove(base, "a", "ArrowUp")).toBeUndefined();
    expect(resolveKeyboardMove(base, "a", "Home")).toBeUndefined();
    expect(resolveKeyboardMove(base, "d", "ArrowDown")).toBeUndefined();
    expect(resolveKeyboardMove(base, "d", "End")).toBeUndefined();
  });

  it("ignores unknown tracks and single-track playlists", () => {
    expect(resolveKeyboardMove(base, "missing", "ArrowDown")).toBeUndefined();
    expect(resolveKeyboardMove([track("a")], "a", "ArrowDown")).toBeUndefined();
  });
});

describe("resolveDropIndex", () => {
  it("treats the source slot and the slot right after it as no movement", () => {
    expect(resolveDropIndex(1, 1)).toBeUndefined();
    expect(resolveDropIndex(1, 2)).toBeUndefined();
  });

  it("keeps real drop targets", () => {
    expect(resolveDropIndex(1, 0)).toBe(0);
    expect(resolveDropIndex(1, 3)).toBe(3);
    expect(resolveDropIndex(1, 4)).toBe(4);
  });

  it("ignores invalid source indexes", () => {
    expect(resolveDropIndex(-1, 2)).toBeUndefined();
    expect(resolveDropIndex(0, -1)).toBeUndefined();
  });
});
