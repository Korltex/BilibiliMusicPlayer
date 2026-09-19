/*
 * 统一的「导入」链接解析器。
 *
 * 支持三类入口，全部先在这里归一化成目标结构，再由各自的适配层去拉数据：
 *  - 收藏夹：`space.bilibili.com/<mid>/favlist?fid=<mlid>`（`ftype=create` 或省略）
 *  - 合集：`.../favlist?fid=<season_id>&ftype=collect&ctype=21`
 *  - 视频：`www.bilibili.com/video/<bvid>[?p=N]`（进入合集嗅探）
 *
 * `ctype` 只是「收藏对象的内容类型」（11 稿件 / 21 合集），**不能单独用来判定 season**：
 *  - `ftype=collect` + `ctype=21`：收藏的是一个**合集**，`fid` 是该合集的 season_id；
 *  - `ftype=create` + `ctype=21`：仍然是**我创建的收藏夹**，`fid` 是这个收藏夹的 mlid
 *    （实测这种链接把 fid 送进合集接口只会拿到 `code -404`，用户看到「合集不存在或链接无效」）。
 *
 * 解析结果只包含字符串与数字，不携带任何 B 站响应字段。
 * 不接受裸数字 id：它没有可校验的归属，会静默落到任意歌单上。
 */

export interface FavTarget {
  fid: string;
  /** 链接形如 `space.bilibili.com/<mid>/…` 时记录链接声称的 UP 主 mid，用于校验收藏夹归属。 */
  ownerMid?: string;
}

export interface SeasonTarget {
  seasonId: string;
  /** 链接路径里的用户 mid，仅作合集接口的占位参数（该接口不校验 mid）。 */
  mid?: string;
}

export interface VideoTarget {
  bvid: string;
}

export type ImportUrlResult =
  | { kind: "folder"; target: FavTarget }
  | { kind: "season"; target: SeasonTarget }
  | { kind: "video"; target: VideoTarget }
  | { kind: "unsupported"; message: string }
  | { kind: "unknown" };

const VIDEO_PATH = /\/video\/(BV[0-9A-Za-z]+)/;
const FAVLIST_MEDIA_PATH = /\/medialist\/detail\/ml(\d+)/i;

export function parseImportUrl(url: string): ImportUrlResult {
  const input = url.trim();
  if (!input) {
    return { kind: "unknown" };
  }

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return { kind: "unknown" };
  }

  if (!isBilibiliHost(parsed.hostname)) {
    return { kind: "unknown" };
  }

  // 批量导入入口**完全忽略** `?p=`：多P 视频按分P 全部拆分导入。
  // 只想导当前这一个分P，请用编辑器里的「将当前视频添加到歌单」。
  const video = parsed.pathname.match(VIDEO_PATH);
  if (video) {
    return { kind: "video", target: { bvid: video[1] } };
  }

  const ownerMid = readOwnerMid(parsed);

  // 合集：只有「我追的合集/收藏夹」（`ftype=collect` 或省略 ftype）里的 `ctype=21` 才是 season_id。
  // 「我创建的收藏夹」（`ftype=create`）即使带 `ctype=21` 也仍是普通 mlid——B 站收藏页给自家
  // 收藏夹的链接就会同时带这两个参数，误当合集送进合集接口只会拿到 -404「合集不存在或链接无效」。
  // 另外不能一刀切拒绝 `ftype=collect`——「收藏的收藏夹」同样是 collect，但它是普通 mlid。
  const isCreatedFolder = parsed.searchParams.get("ftype") === "create";
  if (parsed.searchParams.get("ctype") === "21" && !isCreatedFolder) {
    const seasonId = parsed.searchParams.get("fid");
    if (seasonId && /^\d+$/.test(seasonId)) {
      return {
        kind: "season",
        target: { seasonId, ...(ownerMid ? { mid: ownerMid } : {}) },
      };
    }
    return { kind: "unknown" };
  }

  if (
    parsed.searchParams.has("sid") ||
    /\/lists(\/|$)/i.test(parsed.pathname)
  ) {
    return {
      kind: "unsupported",
      message: "这是合集/列表页链接，请改用收藏页 favlist 里的链接。",
    };
  }

  const fid = parsed.searchParams.get("fid");
  if (fid && /^\d+$/.test(fid)) {
    return {
      kind: "folder",
      target: { fid, ...(ownerMid ? { ownerMid } : {}) },
    };
  }

  const mediaListMatch = parsed.pathname.match(FAVLIST_MEDIA_PATH);
  if (mediaListMatch) {
    return { kind: "folder", target: { fid: mediaListMatch[1] } };
  }

  return { kind: "unknown" };
}

function readOwnerMid(url: URL): string | undefined {
  if (url.hostname.toLowerCase() !== "space.bilibili.com") {
    return undefined;
  }

  return url.pathname.match(/^\/(\d+)\//)?.[1];
}

function isBilibiliHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "bilibili.com" || host.endsWith(".bilibili.com");
}
