import { signal } from "@preact/signals";
import { createId } from "../core/id";
import type {
  AppData,
  PlaybackSession,
  PlayMode,
  Playlist,
  Track,
} from "../core/types";
import {
  createPlaybackSession,
  PlaybackSessionRepository,
} from "../storage/playback-session";
import { AppRepository } from "../storage/repository";
import { createDefaultData } from "../storage/schema";

export class AppStore {
  readonly data = signal<AppData>(createDefaultData());
  readonly session = signal<PlaybackSession>(
    createPlaybackSession(this.data.peek()),
  );

  private readonly repository = new AppRepository();
  private readonly sessionRepository = new PlaybackSessionRepository();
  private unsubscribe?: () => void;

  start(): void {
    const data = this.repository.load();
    this.data.value = data;
    this.session.value = this.sessionRepository.load(data);
    this.unsubscribe = this.repository.subscribe((data) => {
      this.data.value = data;
      this.reconcileSession(data);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  get activePlaylist(): Playlist {
    const data = this.data.peek();
    const { activePlaylistId } = this.session.peek();
    return (
      data.playlists.find((playlist) => playlist.id === activePlaylistId) ??
      data.playlists[0]
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

    this.commitLibrary((data) => ({
      ...data,
      playlists: [...data.playlists, playlist],
    }));
    this.selectPlaylist(playlist.id);
  }

  importPlaylist(playlist: Playlist): void {
    const exists = this.data
      .peek()
      .playlists.some((item) => item.id === playlist.id);

    this.commitLibrary((data) => ({
      ...data,
      playlists: exists
        ? data.playlists.map((item) =>
            item.id === playlist.id ? playlist : item,
          )
        : [...data.playlists, playlist],
    }));
    this.selectPlaylist(playlist.id);
  }

  /**
   * 备份导入专用：用传入的歌单**整体替换**歌单库，不做按 ID 合并。
   *
   * 与 `importPlaylist()` 的区别是这里无条件覆盖 `playlists` 数组（导入文件里
   * 没有的歌单会被删除），并且只写一次 GM 存储，避免其它标签页看到中间状态。
   * `volume` 与共享的 `playMode` 历史字段保留，本标签页会话重置到第一张歌单并
   * 清空当前曲目 / 进度 / 恢复请求；不自动播放，也不跳转视频。
   */
  replaceLibrary(playlists: Playlist[]): void {
    if (playlists.length === 0) {
      return;
    }

    const current = this.data.peek();
    const now = Date.now();
    const activePlaylistId = playlists[0].id;

    const next: AppData = {
      ...current,
      playlists,
      activePlaylistId,
      playback: {
        playlistId: activePlaylistId,
        currentTime: 0,
        resumeRequested: false,
        updatedAt: now,
      },
    };

    this.data.value = next;
    this.repository.save(next);
    this.commitSession((session) => ({
      ...session,
      activePlaylistId,
      playback: {
        playlistId: activePlaylistId,
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

    this.commitLibrary((data) => ({
      ...data,
      playlists: data.playlists.filter(
        (playlist) => playlist.id !== playlistId,
      ),
    }));
  }

  selectPlaylist(playlistId: string): void {
    if (!this.data.peek().playlists.some((item) => item.id === playlistId)) {
      return;
    }

    this.commitSession((session) => ({
      ...session,
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
    const { activePlaylistId } = this.session.peek();
    this.commitLibrary((data) => ({
      ...data,
      playlists: data.playlists.map((playlist) =>
        playlist.id === activePlaylistId
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
    const { activePlaylistId } = this.session.peek();
    this.commitLibrary((data) => ({
      ...data,
      playlists: data.playlists.map((playlist) =>
        playlist.id === activePlaylistId
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
    const { activePlaylistId } = this.session.peek();
    this.commitLibrary((data) => ({
      ...data,
      playlists: data.playlists.map((playlist) =>
        playlist.id === activePlaylistId
          ? {
              ...playlist,
              tracks: playlist.tracks.filter((track) => track.id !== trackId),
              updatedAt: Date.now(),
            }
          : playlist,
      ),
    }));
  }

  setPlayMode(playMode: PlayMode): void {
    this.commitSession((session) => ({ ...session, playMode }));
  }

  setVolume(volume: number): void {
    this.commitLibrary((data) => ({
      ...data,
      volume: Math.min(1, Math.max(0, volume)),
    }));
  }

  requestTrack(track: Track, currentTime = track.startTime): void {
    const { activePlaylistId } = this.session.peek();
    this.commitSession((session) => ({
      ...session,
      playback: {
        playlistId: activePlaylistId,
        trackId: track.id,
        currentTime,
        resumeRequested: true,
        updatedAt: Date.now(),
      },
    }));
  }

  consumeResumeRequest(): void {
    this.commitSession((session) => ({
      ...session,
      playback: {
        ...session.playback,
        resumeRequested: false,
        updatedAt: Date.now(),
      },
    }));
  }

  savePosition(currentTime: number): void {
    const playback = this.session.peek().playback;
    if (!playback.trackId) {
      return;
    }

    this.commitSession((session) => ({
      ...session,
      playback: {
        ...session.playback,
        currentTime,
        updatedAt: Date.now(),
      },
    }));
  }

  private commitLibrary(updater: (data: AppData) => AppData): void {
    const next = updater(this.data.peek());
    this.data.value = next;
    this.reconcileSession(next);
    this.repository.save(next);
  }

  private commitSession(
    updater: (session: PlaybackSession) => PlaybackSession,
  ): void {
    const next = updater(this.session.peek());
    this.session.value = next;
    this.sessionRepository.save(next);
  }

  private reconcileSession(data: AppData): void {
    const session = this.session.peek();
    const activePlaylist =
      data.playlists.find(
        (playlist) => playlist.id === session.activePlaylistId,
      ) ?? data.playlists[0];
    const trackStillExists = session.playback.trackId
      ? activePlaylist.tracks.some(
          (track) => track.id === session.playback.trackId,
        )
      : true;

    const activePlaylistChanged =
      activePlaylist.id !== session.activePlaylistId;
    const playbackNeedsReset = activePlaylistChanged || !trackStillExists;
    if (
      !playbackNeedsReset &&
      session.playback.playlistId === activePlaylist.id
    ) {
      return;
    }

    const now = Date.now();
    this.commitSession((current) => ({
      ...current,
      activePlaylistId: activePlaylist.id,
      playback: playbackNeedsReset
        ? {
            playlistId: activePlaylist.id,
            currentTime: 0,
            resumeRequested: false,
            updatedAt: now,
          }
        : {
            ...current.playback,
            playlistId: activePlaylist.id,
          },
    }));
  }
}

export const appStore = new AppStore();
