import { signal } from "@preact/signals";
import { createId } from "../core/id";
import type { AppData, PlayMode, Playlist, Track } from "../core/types";
import { AppRepository } from "../storage/repository";
import { createDefaultData } from "../storage/schema";

export class AppStore {
  readonly data = signal<AppData>(createDefaultData());

  private readonly repository = new AppRepository();
  private unsubscribe?: () => void;

  start(): void {
    this.data.value = this.repository.load();
    this.unsubscribe = this.repository.subscribe((data) => {
      this.data.value = data;
    });
  }

  stop(): void {
    this.unsubscribe?.();
  }

  get activePlaylist(): Playlist {
    const data = this.data.peek();
    return (
      data.playlists.find(
        (playlist) => playlist.id === data.activePlaylistId,
      ) ?? data.playlists[0]
    );
  }

  findTrack(trackId: string | undefined): Track | undefined {
    if (!trackId) {
      return undefined;
    }

    return this.data
      .peek()
      .playlists.flatMap((playlist) => playlist.tracks)
      .find((track) => track.id === trackId);
  }

  createPlaylist(name: string): void {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    const now = Date.now();
    const playlist: Playlist = {
      id: createId("playlist"),
      name: normalizedName,
      tracks: [],
      createdAt: now,
      updatedAt: now,
    };

    this.commit((data) => ({
      ...data,
      playlists: [...data.playlists, playlist],
      activePlaylistId: playlist.id,
      playback: {
        ...data.playback,
        playlistId: playlist.id,
        trackId: undefined,
        currentTime: 0,
        resumeRequested: false,
        updatedAt: now,
      },
    }));
  }

  removePlaylist(playlistId: string): void {
    const current = this.data.peek();
    if (current.playlists.length <= 1) {
      return;
    }

    this.commit((data) => {
      const playlists = data.playlists.filter(
        (playlist) => playlist.id !== playlistId,
      );
      const activePlaylistId =
        data.activePlaylistId === playlistId
          ? playlists[0].id
          : data.activePlaylistId;

      return {
        ...data,
        playlists,
        activePlaylistId,
        playback:
          data.playback.playlistId === playlistId
            ? {
                playlistId: activePlaylistId,
                currentTime: 0,
                resumeRequested: false,
                updatedAt: Date.now(),
              }
            : data.playback,
      };
    });
  }

  selectPlaylist(playlistId: string): void {
    if (!this.data.peek().playlists.some((item) => item.id === playlistId)) {
      return;
    }

    this.commit((data) => ({
      ...data,
      activePlaylistId: playlistId,
      playback: {
        playlistId,
        currentTime: 0,
        resumeRequested: false,
        updatedAt: Date.now(),
      },
    }));
  }

  addTrack(track: Track): void {
    this.commit((data) => ({
      ...data,
      playlists: data.playlists.map((playlist) =>
        playlist.id === data.activePlaylistId
          ? {
              ...playlist,
              tracks: [...playlist.tracks, track],
              updatedAt: Date.now(),
            }
          : playlist,
      ),
    }));
  }

  updateTrack(track: Track): void {
    this.commit((data) => ({
      ...data,
      playlists: data.playlists.map((playlist) =>
        playlist.id === data.activePlaylistId
          ? {
              ...playlist,
              tracks: playlist.tracks.map((item) =>
                item.id === track.id ? track : item,
              ),
              updatedAt: Date.now(),
            }
          : playlist,
      ),
    }));
  }

  removeTrack(trackId: string): void {
    this.commit((data) => ({
      ...data,
      playlists: data.playlists.map((playlist) =>
        playlist.id === data.activePlaylistId
          ? {
              ...playlist,
              tracks: playlist.tracks.filter((track) => track.id !== trackId),
              updatedAt: Date.now(),
            }
          : playlist,
      ),
      playback:
        data.playback.trackId === trackId
          ? {
              ...data.playback,
              trackId: undefined,
              currentTime: 0,
              resumeRequested: false,
              updatedAt: Date.now(),
            }
          : data.playback,
    }));
  }

  setPlayMode(playMode: PlayMode): void {
    this.commit((data) => ({ ...data, playMode }));
  }

  setVolume(volume: number): void {
    this.commit((data) => ({
      ...data,
      volume: Math.min(1, Math.max(0, volume)),
    }));
  }

  requestTrack(track: Track, currentTime = track.startTime): void {
    this.commit((data) => ({
      ...data,
      playback: {
        playlistId: data.activePlaylistId,
        trackId: track.id,
        currentTime,
        resumeRequested: true,
        updatedAt: Date.now(),
      },
    }));
  }

  consumeResumeRequest(): void {
    this.commit((data) => ({
      ...data,
      playback: {
        ...data.playback,
        resumeRequested: false,
        updatedAt: Date.now(),
      },
    }));
  }

  savePosition(currentTime: number): void {
    const playback = this.data.peek().playback;
    if (!playback.trackId) {
      return;
    }

    this.commit((data) => ({
      ...data,
      playback: {
        ...data.playback,
        currentTime,
        updatedAt: Date.now(),
      },
    }));
  }

  private commit(updater: (data: AppData) => AppData): void {
    const next = updater(this.data.peek());
    this.data.value = next;
    this.repository.save(next);
  }
}

export const appStore = new AppStore();
