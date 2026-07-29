import { describe, expect, it } from "vitest";
import { clamp, formatTime } from "../src/core/time";

describe("time helpers", () => {
  it("formats common media durations", () => {
    expect(formatTime(0)).toBe("00:00");
    expect(formatTime(65.9)).toBe("01:05");
    expect(formatTime(3661)).toBe("01:01:01");
  });

  it("clamps values to a range", () => {
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp(2, 0, 1)).toBe(1);
  });
});
