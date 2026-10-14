/*
 * 页面路由判定：决定用户脚本在哪些 B 站页面上真正工作。
 *
 * 需要挂载 UI 的页面有三类：
 *  - 视频页（www.bilibili.com/video/*）：播放器本体；
 *  - 列表播放页（www.bilibili.com/list/*，如收藏夹/合集「播放全部」的 `/list/ml<mlid>`）：
 *    同样是播放器本体，行为与视频页一致；
 *  - 个人空间的收藏页（space.bilibili.com/<mid>/favlist）：方便就地导入收藏夹。
 * 其余页面保持惰性——不渲染任何东西，也不安装纯音频拦截器。
 */

export type PageRoute = "video" | "playlist" | "favlist" | "other";

const VIDEO_PATH = /^\/video\//i;
// 收藏夹/合集「播放全部」是 `/list/ml<mlid>`；「稍后再看」与用户视频列表播放页共用
// `/list/` 前缀，三者都是带 B 站播放器的播放页，所以统一按 `/list/` 前缀识别。
const PLAYLIST_PATH = /^\/list\//i;
const FAVLIST_PATH = /^\/\d+\/favlist\/?$/i;

export function getPageRoute(url = location.href): PageRoute {
  const parsed = safeUrl(url);
  if (!parsed) {
    return "other";
  }

  const host = parsed.hostname.toLowerCase();

  if (isBilibiliHost(host) && VIDEO_PATH.test(parsed.pathname)) {
    return "video";
  }

  // 与 `@match` 保持一致：列表播放页只认 www 这一个 host（apex 会 301 到 www）。
  if (host === "www.bilibili.com" && PLAYLIST_PATH.test(parsed.pathname)) {
    return "playlist";
  }

  if (host === "space.bilibili.com" && isFavlistPath(parsed)) {
    return "favlist";
  }

  return "other";
}

export function isVideoPage(url = location.href): boolean {
  return getPageRoute(url) === "video";
}

export function isPlaylistPage(url = location.href): boolean {
  return getPageRoute(url) === "playlist";
}

/** 页面上带 B 站播放器的路由：普通视频页与列表播放页。 */
export function isPlaybackPage(url = location.href): boolean {
  const route = getPageRoute(url);
  return route === "video" || route === "playlist";
}

export function isFavlistPage(url = location.href): boolean {
  return getPageRoute(url) === "favlist";
}

export function supportsPlayerUi(url = location.href): boolean {
  return getPageRoute(url) !== "other";
}

function isFavlistPath(parsed: URL): boolean {
  // 新版是路径路由 `/1776113786/favlist`，旧版是 hash 路由 `#/favlist`。
  return FAVLIST_PATH.test(parsed.pathname) || parsed.hash.includes("favlist");
}

function isBilibiliHost(host: string): boolean {
  return host === "bilibili.com" || host.endsWith(".bilibili.com");
}

function safeUrl(url: string): URL | undefined {
  try {
    return new URL(url);
  } catch {
    return undefined;
  }
}
