import type { OpenPanelMode } from "./layout-schema";

export const SETTINGS_STORAGE_KEY = "bilibili-music-player:settings";

/**
 * 悬浮按钮打开播放器时使用的形态偏好。
 *
 * `remember` 与升级前的隐式行为完全一致（沿用布局里记录的 `lastOpenMode`），
 * 因此它必须是默认值：老用户升级后行为不变。
 */
export type OpenModePreference = "remember" | "full" | "minimal";

export interface SettingsData {
  version: 1;
  openMode: OpenModePreference;
}

const OPEN_MODE_PREFERENCES: readonly OpenModePreference[] = [
  "remember",
  "full",
  "minimal",
];

export const DEFAULT_SETTINGS: SettingsData = {
  version: 1,
  openMode: "remember",
};

export function migrateSettingsData(raw: unknown): SettingsData {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_SETTINGS;
  }

  const candidate = raw as Partial<SettingsData>;
  if (candidate.version !== 1) {
    return DEFAULT_SETTINGS;
  }

  return {
    version: 1,
    openMode: readOpenModePreference(candidate.openMode),
  };
}

/** 偏好决定悬浮按钮打开哪个形态：`remember` 透传布局里记录的形态。 */
export function resolveOpenMode(
  preference: OpenModePreference,
  lastOpenMode: OpenPanelMode,
): OpenPanelMode {
  return preference === "remember" ? lastOpenMode : preference;
}

function readOpenModePreference(value: unknown): OpenModePreference {
  return OPEN_MODE_PREFERENCES.includes(value as OpenModePreference)
    ? (value as OpenModePreference)
    : "remember";
}
