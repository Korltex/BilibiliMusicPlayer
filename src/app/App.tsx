import { useEffect, useRef, useState } from "preact/hooks";
import { version } from "../../package.json";
import {
  ChevronDown,
  Clock3,
  ListMusic,
  Minimize2,
  Music2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Volume2,
  X,
} from "./icons";
import type { AppStore } from "./store";
import type { PlayerEngine } from "../playback/player-engine";
import type { AudioOnlyController } from "../bili/audio-only-controller";
import {
  createTrackFromCurrentPage,
  readCurrentVideoMetadata,
} from "../bili/metadata";
import { fetchVideoChapters, type VideoChapter } from "../bili/chapters";
import { formatTime, toEndSecond, toStartSecond } from "../core/time";
import type { PlayMode, Track } from "../core/types";
import { useDraggablePosition } from "./use-draggable-position";
import { LayoutRepository } from "../storage/layout";
import type { OpenPanelMode } from "../storage/layout-schema";
import { MinimalPlayer } from "./minimal-player";
import { audioOnlyReasonLabel, PlayerControls } from "./player-controls";

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

const layoutRepository = new LayoutRepository();
type DisplayMode = "launcher" | OpenPanelMode;

export function App({ store, engine, audioOnly }: AppProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("launcher");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editorTrack, setEditorTrack] = useState<Track | "new">();
  const launcherDrag = useDraggablePosition("launcher");
  const panelDrag = useDraggablePosition("panel");

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

  const showPanel = (mode: OpenPanelMode) => {
    if (displayMode !== "launcher" && displayMode !== mode) {
      panelDrag.saveCurrentPosition();
    }
    layoutRepository.saveLastOpenMode(mode);
    setDisplayMode(mode);
  };

  if (displayMode === "launcher") {
    return (
      <button
        ref={launcherDrag.ref}
        class="floating-button"
        type="button"
        style={launcherDrag.style}
        title="打开 Bilibili 音乐播放器"
        aria-label="打开 Bilibili 音乐播放器"
        onPointerDown={launcherDrag.onPointerDown}
        onPointerMove={launcherDrag.onPointerMove}
        onPointerUp={launcherDrag.onPointerUp}
        onPointerCancel={launcherDrag.onPointerCancel}
        onClick={(event) => {
          if (launcherDrag.consumeSuppressedClick()) {
            event.preventDefault();
            return;
          }

          showPanel(layoutRepository.load().lastOpenMode);
        }}
      >
        <Music2 size={22} aria-hidden="true" />
      </button>
    );
  }

  if (displayMode === "minimal") {
    return (
      <MinimalPlayer
        playMode={data.playMode}
        runtime={runtime}
        audioOnlyState={audioOnlyState}
        drag={panelDrag}
        onToggleAudioOnly={() =>
          audioOnly.toggle(
            engine.currentMedia?.currentTime ?? runtime.currentTime,
          )
        }
        onCyclePlayMode={cyclePlayMode}
        onPrevious={() => engine.previous()}
        onTogglePlayback={() => void engine.togglePlayback()}
        onNext={() => engine.next()}
        onToggleMute={() => engine.toggleMute()}
        onSetVolume={(volume) => engine.setVolume(volume)}
        onExpand={() => showPanel("full")}
        onClose={() => setDisplayMode("launcher")}
      />
    );
  }

  return (
    <section
      ref={panelDrag.ref}
      class="player-panel"
      style={panelDrag.style}
      aria-label="Bilibili 音乐播放器"
    >
      <header
        class="panel-header"
        onPointerDown={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("button, input, select, textarea, a")
          ) {
            return;
          }

          panelDrag.onPointerDown(event);
        }}
        onPointerMove={panelDrag.onPointerMove}
        onPointerUp={panelDrag.onPointerUp}
        onPointerCancel={panelDrag.onPointerCancel}
      >
        <div class="brand">
          <span class="brand-icon">
            <Music2 size={18} aria-hidden="true" />
          </span>
          <strong>Bilibili 音乐播放器</strong>
          <span class="version">{version}</span>
        </div>
        <div class="header-actions">
          <button
            class="icon-button reset-position-button"
            type="button"
            title="重置图标和播放器位置"
            aria-label="重置图标和播放器位置"
            onClick={() => {
              launcherDrag.resetPosition();
              panelDrag.resetPosition();
            }}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <button
            class="icon-button"
            type="button"
            title="进入极简模式"
            aria-label="进入极简模式"
            onClick={() => showPanel("minimal")}
          >
            <Minimize2 size={18} aria-hidden="true" />
          </button>
          <button
            class="icon-button close-panel-button"
            type="button"
            title="收起播放器"
            aria-label="收起播放器"
            onClick={() => setDisplayMode("launcher")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
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

      <PlayerControls
        variant="full"
        playMode={data.playMode}
        runtime={runtime}
        audioOnlyState={audioOnlyState}
        onToggleAudioOnly={() =>
          audioOnly.toggle(
            engine.currentMedia?.currentTime ?? runtime.currentTime,
          )
        }
        onCyclePlayMode={cyclePlayMode}
        onPrevious={() => engine.previous()}
        onTogglePlayback={() => void engine.togglePlayback()}
        onNext={() => engine.next()}
        onToggleMute={() => engine.toggleMute()}
        onSetVolume={(volume) => engine.setVolume(volume)}
      />

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
          key={editorTrack === "new" ? "new" : editorTrack.id}
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
                    {` · ${formatTime(track.startTime)}–${formatTime(
                      track.endTime ?? track.duration,
                    )}`}
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
  const [startTime, setStartTime] = useState(
    String(toStartSecond(track?.startTime ?? 0)),
  );
  const [endTime, setEndTime] = useState(
    track?.endTime === undefined ? "" : String(toEndSecond(track.endTime)),
  );
  const [error, setError] = useState("");
  const [chapters, setChapters] = useState<VideoChapter[]>([]);
  const [resolvedCid, setResolvedCid] = useState(track?.cid);
  const [chapterMenuOpen, setChapterMenuOpen] = useState(false);
  const [activeChapterIndex, setActiveChapterIndex] = useState(-1);
  const chapterCombobox = useRef<HTMLDivElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const chapterSourceBvid = track?.bvid ?? metadata?.bvid;
  const chapterSourcePage = track?.page ?? metadata?.page;
  const chapterSourceCid = track?.cid;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setChapters([]);
    setResolvedCid(chapterSourceCid);
    setChapterMenuOpen(false);
    setActiveChapterIndex(-1);

    if (chapterSourceBvid) {
      void fetchVideoChapters(
        {
          bvid: chapterSourceBvid,
          page: chapterSourcePage,
          cid: chapterSourceCid,
        },
        { signal: controller.signal },
      ).then((result) => {
        if (cancelled) {
          return;
        }

        setChapters(result.chapters);
        setResolvedCid(result.cid);
        setActiveChapterIndex(-1);
      });
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chapterSourceBvid, chapterSourceCid, chapterSourcePage]);

  useEffect(() => {
    if (!chapterMenuOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const combobox = chapterCombobox.current;
      if (combobox && !event.composedPath().includes(combobox)) {
        setChapterMenuOpen(false);
        setActiveChapterIndex(-1);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [chapterMenuOpen]);

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
    if (!Number.isInteger(start)) {
      setError("开始时间必须是整数秒");
      return;
    }
    if (end !== undefined && !Number.isFinite(end)) {
      setError("结束时间无效");
      return;
    }
    if (end !== undefined && !Number.isInteger(end)) {
      setError("结束时间必须是整数秒");
      return;
    }
    if (end !== undefined && end <= start) {
      setError("结束时间必须晚于开始时间");
      return;
    }

    if (track) {
      onSave({
        ...track,
        ...(resolvedCid !== undefined ? { cid: resolvedCid } : {}),
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

    const nextTrack = createTrackFromCurrentPage(
      media,
      title,
      start,
      end,
      resolvedCid,
    );
    if (!nextTrack) {
      setError("无法读取当前视频信息");
      return;
    }
    onSave(nextTrack);
  };

  const selectChapter = (chapter: VideoChapter) => {
    setTitle(chapter.title);
    setStartTime(String(chapter.startTime));
    setEndTime(String(chapter.endTime));
    setChapterMenuOpen(false);
    setActiveChapterIndex(-1);
    titleInput.current?.focus();
  };

  const moveActiveChapter = (direction: 1 | -1) => {
    if (chapters.length === 0) {
      setChapterMenuOpen(true);
      setActiveChapterIndex(-1);
      return;
    }

    setChapterMenuOpen(true);
    setActiveChapterIndex((current) => {
      if (current < 0) {
        return direction === 1 ? 0 : chapters.length - 1;
      }
      return (current + direction + chapters.length) % chapters.length;
    });
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
      <div class="editor-field">
        <label for="bilibili-music-track-title">标题</label>
        <div class="chapter-combobox" ref={chapterCombobox}>
          <input
            id="bilibili-music-track-title"
            ref={titleInput}
            value={title}
            required
            role="combobox"
            aria-autocomplete="none"
            aria-expanded={chapterMenuOpen}
            aria-controls="bilibili-music-chapter-options"
            aria-activedescendant={
              chapterMenuOpen && activeChapterIndex >= 0
                ? `bilibili-music-chapter-${activeChapterIndex}`
                : undefined
            }
            onInput={(event) => {
              setTitle(event.currentTarget.value);
              setActiveChapterIndex(-1);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActiveChapter(1);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActiveChapter(-1);
              } else if (
                event.key === "Enter" &&
                chapterMenuOpen &&
                activeChapterIndex >= 0
              ) {
                event.preventDefault();
                selectChapter(chapters[activeChapterIndex]);
              } else if (event.key === "Escape" && chapterMenuOpen) {
                event.preventDefault();
                setChapterMenuOpen(false);
                setActiveChapterIndex(-1);
              }
            }}
          />
          <button
            class={`chapter-toggle ${chapterMenuOpen ? "open" : ""}`}
            type="button"
            title={chapterMenuOpen ? "收起视频章节" : "展开视频章节"}
            aria-label={chapterMenuOpen ? "收起视频章节" : "展开视频章节"}
            aria-expanded={chapterMenuOpen}
            aria-controls="bilibili-music-chapter-options"
            onClick={() => {
              setChapterMenuOpen((open) => {
                const nextOpen = !open;
                setActiveChapterIndex(nextOpen && chapters.length > 0 ? 0 : -1);
                return nextOpen;
              });
              titleInput.current?.focus();
            }}
          >
            <ChevronDown size={17} aria-hidden="true" />
          </button>
          {chapterMenuOpen && (
            <div
              class="chapter-options"
              id="bilibili-music-chapter-options"
              role="listbox"
              aria-label="视频章节"
            >
              {chapters.map((chapter, index) => (
                <button
                  class={`chapter-option ${
                    index === activeChapterIndex ? "active" : ""
                  }`}
                  id={`bilibili-music-chapter-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeChapterIndex}
                  tabIndex={-1}
                  key={`${chapter.startTime}-${chapter.endTime}-${chapter.title}`}
                  onPointerEnter={() => setActiveChapterIndex(index)}
                  onClick={() => selectChapter(chapter)}
                >
                  <span>{chapter.title}</span>
                  <span>
                    {formatTime(chapter.startTime)}–
                    {formatTime(chapter.endTime)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div class="time-fields">
        <label>
          <span>开始时间（秒）</span>
          <input
            type="number"
            min="0"
            step="1"
            value={startTime}
            onInput={(event) => setStartTime(event.currentTarget.value)}
            onInvalid={(event) => {
              if (event.currentTarget.validity.stepMismatch) {
                event.preventDefault();
                setError("开始时间必须是整数秒");
              }
            }}
          />
        </label>
        <button
          class="current-time-button"
          type="button"
          disabled={!media}
          onClick={() =>
            setStartTime(String(toStartSecond(media?.currentTime ?? 0)))
          }
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
            step="1"
            value={endTime}
            onInput={(event) => setEndTime(event.currentTarget.value)}
            onInvalid={(event) => {
              if (event.currentTarget.validity.stepMismatch) {
                event.preventDefault();
                setError("结束时间必须是整数秒");
              }
            }}
          />
        </label>
        <button
          class="current-time-button"
          type="button"
          disabled={!media}
          onClick={() =>
            setEndTime(media ? String(toEndSecond(media.currentTime)) : "")
          }
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
