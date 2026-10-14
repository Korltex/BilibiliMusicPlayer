/**
 * 歌曲多选的纯逻辑：只做「按 `track.id` 维护一个选中集合」，
 * 不碰存储、不做 UI、不关心排序。
 *
 * 选中状态**不进持久化数据结构**（`AppData` 没有这个字段）：它是纯界面状态，
 * 刷新即丢失。所有对外操作都接收/返回新的 `ReadonlySet`，方便直接塞进
 * `useState` 而不必担心原地修改。
 */

/** 选中的歌曲 id 集合。用 `track.id` 而不是数组下标——排序会改变下标，id 不会。 */
export type TrackSelection = ReadonlySet<string>;

const EMPTY: TrackSelection = new Set<string>();

export function emptyTrackSelection(): TrackSelection {
  return EMPTY;
}

/** 单个复选框：选中 ↔ 取消选中。 */
export function toggleTrackSelection(
  selection: TrackSelection,
  trackId: string,
): TrackSelection {
  const next = new Set(selection);
  if (!next.delete(trackId)) {
    next.add(trackId);
  }
  return next;
}

export function selectTrack(
  selection: TrackSelection,
  trackId: string,
): TrackSelection {
  if (selection.has(trackId)) {
    return selection;
  }

  const next = new Set(selection);
  next.add(trackId);
  return next;
}

export function deselectTrack(
  selection: TrackSelection,
  trackId: string,
): TrackSelection {
  if (!selection.has(trackId)) {
    return selection;
  }

  const next = new Set(selection);
  next.delete(trackId);
  return next;
}

/** 「全选」：选中当前歌单里的全部歌曲。 */
export function selectAllTracks(
  selection: TrackSelection,
  tracks: readonly { id: string }[],
): TrackSelection {
  return areAllTracksSelected(selection, tracks)
    ? selection
    : new Set(tracks.map((track) => track.id));
}

/**
 * 清理失效 id：删除歌曲、切换歌单之后，集合里可能残留已经不存在的 id。
 *
 * 没有实际变化时**返回原引用**，让 `useState` 的更新自然短路，避免无意义的重渲染。
 */
export function pruneTrackSelection(
  selection: TrackSelection,
  tracks: readonly { id: string }[],
): TrackSelection {
  if (selection.size === 0) {
    return selection;
  }

  const alive = new Set(tracks.map((track) => track.id));
  const next = new Set<string>();
  for (const id of selection) {
    if (alive.has(id)) {
      next.add(id);
    }
  }

  return next.size === selection.size ? selection : next;
}

/** 当前歌单里确实存在的选中歌曲 id，按列表顺序返回（批量删除直接用它）。 */
export function resolveSelectedTrackIds(
  selection: TrackSelection,
  tracks: readonly { id: string }[],
): string[] {
  if (selection.size === 0) {
    return [];
  }

  return tracks
    .filter((track) => selection.has(track.id))
    .map((track) => track.id);
}

export function countSelectedTracks(
  selection: TrackSelection,
  tracks: readonly { id: string }[],
): number {
  if (selection.size === 0) {
    return 0;
  }

  return tracks.reduce(
    (count, track) => (selection.has(track.id) ? count + 1 : count),
    0,
  );
}

/** 是否已经全选（空歌单视为「没有可选的东西」，返回 false，避免禁用态语义含糊）。 */
export function areAllTracksSelected(
  selection: TrackSelection,
  tracks: readonly { id: string }[],
): boolean {
  return tracks.length > 0 && tracks.every((track) => selection.has(track.id));
}
