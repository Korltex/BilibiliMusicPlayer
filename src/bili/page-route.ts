/*
 * 页面路由判定：决定用户脚本在哪些 B 站页面上真正工作。
 *
 * 只有两类页面需要挂载 UI：
 *  - 视频页（www.bilibili.com/video/*）：播放器本体；
 *  - 个人空间的收藏页（space.bilibili.com/<mid>/favlist）：方便就地导入收藏夹。
 * 其余 space 页面保持惰性——不渲染任何东西，也不安装纯音频拦截器。
 */

export type PageRoute = "video" | "favlist" | "other";

const VIDEO_PATH = /^\/video\//i;
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

  if (host === "space.bilibili.com" && isFavlistPath(parsed)) {
    return "favlist";
  }

  return "other";
}

export function isVideoPage(url = location.href): boolean {
  return getPageRoute(url) === "video";
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
