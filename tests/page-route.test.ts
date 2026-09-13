import { describe, expect, it } from "vitest";
import {
  getPageRoute,
  isFavlistPage,
  isVideoPage,
  supportsPlayerUi,
} from "../src/bili/page-route";

describe("page route", () => {
  it("recognizes Bilibili video pages", () => {
    expect(getPageRoute("https://www.bilibili.com/video/BV1xx411c7mD/")).toBe(
      "video",
    );
    expect(isVideoPage("https://www.bilibili.com/video/BV1xx411c7mD/?p=2")).toBe(
      true,
    );
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
    expect(isFavlistPage("https://space.bilibili.com/1776113786/favlist/")).toBe(
      true,
    );
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

  it("supports the player UI on both supported routes", () => {
    expect(supportsPlayerUi("https://www.bilibili.com/video/BV1xx/")).toBe(true);
    expect(supportsPlayerUi("https://space.bilibili.com/1/favlist")).toBe(true);
    expect(supportsPlayerUi("https://www.bilibili.com/")).toBe(false);
  });
});
