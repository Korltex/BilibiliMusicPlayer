import { signal } from "@preact/signals";
import type { AppStore } from "../app/store";
import {
  getBvid,
  getPageNumber,
  readCurrentVideoMetadata,
} from "../bili/metadata";
import { MediaLocator, type MediaChangeReason } from "../bili/media-locator";
import { clamp } from "../core/time";
import type {
  NowPlayingState,
  PlayMode,
  PlaybackContext,
  RuntimePlayerState,
  Track,
} from "../core/types";
import { selectAdjacentTrack } from "./queue";
import { TabCoordinator } from "./tab-coordinator";

const INITIAL_NOW_PLAYING_STATE: NowPlayingState = {
  title: "未连接到 Bilibili 播放器",
  startTime: 0,
  storedDuration: 0,
};

const INITIAL_RUNTIME_STATE: RuntimePlayerState = {
  mediaReady: false,
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  muted: false,
  playbackContext: "page",
  nowPlaying: INITIAL_NOW_PLAYING_STATE,
  requiresInteraction: false,
};

export class PlayerEngine {
  readonly state = signal<RuntimePlayerState>(INITIAL_RUNTIME_STATE);

  private media: HTMLMediaElement | null = null;
  private mediaEvents?: AbortController;
  private positionSavedAt = 0;
  private segmentAdvancing = false;
  private readonly locator: MediaLocator;
  private readonly tabs: TabCoordinator;

  constructor(private readonly store: AppStore) {
    this.locator = new MediaLocator((media, reason) =>
      this.handleMediaChange(media, reason),
    );
    this.tabs = new TabCoordinator(() => {
      if (this.media && !this.media.paused) {
        this.media.pause();
        this.setMessage("已由另一个 Bilibili 标签页接管播放");
      }
    });
  }

  start(): void {
    this.store.start();
    this.setPlaybackContext(
      this.shouldUsePlaylistContext() ? "playlist" : "page",
    );
    this.locator.start();
    this.installMediaSessionHandlers();
    window.addEventListener("pagehide", this.savePosition);
  }

  stop(): void {
    this.savePosition();
    this.mediaEvents?.abort();
    this.locator.stop();
    this.tabs.close();
    this.store.stop();
    window.removeEventListener("pagehide", this.savePosition);
  }

  get currentMedia(): HTMLMediaElement | null {
    return this.media;
  }

  async togglePlayback(): Promise<void> {
    if (!this.media) {
      this.setMessage("尚未找到 Bilibili 播放器");
      return;
    }

    if (!this.media.paused) {
      this.media.pause();
      return;
    }

    const data = this.store.data.peek();
    const track = this.store.findTrack(data.playback.trackId);
    if (
      this.isPlaylistContext() &&
      data.playback.resumeRequested &&
      track &&
      !this.isCurrentPage(track)
    ) {
      this.playTrack(track);
      return;
    }

    await this.tryPlay();
  }

  seek(time: number): void {
    if (!this.media || !Number.isFinite(this.media.duration)) {
      return;
    }

    this.media.currentTime = clamp(time, 0, this.media.duration);
    this.syncRuntime();
  }

  setVolume(volume: number): void {
    const normalized = clamp(volume, 0, 1);
    this.store.setVolume(normalized);
    if (this.media) {
      this.media.volume = normalized;
      this.media.muted = false;
    }
  }

  toggleMute(): void {
    if (this.media) {
      this.media.muted = !this.media.muted;
    }
  }

  setPlayMode(mode: PlayMode): void {
    this.store.setPlayMode(mode);
  }

  exitPlaylistPlayback(): void {
    if (this.store.data.peek().playback.resumeRequested) {
      this.store.consumeResumeRequest();
    }
    this.exitPlaylistContext();
  }

  playTrack(track: Track): void {
    this.store.requestTrack(track);
    this.setPlaybackContext("playlist");

    if (!this.isCurrentPage(track)) {
      location.assign(buildTrackUrl(track));
      return;
    }

    this.setPlaylistRouteMarker(true);
    this.refreshPageMetadata();
    void this.resumeRequestedTrack();
  }

  next(automatic = false): void {
    const data = this.store.data.peek();
    const playlist = data.playlists.find(
      (item) => item.id === data.playback.playlistId,
    );
    const track = selectAdjacentTrack(
      playlist,
      data.playback.trackId,
      data.playMode,
      { direction: 1, automatic },
    );

    if (!track) {
      this.media?.pause();
      this.exitPlaylistContext();
      this.setMessage("播放列表已结束");
      return;
    }

    this.playTrack(track);
  }

  previous(): void {
    const data = this.store.data.peek();
    const playlist = data.playlists.find(
      (item) => item.id === data.playback.playlistId,
    );
    const track = selectAdjacentTrack(
      playlist,
      data.playback.trackId,
      data.playMode,
      { direction: -1 },
    );

    if (track) {
      this.playTrack(track);
    }
  }

