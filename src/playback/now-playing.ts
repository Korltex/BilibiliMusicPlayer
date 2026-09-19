import type { CurrentVideoMetadata } from "../bili/metadata";
import type { NowPlayingState, Track } from "../core/types";

export const FALLBACK_NOW_PLAYING_TITLE = "Bilibili 音乐播放器";

export interface NowPlayingInput {
  /** 歌单播放上下文中的当前歌曲；普通视频播放时为 undefined。 */
  track: Track | undefined;
  /** 当前页面 DOM 读到的视频信息；非视频页或读取失败时为 undefined。 */
  metadata: CurrentVideoMetadata | undefined;
  /**
   * 按当前 bvid 从 view 接口解析出的封面。页面上的 `og:image` 是首屏 SSR 写入的，
   * B 站同文档换视频时不保证更新，所以接口结果优先。
   */
  pageCover?: string;
}

/**
 * 把「歌单当前歌曲」与「当前页面视频信息」合成面板要显示的条目。
 *
 * 取值优先级与播放器既有行为一致：歌单播放时标题、片段起止和时长以歌曲为准，
 * UP 主和封面优先取当前页面（歌单里的视频可能已被改名或换封面）。
 */
export function resolveNowPlaying({
  track,
  metadata,
  pageCover,
}: NowPlayingInput): NowPlayingState {
  return {
    trackId: track?.id,
    title: track?.title ?? metadata?.title ?? FALLBACK_NOW_PLAYING_TITLE,
    uploader: metadata?.uploader ?? track?.uploader,
    cover: pageCover ?? metadata?.cover ?? track?.cover,
    startTime: track?.startTime ?? 0,
    endTime: track?.endTime,
    storedDuration: track?.duration ?? 0,
  };
}

/**
 * 页面元数据每秒都会被重新读取，只有真正变化时才允许写入状态。
 * 否则每秒重建 state 与 MediaMetadata 会让界面和系统媒体面板持续抖动。
 */
export function nowPlayingEquals(
  left: NowPlayingState,
  right: NowPlayingState,
): boolean {
  return (
    left.trackId === right.trackId &&
    left.title === right.title &&
    left.uploader === right.uploader &&
    left.cover === right.cover &&
    left.startTime === right.startTime &&
    left.endTime === right.endTime &&
    left.storedDuration === right.storedDuration
  );
}
