import { GM_getValue, GM_setValue } from "$";
import type { ViewportPosition } from "../app/draggable-position";
import {
  LAYOUT_STORAGE_KEY,
  migrateLayoutData,
  type LayoutData,
  type OpenPanelMode,
  type LayoutTarget,
} from "./layout-schema";

export type { LayoutTarget } from "./layout-schema";

export class LayoutRepository {
  load(): LayoutData {
    return migrateLayoutData(GM_getValue<unknown>(LAYOUT_STORAGE_KEY));
  }

  savePosition(target: LayoutTarget, position: ViewportPosition): void {
    GM_setValue(LAYOUT_STORAGE_KEY, {
      ...this.load(),
      [target]: position,
    });
  }

  clearPosition(target: LayoutTarget): void {
    const layout = this.load();
    delete layout[target];
    GM_setValue(LAYOUT_STORAGE_KEY, layout);
  }

  saveLastOpenMode(lastOpenMode: OpenPanelMode): void {
    GM_setValue(LAYOUT_STORAGE_KEY, {
      ...this.load(),
      lastOpenMode,
    });
  }
}
