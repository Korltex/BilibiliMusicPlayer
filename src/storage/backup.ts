import type { AppData, Playlist, Track } from "../core/types";
import { STORAGE_KEY } from "./schema";

/**
 * 歌单备份（导出 / 导入）的格式定义与纯函数。
 *
 * 备份只包含**歌单库**：歌单名称、歌曲、BV 号、分P、片段起止时间、标题、
 * UP 主、封面与导入来源。音量、播放进度与会话、纯音频开关、UI 布局、
 * 极简模式状态都不进备份文件；导入侧也**只**读歌单库，绝不覆盖上面的键。
 *
 * 导入是「全量覆盖」：文件里的歌单替换当前全部歌单。因此这里的校验必须
 * **严格失败**，不能像 `migrateAppData()` 那样在输入非法时静默回退默认歌单——
 * 那会在用户以为恢复成功时把原有歌单换成一张空歌单。
 */

export const BACKUP_FORMAT = "bilibili-music-player-backup";
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_LIBRARY_VERSION = 1;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

const TRACK_SOURCES = ["manual", "collection", "favorite"] as const;

export type TrackSource = (typeof TRACK_SOURCES)[number];

/** 解析结果的来源标记，用于在弹窗里如实告知用户数据是从哪来的。 */
export type BackupSource =
  "backup" | "tampermonkey-storage" | "legacy-app-data";

export interface PlaylistLibraryBackup {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  exportedAt: string;
  appVersion: string;
  library: {
    version: number;
    playlists: Playlist[];
  };
}

export interface ParsedPlaylistBackup {
  source: BackupSource;
  playlists: Playlist[];
  playlistCount: number;
  trackCount: number;
  exportedAt?: string;
  appVersion?: string;
}

export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupError";
  }
}

export function createPlaylistBackup(
  data: Pick<AppData, "playlists">,
  appVersion: string,
  exportedAt = new Date(),
): PlaylistLibraryBackup {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    appVersion,
    library: {
      version: BACKUP_LIBRARY_VERSION,
      playlists: data.playlists.map(copyPlaylist),
    },
  };
}

export function serializePlaylistBackup(backup: PlaylistLibraryBackup): string {
  return JSON.stringify(backup, null, 2);
}

/** `bilibili-music-player-playlists-YYYYMMDD-HHmmss.json`（本地时间）。 */
export function backupFileName(exportedAt = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, "0");
  const date = `${exportedAt.getFullYear()}${pad(exportedAt.getMonth() + 1)}${pad(
    exportedAt.getDate(),
  )}`;
  const time = `${pad(exportedAt.getHours())}${pad(exportedAt.getMinutes())}${pad(
    exportedAt.getSeconds(),
  )}`;

  return `bilibili-music-player-playlists-${date}-${time}.json`;
}

export function backupByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** 文件大小门禁；读取文件前用 `File.size`、解析时用文本字节数各查一次。 */
export function assertBackupSize(bytes: number): void {
  if (bytes > MAX_BACKUP_BYTES) {
    throw new BackupError(
      `文件超过 ${MAX_BACKUP_BYTES / 1024 / 1024} MiB 上限，不是歌单备份`,
    );
  }
}

/**
 * 解析并校验备份文本。支持三种输入：
 * 1. 本功能导出的标准备份（`format` + `library`）；
 * 2. Tampermonkey「存储」页复制出来的完整 JSON（取 `bilibili-music-player:data`）；
 * 3. 旧版直接导出的 `AppData` 对象。
 *
 * 任何一步不合法都抛 `BackupError`，调用方必须保留当前歌单库不变。
 */
export function parsePlaylistBackup(
  text: string,
  now = Date.now(),
): ParsedPlaylistBackup {
  assertBackupSize(backupByteLength(text));

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("文件不是有效的 JSON");
  }

  if (!isRecord(raw)) {
    throw new BackupError("文件内容必须是 JSON 对象");
  }

  const { library, source, exportedAt, appVersion } = readEnvelope(raw);

  if (!isRecord(library)) {
    throw new BackupError("文件里没有歌单库数据");
  }
  if (library.version !== BACKUP_LIBRARY_VERSION) {
    throw new BackupError(
      `歌单库版本不受支持：${describe(library.version)}（当前支持 ${BACKUP_LIBRARY_VERSION}）`,
    );
  }
  if (!Array.isArray(library.playlists)) {
    throw new BackupError("文件里没有歌单列表");
  }
  if (library.playlists.length === 0) {
    throw new BackupError("文件里没有任何歌单");
  }

  const playlistIds = new Set<string>();
  const trackIds = new Set<string>();
  const playlists = library.playlists.map((value, index) =>
    readPlaylist(value, index, { playlistIds, trackIds, now }),
  );

  return {
    source,
    playlists,
    playlistCount: playlists.length,
    trackCount: playlists.reduce(
      (total, playlist) => total + playlist.tracks.length,
      0,
    ),
    ...(exportedAt ? { exportedAt } : {}),
    ...(appVersion ? { appVersion } : {}),
  };
}

export function countTracks(playlists: Playlist[]): number {
  return playlists.reduce(
    (total, playlist) => total + playlist.tracks.length,
    0,
  );
}

interface Envelope {
  library: unknown;
  source: BackupSource;
  exportedAt?: string;
  appVersion?: string;
}

