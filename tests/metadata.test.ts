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
      getBvid(
        "https://www.bilibili.com/list/100969474?sid=1947439&bvid=BV1yy411c7mE",
      ),
    ).toBe("BV1yy411c7mE");
    // 多余的空白要容忍（复制粘贴常见）。
    expect(
      getBvid("https://www.bilibili.com/list/ml1?bvid=%20BV1414y1W7QZ%20"),
    ).toBe("BV1414y1W7QZ");
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
    expect(
      getBvid("https://www.bilibili.com/list/ml1?bvid=BV"),
    ).toBeUndefined();
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

  it("reads the BV from a festival page's validated bvid query", () => {
    // 用户实际报告的两个专题页：歌单切歌会被 B 站从 /video 客户端重定向到这里。
    expect(
      getBvid(
        "https://www.bilibili.com/festival/ournotesBonly?bvid=BV1wzaE63EEw&spm_id_from=333.1387.homepage.video_card.click",
      ),
    ).toBe("BV1wzaE63EEw");
    expect(
      getBvid(
        "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2&spm_id_from=333.337.search-card.all.click",
      ),
    ).toBe("BV1tsfpYwEt2");
    // 多余的空白要容忍。
    expect(
      getBvid(
        "https://www.bilibili.com/festival/bnj2025?bvid=%20BV1tsfpYwEt2%20",
      ),
    ).toBe("BV1tsfpYwEt2");
  });

  it("ignores a missing or malformed bvid on festival pages", () => {
    expect(
      getBvid("https://www.bilibili.com/festival/bnj2025"),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/festival/bnj2025?bvid="),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/festival/bnj2025?bvid=not-a-bv"),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/festival/bnj2025?bvid=12345"),
    ).toBeUndefined();
    expect(
      getBvid("https://www.bilibili.com/festival/bnj2025?oid=775106615"),
    ).toBeUndefined();
    // 只有 www 的专题页在支持范围内。
    expect(
      getBvid("https://m.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2"),
    ).toBeUndefined();
    expect(
      getBvid("https://example.com/festival/bnj2025?bvid=BV1tsfpYwEt2"),
    ).toBeUndefined();
  });

  it("ignores p on festival pages so resume never targets a wrong part", () => {
    // B 站会把 /video?p=2 的 p 转发到专题页，但专题播放器按活动配置的 cid 选片，
    // 那个 p 并不代表「当前在第 2 分 P」；当成第 1 分 P 才不会把整段视频当成分 P。
    expect(
      getPageNumber(
        "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2&p=2",
      ),
    ).toBeUndefined();
    expect(
      getPageNumber(
        "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2&p=9",
      ),
    ).toBeUndefined();
  });
});
