import { describe, expect, it } from "vitest";
import {
  getPageRoute,
  isFestivalPage,
  isFavlistPage,
  isPlaybackPage,
  isPlaylistPage,
  isVideoPage,
  isValidBvidQuery,
  supportsPlayerUi,
} from "../src/bili/page-route";

describe("page route", () => {
  it("recognizes Bilibili video pages", () => {
    expect(getPageRoute("https://www.bilibili.com/video/BV1xx411c7mD/")).toBe(
      "video",
    );
    expect(
      isVideoPage("https://www.bilibili.com/video/BV1xx411c7mD/?p=2"),
    ).toBe(true);
  });

  it("recognizes Bilibili list playback pages", () => {
    // 用户实际报告的收藏夹「播放全部」链接。
    expect(
      getPageRoute(
        "https://www.bilibili.com/list/ml1259927886?spm_id_from=333.1387.0.0&oid=775106615&bvid=BV1414y1W7QZ",
      ),
    ).toBe("playlist");
    expect(isPlaylistPage("https://www.bilibili.com/list/ml1259927886")).toBe(
      true,
    );
    // 「稍后再看」与用户视频列表播放页共用 /list/ 前缀，同样带播放器。
    expect(getPageRoute("https://www.bilibili.com/list/watchlater")).toBe(
      "playlist",
    );
    expect(
      getPageRoute("https://www.bilibili.com/list/100969474?sid=1947439"),
    ).toBe("playlist");
    // `/list/` 不是视频页，也不是收藏页。
    expect(isVideoPage("https://www.bilibili.com/list/ml1")).toBe(false);
    expect(isFavlistPage("https://www.bilibili.com/list/ml1")).toBe(false);
  });

  it("only matches the confirmed www host for list pages", () => {
    // apex 会 301 到 www；脚本只在 www 注入。
    expect(getPageRoute("https://bilibili.com/list/ml1259927886")).toBe(
      "other",
    );
    expect(getPageRoute("https://m.bilibili.com/list/ml1")).toBe("other");
    // 其他站点的 /list/ 路径不受影响。
    expect(getPageRoute("https://example.com/list/ml1")).toBe("other");
    // 其它 www 页面依旧不匹配。
    expect(getPageRoute("https://www.bilibili.com/")).toBe("other");
    expect(getPageRoute("https://www.bilibili.com/bangumi/play/ep1")).toBe(
      "other",
    );
  });

  it("recognizes festival playback pages only when they carry a valid bvid", () => {
    // 用户实际报告的两个拜年纪/专题页（歌单切歌会被 B 站从 /video 客户端重定向到这里）。
    expect(
      getPageRoute(
        "https://www.bilibili.com/festival/ournotesBonly?bvid=BV1wzaE63EEw&spm_id_from=333.1387.homepage.video_card.click",
      ),
    ).toBe("festival");
    expect(
      getPageRoute(
        "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2&spm_id_from=333.337.search-card.all.click",
      ),
    ).toBe("festival");
    expect(
      isFestivalPage(
        "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2",
      ),
    ).toBe(true);

    // 缺参数 / 空值 / 非 BV 的参数一律不挂载（`spm_id_from`、`oid` 都不是 BV 号）。
    expect(getPageRoute("https://www.bilibili.com/festival/bnj2025")).toBe(
      "other",
    );
    expect(
      getPageRoute("https://www.bilibili.com/festival/bnj2025?bvid="),
    ).toBe("other");
    expect(
      getPageRoute("https://www.bilibili.com/festival/bnj2025?bvid=not-a-bv"),
    ).toBe("other");
    expect(
      getPageRoute("https://www.bilibili.com/festival/bnj2025?oid=775106615"),
    ).toBe("other");
    expect(
      getPageRoute("https://www.bilibili.com/festival/bnj2025?bvid=12345"),
    ).toBe("other");

    // 只在 www 注入，也不影响别站点的同名路径。
    expect(
      getPageRoute("https://m.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2"),
    ).toBe("other");
    expect(
      getPageRoute("https://example.com/festival/bnj2025?bvid=BV1tsfpYwEt2"),
    ).toBe("other");
  });

  it("checks bvid query values", () => {
    expect(isValidBvidQuery("BV1tsfpYwEt2")).toBe(true);
    expect(isValidBvidQuery("  BV1tsfpYwEt2  ")).toBe(true);
    expect(isValidBvidQuery("bv1tsfpYwEt2")).toBe(false);
    expect(isValidBvidQuery("not-a-bv")).toBe(false);
    expect(isValidBvidQuery("12345")).toBe(false);
    expect(isValidBvidQuery("")).toBe(false);
    expect(isValidBvidQuery(null)).toBe(false);
  });

  it("recognizes the space favlist page", () => {
    expect(getPageRoute("https://space.bilibili.com/1776113786/favlist")).toBe(
      "favlist",
    );
    expect(
      isFavlistPage(
        "https://space.bilibili.com/1776113786/favlist?fid=5471&ftype=collect&ctype=21",
      ),
    ).toBe(true);
    expect(
      isFavlistPage("https://space.bilibili.com/1776113786/favlist/"),
    ).toBe(true);
    // 旧版 hash 路由。
    expect(
      isFavlistPage("https://space.bilibili.com/1776113786/#/favlist?fid=1"),
    ).toBe(true);
  });

  it("leaves other space pages inert", () => {
    expect(getPageRoute("https://space.bilibili.com/1776113786/video")).toBe(
      "other",
    );
    expect(getPageRoute("https://space.bilibili.com/1776113786")).toBe("other");
    expect(
      supportsPlayerUi("https://space.bilibili.com/1776113786/dynamic"),
    ).toBe(false);
  });

  it("ignores unrelated hosts and invalid urls", () => {
    expect(getPageRoute("https://example.com/video/BV1xx/")).toBe("other");
    expect(getPageRoute("https://notbilibili.com/video/BV1xx/")).toBe("other");
    expect(getPageRoute("not a url")).toBe("other");
    expect(getPageRoute("")).toBe("other");
  });

  it("treats only player routes as playback pages", () => {
    expect(isPlaybackPage("https://www.bilibili.com/video/BV1xx/")).toBe(true);
    expect(isPlaybackPage("https://www.bilibili.com/list/ml1259927886")).toBe(
      true,
    );
    // 带合法 bvid 的专题页同样是播放页：否则悬浮按钮会误走「批量导入」分支、
    // 纯音频拦截器也不会安装。
    expect(
      isPlaybackPage(
        "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2",
      ),
    ).toBe(true);
    expect(isPlaybackPage("https://www.bilibili.com/festival/bnj2025")).toBe(
      false,
    );
    // 收藏页没有播放器：不能当作播放页（否则点悬浮按钮会走错分支）。
    expect(isPlaybackPage("https://space.bilibili.com/1/favlist")).toBe(false);
    expect(isPlaybackPage("https://space.bilibili.com/1/video")).toBe(false);
    expect(isPlaybackPage("https://www.bilibili.com/")).toBe(false);
  });

  it("supports the player UI on every mounted route", () => {
    expect(supportsPlayerUi("https://www.bilibili.com/video/BV1xx/")).toBe(
      true,
    );
    expect(supportsPlayerUi("https://www.bilibili.com/list/ml1")).toBe(true);
    expect(
      supportsPlayerUi(
        "https://www.bilibili.com/festival/bnj2025?bvid=BV1tsfpYwEt2",
      ),
    ).toBe(true);
    // 没有 bvid 的活动页不挂载。
    expect(supportsPlayerUi("https://www.bilibili.com/festival/bnj2025")).toBe(
      false,
    );
    expect(supportsPlayerUi("https://space.bilibili.com/1/favlist")).toBe(true);
    expect(supportsPlayerUi("https://www.bilibili.com/")).toBe(false);
    expect(supportsPlayerUi("https://bilibili.com/list/ml1")).toBe(false);
  });
});
