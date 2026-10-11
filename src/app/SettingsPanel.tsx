import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";
import { version } from "../../package.json";
import type { OpenModePreference } from "../storage/settings-schema";
import {
  AppWindow,
  ArrowLeft,
  ChevronDown,
  Database,
  Download,
  Info,
  RotateCcw,
  Upload,
  X,
} from "./icons";
import type { DraggablePositionBinding } from "./use-draggable-position";

export interface SettingsPanelProps {
  openMode: OpenModePreference;
  /** 「N 个歌单 · M 首歌曲」，由 App 用 `summarizeLibrary` 生成。 */
  librarySummary: string;
  drag: DraggablePositionBinding;
  exportStatus?: string;
  exportError?: string;
  onSelectOpenMode: (mode: OpenModePreference) => void;
  onResetPositions: () => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
  onBack: () => void;
  onClose: () => void;
  /** 弹窗挂在这里面，才能像播放器面板一样相对面板定位并接收指针事件。 */
  children?: ComponentChildren;
}

const OPEN_MODE_OPTIONS: { value: OpenModePreference; label: string }[] = [
  { value: "remember", label: "记住上次" },
  { value: "full", label: "完整模式" },
  { value: "minimal", label: "极简模式" },
];

type SectionId = "appearance" | "data" | "about";

/**
 * 设置视图。
 *
 * 与播放器面板共用同一个容器与拖拽坐标（`drag`），只把内容换成三个分区；
 * 组件本身不写任何存储：偏好与备份都由 App 提供回调，展开状态只是本地 UI 状态。
 * 一次只展开一个分区，避免设置页被拉得过长。
 */
export function SettingsPanel({
  openMode,
  librarySummary,
  drag,
  exportStatus,
  exportError,
  onSelectOpenMode,
  onResetPositions,
  onExportBackup,
  onImportBackup,
  onBack,
  onClose,
  children,
}: SettingsPanelProps) {
  const [openSection, setOpenSection] = useState<SectionId | undefined>(
    "appearance",
  );

  const toggle = (section: SectionId) => {
    setOpenSection((current) => (current === section ? undefined : section));
  };

  const isOpen = (section: SectionId) => openSection === section;

  const sectionHeader = (
    section: SectionId,
    title: string,
    icon: ComponentChildren,
    summary?: string,
  ) => (
    <button
      class="settings-section-header"
      type="button"
      aria-expanded={isOpen(section)}
      aria-controls={`bmp-settings-${section}`}
      onClick={() => toggle(section)}
    >
      <span class="settings-section-icon" aria-hidden="true">
        {icon}
      </span>
      <strong class="settings-section-title">{title}</strong>
      {summary && <span class="settings-section-summary">{summary}</span>}
      <ChevronDown class="settings-chevron" size={16} aria-hidden="true" />
    </button>
  );

  return (
    <section
      ref={drag.ref}
      class="player-panel settings-panel"
      style={drag.style}
      aria-label="Bilibili 音乐播放器（设置）"
    >
      <header
        class="panel-header settings-header"
        onPointerDown={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("button, input, select, textarea, a")
          ) {
            return;
          }

          drag.onPointerDown(event);
        }}
        onPointerMove={drag.onPointerMove}
        onPointerUp={drag.onPointerUp}
        onPointerCancel={drag.onPointerCancel}
      >
        <button
          class="icon-button settings-back"
          type="button"
          title="返回播放器"
          aria-label="返回播放器"
          onClick={onBack}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <strong class="settings-title">设置</strong>
        <button
          class="icon-button close-panel-button"
          type="button"
          title="收起播放器"
          aria-label="收起播放器"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div class="settings-body">
        <section class="settings-section">
          {sectionHeader("appearance", "窗口与外观", <AppWindow size={16} />)}
          {isOpen("appearance") && (
            <div
              class="settings-section-body"
              id="bmp-settings-appearance"
              role="region"
              aria-label="窗口与外观"
            >
              <div class="settings-row">
                <span class="settings-label">打开时</span>
                <div
                  class="segmented-control"
                  role="radiogroup"
                  aria-label="打开时"
                  title="下次打开播放器时生效"
                >
                  {OPEN_MODE_OPTIONS.map((option) => (
                    <label class="segment" key={option.value}>
                      <input
                        type="radio"
                        name="bmp-open-mode"
                        value={option.value}
                        checked={openMode === option.value}
                        onChange={() => onSelectOpenMode(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div class="settings-row">
                <span class="settings-label">悬浮位置</span>
                <button
                  class="settings-action"
                  type="button"
                  title="恢复悬浮按钮和播放器面板的默认位置"
                  onClick={onResetPositions}
                >
                  <RotateCcw size={15} aria-hidden="true" />
                  重置位置
                </button>
              </div>
            </div>
          )}
        </section>

        <section class="settings-section">
          {sectionHeader(
            "data",
            "数据管理",
            <Database size={16} />,
            librarySummary,
          )}
          {isOpen("data") && (
            <div
              class="settings-section-body"
              id="bmp-settings-data"
              role="region"
              aria-label="数据管理"
            >
              <div class="settings-actions">
                <button
                  class="settings-action"
                  type="button"
                  onClick={onExportBackup}
                >
                  <Download size={15} aria-hidden="true" />
                  导出备份
                </button>
                <button
                  class="settings-action"
                  type="button"
                  onClick={onImportBackup}
                >
                  <Upload size={15} aria-hidden="true" />
                  从备份恢复
                </button>
              </div>
              {exportStatus && (
                <p class="settings-status" role="status">
                  {exportStatus}
                </p>
              )}
              {exportError && (
                <p class="settings-error" role="alert">
                  {exportError}
                </p>
              )}
            </div>
          )}
        </section>

        <section class="settings-section">
          {sectionHeader(
            "about",
            "关于",
            <Info size={16} />,
            `版本 ${version}`,
          )}
          {isOpen("about") && (
            <div
              class="settings-section-body"
              id="bmp-settings-about"
              role="region"
              aria-label="关于"
            >
              <dl class="settings-about">
                <dt>应用</dt>
                <dd>Bilibili 音乐播放器</dd>
                <dt>版本</dt>
                <dd>{version}</dd>
                <dt>许可</dt>
                <dd>MIT License</dd>
                <dt>存储</dt>
                <dd>歌单保存在油猴本地存储，当前播放会话只在对应标签页</dd>
              </dl>
            </div>
          )}
        </section>
      </div>

      {children}
    </section>
  );
}
