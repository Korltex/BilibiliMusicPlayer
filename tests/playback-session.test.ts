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
});
