import { useEffect, useState } from "preact/hooks";
import {
  Clock3,
  Headphones,
  ListMusic,
  Music2,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  Repeat1,
  Save,
  Shuffle,
  SkipBack,
  SkipForward,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-preact";
import type { AppStore } from "./store";
import type { PlayerEngine } from "../playback/player-engine";
import type {
  AudioOnlyController,
  AudioOnlyState,
} from "../bili/audio-only-controller";
import type { AudioOnlyInterceptionReason } from "../bili/audio-only-interceptor";
import {
  createTrackFromCurrentPage,
  readCurrentVideoMetadata,
} from "../bili/metadata";
import { formatTime } from "../core/time";
import type { PlayMode, Track } from "../core/types";

interface AppProps {
  store: AppStore;
  engine: PlayerEngine;
  audioOnly: AudioOnlyController;
}

const PLAY_MODES: PlayMode[] = [
  "sequence",
  "list-loop",
  "single-loop",
  "shuffle",
];

const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  sequence: "顺序播放",
  "list-loop": "列表循环",
  "single-loop": "单曲循环",
  shuffle: "随机播放",
};

export function App({ store, engine, audioOnly }: AppProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editorTrack, setEditorTrack] = useState<Track | "new">();

  const data = store.data.value;
  const runtime = engine.state.value;
  const audioOnlyState = audioOnly.state.value;
  const activePlaylist =
    data.playlists.find((playlist) => playlist.id === data.activePlaylistId) ??
    data.playlists[0];
  const nowPlaying = runtime.nowPlaying;
  const progressMinimum = nowPlaying.startTime;
  const progressMaximum =
    nowPlaying.endTime ??
    (runtime.duration > 0 ? runtime.duration : nowPlaying.storedDuration);
  const audioFallbackNotice =
    audioOnlyState.status === "fallback"
      ? `纯音频模式未生效，已回退正常视频：${audioOnlyReasonLabel(
          audioOnlyState.reason,
        )}`
      : undefined;
  const primaryNotice = runtime.message ?? audioFallbackNotice;
  const noticeActionable = Boolean(
    runtime.message && runtime.requiresInteraction,
  );
  const noticeFallback = !runtime.message && Boolean(audioFallbackNotice);

  const createPlaylist = (event: SubmitEvent) => {
    event.preventDefault();
    store.createPlaylist(newPlaylistName);
    setNewPlaylistName("");
    setCreatingPlaylist(false);
  };

  const cyclePlayMode = () => {
    const currentIndex = PLAY_MODES.indexOf(data.playMode);
    engine.setPlayMode(PLAY_MODES[(currentIndex + 1) % PLAY_MODES.length]);
  };

  if (!panelOpen) {
    return (
      <button
        class="floating-button"
        type="button"
        title="打开 Bilibili 音乐播放器"
        aria-label="打开 Bilibili 音乐播放器"
        onClick={() => setPanelOpen(true)}
      >
        <Music2 size={22} aria-hidden="true" />
      </button>
    );
  }

  return (
    <section class="player-panel" aria-label="Bilibili 音乐播放器">
      <header class="panel-header">
        <div class="brand">
          <span class="brand-icon">
            <Music2 size={18} aria-hidden="true" />
          </span>
          <strong>Bilibili 音乐播放器</strong>
          <span class="version">0.1.1</span>
        </div>
        <button
          class="icon-button"
          type="button"
          title="收起播放器"
          aria-label="收起播放器"
          onClick={() => setPanelOpen(false)}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div class="now-playing">
        <div class="cover">
          {nowPlaying.cover ? (
            <img src={nowPlaying.cover} alt="" />
          ) : (
            <Music2 size={28} aria-hidden="true" />
          )}
        </div>
        <div class="now-playing-copy">
          <strong title={nowPlaying.title}>{nowPlaying.title}</strong>
          <span>
            {nowPlaying.uploader ??
              (runtime.mediaReady ? "当前 Bilibili 视频" : "等待播放器")}
          </span>
          {runtime.playbackContext === "playlist" && (
            <button
              class="playlist-context-chip"
              type="button"
              title="退出歌单播放并继续播放完整视频"
              aria-label="退出歌单播放并继续播放完整视频"
              onClick={() => engine.exitPlaylistPlayback()}
            >
              播放完整视频
            </button>
          )}
        </div>
      </div>

      <div class="progress-area">
        <input
          class="range progress-range"
          type="range"
          min={progressMinimum}
          max={Math.max(progressMaximum, progressMinimum + 1)}
          step="0.1"
          value={Math.min(
            Math.max(runtime.currentTime, progressMinimum),
            Math.max(progressMaximum, progressMinimum + 1),
          )}
          aria-label="播放进度"
          disabled={!runtime.mediaReady}
          onInput={(event) => engine.seek(Number(event.currentTarget.value))}
        />
        <div class="time-row">
          <span>{formatTime(runtime.currentTime)}</span>
          <span>{formatTime(progressMaximum)}</span>
        </div>
      </div>

      <div class="transport">
        <button
          class={`icon-button audio-mode-button ${audioOnlyState.status}`}
          type="button"
          title={audioOnlyButtonLabel(audioOnlyState)}
          aria-label={audioOnlyButtonLabel(audioOnlyState)}
          aria-pressed={audioOnlyState.requested}
          onClick={() =>
            audioOnly.toggle(
              engine.currentMedia?.currentTime ?? runtime.currentTime,
            )
          }
        >
          <Headphones size={19} aria-hidden="true" />
        </button>
        <button
          class="icon-button"
          type="button"
          title={PLAY_MODE_LABELS[data.playMode]}
          aria-label={PLAY_MODE_LABELS[data.playMode]}
          onClick={cyclePlayMode}
        >
          <PlayModeIcon mode={data.playMode} />
        </button>
        <button
          class="icon-button"
          type="button"
          title="上一首"
          aria-label="上一首"
          onClick={() => engine.previous()}
        >
          <SkipBack size={20} aria-hidden="true" />
        </button>
        <button
          class="play-button"
          type="button"
          title={runtime.playing ? "暂停" : "播放"}
          aria-label={runtime.playing ? "暂停" : "播放"}
          onClick={() => void engine.togglePlayback()}
        >
          {runtime.playing ? (
            <Pause size={22} fill="currentColor" aria-hidden="true" />
          ) : (
            <Play size={22} fill="currentColor" aria-hidden="true" />
          )}
        </button>
        <button
          class="icon-button"
          type="button"
          title="下一首"
          aria-label="下一首"
          onClick={() => engine.next()}
        >
          <SkipForward size={20} aria-hidden="true" />
        </button>
        <div class="volume-control">
          <button
            class="icon-button"
            type="button"
            title={runtime.muted ? "取消静音" : "静音"}
            aria-label={runtime.muted ? "取消静音" : "静音"}
            onClick={() => engine.toggleMute()}
          >
            {runtime.muted || runtime.volume === 0 ? (
              <VolumeX size={19} aria-hidden="true" />
            ) : (
              <Volume2 size={19} aria-hidden="true" />
            )}
          </button>
          <input
            class="range volume-range"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={runtime.muted ? 0 : runtime.volume}
            aria-label="音量"
            onInput={(event) =>
              engine.setVolume(Number(event.currentTarget.value))
            }
          />
        </div>
      </div>

      {primaryNotice &&
        (noticeActionable ? (
          <button
            class="status-message actionable"
            type="button"
            title={primaryNotice}
            onClick={() => void engine.togglePlayback()}
          >
            {primaryNotice}
          </button>
        ) : (
          <div
            class={`status-message ${noticeFallback ? "fallback" : ""}`}
            role="status"
            title={primaryNotice}
          >
            {primaryNotice}
          </div>
        ))}

      <div class="playlist-toolbar">
        <select
          value={activePlaylist.id}
          aria-label="当前歌单"
          onChange={(event) => store.selectPlaylist(event.currentTarget.value)}
        >
          {data.playlists.map((playlist) => (
            <option value={playlist.id} key={playlist.id}>
              {playlist.name}
            </option>
          ))}
        </select>
        <button
          class="icon-button"
          type="button"
          title="新建歌单"
          aria-label="新建歌单"
          onClick={() => setCreatingPlaylist((value) => !value)}
        >
          <Plus size={18} aria-hidden="true" />
        </button>
        <button
          class="icon-button danger"
          type="button"
          title="删除当前歌单"
          aria-label="删除当前歌单"
          disabled={data.playlists.length <= 1}
          onClick={() => store.removePlaylist(activePlaylist.id)}
        >
          <Trash2 size={17} aria-hidden="true" />
        </button>
      </div>

      {creatingPlaylist && (
        <form class="inline-form" onSubmit={createPlaylist}>
          <input
            value={newPlaylistName}
            placeholder="歌单名称"
            aria-label="歌单名称"
            autoFocus
            onInput={(event) => setNewPlaylistName(event.currentTarget.value)}
          />
          <button class="icon-button accent" type="submit" title="保存歌单">
            <Save size={17} aria-hidden="true" />
          </button>
        </form>
      )}

      <button
        class="add-current-button"
        type="button"
        disabled={!engine.currentMedia}
        onClick={() => setEditorTrack("new")}
      >
        <Plus size={17} aria-hidden="true" />
        将当前视频添加到歌单
      </button>

      {editorTrack && (
        <TrackEditor
          media={engine.currentMedia}
          track={editorTrack === "new" ? undefined : editorTrack}
          onCancel={() => setEditorTrack(undefined)}
          onSave={(track) => {
            if (editorTrack === "new") {
              store.addTrack(track);
            } else {
              store.updateTrack(track);
            }
            setEditorTrack(undefined);
          }}
        />
      )}

      <div class="track-list" role="list" aria-label="歌曲列表">
        {activePlaylist.tracks.length === 0 ? (
          <div class="empty-state">
            <ListMusic size={26} aria-hidden="true" />
            <span>歌单还是空的</span>
          </div>
        ) : (
          activePlaylist.tracks.map((track, index) => (
            <div
              class={`track-row ${
                track.id === nowPlaying.trackId ? "active" : ""
              }`}
              role="listitem"
              key={track.id}
            >
              <button
                class="track-main"
                type="button"
                title={`播放 ${track.title}`}
                onClick={() => engine.playTrack(track)}
              >
                <span class="track-index">
                  {track.id === nowPlaying.trackId && runtime.playing ? (
                    <Volume2 size={15} aria-hidden="true" />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span class="track-copy">
                  <strong>{track.title}</strong>
                  <span>
                    {track.uploader ?? track.bvid}
                    {track.startTime > 0 || track.endTime !== undefined
                      ? ` · ${formatTime(track.startTime)}–${formatTime(
                          track.endTime ?? track.duration,
                        )}`
                      : ""}
                  </span>
                </span>
                <span class="track-duration">
                  {formatTime(
                    (track.endTime ?? track.duration) - track.startTime,
                  )}
                </span>
              </button>
              <button
                class="row-action"
                type="button"
                title="编辑歌曲"
                aria-label={`编辑 ${track.title}`}
                onClick={() => setEditorTrack(track)}
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
              <button
                class="row-action danger"
                type="button"
                title="删除歌曲"
                aria-label={`删除 ${track.title}`}
                onClick={() => store.removeTrack(track.id)}
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

interface TrackEditorProps {
  media: HTMLMediaElement | null;
  track?: Track;
  onCancel: () => void;
  onSave: (track: Track) => void;
}

function TrackEditor({ media, track, onCancel, onSave }: TrackEditorProps) {
  const metadata = readCurrentVideoMetadata();
  const [title, setTitle] = useState(track?.title ?? metadata?.title ?? "");
  const [startTime, setStartTime] = useState(String(track?.startTime ?? 0));
  const [endTime, setEndTime] = useState(
    track?.endTime === undefined ? "" : String(track.endTime),
  );
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [startTime, endTime]);

  const save = (event: SubmitEvent) => {
    event.preventDefault();

    const start = Number(startTime);
    const end = endTime.trim() ? Number(endTime) : undefined;
    if (!Number.isFinite(start) || start < 0) {
      setError("开始时间无效");
      return;
    }
    if (end !== undefined && (!Number.isFinite(end) || end <= start)) {
      setError("结束时间必须晚于开始时间");
      return;
    }

    if (track) {
      onSave({
        ...track,
        title: title.trim() || track.title,
        startTime: start,
        endTime: end,
      });
      return;
    }

    if (!media) {
      setError("尚未找到 Bilibili 播放器");
      return;
    }

    const nextTrack = createTrackFromCurrentPage(media, title, start, end);
    if (!nextTrack) {
      setError("无法读取当前视频信息");
      return;
    }
    onSave(nextTrack);
  };

  return (
    <form class="track-editor" onSubmit={save}>
      <div class="editor-heading">
        <strong>{track ? "编辑歌曲" : "添加歌曲"}</strong>
        <button
          class="icon-button"
          type="button"
          title="关闭编辑器"
          aria-label="关闭编辑器"
          onClick={onCancel}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <label>
        <span>标题</span>
        <input
          value={title}
          required
          onInput={(event) => setTitle(event.currentTarget.value)}
        />
      </label>
      <div class="time-fields">
        <label>
          <span>开始时间（秒）</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={startTime}
            onInput={(event) => setStartTime(event.currentTarget.value)}
          />
        </label>
        <button
          class="current-time-button"
          type="button"
          disabled={!media}
          onClick={() => setStartTime(String(media?.currentTime ?? 0))}
        >
          <Clock3 size={15} aria-hidden="true" />
          当前
        </button>
      </div>
      <div class="time-fields">
        <label>
          <span>结束时间（秒）</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={endTime}
            onInput={(event) => setEndTime(event.currentTarget.value)}
          />
        </label>
        <button
          class="current-time-button"
          type="button"
          disabled={!media}
          onClick={() => setEndTime(String(media?.currentTime ?? ""))}
        >
          <Clock3 size={15} aria-hidden="true" />
          当前
        </button>
      </div>
      {error && <div class="editor-error">{error}</div>}
      <button class="save-track-button" type="submit">
        <Save size={16} aria-hidden="true" />
        保存
      </button>
    </form>
  );
}

function PlayModeIcon({ mode }: { mode: PlayMode }) {
  switch (mode) {
    case "list-loop":
      return <Repeat size={19} aria-hidden="true" />;
    case "single-loop":
      return <Repeat1 size={19} aria-hidden="true" />;
    case "shuffle":
      return <Shuffle size={19} aria-hidden="true" />;
    default:
      return <ListMusic size={19} aria-hidden="true" />;
  }
}

function audioOnlyButtonLabel(state: AudioOnlyState): string {
  switch (state.status) {
    case "detecting":
      return "纯音频模式正在检测播放流；点击关闭并重载";
    case "active":
      return "纯音频模式已生效；点击关闭并重载";
    case "fallback":
      return `纯音频模式未生效，已回退正常视频：${audioOnlyReasonLabel(
        state.reason,
      )}；点击关闭并重载`;
    default:
      return "开启纯音频模式并重载页面";
  }
}

function audioOnlyReasonLabel(
  reason: AudioOnlyInterceptionReason | undefined,
): string {
  switch (reason) {
    case "durl-only":
      return "当前视频只提供音视频混流";
    case "missing-audio":
      return "DASH 清单没有可用音频";
    case "missing-dash":
    case "invalid-payload":
      return "未找到可改写的 DASH 清单";
    case "invalid-json":
      return "播放清单不是有效 JSON";
    case "unsupported-response-type":
      return "播放器使用了暂不支持的响应格式";
    case "playinfo-nonconfigurable":
      return "首屏播放信息无法拦截";
    case "playinfo-rewrite-failed":
    case "fetch-rewrite-failed":
    case "xhr-rewrite-failed":
      return "播放清单拦截失败";
    default:
      return "当前播放格式不受支持";
  }
}
