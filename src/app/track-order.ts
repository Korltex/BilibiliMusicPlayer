/**
 * 歌曲行拖拽排序的纯逻辑：只做数组移动，不碰存储、不做 UI。
 *
 * 索引语义统一为「插入位」：`toIndex` 表示在**移动前**的数组里把歌曲放到该下标之前，
 * 取值 0..length（length = 追加到末尾）。这样调用方能直接用拖拽指针算出的插入位，
 * 不用关心「往下拖时源下标会让目标左移一位」这类偏移。
 */
export interface TrackMoveResult<T> {
  tracks: T[];
  index: number;
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length);
}

/**
 * 把 `trackId` 对应的条目移动到 `toIndex` 之前。
 *
 * 返回 `undefined` 表示无需改动：歌曲不存在、索引非法、或移动后顺序与原来完全一致。
 * 此时调用方不应写存储，避免产生无意义的 `updatedAt` 变更与远端广播。
 */
export function moveTrackToIndex<T extends { id: string }>(
  tracks: readonly T[],
  trackId: string,
  toIndex: number,
): TrackMoveResult<T> | undefined {
  const fromIndex = tracks.findIndex((track) => track.id === trackId);
  if (fromIndex === -1 || !Number.isFinite(toIndex)) {
    return undefined;
  }

  const next = [...tracks];
  const [moved] = next.splice(fromIndex, 1);
  // 移除源条目后，源位置之后的插入位整体左移一位。
  const insertIndex = clampIndex(
    toIndex > fromIndex ? toIndex - 1 : toIndex,
    next.length,
  );
  next.splice(insertIndex, 0, moved);

  if (insertIndex === fromIndex) {
    return undefined;
  }

  return { tracks: next, index: insertIndex };
}

/**
 * 键盘排序的统一入口：把 ↑/↓/Home/End 解释成一次移动。
 *
 * 返回值里有两个下标，语义不同、都不要混用：
 * - `toIndex`：传给 `AppStore.moveTrack()` 的**插入位**（移动前数组的下标）；
 * - `index`：移动完成后歌曲所在的下标，UI 用它播报「已移动到第 N 首」。
 *
 * 到边界（已经在首/尾）时返回 `undefined`。
 */
export function resolveKeyboardMove<T extends { id: string }>(
  tracks: readonly T[],
  trackId: string,
  key: "ArrowUp" | "ArrowDown" | "Home" | "End",
): { toIndex: number; index: number } | undefined {
  const fromIndex = tracks.findIndex((track) => track.id === trackId);
  if (fromIndex === -1) {
    return undefined;
  }

  if (key === "Home") {
    return fromIndex === 0 ? undefined : { toIndex: 0, index: 0 };
  }

  if (key === "End") {
    return fromIndex === tracks.length - 1
      ? undefined
      : { toIndex: tracks.length, index: tracks.length - 1 };
  }

  const index = fromIndex + (key === "ArrowDown" ? 1 : -1);
  if (index < 0 || index >= tracks.length) {
    return undefined;
  }

  // 向后移动时源条目先被摘除会让插入位左移一位，因此要 +1。
  return { toIndex: key === "ArrowDown" ? index + 1 : index, index };
}

/**
 * 拖拽落点归一化：拖拽期间算出的插入位若等价于「留在原位」，返回 `undefined`，
 * 让 UI 不显示落点指示线、松开后也不写存储。
 */
export function resolveDropIndex(
  fromIndex: number,
  dropIndex: number,
): number | undefined {
  if (fromIndex < 0 || dropIndex < 0) {
    return undefined;
  }

  return dropIndex === fromIndex || dropIndex === fromIndex + 1
    ? undefined
    : dropIndex;
}
