import type { AppData, Playlist } from "../core/types";
import { createId } from "../core/id";

export const STORAGE_KEY = "bilibili-music-player:data";

export function createDefaultData(now = Date.now()): AppData {
  const playlist: Playlist = {
    id: createId("playlist"),
    name: "默认歌单",
    tracks: [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    version: 1,
    playlists: [playlist],
    activePlaylistId: playlist.id,
    playMode: "list-loop",
    volume: 1,
    playback: {
      playlistId: playlist.id,
      currentTime: 0,
      resumeRequested: false,
      updatedAt: now,
    },
  };
}

export function migrateAppData(raw: unknown): AppData {
  if (!raw || typeof raw !== "object") {
    return createDefaultData();
  }

  const candidate = raw as Partial<AppData>;
  if (candidate.version !== 1 || !Array.isArray(candidate.playlists)) {
    return createDefaultData();
  }

  const fallback = createDefaultData();
  const playlists = candidate.playlists.filter(
    (playlist): playlist is Playlist =>
      Boolean(
        playlist &&
        typeof playlist.id === "string" &&
        typeof playlist.name === "string" &&
        Array.isArray(playlist.tracks),
      ),
  );

  if (playlists.length === 0) {
    return fallback;
  }

  const activePlaylistId = playlists.some(
    (playlist) => playlist.id === candidate.activePlaylistId,
  )
    ? candidate.activePlaylistId!
    : playlists[0].id;

  return {
    version: 1,
    playlists,
    activePlaylistId,
    playMode:
      candidate.playMode === "sequence" ||
      candidate.playMode === "list-loop" ||
      candidate.playMode === "single-loop" ||
      candidate.playMode === "shuffle"
        ? candidate.playMode
        : "list-loop",
    volume:
      typeof candidate.volume === "number"
        ? Math.min(1, Math.max(0, candidate.volume))
        : 1,
    playback: {
      playlistId: candidate.playback?.playlistId ?? activePlaylistId,
      trackId: candidate.playback?.trackId,
      currentTime: candidate.playback?.currentTime ?? 0,
      resumeRequested: candidate.playback?.resumeRequested ?? false,
      updatedAt: candidate.playback?.updatedAt ?? Date.now(),
    },
  };
}
