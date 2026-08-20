import type { ViewportPosition } from "../app/draggable-position";

export const LAYOUT_STORAGE_KEY = "bilibili-music-player:layout";

export type LayoutTarget = "launcher" | "panel";
export type OpenPanelMode = "full" | "minimal";

export interface LayoutData {
  version: 1;
  launcher?: ViewportPosition;
  panel?: ViewportPosition;
  lastOpenMode: OpenPanelMode;
}

const DEFAULT_LAYOUT: LayoutData = { version: 1, lastOpenMode: "full" };

function readOpenPanelMode(value: unknown): OpenPanelMode {
  return value === "minimal" ? "minimal" : "full";
}

function readPosition(value: unknown): ViewportPosition | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const candidate = value as Partial<ViewportPosition>;
  if (
    typeof candidate.x !== "number" ||
    !Number.isFinite(candidate.x) ||
    typeof candidate.y !== "number" ||
    !Number.isFinite(candidate.y)
  ) {
    return undefined;
  }

  return { x: candidate.x, y: candidate.y };
}

export function migrateLayoutData(raw: unknown): LayoutData {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_LAYOUT;
  }

  const candidate = raw as Partial<LayoutData>;
  if (candidate.version !== 1) {
    return DEFAULT_LAYOUT;
  }

  const migrated: LayoutData = {
    version: 1,
    lastOpenMode: readOpenPanelMode(candidate.lastOpenMode),
  };

  const launcher = readPosition(candidate.launcher);
  if (launcher) migrated.launcher = launcher;
  const panel = readPosition(candidate.panel);
  if (panel) migrated.panel = panel;
  return migrated;
}
