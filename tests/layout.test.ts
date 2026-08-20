import { describe, expect, it } from "vitest";
import { clampPosition } from "../src/app/draggable-position";
import { migrateLayoutData } from "../src/storage/layout-schema";

describe("draggable layout", () => {
  it("keeps a valid position inside the viewport", () => {
    expect(
      clampPosition(
        { x: 120, y: 80 },
        { width: 48, height: 48 },
        { width: 320, height: 200 },
      ),
    ).toEqual({ x: 120, y: 80 });
  });

  it("clamps positions so the whole element remains visible", () => {
    expect(
      clampPosition(
        { x: 500, y: -20 },
        { width: 48, height: 48 },
        { width: 320, height: 200 },
      ),
    ).toEqual({ x: 272, y: 0 });

    expect(
      clampPosition(
        { x: 80, y: 40 },
        { width: 400, height: 300 },
        { width: 320, height: 200 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });

  it("accepts finite stored coordinates and ignores invalid values", () => {
    expect(
      migrateLayoutData({
        version: 1,
        launcher: { x: 24, y: 36 },
        panel: { x: 180, y: 90 },
      }),
    ).toEqual({
      version: 1,
      launcher: { x: 24, y: 36 },
      panel: { x: 180, y: 90 },
      lastOpenMode: "full",
    });

    const invalidLayout = migrateLayoutData({
      version: 1,
      launcher: { x: Number.NaN, y: 10 },
      panel: { x: "20", y: 30 },
    });
    expect(invalidLayout.launcher).toBeUndefined();
    expect(invalidLayout.panel).toBeUndefined();
    expect(migrateLayoutData({ version: 2 })).toEqual({
      version: 1,
      lastOpenMode: "full",
    });
  });

  it("defaults old layout data to the full panel", () => {
    expect(
      migrateLayoutData({
        version: 1,
        launcher: { x: 24, y: 36 },
        panel: { x: 180, y: 90 },
      }),
    ).toEqual({
      version: 1,
      launcher: { x: 24, y: 36 },
      panel: { x: 180, y: 90 },
      lastOpenMode: "full",
    });
  });

  it("keeps valid minimal mode and rejects invalid stored modes", () => {
    expect(migrateLayoutData({ version: 1, lastOpenMode: "minimal" })).toEqual({
      version: 1,
      lastOpenMode: "minimal",
    });
    expect(migrateLayoutData({ version: 1, lastOpenMode: "compact" })).toEqual({
      version: 1,
      lastOpenMode: "full",
    });
  });
});
