import type { ViewportPosition } from "../app/draggable-position";

export const LAYOUT_STORAGE_KEY = "bilibili-music-player:layout";

export type LayoutTarget = "launcher" | "panel";

export interface LayoutData {
  version: 1;
  launcher?: ViewportPosition;
  panel?: ViewportPosition;
}

const DEFAULT_LAYOUT: LayoutData = { version: 1 };

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

  return {
    version: 1,
    launcher: readPosition(candidate.launcher),
    panel: readPosition(candidate.panel),
  };
}
