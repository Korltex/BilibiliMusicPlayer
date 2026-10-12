import { useEffect, useRef, useState } from "preact/hooks";
import { version } from "../../package.json";
import {
  BrandLogo,
  ChevronDown,
  Clock3,
  ListMusic,
  Minimize2,
  Music2,
  Pencil,
  Plus,
  Save,
  Settings,
  StarPlus,
  Trash2,
  Volume2,
  X,
} from "./icons";
import { ImportFavModal } from "./ImportFavModal";
import { BackupModal } from "./BackupModal";
import { ConfirmModal } from "./ConfirmModal";
import { downloadTextFile } from "./download";
import { SettingsPanel } from "./SettingsPanel";
import type { AppStore } from "./store";
import type { PlayerEngine } from "../playback/player-engine";
import type { AudioOnlyController } from "../bili/audio-only-controller";
import {
  createTrackFromCurrentPage,
  readCurrentVideoMetadata,
} from "../bili/metadata";
import { fetchVideoChapters, type VideoChapter } from "../bili/chapters";
import { isVideoPage } from "../bili/page-route";
import {
  backupFileName,
  createPlaylistBackup,
  serializePlaylistBackup,
  summarizeLibrary,
} from "../storage/backup";
import { formatTime, toEndSecond, toStartSecond } from "../core/time";
import type { PlayMode, Playlist, Track } from "../core/types";
import { useDraggablePosition } from "./use-draggable-position";
import { useTrackReorder, type TrackRowBinding } from "./use-track-reorder";
import { LayoutRepository } from "../storage/layout";
import type { OpenPanelMode } from "../storage/layout-schema";
import { SettingsRepository } from "../storage/settings";
import {
  resolveOpenMode,
  type OpenModePreference,
} from "../storage/settings-schema";
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
const settingsRepository = new SettingsRepository();
type DisplayMode = "launcher" | OpenPanelMode | "settings";

