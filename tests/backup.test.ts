import { describe, expect, it } from "vitest";
import type { AppData, Playlist } from "../src/core/types";
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  BackupError,
  backupFileName,
  countTracks,
  createPlaylistBackup,
  MAX_BACKUP_BYTES,
  parsePlaylistBackup,
  serializePlaylistBackup,
} from "../src/storage/backup";

function createTrack(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    bvid: "BV1BackupTrack",
    cid: 111,
    page: 1,
    title: `歌曲 ${id}`,
    uploader: "测试UP",
    cover: "https://i0.hdslb.com/cover.jpg",
    startTime: 10.5,
    endTime: 90.25,
    duration: 120,
    addedAt: 1_000,
    source: "manual" as const,
    ...overrides,
  };
}

function createLibrary(): Pick<AppData, "playlists"> {
  return {
    playlists: [
      {
        id: "playlist-a",
        name: "默认歌单",
        tracks: [
          createTrack("track-1"),
          createTrack("track-2", { endTime: undefined }),
        ],
        createdAt: 1,
        updatedAt: 2,
      },
      {
        id: "playlist-b",
        name: "Test",
        tracks: [],
        createdAt: 3,
        updatedAt: 4,
      },
    ],
  };
}

function exportText(): string {
  return serializePlaylistBackup(
    createPlaylistBackup(createLibrary(), "0.1.8", new Date(0)),
  );
}

describe("playlist backup format", () => {
  it("round-trips every playlist and track field", () => {
    const parsed = parsePlaylistBackup(exportText());

    expect(parsed.source).toBe("backup");
    expect(parsed.playlistCount).toBe(2);
    expect(parsed.trackCount).toBe(2);
    expect(parsed.appVersion).toBe("0.1.8");
    expect(parsed.exportedAt).toBe("1970-01-01T00:00:00.000Z");
    expect(parsed.playlists).toEqual(createLibrary().playlists);
    // 小数秒必须原样保留，不能被取整或被判为非法。
    expect(parsed.playlists[0].tracks[0].startTime).toBe(10.5);
    expect(parsed.playlists[0].tracks[0].endTime).toBe(90.25);
  });

  it("writes a readable file with a stable envelope", () => {
    const text = exportText();
    const raw = JSON.parse(text) as Record<string, unknown>;

    expect(text).toContain("\n  ");
    expect(raw.format).toBe(BACKUP_FORMAT);
    expect(raw.formatVersion).toBe(BACKUP_FORMAT_VERSION);
    expect(Object.keys(raw).sort()).toEqual([
      "appVersion",
      "exportedAt",
      "format",
      "formatVersion",
      "library",
    ]);
    expect(raw.library).toEqual({
      version: 1,
      playlists: createLibrary().playlists,
    });
  });

  it("never exports volume, playback session, audio-only or layout data", () => {
    const data: AppData = {
      version: 1,
      playlists: createLibrary().playlists,
      activePlaylistId: "playlist-a",
      playMode: "shuffle",
      volume: 0.42,
      playback: {
        playlistId: "playlist-a",
        trackId: "track-1",
        currentTime: 55,
        resumeRequested: true,
        updatedAt: 9,
      },
    };

    const text = serializePlaylistBackup(
      createPlaylistBackup(data, "0.1.8", new Date(0)),
    );

    expect(text).not.toContain("volume");
    expect(text).not.toContain("resumeRequested");
    expect(text).not.toContain("activePlaylistId");
    expect(text).not.toContain("playMode");
    expect(text).not.toContain("playback");
    expect(text).not.toContain("audio-only");
    expect(text).not.toContain("layout");
    expect(text).not.toContain("0.42");
    expect(text).not.toContain("55");
  });

  it("builds the documented file name", () => {
    expect(backupFileName(new Date(2026, 9, 1, 3, 4, 5))).toBe(
      "bilibili-music-player-playlists-20261001-030405.json",
    );
  });

  it("counts playlists and tracks", () => {
    expect(countTracks(createLibrary().playlists)).toBe(2);
    expect(countTracks([])).toBe(0);
  });
});

