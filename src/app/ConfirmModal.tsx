import { X } from "./icons";

export interface ConfirmModalProps {
  title: string;
  message: string;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 插件内确认弹窗，用来替代 `window.confirm`。
 *
 * 外壳与按钮复用「批量导入」弹窗的视觉规范：`.modal-*` 与 `.import-fav-*`
 * 在 styles.css 里是同一组规则，因此圆角、背景、阴影、按钮配色保持一致。
 * 点击【取消】、右上角关闭图标都只关闭弹窗；只有【确定】才执行破坏性操作。
 */
export function ConfirmModal({
  title,
  message,
  warning,
  confirmLabel = "确定",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div class="modal-card">
        <div class="editor-heading">
          <strong>{title}</strong>
          <button
            class="icon-button"
            type="button"
            title="关闭"
            aria-label="关闭"
            onClick={onCancel}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p class="modal-message">{message}</p>
        {warning && <p class="modal-warning">{warning}</p>}

        <div class="modal-actions">
          <button
            class="modal-button secondary"
            type="button"
            autoFocus
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            class="modal-button primary"
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
