import { describe, expect, it } from "vitest";
import { calculatePlaybackProgress } from "../src/app/playback-progress";

describe("minimal player progress", () => {
  it("calculates progress across a playlist segment", () => {
    expect(
      calculatePlaybackProgress({
        currentTime: 461.5,
        startTime: 364,
        endTime: 559,
        duration: 900,
        storedDuration: 900,
      }),
    ).toBe(0.5);
  });

  it("uses runtime then stored duration when no segment end exists", () => {
    expect(
      calculatePlaybackProgress({
        currentTime: 60,
        startTime: 0,
        duration: 240,
        storedDuration: 300,
      }),
    ).toBe(0.25);
    expect(
      calculatePlaybackProgress({
        currentTime: 75,
        startTime: 0,
        duration: 0,
        storedDuration: 300,
      }),
    ).toBe(0.25);
  });

  it("clamps bounds and returns zero for invalid ranges", () => {
    const base = { startTime: 10, endTime: 20, duration: 0, storedDuration: 0 };
    expect(calculatePlaybackProgress({ ...base, currentTime: 5 })).toBe(0);
    expect(calculatePlaybackProgress({ ...base, currentTime: 25 })).toBe(1);
    expect(
      calculatePlaybackProgress({ ...base, currentTime: Number.NaN }),
    ).toBe(0);
    expect(
      calculatePlaybackProgress({
        currentTime: 10,
        startTime: 10,
        endTime: 10,
        duration: 0,
        storedDuration: 0,
      }),
    ).toBe(0);
  });
});
