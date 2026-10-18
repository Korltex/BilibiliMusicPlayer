/*
 * 页面路由判定：决定用户脚本在哪些 B 站页面上真正工作。
 *
 * 需要挂载 UI 的页面有五类：
 *  - 视频页（www.bilibili.com/video/*）：播放器本体；
 *  - 列表播放页（www.bilibili.com/list/*，如收藏夹/合集「播放全部」的 `/list/ml<mlid>`）：
 *    同样是播放器本体，行为与视频页一致；
 *  - 专题/活动播放页（www.bilibili.com/festival/*）：拜年纪等活动页把 B 站播放器内联渲染
 *    在自己的 DOM 里，当前视频由查询串 `bvid` 指定。**只有带合法 bvid 的才视为播放页**，
 *    其余活动页保持惰性；
 *  - 首页（www.bilibili.com/）：**没有页面播放器**，只挂悬浮按钮让用户管理歌单；点歌单里的
 *    歌曲由引擎导航到对应视频页播放。因此它属于「挂 UI」但**不属于「播放页」**（不装纯音频
 *    拦截器、不绑定任何媒体）；
 *  - 个人空间的收藏页（space.bilibili.com/<mid>/favlist）：方便就地导入收藏夹。
 * 其余页面保持惰性——不渲染任何东西，也不安装纯音频拦截器。
 */

export type PageRoute =
  "video" | "playlist" | "festival" | "home" | "favlist" | "other";

const VIDEO_PATH = /^\/video\//i;
// 收藏夹/合集「播放全部」是 `/list/ml<mlid>`；「稍后再看」与用户视频列表播放页共用
// `/list/` 前缀，三者都是带 B 站播放器的播放页，所以统一按 `/list/` 前缀识别。
const PLAYLIST_PATH = /^\/list\//i;
// 专题/活动页：`/festival/<活动 slug>`，是否播放取决于 `?bvid=`。
const FESTIVAL_PATH = /^\/festival\//i;
// 首页：根路径与旧版入口 `/index.html`（两者都由 B 站返回首页）。查询串与 hash 不参与判定，
// 因此 `/?spm_id_from=333.788.0.0` 这类带跟踪参数的首页同样是 home；`/main/`、`/anime/`
// 之类子页面仍算 other，避免误把其它 www 页面当首页。
const HOME_PATHS: ReadonlySet<string> = new Set(["/", "/index.html"]);
const FAVLIST_PATH = /^\/\d+\/favlist\/?$/i;

/**
 * 查询串里的 BV 号格式校验。
 *
 * 列表播放页与专题页的 BV 都来自 `?bvid=`，而同一串查询参数里还有 `oid`、`cid` 这类
 * 纯数字参数，绝不能"取到就用"。真实 BV 号是 `BV` + 10 位字母数字（旧号可能更长），
 * 这里沿用宽松但足够严格的前缀校验：必须以 `BV` 开头且只含字母数字。
 */
const BVID_QUERY = /^BV[0-9A-Za-z]+$/;

export function isValidBvidQuery(value: string | null | undefined): boolean {
  const trimmed = value?.trim();
  return Boolean(trimmed && BVID_QUERY.test(trimmed));
}

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

  // 专题页只有在 `?bvid=` 通过格式校验时才是播放页；普通活动页 / 缺参数 / 非法参数
  // 一律留在 "other"，不挂载 UI、也不安装纯音频拦截器。
  if (
    host === "www.bilibili.com" &&
    FESTIVAL_PATH.test(parsed.pathname) &&
    isValidBvidQuery(parsed.searchParams.get("bvid"))
  ) {
    return "festival";
  }

  if (host === "space.bilibili.com" && isFavlistPath(parsed)) {
    return "favlist";
  }

  // 首页：根路径或 `/index.html`（查询串与 hash 无关）。它挂 UI 但没有页面播放器，
  // 因此不算 `isPlaybackPage()`——纯音频拦截器不安装，任何 <video> 也不绑定。
  if (
    host === "www.bilibili.com" &&
    HOME_PATHS.has(parsed.pathname.toLowerCase())
  ) {
    return "home";
  }

  return "other";
}

export function isVideoPage(url = location.href): boolean {
  return getPageRoute(url) === "video";
}

export function isPlaylistPage(url = location.href): boolean {
  return getPageRoute(url) === "playlist";
}

export function isFestivalPage(url = location.href): boolean {
  return getPageRoute(url) === "festival";
}

export function isHomePage(url = location.href): boolean {
  return getPageRoute(url) === "home";
}

/** 页面上带 B 站播放器的路由：普通视频页、列表播放页与带 bvid 的专题页。 */
export function isPlaybackPage(url = location.href): boolean {
  const route = getPageRoute(url);
  return route === "video" || route === "playlist" || route === "festival";
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
