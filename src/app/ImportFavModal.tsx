import { useRef, useState } from "preact/hooks";
import type { Playlist } from "../core/types";
import {
  favoritePlaylistId,
  fetchFavFolder,
  fetchFavFolderInfo,
  parseFavUrl,
  type FavTarget,
  type SeasonTarget,
} from "../sources/bilibili-fav";
import {
  fetchSeason,
  fetchSeasonInfo,
  seasonPlaylistId,
} from "../sources/bilibili-season";
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
  | { kind: "season"; target: SeasonTarget };

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
  const [progress, setProgress] = useState<ImportProgress>();
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  const playlistId = source
    ? source.kind === "folder"
      ? favoritePlaylistId(source.target.fid)
      : seasonPlaylistId(source.target.seasonId)
    : undefined;
  const existingPlaylist = playlistId
    ? store.data.value.playlists.find((item) => item.id === playlistId)
    : undefined;

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
    setProgress(undefined);
    setError("");
    setPhase("input");
  };

  const parse = async (event: SubmitEvent) => {
    event.preventDefault();

    const parsed = parseFavUrl(url);
    if (parsed.kind === "unsupported") {
      setError(parsed.message);
      setPhase("error");
      return;
    }
    if (parsed.kind !== "folder" && parsed.kind !== "season") {
      setError(
        "无法解析链接，请粘贴 B 站收藏夹或合集链接（如 https://space.bilibili.com/…/favlist?fid=…）",
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
      } else {
        setSource({ kind: "season", target: parsed.target });
        const result = await fetchSeasonInfo(parsed.target.seasonId, {
          signal: next.signal,
          mid: parsed.target.mid,
        });
        setInfo({ name: result.name, count: result.total });
      }

      setPhase("confirm");
    } catch (err) {
      if (!next.signal.aborted) {
        setError(readMessage(err));
        setPhase("error");
      }
    }
  };

  const runImport = async () => {
    if (!source || !info) {
      return;
    }

    resetController();
    const next = new AbortController();
    controller.current = next;
    setError("");
    setProgress(undefined);
    setPhase("importing");

    try {
      const result =
        source.kind === "folder"
          ? await fetchFavFolder(source.target.fid, {
              signal: next.signal,
              expectedOwnerMid: source.target.ownerMid,
              onProgress: (value) =>
                setProgress({ loaded: value.loaded, total: value.total }),
            })
          : await fetchSeason(source.target.seasonId, {
              signal: next.signal,
              mid: source.target.mid,
              onProgress: (value) =>
                setProgress({ loaded: value.loaded, total: value.total }),
            });

      const playlist: Playlist = {
        id:
          source.kind === "folder"
            ? favoritePlaylistId(source.target.fid)
            : seasonPlaylistId(source.target.seasonId),
        name: info.name,
        tracks: result.tracks,
        createdAt: existingPlaylist?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      store.importPlaylist(playlist);

      setSummary(
        `成功导入 ${result.tracks.length} 个视频，已跳过 ${result.skipped} 个失效视频`,
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
      aria-label="导入 Bilibili 收藏夹"
    >
      <div class="import-fav-card">
        <div class="editor-heading">
          <strong>导入收藏夹 / 合集</strong>
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
              placeholder="粘贴收藏夹或合集链接，如 https://space.bilibili.com/…/favlist?fid=…"
              aria-label="收藏夹链接"
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
            <p>
              即将导入歌单「{info.name}」，共 {info.count} 条内容
            </p>
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
