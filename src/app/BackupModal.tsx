import { useRef, useState } from "preact/hooks";
import type { Playlist } from "../core/types";
import {
  assertBackupSize,
  parsePlaylistBackup,
  summarizeLibrary,
  type BackupSource,
  type ParsedPlaylistBackup,
} from "../storage/backup";
import { X } from "./icons";
import type { AppStore } from "./store";

const SOURCE_LABELS: Record<BackupSource, string> = {
  backup: "Bilibili 音乐播放器备份",
  "tampermonkey-storage": "Tampermonkey 存储数据",
  "legacy-app-data": "旧版歌单数据",
};

type Phase = "idle" | "preview" | "confirming" | "done";

interface BackupModalProps {
  store: AppStore;
  /** 由 App 提供：先退出插件歌单播放，再整体替换歌单库。 */
  onRestore: (playlists: Playlist[]) => void;
  onClose: () => void;
}

/**
 * 「导入歌单」弹窗（设置的「数据管理 → 导入备份」入口）。
 *
 * 导出已经由设置页内联一步完成，这里只负责导入：解析校验 → 预览 → 二次确认
 * → 才写存储。任何一步失败（取消、关闭、读取失败、校验失败）都必须保持
 * 当前歌单库原样。
 */
export function BackupModal({ store, onRestore, onClose }: BackupModalProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<ParsedPlaylistBackup>();
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const currentSummary = summarizeLibrary(store.data.value.playlists);
  const importedSummary = parsed
    ? `${parsed.playlistCount} 个歌单、${parsed.trackCount} 首歌曲`
    : "";

  const readFile = async (file: File) => {
    setError("");

    try {
      assertBackupSize(file.size);
      const next = parsePlaylistBackup(await file.text());
      setParsed(next);
      setPhase("preview");
    } catch (err) {
      setParsed(undefined);
      setPhase("idle");
      setError(readMessage(err));
    }
  };

  const confirmRestore = () => {
    if (!parsed) {
      return;
    }

    onRestore(parsed.playlists);
    setPhase("done");
  };

  return (
    <div
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle(phase)}
    >
      <div class="modal-card">
        <div class="editor-heading">
          <strong>{modalTitle(phase)}</strong>
          <button
            class="icon-button"
            type="button"
            title="关闭"
            aria-label="关闭"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {phase === "idle" && (
          <>
            <section class="backup-section">
              <p class="backup-note">
                选择此前导出的歌单 JSON 文件，导入会替换当前全部歌单
              </p>
              <p class="backup-count">当前：{currentSummary}</p>
              <input
                ref={fileInput}
                class="visually-hidden"
                type="file"
                accept=".json,application/json"
                aria-label="选择歌单文件"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  // 清空 value，保证「同一个文件再选一次」也能触发 change。
                  event.currentTarget.value = "";
                  if (file) {
                    void readFile(file);
                  }
                }}
              />
              <button
                class="modal-button secondary"
                type="button"
                onClick={() => fileInput.current?.click()}
              >
                选择歌单文件
              </button>
              {error && (
                <p class="backup-error" role="alert">
                  {error}
                </p>
              )}
            </section>
          </>
        )}

        {phase === "preview" && parsed && (
          <>
            <div class="backup-preview">
              <p>来源：{SOURCE_LABELS[parsed.source]}</p>
              <p class="backup-count">将导入：{importedSummary}</p>
              <p class="backup-count">当前歌库：{currentSummary}</p>
            </div>
            <p class="modal-warning">导入会替换当前全部歌单和歌曲。</p>
            <div class="modal-actions">
              <button
                class="modal-button secondary"
                type="button"
                onClick={() => {
                  setParsed(undefined);
                  setPhase("idle");
                }}
              >
                取消
              </button>
              <button
                class="modal-button primary"
                type="button"
                onClick={() => setPhase("confirming")}
              >
                导入并覆盖
              </button>
            </div>
          </>
        )}

        {phase === "confirming" && parsed && (
          <>
            <div class="backup-preview">
              <p>备份中有 {importedSummary}。</p>
              <p>这会替换当前全部歌单和歌曲。</p>
              <p>当前未包含在导入文件中的歌单将被删除。</p>
            </div>
            <p class="modal-warning">此操作不会自动备份，且无法撤销。</p>
            <div class="modal-actions">
              <button
                class="modal-button secondary"
                type="button"
                autoFocus
                onClick={() => setPhase("preview")}
              >
                取消
              </button>
              <button
                class="modal-button primary"
                type="button"
                onClick={confirmRestore}
              >
                确认导入
              </button>
            </div>
          </>
        )}

        {phase === "done" && parsed && (
          <div class="backup-done">
            <p role="status">导入成功：已恢复 {importedSummary}。</p>
            <div class="modal-actions">
              <button
                class="modal-button primary"
                type="button"
                autoFocus
                onClick={onClose}
              >
                完成
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 导入确认阶段要换标题，让用户一眼看出这是不可撤销的最后一步。 */
function modalTitle(phase: Phase): string {
  return phase === "confirming" ? "确认导入歌单" : "导入歌单";
}

function readMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "读取歌单文件失败，请重试";
}