  private handleMediaChange(
    media: HTMLMediaElement | null,
    reason: MediaChangeReason,
  ): void {
    if (media !== this.media) {
      this.bindMedia(media);
    }

    if (reason === "route") {
      this.setPlaybackContext(
        this.shouldUsePlaylistContext() ? "playlist" : "page",
      );
      this.refreshPageMetadata();
      window.setTimeout(() => this.refreshPageMetadata(), 1_000);
    }

    if (
      media &&
      this.isPlaylistContext() &&
      this.store.data.peek().playback.resumeRequested
    ) {
      void this.resumeRequestedTrack();
    }
  }

  private bindMedia(media: HTMLMediaElement | null): void {
    this.mediaEvents?.abort();
    this.mediaEvents = undefined;
    this.media = media;

    if (!media) {
      const playbackContext = this.state.peek().playbackContext;
      this.state.value = {
        ...INITIAL_RUNTIME_STATE,
        volume: this.store.data.peek().volume,
        playbackContext,
      };
      return;
    }

    media.volume = this.store.data.peek().volume;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    this.mediaEvents = controller;

    media.addEventListener("play", this.handlePlay, options);
    media.addEventListener("pause", this.syncRuntime, options);
    media.addEventListener("timeupdate", this.handleTimeUpdate, options);
    media.addEventListener("durationchange", this.syncRuntime, options);
    media.addEventListener(
      "loadedmetadata",
      this.handleLoadedMetadata,
      options,
    );
    media.addEventListener("volumechange", this.syncRuntime, options);
    media.addEventListener("ended", this.handleEnded, options);

    this.refreshPageMetadata();
    this.syncRuntime();
  }

  private readonly handlePlay = (): void => {
    this.tabs.claim();
    this.state.value = {
      ...this.state.peek(),
      playing: true,
      requiresInteraction: false,
      message: undefined,
    };
    this.updateMediaSession();
  };

  private readonly handleTimeUpdate = (): void => {
    this.syncRuntime();

    const track = this.getActiveTrack();
    if (
      track?.endTime !== undefined &&
      this.media &&
      this.media.currentTime >= track.endTime - 0.15 &&
      !this.segmentAdvancing
    ) {
      this.segmentAdvancing = true;
      this.next(true);
      window.setTimeout(() => {
        this.segmentAdvancing = false;
      }, 500);
      return;
    }

    if (this.media && Date.now() - this.positionSavedAt >= 10_000 && track) {
      this.positionSavedAt = Date.now();
      this.store.savePosition(this.media.currentTime);
    }
  };

  private readonly handleLoadedMetadata = (): void => {
    this.syncRuntime();
    if (
      this.isPlaylistContext() &&
      this.store.data.peek().playback.resumeRequested
    ) {
      void this.resumeRequestedTrack();
    }
  };

  private readonly handleEnded = (): void => {
    if (this.getActiveTrack()) {
      this.next(true);
    }
  };

  private readonly syncRuntime = (): void => {
    if (!this.media) {
      return;
    }

    this.state.value = {
      ...this.state.peek(),
      mediaReady: this.media.readyState > 0,
      playing: !this.media.paused,
      currentTime: this.media.currentTime || 0,
      duration: Number.isFinite(this.media.duration) ? this.media.duration : 0,
      volume: this.media.volume,
      muted: this.media.muted,
    };

    this.updateMediaPosition();
  };

  private async resumeRequestedTrack(): Promise<void> {
    const media = this.media;
    const data = this.store.data.peek();
    const track = this.store.findTrack(data.playback.trackId);
    if (
      !this.isPlaylistContext() ||
      !media ||
      !track ||
      !this.isCurrentPage(track)
    ) {
      return;
    }

    if (media.readyState === 0) {
      return;
    }

    const resumeTime =
      data.playback.currentTime >= track.startTime &&
      (track.endTime === undefined || data.playback.currentTime < track.endTime)
        ? data.playback.currentTime
        : track.startTime;

    media.currentTime = clamp(
      resumeTime,
      0,
      Number.isFinite(media.duration) ? media.duration : resumeTime,
    );
    this.refreshPageMetadata();
    this.store.consumeResumeRequest();
    await this.tryPlay();
  }

  private async tryPlay(): Promise<void> {
    if (!this.media) {
      return;
    }

    try {
      this.tabs.claim();
      await this.media.play();
      this.state.value = {
        ...this.state.peek(),
        requiresInteraction: false,
        message: undefined,
      };
    } catch {
      this.state.value = {
        ...this.state.peek(),
        requiresInteraction: true,
        message: "浏览器阻止了自动播放，请点击播放按钮继续",
      };
    }
  }

