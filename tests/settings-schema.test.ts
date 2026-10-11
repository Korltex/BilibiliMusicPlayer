import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  migrateSettingsData,
  resolveOpenMode,
} from "../src/storage/settings-schema";

describe("settings migration", () => {
  it("falls back to the defaults for missing or malformed data", () => {
    expect(migrateSettingsData(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettingsData(null)).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettingsData("remember")).toEqual(DEFAULT_SETTINGS);
    expect(migrateSettingsData({ openMode: "minimal" })).toEqual(
      DEFAULT_SETTINGS,
    );
    expect(migrateSettingsData({ version: 2, openMode: "minimal" })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it("keeps a valid open mode", () => {
    expect(migrateSettingsData({ version: 1, openMode: "minimal" })).toEqual({
      version: 1,
      openMode: "minimal",
    });
    expect(migrateSettingsData({ version: 1, openMode: "full" })).toEqual({
      version: 1,
      openMode: "full",
    });
  });

  it("defaults an unknown open mode to remember without dropping the rest", () => {
    expect(migrateSettingsData({ version: 1, openMode: "auto" })).toEqual({
      version: 1,
      openMode: "remember",
    });
  });
});

describe("resolveOpenMode", () => {
  it("passes the remembered mode through", () => {
    expect(resolveOpenMode("remember", "minimal")).toBe("minimal");
    expect(resolveOpenMode("remember", "full")).toBe("full");
  });

  it("uses the pinned mode regardless of what was last used", () => {
    expect(resolveOpenMode("full", "minimal")).toBe("full");
    expect(resolveOpenMode("minimal", "full")).toBe("minimal");
  });
});
