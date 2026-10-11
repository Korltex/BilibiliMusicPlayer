import { GM_getValue, GM_setValue } from "$";
import {
  migrateSettingsData,
  SETTINGS_STORAGE_KEY,
  type OpenModePreference,
  type SettingsData,
} from "./settings-schema";

/**
 * 设置偏好单独一个 GM 键：布局数据被测试逐字断言、且只描述位置与形态，
 * 混在一起会强迫布局做一次没有必要的迁移。
 */
export class SettingsRepository {
  load(): SettingsData {
    return migrateSettingsData(GM_getValue<unknown>(SETTINGS_STORAGE_KEY));
  }

  saveOpenMode(openMode: OpenModePreference): void {
    GM_setValue(SETTINGS_STORAGE_KEY, { ...this.load(), openMode });
  }
}
