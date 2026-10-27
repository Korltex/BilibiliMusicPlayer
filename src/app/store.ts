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
import { moveTrackToIndex } from "./track-order";

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

    // 新建即选中：歌单数组与「上次使用的歌单」一次写入，避免同一次操作写两遍存储。
    this.commitLibrary((data) =>
      this.applyActivePlaylist(
        { ...data, playlists: [...data.playlists, playlist] },
        playlist.id,
      ),
    );
    this.resetSessionPlaylist(playlist.id);
  }

  /**
   * 重命名歌单：只改 `name` 与 `updatedAt`。
   *
   * `id`、歌曲数组、`createdAt` 与「当前选中的歌单」都不动，也不碰本标签页会话：
   * 重命名不是「切换歌单」，`reconcileSession()` 会走早退分支，因此正在播放的
   * 歌曲与进度保持原样。名称沿用 `createPlaylist()` 的既有口径（`trim()` 后使用），
   * 重名不做额外限制。空名称或名称没有实际变化时直接返回——不写存储、不产生
   * 无意义的 `updatedAt` 变更与跨标签页广播。
   */
  renamePlaylist(playlistId: string, name: string): void {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return;
    }

    const playlist = this.data
      .peek()
      .playlists.find((item) => item.id === playlistId);
    if (!playlist || playlist.name === normalizedName) {
      return;
    }

    this.commitLibrary((data) => ({
      ...data,
      playlists: data.playlists.map((item) =>
        item.id === playlistId
          ? { ...item, name: normalizedName, updatedAt: Date.now() }
          : item,
      ),
    }));
  }

  importPlaylist(playlist: Playlist): void {
    const exists = this.data
      .peek()
      .playlists.some((item) => item.id === playlist.id);

    // 导入即选中：与新建同一条路径，歌单写入与恢复目标一次落盘。
    this.commitLibrary((data) =>
      this.applyActivePlaylist(
        {
          ...data,
          playlists: exists
            ? data.playlists.map((item) =>
                item.id === playlist.id ? playlist : item,
              )
            : [...data.playlists, playlist],
        },
        playlist.id,
      ),
    );
    this.resetSessionPlaylist(playlist.id);
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

  /**
   * 删除歌单：同时把共享数据里的「上次使用的歌单」修正到仍然存在的歌单上。
   *
   * 删除的正是当前记录的那张时，回退到剩下的第一张（与 `reconcileSession()` 的
   * 会话回退口径一致），避免持久化里留下一个指向已删除歌单的悬空 id。
   */
  removePlaylist(playlistId: string): void {
    const current = this.data.peek();
    if (current.playlists.length <= 1) {
      return;
    }

    this.commitLibrary((data) => {
      const playlists = data.playlists.filter(
        (playlist) => playlist.id !== playlistId,
      );
      const activePlaylistId = playlists.some(
        (playlist) => playlist.id === data.activePlaylistId,
      )
        ? data.activePlaylistId
        : playlists[0].id;

      return { ...data, playlists, activePlaylistId };
    });
  }

  /**
   * 切换当前歌单。
   *
   * 除了本标签页会话，还要把「上次使用的歌单」写回共享数据：`sessionStorage`
   * 只活到标签页关闭，新标签页/重开浏览器只能靠共享数据里的 `activePlaylistId`
   * 恢复。两者在同一次操作里更新，恢复目标不会比会话慢一拍。
   */
  selectPlaylist(playlistId: string): void {
    const data = this.data.peek();
    if (!data.playlists.some((item) => item.id === playlistId)) {
      return;
    }

    // 共享数据已经指向这张歌单时不必再写一遍（避免多余的 GM 写入与跨标签广播）。
    if (data.activePlaylistId !== playlistId) {
      this.commitLibrary((current) =>
        this.applyActivePlaylist(current, playlistId),
      );
    }
    this.resetSessionPlaylist(playlistId);
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
    this.removeTracks([trackId]);
  }

  /**
   * 批量删除当前歌单里的歌曲：**一次 `commitLibrary` 写一次存储**（也只会向其它标签页
   * 广播一次），不会为每首歌各写一遍。
   *
   * 只影响当前歌单：其它歌单里即使有同 id 的条目也不动。当前正在播放的歌曲被删掉时，
   * `reconcileSession()` 会把播放上下文退回「完整视频」——与单首删除完全同一条路径，
   * 因此不会中断页面上的视频播放。
   *
   * 没有任何条目被真正删除时直接返回：不写存储、不产生无意义的 `updatedAt` 变更。
   */
  removeTracks(trackIds: readonly string[]): void {
    const removing = new Set(trackIds);
    if (removing.size === 0) {
      return;
    }

    const { activePlaylistId } = this.session.peek();
    const playlist = this.data
      .peek()
      .playlists.find((item) => item.id === activePlaylistId);
    if (!playlist) {
      return;
    }

    const tracks = playlist.tracks.filter((track) => !removing.has(track.id));
    if (tracks.length === playlist.tracks.length) {
      return;
    }

    this.commitLibrary((data) => ({
      ...data,
      playlists: data.playlists.map((item) =>
        item.id === activePlaylistId
          ? { ...item, tracks, updatedAt: Date.now() }
          : item,
      ),
    }));
  }

  /**
   * 调整当前歌单内的播放顺序：把 `trackId` 移到 `toIndex`（插入位，0..length）之前。
   *
   * 顺序就是 `Playlist.tracks` 的数组顺序，因此不需要新字段或迁移。
   * 播放中的歌曲由稳定的 `trackId` 标识，移动后当前曲目继续播放，
   * 只影响之后「上一首/下一首」的选择；其它歌单不受影响。
   */
  moveTrack(trackId: string, toIndex: number): void {
    const { activePlaylistId } = this.session.peek();
    const playlist = this.data
      .peek()
      .playlists.find((item) => item.id === activePlaylistId);
    if (!playlist) {
      return;
    }

    const moved = moveTrackToIndex(playlist.tracks, trackId, toIndex);
    if (!moved) {
      return;
    }

    this.commitLibrary((data) => ({
      ...data,
      playlists: data.playlists.map((item) =>
        item.id === activePlaylistId
          ? { ...item, tracks: moved.tracks, updatedAt: Date.now() }
          : item,
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

  /**
   * 把「上次使用的歌单」写进共享数据。
   *
   * 这是新会话（新标签页 / 关掉浏览器再打开）唯一的恢复依据：`sessionStorage`
   * 里的会话随标签页消失，只能靠 `AppData.activePlaylistId` 记住选择。
   * 只改这一个字段，`playlists`、`volume` 等其它内容原样保留。
   */
  private applyActivePlaylist(data: AppData, playlistId: string): AppData {
    if (data.activePlaylistId === playlistId) {
      return data;
    }

    return { ...data, activePlaylistId: playlistId };
  }

  /**
   * 把本标签页会话切到指定歌单，并清空当前曲目 / 进度 / 恢复请求。
   *
   * 这是「用户主动切歌单」的既有语义（切换后按完整视频继续播放），
   * 与启动时的「只恢复歌单选择」是两条不同的路径，后者绝不能走这里。
   */
  private resetSessionPlaylist(playlistId: string): void {
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
