import { useRef, useState } from "preact/hooks";
import type { Playlist, Track } from "../core/types";
import {
  favoritePlaylistId,
  fetchFavFolder,
  fetchFavFolderInfo,
} from "../sources/bilibili-fav";
import {
  fetchSeason,
  fetchSeasonInfo,
  seasonPlaylistId,
} from "../sources/bilibili-season";
import {
  buildEntryTracks,
  fetchVideoDetail,
  videoPlaylistId,
  VIDEO_TRACK_PREFIX,
  type VideoDetail,
} from "../sources/bilibili-video";
import {
  parseImportUrl,
  type FavTarget,
  type SeasonTarget,
  type VideoTarget,
} from "../sources/import-url";
import { X } from "./icons";
import type { AppStore } from "./store";

type Phase =
  | "input"
  | "confirming"
  | "confirm"
  | "importing"
  | "done"
  | "error";

type ImportSource =
  | { kind: "folder"; target: FavTarget }
  | { kind: "season"; target: SeasonTarget }
  | { kind: "video"; target: VideoTarget };

interface SourceInfo {
  name: string;
  count: number;
}

interface ImportProgress {
  loaded: number;
  total: number;
}

interface ImportFavModalProps {
  store: AppStore;
  onClose: () => void;
}

export function ImportFavModal({ store, onClose }: ImportFavModalProps) {
  const [phase, setPhase] = useState<Phase>("input");
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<ImportSource>();
  const [info, setInfo] = useState<SourceInfo>();
  const [detail, setDetail] = useState<VideoDetail>();
  const [progress, setProgress] = useState<ImportProgress>();
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  const videoSource = source?.kind === "video" ? source : undefined;

  const playlistId = source
    ? source.kind === "folder"
      ? favoritePlaylistId(source.target.fid)
      : source.kind === "season"
        ? seasonPlaylistId(source.target.seasonId)
        : videoPlaylistId(source.target.bvid)
    : undefined;
  const existingPlaylist = playlistId
    ? store.data.value.playlists.find((item) => item.id === playlistId)
    : undefined;
  const plannedCount = videoSource
    ? (detail?.pages.length ?? 0)
    : (info?.count ?? 0);

  const resetController = () => {
    controller.current?.abort();
    controller.current = null;
  };

  const close = () => {
    resetController();
    onClose();
  };

  const backToInput = () => {
    resetController();
    setSource(undefined);
    setInfo(undefined);
    setDetail(undefined);
    setProgress(undefined);
    setError("");
    setPhase("input");
  };

  const loadSeason = async (
    target: SeasonTarget,
    signal: AbortSignal,
  ): Promise<void> => {
    setSource({ kind: "season", target });
    const result = await fetchSeasonInfo(target.seasonId, {
      signal,
      mid: target.mid,
    });
    setInfo({ name: result.name, count: result.total });
  };

  /** 视频入口：先嗅探合集；有合集就当合集导入，没有就按分P 全部导入。 */
  const loadVideo = async (
    target: VideoTarget,
    signal: AbortSignal,
  ): Promise<void> => {
    const video = await fetchVideoDetail(target.bvid, { signal });
    setDetail(video);

    if (video.seasonId) {
      await loadSeason(
        {
          seasonId: video.seasonId,
          ...(video.seasonOwnerMid ? { mid: video.seasonOwnerMid } : {}),
        },
        signal,
      );
      return;
    }

    setSource({ kind: "video", target });
    setInfo({ name: video.title || target.bvid, count: video.pages.length });
  };

  const parse = async (event: SubmitEvent) => {
    event.preventDefault();

    const parsed = parseImportUrl(url);
    if (parsed.kind === "unsupported") {
      setError(parsed.message);
      setPhase("error");
      return;
    }
    if (parsed.kind === "unknown") {
      setError(
        "无法解析链接，请粘贴 B 站收藏夹 / 合集 / 视频链接（space.bilibili.com 的 favlist，或 /video/BV…）",
      );
      setPhase("error");
      return;
    }

    resetController();
    const next = new AbortController();
    controller.current = next;
    setError("");
    setPhase("confirming");

    try {
      if (parsed.kind === "folder") {
        setSource({ kind: "folder", target: parsed.target });
        const result = await fetchFavFolderInfo(parsed.target.fid, {
          signal: next.signal,
          expectedOwnerMid: parsed.target.ownerMid,
        });
        setInfo({ name: result.name, count: result.mediaCount });
      } else if (parsed.kind === "season") {
        await loadSeason(parsed.target, next.signal);
      } else {
        await loadVideo(parsed.target, next.signal);
      }

      setPhase("confirm");
    } catch (err) {
      if (next.signal.aborted) {
        return;
      }

      setError(readMessage(err));
      setPhase("error");
    }
  };

  const runImport = async () => {
    if (!source || !info || !playlistId) {
      return;
    }

    resetController();
    const next = new AbortController();
    controller.current = next;
    setError("");
    setProgress(undefined);
    setPhase("importing");

    try {
      let tracks: Track[];
      let skipped = 0;

      if (source.kind === "video") {
        if (!detail) {
          throw new Error("视频信息已失效，请重新解析链接");
        }
        // `pages` 是唯一权威的可播放选集来源；空即无可导入内容。
        // （收藏夹/合集的单P 条目走的是「无 parts → 用列表元数据」分支，不在此列。）
        if (detail.pages.length === 0) {
          throw new Error("该视频没有可导入的分P，请换一个视频链接");
        }

        tracks = buildEntryTracks(
          VIDEO_TRACK_PREFIX,
          {
            bvid: detail.bvid,
            title: detail.title,
            ...(detail.cover ? { cover: detail.cover } : {}),
            ...(detail.ownerName ? { uploader: detail.ownerName } : {}),
            duration: detail.duration,
          },
          detail.pages,
          "manual",
        );

        if (tracks.length === 0) {
          throw new Error("该视频没有可导入的分P，请换一个视频链接");
        }
      } else if (source.kind === "folder") {
        const result = await fetchFavFolder(source.target.fid, {
          signal: next.signal,
          expectedOwnerMid: source.target.ownerMid,
          onProgress: (value) =>
            setProgress({ loaded: value.loaded, total: value.total }),
        });

        tracks = result.tracks;
        skipped = result.skipped;
      } else {
        const result = await fetchSeason(source.target.seasonId, {
          signal: next.signal,
          mid: source.target.mid,
          onProgress: (value) =>
            setProgress({ loaded: value.loaded, total: value.total }),
        });

        tracks = result.tracks;
        skipped = result.skipped;
      }

      const playlist: Playlist = {
        id: playlistId,
        name: info.name,
        tracks,
        createdAt: existingPlaylist?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      store.importPlaylist(playlist);

      setSummary(
        `成功导入 ${tracks.length} 个视频，已跳过 ${skipped} 个失效视频`,
      );
      setPhase("done");
    } catch (err) {
      if (next.signal.aborted) {
        setPhase("input");
      } else {
        setError(readMessage(err));
        setPhase("error");
      }
    }
  };

  const abortImport = () => {
    controller.current?.abort();
  };

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : 0;
  const progressText = progress
    ? `正在导入… ${progress.loaded}/${
        progress.total > 0 ? progress.total : "?"
      }（${percent}%）`
    : "正在导入…";

  return (
    <div
      class="import-fav-modal"
      role="dialog"
      aria-modal="true"
      aria-label="批量导入"
    >
      <div class="import-fav-card">
        <div class="editor-heading">
          <strong>批量导入</strong>
          <button
            class="icon-button"
            type="button"
            title="关闭"
            aria-label="关闭"
            onClick={close}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {phase === "input" && (
          <form class="import-fav-form" onSubmit={parse}>
            <input
              value={url}
              placeholder="粘贴收藏夹 / 合集 / 视频链接，如 https://www.bilibili.com/video/BV…"
              aria-label="导入链接"
              autoFocus
              onInput={(event) => setUrl(event.currentTarget.value)}
            />
            <div class="import-fav-actions">
              <button
                class="import-fav-button secondary"
                type="button"
                onClick={close}
              >
                取消
              </button>
              <button
                class="import-fav-button primary"
                type="submit"
                disabled={!url.trim()}
              >
                解析
              </button>
            </div>
          </form>
        )}

        {phase === "confirming" && (
          <div class="import-fav-status">正在获取信息…</div>
        )}

        {phase === "confirm" && info && (
          <div class="import-fav-confirm">
            {videoSource ? (
              <div class="import-fav-video">
                <p>该视频没有合集，是否导入为歌单？</p>
                <p class="import-fav-name">《{info.name}》</p>
                <p class="import-fav-note">
                  将导入 {plannedCount} 个视频（多P 会按分P 拆分为独立曲目）
                </p>
              </div>
            ) : (
              <p>
                即将导入歌单「{info.name}」，共 {info.count} 条内容
              </p>
            )}
            {existingPlaylist && (
              <p class="import-fav-warning">
                本地已存在该歌单，覆盖导入将替换其中的歌曲
              </p>
            )}
            <div class="import-fav-actions">
              <button
                class="import-fav-button secondary"
                type="button"
                onClick={close}
              >
                取消
              </button>
              <button
                class="import-fav-button primary"
                type="button"
                onClick={() => void runImport()}
              >
                {existingPlaylist ? "覆盖导入" : "导入"}
              </button>
            </div>
          </div>
        )}

        {phase === "importing" && (
          <div class="import-fav-importing">
            <div
              class="import-progress"
              role="progressbar"
              aria-label="导入进度"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div class="import-progress-track">
                <div
                  class="import-progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
            <div class="import-progress-text">{progressText}</div>
            <div class="import-fav-actions">
              <button
                class="import-fav-button secondary"
                type="button"
                onClick={abortImport}
              >
                中止导入
              </button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div class="import-fav-done">
            <p>{summary}</p>
            <div class="import-fav-actions">
              <button
                class="import-fav-button primary"
                type="button"
                onClick={close}
              >
                完成
              </button>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div class="import-fav-error">
            <p>{error}</p>
            <div class="import-fav-actions">
              <button
                class="import-fav-button secondary"
                type="button"
                onClick={close}
              >
                取消
              </button>
              <button
                class="import-fav-button primary"
                type="button"
                onClick={backToInput}
              >
                返回
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function readMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "导入失败，请重试";
}