function readEnvelope(raw: Record<string, unknown>): Envelope {
  if (raw.format === BACKUP_FORMAT) {
    const formatVersion = raw.formatVersion;
    if (formatVersion !== BACKUP_FORMAT_VERSION) {
      throw new BackupError(
        `备份文件版本不受支持：${describe(formatVersion)}（当前支持 ${BACKUP_FORMAT_VERSION}）`,
      );
    }

    return {
      library: raw.library,
      source: "backup",
      ...(typeof raw.exportedAt === "string"
        ? { exportedAt: raw.exportedAt }
        : {}),
      ...(typeof raw.appVersion === "string"
        ? { appVersion: raw.appVersion }
        : {}),
    };
  }

  if (Object.prototype.hasOwnProperty.call(raw, STORAGE_KEY)) {
    return { library: raw[STORAGE_KEY], source: "tampermonkey-storage" };
  }

  if (raw.format !== undefined || raw.formatVersion !== undefined) {
    throw new BackupError("这不是 Bilibili 音乐播放器的歌单备份");
  }

  return { library: raw, source: "legacy-app-data" };
}

interface ReadContext {
  playlistIds: Set<string>;
  trackIds: Set<string>;
  now: number;
}

function readPlaylist(
  value: unknown,
  index: number,
  context: ReadContext,
): Playlist {
  const label = `第 ${index + 1} 个歌单`;
  if (!isRecord(value)) {
    throw new BackupError(`${label}不是有效对象`);
  }

  const id = readId(value.id, `${label}缺少有效 ID`);
  if (context.playlistIds.has(id)) {
    throw new BackupError(`歌单 ID 重复：${id}`);
  }
  context.playlistIds.add(id);

  if (typeof value.name !== "string" || value.name.trim() === "") {
    throw new BackupError(`${label}缺少有效名称`);
  }
  const name = value.name;

  if (!Array.isArray(value.tracks)) {
    throw new BackupError(`歌单「${name}」没有歌曲列表`);
  }

  const tracks = value.tracks.map((track, trackIndex) =>
    readTrack(track, trackIndex, name, context),
  );

  return {
    id,
    name,
    tracks,
    createdAt: readOptionalTimestamp(value.createdAt, context.now),
    updatedAt: readOptionalTimestamp(value.updatedAt, context.now),
  };
}

function readTrack(
  value: unknown,
  index: number,
  playlistName: string,
  context: ReadContext,
): Track {
  const label = `歌单「${playlistName}」的第 ${index + 1} 首歌`;
  if (!isRecord(value)) {
    throw new BackupError(`${label}不是有效对象`);
  }

  const id = readId(value.id, `${label}缺少有效 ID`);
  if (context.trackIds.has(id)) {
    throw new BackupError(`歌曲 ID 重复：${id}`);
  }
  context.trackIds.add(id);

  const bvid = readText(value.bvid, `${label}缺少有效 bvid`);
  const title = readText(value.title, `${label}缺少有效标题`);
  const startTime = readNumber(value.startTime, `${label}的 startTime 无效`);
  if (startTime < 0) {
    throw new BackupError(`${label}的 startTime 不能是负数`);
  }
  const duration = readNumber(value.duration, `${label}的 duration 无效`);
  if (duration < 0) {
    throw new BackupError(`${label}的 duration 不能是负数`);
  }
  const addedAt = readNumber(value.addedAt, `${label}的 addedAt 无效`);

  const source = value.source;
  if (!isTrackSource(source)) {
    throw new BackupError(
      `${label}的 source 无效（只接受 ${TRACK_SOURCES.join(" / ")}）`,
    );
  }

  const track: Track = {
    id,
    bvid,
    title,
    startTime,
    duration,
    addedAt,
    source,
  };

  // 历史备份里 endTime 可能是小数秒，这里只校验「有限数字且晚于 startTime」。
  if (value.endTime !== undefined && value.endTime !== null) {
    const endTime = readNumber(value.endTime, `${label}的 endTime 无效`);
    if (endTime <= startTime) {
      throw new BackupError(`${label}的 endTime 必须晚于 startTime`);
    }
    track.endTime = endTime;
  }

  // 其余可选字段类型不合法就丢弃：它们不影响恢复播放，没必要因此拒绝整份备份。
  if (typeof value.uploader === "string" && value.uploader !== "") {
    track.uploader = value.uploader;
  }
  if (typeof value.cover === "string" && value.cover !== "") {
    track.cover = value.cover;
  }
  if (isPositiveInteger(value.cid)) {
    track.cid = value.cid;
  }
  if (isPositiveInteger(value.page)) {
    track.page = value.page;
  }

  return track;
}

/** 导出时逐字段复制，保证文件里只有 `Track` 定义的字段。 */
function copyPlaylist(playlist: Playlist): Playlist {
  return {
    id: playlist.id,
    name: playlist.name,
    tracks: playlist.tracks.map(copyTrack),
    createdAt: playlist.createdAt,
    updatedAt: playlist.updatedAt,
  };
}

function copyTrack(track: Track): Track {
  return {
    id: track.id,
    bvid: track.bvid,
    ...(track.cid !== undefined ? { cid: track.cid } : {}),
    ...(track.page !== undefined ? { page: track.page } : {}),
    title: track.title,
    ...(track.uploader !== undefined ? { uploader: track.uploader } : {}),
    ...(track.cover !== undefined ? { cover: track.cover } : {}),
    startTime: track.startTime,
    ...(track.endTime !== undefined ? { endTime: track.endTime } : {}),
    duration: track.duration,
    addedAt: track.addedAt,
    source: track.source,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTrackSource(value: unknown): value is TrackSource {
  return (
    typeof value === "string" &&
    (TRACK_SOURCES as readonly string[]).includes(value)
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function readId(value: unknown, message: string): string {
  return readText(value, message);
}

function readText(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BackupError(message);
  }

  return value;
}

function readNumber(value: unknown, message: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new BackupError(message);
  }

  return value;
}

function readOptionalTimestamp(value: unknown, now: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : now;
}

function describe(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "缺失";
}