export function App({ store, engine, audioOnly }: AppProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("launcher");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [editorTrack, setEditorTrack] = useState<Track | "new">();
  const [importOpen, setImportOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  // 设置视图里的偏好与导出结果；写存储与下载都由下面的回调负责。
  const [openMode, setOpenMode] = useState<OpenModePreference>(
    () => settingsRepository.load().openMode,
  );
  const [settingsOrigin, setSettingsOrigin] = useState<OpenPanelMode>();
  const [exportResult, setExportResult] = useState<{
    status?: string;
    error?: string;
  }>({});
  // 待删除对象即“确认弹窗是否打开”的唯一来源，同时快照住点击那一刻的名称，
  // 避免弹窗期间下游数据变化导致文案或删除目标漂移。
  const [playlistPendingDeletion, setPlaylistPendingDeletion] =
    useState<Playlist>();
  const [trackPendingDeletion, setTrackPendingDeletion] = useState<Track>();
  const launcherDrag = useDraggablePosition("launcher");
  // 播放器面板顶边固定：歌单内容变少时只收起底边，面板不整体上移/下移。
  const panelDrag = useDraggablePosition("panel", { pinDefaultAnchor: true });
  // 歌曲行长按拖动排序：顺序直接写当前歌单的 `tracks` 数组（见 store.moveTrack）。
  const reorder = useTrackReorder({
    onMove: (trackId, toIndex) => store.moveTrack(trackId, toIndex),
    describePosition: (index) => `已移动到第 ${index + 1} 首`,
  });

  const data = store.data.value;
  const session = store.session.value;
  const runtime = engine.state.value;
  const audioOnlyState = audioOnly.state.value;
  const activePlaylist =
    data.playlists.find(
      (playlist) => playlist.id === session.activePlaylistId,
    ) ?? data.playlists[0];
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
    const currentIndex = PLAY_MODES.indexOf(session.playMode);
    engine.setPlayMode(PLAY_MODES[(currentIndex + 1) % PLAY_MODES.length]);
  };

  const restoreLibrary = (playlists: Playlist[]) => {
    // 导入会整体替换歌单库：先退出插件歌单播放并暂停媒体，
    // 否则引擎可能拿着已经不存在于歌库里的 trackId 继续恢复播放。
    if (runtime.playbackContext === "playlist") {
      engine.currentMedia?.pause();
      engine.exitPlaylistPlayback();
    }
    store.replaceLibrary(playlists);
  };

  const showPanel = (mode: OpenPanelMode) => {
    if (displayMode !== "launcher" && displayMode !== mode) {
      panelDrag.saveCurrentPosition();
    }
    layoutRepository.saveLastOpenMode(mode);
    setDisplayMode(mode);
  };

  const openSettings = () => {
    panelDrag.saveCurrentPosition();
    setSettingsOrigin(displayMode === "minimal" ? "minimal" : "full");
    setExportResult({});
    setDisplayMode("settings");
  };

  const selectOpenMode = (mode: OpenModePreference) => {
    settingsRepository.saveOpenMode(mode);
    setOpenMode(mode);
  };

  /** 导出是纯本地动作：序列化当前歌单库并触发下载，不改任何数据。 */
  const exportLibrary = () => {
    try {
      const text = serializePlaylistBackup(
        createPlaylistBackup({ playlists: data.playlists }, version),
      );
      downloadTextFile(backupFileName(), text);
      setExportResult({ status: "已开始下载备份文件" });
    } catch (error) {
      setExportResult({
        error:
          error instanceof Error && error.message
            ? error.message
            : "导出失败，请重试",
      });
    }
  };

  const openImportBackup = () => {
    setExportResult({});
    setBackupOpen(true);
  };

  // 面板与设置两个视图共用同一批弹窗：设置页只需要备份导入，
  // 其余弹窗在设置页不会被触发，因此可以原样复用。
  const overlays = (
    <>
      {importOpen && (
        <ImportFavModal store={store} onClose={() => setImportOpen(false)} />
      )}

      {backupOpen && (
        <BackupModal
          store={store}
          onRestore={restoreLibrary}
          onClose={() => setBackupOpen(false)}
        />
      )}

      {playlistPendingDeletion && (
        <ConfirmModal
          title="删除歌单"
          message={`确定删除歌单“${playlistPendingDeletion.name}”？`}
          warning="删除后无法恢复，歌单里的歌曲会一并移除"
          onCancel={() => setPlaylistPendingDeletion(undefined)}
          onConfirm={() => {
            store.removePlaylist(playlistPendingDeletion.id);
            setPlaylistPendingDeletion(undefined);
          }}
        />
      )}

      {trackPendingDeletion && (
        <ConfirmModal
          title="删除歌曲"
          message={`确定删除歌曲“${trackPendingDeletion.title}”？`}
          warning="删除后无法恢复。"
          onCancel={() => setTrackPendingDeletion(undefined)}
          onConfirm={() => {
            store.removeTrack(trackPendingDeletion.id);
            setTrackPendingDeletion(undefined);
          }}
        />
      )}
    </>
  );

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

          if (!isVideoPage()) {
            // 收藏页等没有播放器的页面：直接进入完整面板并打开导入弹窗，
            // 且不覆盖用户记住的面板形态。
            setDisplayMode("full");
            setImportOpen(true);
            return;
          }

          showPanel(
            resolveOpenMode(openMode, layoutRepository.load().lastOpenMode),
          );
        }}
      >
        <Music2 size={22} aria-hidden="true" />
      </button>
    );
  }

  if (displayMode === "settings") {
    return (
      <SettingsPanel
        openMode={openMode}
        librarySummary={summarizeLibrary(data.playlists)}
        drag={panelDrag}
        exportStatus={exportResult.status}
        exportError={exportResult.error}
        onSelectOpenMode={selectOpenMode}
        onResetPositions={() => {
          launcherDrag.resetPosition();
          panelDrag.resetPosition();
        }}
        onExportBackup={exportLibrary}
        onImportBackup={openImportBackup}
        onBack={() => setDisplayMode(settingsOrigin ?? "full")}
        onClose={() => setDisplayMode("launcher")}
      >
        {overlays}
      </SettingsPanel>
    );
  }

  if (displayMode === "minimal") {
    return (
      <MinimalPlayer
        playMode={session.playMode}
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
          <BrandLogo class="brand-logo" size={26} aria-hidden="true" />
          <strong>Bilibili 音乐播放器</strong>
          <span class="version">{version}</span>
        </div>
        <div class="header-actions">
          <button
            class="icon-button"
            type="button"
            title="批量导入"
            aria-label="批量导入"
            onClick={() => setImportOpen(true)}
          >
            <StarPlus size={18} aria-hidden="true" />
          </button>
          <button
            class="icon-button"
            type="button"
            title="极简模式"
            aria-label="极简模式"
            onClick={() => showPanel("minimal")}
          >
            <Minimize2 size={18} aria-hidden="true" />
          </button>
          <button
            class="icon-button"
            type="button"
            title="设置"
            aria-label="设置"
            onClick={openSettings}
          >
            <Settings size={18} aria-hidden="true" />
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
        playMode={session.playMode}
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
          onClick={() => setPlaylistPendingDeletion(activePlaylist)}
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

      <div
        class={`track-list ${reorder.draggingTrackId ? "reordering" : ""}`}
        role="list"
        aria-label="歌曲列表"
        ref={reorder.containerRef}
      >
        {activePlaylist.tracks.length === 0 ? (
          <div class="empty-state">
            <ListMusic size={26} aria-hidden="true" />
            <span>歌单还是空的</span>
          </div>
        ) : (
          activePlaylist.tracks.map((track, index) => (
            <TrackRow
              key={track.id}
              track={track}
              index={index}
              active={track.id === nowPlaying.trackId}
              playing={runtime.playing}
              dropIndex={reorder.dropIndex}
              trackCount={activePlaylist.tracks.length}
              row={reorder.bindRow(track.id)}
              onPlay={() => engine.playTrack(track)}
              onEdit={() => setEditorTrack(track)}
              onDelete={() => setTrackPendingDeletion(track)}
            />
          ))
        )}
      </div>

      {overlays}
    </section>
  );
}

