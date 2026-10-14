import { describe, expect, it } from "vitest";
import { getBvid, getPageNumber } from "../src/bili/metadata";

describe("getBvid", () => {
  it("reads the BV from an ordinary video page path", () => {
    expect(getBvid("https://www.bilibili.com/video/BV1xx411c7mD/")).toBe(
      "BV1xx411c7mD",
    );
    expect(getBvid("https://www.bilibili.com/video/BV1xx411c7mD?p=2")).toBe(
      "BV1xx411c7mD",
    );
  });

  it("reads the BV from a list playback page query", () => {
    // 用户实际报告的收藏夹「播放全部」链接：路径里没有 BV，只有查询串有。
    expect(
      getBvid(
        "https://www.bilibili.com/list/ml1259927886?spm_id_from=333.1387.0.0&oid=775106615&bvid=BV1414y1W7QZ",
      ),
    ).toBe("BV1414y1W7QZ");
    // 「稍后再看」与用户视频列表播放页同样把当前视频放在 bvid 上。
    expect(
      getBvid("https://www.bilibili.com/list/100969474?sid=1947439&bvid=BV1yy411c7mE"),
    ).toBe("BV1yy411c7mE");
    // 多余的空白要容忍（复制粘贴常见）。
    expect(getBvid("https://www.bilibili.com/list/ml1?bvid=%20BV1414y1W7QZ%20")).toBe(
      "BV1414y1W7QZ",
    );
  });

  it("ignores a missing or malformed bvid on list pages", () => {
    expect(
      getBvid("https://www.bilibili.com/list/ml1259927886"),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/list/ml1259927886?oid=775106615"),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/list/ml1259927886?bvid="),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/list/ml1259927886?bvid=%20"),
    ).toBeUndefined();
    // oid / 纯数字 / av 号都不是 BV。
    expect(
      getBvid("https://www.bilibili.com/list/ml1259927886?bvid=775106615"),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/list/ml1259927886?bvid=av775106615"),
    ).toBeUndefined();
    // 只有前缀没有正文。
    expect(getBvid("https://www.bilibili.com/list/ml1?bvid=BV")).toBeUndefined();
    // 带非法字符。
    expect(
      getBvid("https://www.bilibili.com/list/ml1?bvid=BV1414y1W7Q-Z"),
    ).toBeUndefined();
  });

  it("does not read a bvid query outside the supported routes", () => {
    expect(
      getBvid("https://www.bilibili.com/?bvid=BV1414y1W7QZ"),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/bangumi/play/ep1?bvid=BV1414y1W7QZ"),
    ).toBeUndefined();
    expect(
      getBvid("https://space.bilibili.com/1/favlist?bvid=BV1414y1W7QZ"),
    ).toBeUndefined();
    // 非 www 的列表页不在脚本支持范围内。
    expect(
      getBvid("https://bilibili.com/list/ml1259927886?bvid=BV1414y1W7QZ"),
    ).toBeUndefined();
    expect(
      getBvid("https://example.com/list/ml1?bvid=BV1414y1W7QZ"),
    ).toBeUndefined();
  });

  it("keeps ?p= semantics unchanged", () => {
    expect(
      getPageNumber("https://www.bilibili.com/video/BV1xx411c7mD?p=3"),
    ).toBe(3);
    // 列表页没有分P 语义，不该被 ?p= 影响。
    expect(
      getPageNumber("https://www.bilibili.com/list/ml1?bvid=BV1414y1W7QZ"),
    ).toBeUndefined();
  });
});