  private refreshPageMetadata(): void {
    const track = this.getActiveTrack();
    const metadata = readCurrentVideoMetadata();
    this.state.value = {
      ...this.state.peek(),
      nowPlaying: {
        trackId: track?.id,
        title: track?.title ?? metadata?.title ?? "Bilibili 音乐播放器",
        uploader: metadata?.uploader ?? track?.uploader,
        cover: metadata?.cover ?? track?.cover,
        startTime: track?.startTime ?? 0,
        endTime: track?.endTime,
        storedDuration: track?.duration ?? 0,
      },
    };
    this.updateMediaSession();
  }

  private getActiveTrack(): Track | undefined {
    if (!this.isPlaylistContext()) {
      return undefined;
    }

    const track = this.store.findTrack(this.store.data.peek().playback.trackId);
    return track && this.isCurrentPage(track) ? track : undefined;
  }

  private isPlaylistContext(): boolean {
    return this.state.peek().playbackContext === "playlist";
  }

  private shouldUsePlaylistContext(): boolean {
    if (!hasPlaylistRouteMarker()) {
      return false;
    }

    const track = this.store.findTrack(this.store.data.peek().playback.trackId);
    return Boolean(track && this.isCurrentPage(track));
  }

  private setPlaybackContext(playbackContext: PlaybackContext): void {
    if (this.state.peek().playbackContext === playbackContext) {
      return;
    }

    this.state.value = {
      ...this.state.peek(),
      playbackContext,
    };
  }

  private exitPlaylistContext(): void {
    this.setPlaybackContext("page");
    this.setPlaylistRouteMarker(false);
    this.refreshPageMetadata();
  }

  private setPlaylistRouteMarker(enabled: boolean): void {
    const url = new URL(location.href);
    if (enabled) {
      url.searchParams.set("bili_music", "1");
    } else {
      url.searchParams.delete("bili_music");
    }

    if (url.href !== location.href) {
      history.replaceState(history.state, "", url);
    }
  }

  private isCurrentPage(track: Track): boolean {
    return (
      getBvid()?.toLowerCase() === track.bvid.toLowerCase() &&
      (track.page ?? 1) === (getPageNumber() ?? 1)
    );
  }

  private setMessage(message: string): void {
    this.state.value = { ...this.state.peek(), message };
  }

  private readonly savePosition = (): void => {
    if (this.media && this.getActiveTrack()) {
      this.store.savePosition(this.media.currentTime);
    }
  };

  private installMediaSessionHandlers(): void {
    if (!("mediaSession" in navigator)) {
      return;
    }

    const handlers: Partial<
      Record<MediaSessionAction, MediaSessionActionHandler>
    > = {
      play: () => void this.togglePlayback(),
      pause: () => this.media?.pause(),
      previoustrack: () => this.previous(),
      nexttrack: () => this.next(),
      seekto: (details) => {
        if (details.seekTime !== undefined) {
          this.seek(details.seekTime);
        }
      },
      seekbackward: (details) =>
        this.seek((this.media?.currentTime ?? 0) - (details.seekOffset ?? 10)),
      seekforward: (details) =>
        this.seek((this.media?.currentTime ?? 0) + (details.seekOffset ?? 10)),
    };

    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(
          action as MediaSessionAction,
          handler ?? null,
        );
      } catch {
        // Older browsers expose Media Session with a smaller action set.
      }
    }
  }

  private updateMediaSession(): void {
    if (!("mediaSession" in navigator)) {
      return;
    }

    const { nowPlaying } = this.state.peek();

    navigator.mediaSession.metadata = new MediaMetadata({
      title: nowPlaying.title,
      artist: nowPlaying.uploader ?? "Bilibili",
      album: "Bilibili Music Player",
      artwork: nowPlaying.cover
        ? [{ src: nowPlaying.cover, sizes: "512x512", type: "image/jpeg" }]
        : [],
    });
  }

  private updateMediaPosition(): void {
    if (
      !("mediaSession" in navigator) ||
      !this.media ||
      !Number.isFinite(this.media.duration) ||
      this.media.duration <= 0
    ) {
      return;
    }

    try {
      navigator.mediaSession.setPositionState({
        duration: this.media.duration,
        playbackRate: this.media.playbackRate,
        position: clamp(this.media.currentTime, 0, this.media.duration),
      });
    } catch {
      // Position reporting is optional and may reject transient media state.
    }
  }
}

function buildTrackUrl(track: Track): string {
  const url = new URL(`/video/${track.bvid}/`, location.origin);
  if (track.page && track.page > 1) {
    url.searchParams.set("p", String(track.page));
  }
  url.searchParams.set("bili_music", "1");
  return url.href;
}

function hasPlaylistRouteMarker(url = location.href): boolean {
  return new URL(url).searchParams.get("bili_music") === "1";
}
