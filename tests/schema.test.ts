import { describe, expect, it } from "vitest";
import { createDefaultData, migrateAppData } from "../src/storage/schema";

describe("storage schema", () => {
  it("creates a usable default playlist", () => {
    const data = createDefaultData(100);
    expect(data.playlists).toHaveLength(1);
    expect(data.playback.playlistId).toBe(data.activePlaylistId);
  });

  it("falls back when persisted data is invalid", () => {
    const data = migrateAppData({ version: 99 });
    expect(data.version).toBe(1);
    expect(data.playlists).toHaveLength(1);
  });
});