interface TrackRowProps {
  track: Track;
  index: number;
  active: boolean;
  playing: boolean;
  dropIndex?: number;
  trackCount: number;
  /** `useTrackReorder().bindRow()` 产出的拖动/键盘排序绑定。 */
  row: TrackRowBinding;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

/**
 * 单行歌曲。
 *
 * 拆成组件是为了把 `bindRow()` 的输出**只求值一次**：它带有 `onPointerDown` 等回调，
 * 在 JSX 里重复调用会让每次渲染都产生新函数、并让 class 合并变复杂。
 */
function TrackRow({
  track,
  index,
  active,
  playing,
  dropIndex,
  trackCount,
  row,
  onPlay,
  onEdit,
  onDelete,
}: TrackRowProps) {
  const showTail = dropIndex === trackCount && index === trackCount - 1;
  const playIcon = active && playing;

  return (
    <div
      {...row}
      role="listitem"
      data-track-id={track.id}
      class={`${row.class} ${active ? "active" : ""}`.trim()}
    >
      {/* 落点插入线：绝对定位，因此不参与 `.track-row` 的网格布局。 */}
      {(dropIndex === index || showTail) && (
        <span
          class={`track-drop-indicator ${
            dropIndex === index ? "" : "tail"
          }`.trim()}
          aria-hidden="true"
        />
      )}
      <button
        class="track-main"
        type="button"
        title={`播放 ${track.title}`}
        onClick={onPlay}
      >
        <span class="track-index">
          {playIcon ? (
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
          {formatTime((track.endTime ?? track.duration) - track.startTime)}
        </span>
      </button>
      <button
        class="row-action"
        type="button"
        title="编辑歌曲"
        aria-label={`编辑 ${track.title}`}
        onClick={onEdit}
      >
        <Pencil size={15} aria-hidden="true" />
      </button>
      <button
        class="row-action danger"
        type="button"
        title="删除歌曲"
        aria-label={`删除 ${track.title}`}
        onClick={onDelete}
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </div>
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
