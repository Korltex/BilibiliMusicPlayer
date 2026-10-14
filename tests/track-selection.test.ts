import { describe, expect, it } from "vitest";
import {
  areAllTracksSelected,
  countSelectedTracks,
  deselectTrack,
  emptyTrackSelection,
  pruneTrackSelection,
  resolveSelectedTrackIds,
  selectAllTracks,
  selectTrack,
  toggleTrackSelection,
} from "../src/app/track-selection";

const tracks = [{ id: "a" }, { id: "b" }, { id: "c" }];

function ids(selection: ReadonlySet<string>): string[] {
  return [...selection].sort();
}

describe("toggleTrackSelection", () => {
  it("selects then deselects the same id", () => {
    const selected = toggleTrackSelection(emptyTrackSelection(), "b");
    expect(ids(selected)).toEqual(["b"]);

    const cleared = toggleTrackSelection(selected, "b");
    expect(cleared.size).toBe(0);
  });

  it("never mutates the input set", () => {
    const before = emptyTrackSelection();
    toggleTrackSelection(before, "a");
    expect(before.size).toBe(0);
  });

  it("keeps every other id while toggling one", () => {
    let selection = emptyTrackSelection();
    selection = toggleTrackSelection(selection, "a");
    selection = toggleTrackSelection(selection, "c");
    selection = toggleTrackSelection(selection, "a");
    expect(ids(selection)).toEqual(["c"]);
  });

  it("identifies tracks by id, so reordering cannot change what is selected", () => {
    // 同一批 id 换一个顺序：集合内容完全不变（顺序不是选择状态的一部分）。
    const selection = toggleTrackSelection(emptyTrackSelection(), "c");
    const reordered = [tracks[2], tracks[0], tracks[1]];
    expect(resolveSelectedTrackIds(selection, reordered)).toEqual(["c"]);
  });
});

describe("selectTrack / deselectTrack", () => {
  it("returns the same reference when nothing changes", () => {
    const selection = selectTrack(emptyTrackSelection(), "a");
    expect(selectTrack(selection, "a")).toBe(selection);
    expect(deselectTrack(selection, "missing")).toBe(selection);
  });
});

describe("selectAllTracks", () => {
  it("selects every track of the playlist", () => {
    expect(ids(selectAllTracks(emptyTrackSelection(), tracks))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("is a no-op (same reference) when everything is already selected", () => {
    const all = selectAllTracks(emptyTrackSelection(), tracks);
    expect(selectAllTracks(all, tracks)).toBe(all);
  });

  it("reports emptiness for an empty playlist instead of claiming all-selected", () => {
    const all = selectAllTracks(emptyTrackSelection(), []);
    expect(all.size).toBe(0);
    expect(areAllTracksSelected(all, [])).toBe(false);
  });
});

describe("pruneTrackSelection", () => {
  it("drops ids that no longer exist", () => {
    const selection = new Set(["a", "b", "gone"]);
    expect(ids(pruneTrackSelection(selection, tracks))).toEqual(["a", "b"]);
  });

  it("returns the same reference when every id is still alive", () => {
    const selection = new Set(["a", "c"]);
    expect(pruneTrackSelection(selection, tracks)).toBe(selection);
  });

  it("returns the same reference for an empty selection", () => {
    const selection = emptyTrackSelection();
    expect(pruneTrackSelection(selection, tracks)).toBe(selection);
  });

  it("empties the selection when the playlist has no tracks", () => {
    expect(pruneTrackSelection(new Set(["a"]), []).size).toBe(0);
  });
});

describe("resolveSelectedTrackIds", () => {
  it("returns selected ids in list order, ignoring stale ids", () => {
    const selection = new Set(["c", "a", "gone"]);
    expect(resolveSelectedTrackIds(selection, tracks)).toEqual(["a", "c"]);
  });

  it("returns an empty array for an empty selection", () => {
    expect(resolveSelectedTrackIds(emptyTrackSelection(), tracks)).toEqual([]);
  });
});

describe("countSelectedTracks", () => {
  it("counts only tracks that still exist in the playlist", () => {
    expect(countSelectedTracks(new Set(["a", "gone"]), tracks)).toBe(1);
    expect(countSelectedTracks(emptyTrackSelection(), tracks)).toBe(0);
  });
});

describe("areAllTracksSelected", () => {
  it("is only true when every track is selected", () => {
    expect(areAllTracksSelected(new Set(["a", "b"]), tracks)).toBe(false);
    expect(areAllTracksSelected(new Set(["a", "b", "c"]), tracks)).toBe(true);
    expect(
      areAllTracksSelected(new Set(["a", "b", "c", "extra"]), tracks),
    ).toBe(true);
  });
});
