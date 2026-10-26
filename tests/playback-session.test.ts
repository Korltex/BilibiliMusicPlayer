import { describe, expect, it } from "vitest";
import {
  createPlaybackSession,
  migratePlaybackSession,
} from "../src/storage/playback-session";
import { createDefaultData } from "../src/storage/schema";

describe("playback session", () => {
  it("uses the legacy shared data only for an initial playlist and mode", () => {
    const data = createDefaultData(100);
    data.playMode = "shuffle";
    data.playback = {
      playlistId: data.activePlaylistId,
      trackId: "legacy-track",
      currentTime: 42,
      resumeRequested: true,
      updatedAt: 100,
    };

    const session = createPlaybackSession(data, 200);

    expect(session.activePlaylistId).toBe(data.activePlaylistId);
    expect(session.playMode).toBe("shuffle");
    expect(session.playback).toEqual({
      playlistId: data.activePlaylistId,
      currentTime: 0,
      resumeRequested: false,
      updatedAt: 200,
    });
  });

  it("restores a valid session without using another tab's shared playback", () => {
    const data = createDefaultData(100);
    const track = {
      id: "track-a",
      bvid: "BV1SessionA",
      title: "会话歌曲",
      startTime: 0,
      duration: 240,
      addedAt: 100,
      source: "manual" as const,
    };
    data.playlists[0].tracks.push(track);

    const session = migratePlaybackSession(
      {
        activePlaylistId: data.activePlaylistId,
        playMode: "single-loop",
        playback: {
          playlistId: data.activePlaylistId,
          trackId: track.id,
          currentTime: 36,
          resumeRequested: true,
          updatedAt: 150,
        },
      },
      data,
      200,
    );

    expect(session).toEqual({
      activePlaylistId: data.activePlaylistId,
      playMode: "single-loop",
      playback: {
        playlistId: data.activePlaylistId,
        trackId: track.id,
        currentTime: 36,
        resumeRequested: true,
        updatedAt: 150,
      },
    });
  });

  it("clears playback when its song no longer belongs to the selected playlist", () => {
    const data = createDefaultData(100);

    const session = migratePlaybackSession(
      {
        activePlaylistId: data.activePlaylistId,
        playMode: "list-loop",
        playback: {
          playlistId: data.activePlaylistId,
          trackId: "deleted-track",
          currentTime: 36,
          resumeRequested: true,
          updatedAt: 150,
        },
      },
      data,
      200,
    );

    expect(session.playback).toEqual({
      playlistId: data.activePlaylistId,
      currentTime: 0,
      resumeRequested: false,
      updatedAt: 200,
    });
  });

  it("starts a new session on the persisted last used playlist", () => {
    const data = createDefaultData(100);
    data.playlists.push({
      id: "playlist-second",
      name: "第二张",
      tracks: [],
      createdAt: 100,
      updatedAt: 100,
    });
    data.activePlaylistId = "playlist-second";

    const session = createPlaybackSession(data, 200);

    // 新会话（没有 sessionStorage）只能靠共享数据恢复，且不自动播放。
    expect(session.activePlaylistId).toBe("playlist-second");
    expect(session.playback).toEqual({
      playlistId: "playlist-second",
      currentTime: 0,
      resumeRequested: false,
      updatedAt: 200,
    });
  });

  it("falls back to the persisted playlist when the session playlist was deleted", () => {
    const data = createDefaultData(100);
    data.playlists.push({
      id: "playlist-second",
      name: "第二张",
      tracks: [],
      createdAt: 100,
      updatedAt: 100,
    });
    data.activePlaylistId = "playlist-second";

    const session = migratePlaybackSession(
      {
        activePlaylistId: "playlist-deleted",
        playMode: "list-loop",
        playback: {
          playlistId: "playlist-deleted",
          currentTime: 0,
          resumeRequested: false,
          updatedAt: 100,
        },
      },
      data,
      200,
    );

    expect(session.activePlaylistId).toBe("playlist-second");
  });

  it("falls back to the first available playlist when nothing recorded is valid", () => {
    const data = createDefaultData(100);
    data.activePlaylistId = "playlist-deleted";

    const session = migratePlaybackSession(
      {
        activePlaylistId: "playlist-deleted-too",
        playMode: "list-loop",
        playback: {
          playlistId: "playlist-deleted-too",
          currentTime: 0,
          resumeRequested: false,
          updatedAt: 100,
        },
      },
      data,
      200,
    );

    expect(session.activePlaylistId).toBe(data.playlists[0].id);
  });
});
