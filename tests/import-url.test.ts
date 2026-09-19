import { describe, expect, it } from "vitest";
import {
  parseImportUrl,
  type FavTarget,
  type SeasonTarget,
  type VideoTarget,
} from "../src/sources/import-url";

function folderTarget(input: string): FavTarget {
  const result = parseImportUrl(input);
  expect(result.kind).toBe("folder");
  if (result.kind !== "folder") {
    throw new Error("expected a favorite folder link");
  }
  return result.target;
}

function seasonTarget(input: string): SeasonTarget {
  const result = parseImportUrl(input);
  expect(result.kind).toBe("season");
  if (result.kind !== "season") {
    throw new Error("expected a collection link");
  }
  return result.target;
}

function videoTarget(input: string): VideoTarget {
  const result = parseImportUrl(input);
  expect(result.kind).toBe("video");
  if (result.kind !== "video") {
    throw new Error("expected a video link");
  }
  return result.target;
}

describe("parseImportUrl / favorite folders", () => {
  it("parses the fid query parameter and the owner mid", () => {
    expect(
      folderTarget("https://space.bilibili.com/123/favlist?fid=2015788186"),
    ).toEqual({ fid: "2015788186", ownerMid: "123" });
  });

  it("parses fid among other query parameters", () => {
    expect(
      folderTarget(
        "https://space.bilibili.com/123/favlist?fid=2015788186&ctid=0",
      ),
    ).toEqual({ fid: "2015788186", ownerMid: "123" });
  });

  it("parses a medialist detail path without an owner mid", () => {
    expect(
      folderTarget("https://www.bilibili.com/medialist/detail/ml2015788186"),
    ).toEqual({ fid: "2015788186" });
  });

  it("treats collected favorite folders as folders", () => {
    expect(
      folderTarget(
        "https://space.bilibili.com/100969474/favlist?fid=1306978874&ftype=collect",
      ),
    ).toEqual({ fid: "1306978874", ownerMid: "100969474" });
  });

  // 收藏页给自己创建的收藏夹发的链接会同时带 ftype=create 和 ctype=21；
  // `fid` 仍是 mlid，不能因为 ctype=21 就走合集接口（否则报「合集不存在或链接无效」）。
  it("keeps ftype=create links as folders even when ctype=21 is present", () => {
    expect(
      folderTarget(
        "https://space.bilibili.com/1776113786/favlist?fid=1618343886&ftype=create&ctype=21",
      ),
    ).toEqual({ fid: "1618343886", ownerMid: "1776113786" });
  });

  it("keeps created folders without an owner mid as folders too", () => {
    expect(
      folderTarget(
        "https://www.bilibili.com/favlist?fid=1618343886&ftype=create&ctype=21",
      ),
    ).toEqual({ fid: "1618343886" });
  });
});

describe("parseImportUrl / collections", () => {
  it("routes ctype=21 links to the season source", () => {
    expect(
      seasonTarget(
        "https://space.bilibili.com/100969474/favlist?fid=3221717&ftype=collect&ctype=21",
      ),
    ).toEqual({ seasonId: "3221717", mid: "100969474" });
  });

  it("keeps the season id without an owner mid on other hosts", () => {
    expect(
      seasonTarget("https://www.bilibili.com/favlist?fid=5471&ctype=21"),
    ).toEqual({ seasonId: "5471" });
  });

  it("routes collected collections (ftype=collect) to the season source", () => {
    expect(
      seasonTarget(
        "https://space.bilibili.com/1776113786/favlist?fid=186033&ftype=collect&ctype=21",
      ),
    ).toEqual({ seasonId: "186033", mid: "1776113786" });
  });
});

describe("parseImportUrl / videos", () => {
  it("parses a plain BV link", () => {
    expect(
      videoTarget("https://www.bilibili.com/video/BV1Mn4y1R7fa"),
    ).toEqual({ bvid: "BV1Mn4y1R7fa" });
  });

  it("parses a BV link with a trailing slash and extra params", () => {
    expect(
      videoTarget(
        "https://www.bilibili.com/video/BV1Mn4y1R7fa/?spm_id_from=333.999",
      ),
    ).toEqual({ bvid: "BV1Mn4y1R7fa" });
  });

  // 批量导入入口完全忽略 `?p=`：多P 视频按分P 全部拆分导入。
  it("ignores the p parameter", () => {
    expect(
      videoTarget("https://www.bilibili.com/video/BV1Mn4y1R7fa?p=3"),
    ).toEqual({ bvid: "BV1Mn4y1R7fa" });
    expect(
      videoTarget("https://www.bilibili.com/video/BV1Mn4y1R7fa?p=1"),
    ).toEqual({ bvid: "BV1Mn4y1R7fa" });
  });
});

describe("parseImportUrl / rejected input", () => {
  it("rejects list-page links that are not favlist links", () => {
    for (const input of [
      "https://space.bilibili.com/3546619314178489/lists?sid=3221717&type=season",
      "https://space.bilibili.com/100969474/lists/1947439?type=series",
      "https://www.bilibili.com/list/100969474?sid=1947439",
    ]) {
      expect(parseImportUrl(input)).toEqual({
        kind: "unsupported",
        message: "这是合集/列表页链接，请改用收藏页 favlist 里的链接。",
      });
    }
  });

  it("rejects a bare numeric id, which has no owner to verify", () => {
    expect(parseImportUrl("2015788186")).toEqual({ kind: "unknown" });
  });

  it("rejects unrelated hosts and malformed input", () => {
    expect(parseImportUrl("https://example.com/favlist?fid=123")).toEqual({
      kind: "unknown",
    });
    expect(parseImportUrl("https://notbilibili.com/video/BV1xx/")).toEqual({
      kind: "unknown",
    });
    expect(parseImportUrl("not a url")).toEqual({ kind: "unknown" });
    expect(parseImportUrl("")).toEqual({ kind: "unknown" });
  });

  it("rejects favlist and collection links without a usable id", () => {
    expect(parseImportUrl("https://space.bilibili.com/123/favlist")).toEqual({
      kind: "unknown",
    });
    expect(
      parseImportUrl("https://space.bilibili.com/123/favlist?ctype=21"),
    ).toEqual({ kind: "unknown" });
  });
});