describe("playlist backup parsing", () => {
  it("extracts the library from a raw Tampermonkey storage dump", () => {
    const storage = {
      "bilibili-music-player:audio-only": true,
      "bilibili-music-player:data": {
        version: 1,
        playlists: createLibrary().playlists,
      },
      "bilibili-music-player:layout": { version: 1, lastOpenMode: "minimal" },
    };

    const parsed = parsePlaylistBackup(JSON.stringify(storage));

    expect(parsed.source).toBe("tampermonkey-storage");
    expect(parsed.playlists).toEqual(createLibrary().playlists);
  });

  it("accepts a legacy bare AppData object", () => {
    const legacy = {
      version: 1,
      playlists: createLibrary().playlists,
      activePlaylistId: "playlist-a",
      playMode: "list-loop",
      volume: 1,
      playback: {
        playlistId: "playlist-a",
        currentTime: 0,
        resumeRequested: false,
        updatedAt: 1,
      },
    };

    const parsed = parsePlaylistBackup(JSON.stringify(legacy));

    expect(parsed.source).toBe("legacy-app-data");
    expect(parsed.playlists).toEqual(createLibrary().playlists);
  });

  it("fills missing playlist timestamps instead of rejecting the backup", () => {
    const parsed = parsePlaylistBackup(
      JSON.stringify({
        version: 1,
        playlists: [
          {
            id: "playlist-a",
            name: "默认歌单",
            tracks: [createTrack("track-1")],
          },
        ],
      }),
      777,
    );

    expect(parsed.playlists[0].createdAt).toBe(777);
    expect(parsed.playlists[0].updatedAt).toBe(777);
  });

  it("rejects broken or unsupported files", () => {
    const cases: [string, string][] = [
      ["", "文件不是有效的 JSON"],
      ["{", "文件不是有效的 JSON"],
      ["[]", "文件内容必须是 JSON 对象"],
      ['"歌单"', "文件内容必须是 JSON 对象"],
      [
        JSON.stringify({
          format: BACKUP_FORMAT,
          formatVersion: 2,
          library: {},
        }),
        "备份文件版本不受支持：2（当前支持 1）",
      ],
      [
        JSON.stringify({ format: "other-app-backup", formatVersion: 1 }),
        "这不是 Bilibili 音乐播放器的歌单备份",
      ],
      [JSON.stringify({ version: 1, playlists: [] }), "文件里没有任何歌单"],
      [
        JSON.stringify({ version: 2, playlists: [{ id: "a" }] }),
        "歌单库版本不受支持：2（当前支持 1）",
      ],
      [JSON.stringify({ version: 1 }), "文件里没有歌单列表"],
      [
        JSON.stringify({ "bilibili-music-player:data": null }),
        "文件里没有歌单库数据",
      ],
    ];

    for (const [text, message] of cases) {
      expect(() => parsePlaylistBackup(text), text).toThrow(BackupError);
      expect(() => parsePlaylistBackup(text), text).toThrow(message);
    }
  });

  it("rejects duplicate playlist and track ids", () => {
    const duplicatePlaylist = {
      version: 1,
      playlists: [
        { id: "playlist-a", name: "A", tracks: [] },
        { id: "playlist-a", name: "B", tracks: [] },
      ],
    };
    expect(() =>
      parsePlaylistBackup(JSON.stringify(duplicatePlaylist)),
    ).toThrow("歌单 ID 重复：playlist-a");

    const duplicateTrack = {
      version: 1,
      playlists: [
        { id: "playlist-a", name: "A", tracks: [createTrack("track-1")] },
        { id: "playlist-b", name: "B", tracks: [createTrack("track-1")] },
      ],
    };
    expect(() => parsePlaylistBackup(JSON.stringify(duplicateTrack))).toThrow(
      "歌曲 ID 重复：track-1",
    );
  });

  it("rejects invalid track fields", () => {
    const withTrack = (track: Record<string, unknown>, name = "A") =>
      JSON.stringify({
        version: 1,
        playlists: [{ id: "playlist-a", name, tracks: [track] }],
      });

    expect(() =>
      parsePlaylistBackup(withTrack(createTrack("track-1", { bvid: "" }))),
    ).toThrow("歌单「A」的第 1 首歌缺少有效 bvid");
    expect(() =>
      parsePlaylistBackup(withTrack(createTrack("track-1", { title: "  " }))),
    ).toThrow("歌单「A」的第 1 首歌缺少有效标题");
    expect(() =>
      parsePlaylistBackup(withTrack(createTrack("track-1", { startTime: -1 }))),
    ).toThrow("歌单「A」的第 1 首歌的 startTime 不能是负数");
    expect(() =>
      parsePlaylistBackup(
        withTrack(createTrack("track-1", { duration: "120" })),
      ),
    ).toThrow("歌单「A」的第 1 首歌的 duration 无效");
    expect(() =>
      parsePlaylistBackup(withTrack(createTrack("track-1", { addedAt: null }))),
    ).toThrow("歌单「A」的第 1 首歌的 addedAt 无效");
    expect(() =>
      parsePlaylistBackup(
        withTrack(createTrack("track-1", { source: "cloud" })),
      ),
    ).toThrow(
      "歌单「A」的第 1 首歌的 source 无效（只接受 manual / collection / favorite）",
    );
    expect(() =>
      parsePlaylistBackup(withTrack(createTrack("track-1", { endTime: 10.5 }))),
    ).toThrow("歌单「A」的第 1 首歌的 endTime 必须晚于 startTime");
    expect(() => parsePlaylistBackup(withTrack(createTrack("", {})))).toThrow(
      "歌单「A」的第 1 首歌缺少有效 ID",
    );
  });

  it("rejects empty playlist ids and names", () => {
    expect(() =>
      parsePlaylistBackup(
        JSON.stringify({
          version: 1,
          playlists: [{ id: "", name: "A", tracks: [] }],
        }),
      ),
    ).toThrow("第 1 个歌单缺少有效 ID");

    expect(() =>
      parsePlaylistBackup(
        JSON.stringify({
          version: 1,
          playlists: [{ id: "a", name: " ", tracks: [] }],
        }),
      ),
    ).toThrow("第 1 个歌单缺少有效名称");

    expect(() =>
      parsePlaylistBackup(
        JSON.stringify({ version: 1, playlists: [{ id: "a", name: "A" }] }),
      ),
    ).toThrow("歌单「A」没有歌曲列表");
  });

  it("rejects files above the size limit", () => {
    const oversized = `{"pad":"${"x".repeat(MAX_BACKUP_BYTES)}"}`;

    expect(() => parsePlaylistBackup(oversized)).toThrow(
      "文件超过 10 MiB 上限，不是歌单备份",
    );
  });

  it("drops optional fields with the wrong type instead of failing", () => {
    const parsed = parsePlaylistBackup(
      JSON.stringify({
        version: 1,
        playlists: [
          {
            id: "playlist-a",
            name: "A",
            tracks: [
              createTrack("track-1", {
                cid: "111",
                page: 0,
                uploader: 42,
                cover: null,
                endTime: null,
              }),
            ],
          },
        ],
      }),
    );

    const track = parsed.playlists[0].tracks[0];
    expect(track.cid).toBeUndefined();
    expect(track.page).toBeUndefined();
    expect(track.uploader).toBeUndefined();
    expect(track.cover).toBeUndefined();
    expect(track.endTime).toBeUndefined();
    expect(track.title).toBe("歌曲 track-1");
  });

  it("never falls back to default playlists on invalid input", () => {
    let result: Playlist[] | undefined;
    try {
      result = parsePlaylistBackup("{}").playlists;
    } catch (error) {
      expect(error).toBeInstanceOf(BackupError);
    }

    // 与 migrateAppData() 不同：非法输入必须抛错，绝不能返回一张空歌单。
    expect(result).toBeUndefined();
  });
});
