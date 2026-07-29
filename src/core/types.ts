export type PlayMode = "sequence" | "list-loop" | "single-loop" | "shuffle";
export type PlaybackContext = "page" | "playlist";

export interface Track {
  id: string;
  bvid: string;
  cid?: number;
  page?: number;
  title: string;
  uploader?: string;
  cover?: string;
  startTime: number;
  endTime?: number;
  duration: number;
  addedAt: number;
  source: "manual" | "collection" | "favorite";
}

export interface Playlist {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
}

export interface PlaybackSnapshot {
  playlistId: string;
  trackId?: string;
  currentTime: number;
  resumeRequested: boolean;
  updatedAt: number;
}

export interface AppData {
  version: 1;
  playlists: Playlist[];
  activePlaylistId: string;
  playMode: PlayMode;
  volume: number;
  playback: PlaybackSnapshot;
}

export interface NowPlayingState {
  trackId?: string;
  title: string;
  uploader?: string;
  cover?: string;
  startTime: number;
  endTime?: number;
  storedDuration: number;
}

export interface RuntimePlayerState {
  mediaReady: boolean;
  playing: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  playbackContext: PlaybackContext;
  nowPlaying: NowPlayingState;
  requiresInteraction: boolean;
  message?: string;
}
