import type {
  AppData,
  PlaybackSession,
  PlaybackSnapshot,
  PlayMode,
  Playlist,
} from "../core/types";

export const PLAYBACK_SESSION_KEY = "bilibili-music-player:playback-session";

const PLAY_MODES: readonly PlayMode[] = [
  "sequence",
  "list-loop",
  "single-loop",
  "shuffle",
];

export function createPlaybackSession(
  data: AppData,
  now = Date.now(),
): PlaybackSession {
  const activePlaylistId = resolvePlaylistId(data, data.activePlaylistId);

  return {
    activePlaylistId,
    playMode: isPlayMode(data.playMode) ? data.playMode : "list-loop",
    playback: createPlaybackSnapshot(activePlaylistId, now),
  };
}

export function migratePlaybackSession(
  raw: unknown,
  data: AppData,
  now = Date.now(),
): PlaybackSession {
  if (!raw || typeof raw !== "object") {
    return createPlaybackSession(data, now);
  }

  const candidate = raw as Partial<PlaybackSession>;
  const activePlaylistId = resolvePlaylistId(data, candidate.activePlaylistId);
  const playlist = data.playlists.find((item) => item.id === activePlaylistId)!;
  const playback = migratePlaybackSnapshot(candidate.playback, playlist, now);

  return {
    activePlaylistId,
    playMode: isPlayMode(candidate.playMode) ? candidate.playMode : "list-loop",
    playback,
  };
}

export class PlaybackSessionRepository {
  private memory?: PlaybackSession;

  load(data: AppData): PlaybackSession {
    try {
      const raw = sessionStorage.getItem(PLAYBACK_SESSION_KEY);
      const session = migratePlaybackSession(
        raw === null ? undefined : JSON.parse(raw),
        data,
      );
      this.memory = session;
      return session;
    } catch {
      const session = this.memory ?? createPlaybackSession(data);
      this.memory = session;
      return session;
    }
  }

  save(session: PlaybackSession): void {
    this.memory = session;
    try {
      sessionStorage.setItem(PLAYBACK_SESSION_KEY, JSON.stringify(session));
    } catch {
      // Keep the in-memory session when browser storage is unavailable.
    }
  }
}

function resolvePlaylistId(data: AppData, candidate: unknown): string {
  if (
    typeof candidate === "string" &&
    data.playlists.some((playlist) => playlist.id === candidate)
  ) {
    return candidate;
  }

  if (
    data.playlists.some((playlist) => playlist.id === data.activePlaylistId)
  ) {
    return data.activePlaylistId;
  }

  return data.playlists[0].id;
}

function migratePlaybackSnapshot(
  raw: unknown,
  playlist: Playlist,
  now: number,
): PlaybackSnapshot {
  const candidate = raw as Partial<PlaybackSnapshot> | undefined;
  const currentTime = candidate?.currentTime;
  const updatedAt = candidate?.updatedAt;
  const trackId =
    typeof candidate?.trackId === "string" &&
    playlist.tracks.some((track) => track.id === candidate.trackId)
      ? candidate.trackId
      : undefined;

  if (!trackId) {
    return createPlaybackSnapshot(playlist.id, now);
  }

  return {
    playlistId: playlist.id,
    trackId,
    currentTime:
      typeof currentTime === "number" && Number.isFinite(currentTime)
        ? Math.max(0, currentTime)
        : 0,
    resumeRequested: candidate?.resumeRequested === true,
    updatedAt: typeof updatedAt === "number" ? updatedAt : now,
  };
}

function createPlaybackSnapshot(
  playlistId: string,
  now: number,
): PlaybackSnapshot {
  return {
    playlistId,
    currentTime: 0,
    resumeRequested: false,
    updatedAt: now,
  };
}

function isPlayMode(value: unknown): value is PlayMode {
  return typeof value === "string" && PLAY_MODES.includes(value as PlayMode);
}
