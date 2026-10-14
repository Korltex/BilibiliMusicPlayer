import type {
  TargetedEvent,
  TargetedKeyboardEvent,
  TargetedPointerEvent,
} from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { resolveDropIndex, resolveKeyboardMove } from "./track-order";

/** 长按多久进入拖动。低于这个时长松开仍然是普通点击，不会误排序。 */
export const REORDER_LONG_PRESS_MS = 200;
/** 长按期间允许的指针抖动；超出即视为滚动/滑动，放弃这次拖动。 */
const LONG_PRESS_SLOP_PX = 8;
/** 指针纵位移不超过这个距离才算「点了一下」，超过就是拖动手势。 */
const CLICK_SLOP_PX = 6;
/** 指针进入列表可视区上下多近的边缘带时开始自动滚动。 */
const EDGE_SCROLL_ZONE_PX = 28;
/** 自动滚动的每帧最大步长（px/帧，约 60fps）。越靠近边缘越快。 */
const EDGE_SCROLL_MAX_STEP_PX = 14;

type RowPointerEvent = TargetedPointerEvent<HTMLDivElement>;
type RowKeyEvent = TargetedKeyboardEvent<HTMLDivElement>;
type RowClickEvent = TargetedEvent<HTMLDivElement>;

interface ActiveDrag {
  pointerId: number;
  pointerType: string;
  /** 收到 pointerdown 的那一行：指针捕获与释放都挂在它身上。 */
  row: HTMLElement;
  /** 用于量行位置与自动滚动的列表容器。 */
  listElement: HTMLElement;
  trackId: string;
  originPointerY: number;
  pointerY: number;
  started: boolean;
  settled: boolean;
  /** 这一次按下是否发生过拖动手势（松手后用来决定要不要吞掉 click）。 */
  dragged: boolean;
  dropIndex?: number;
}

/**
 * 绑定到歌曲行上的拖动/键盘排序属性。
 *
 * 刻意**不含 `draggable`**：HTML5 原生拖动会在鼠标按住并移动时抢走手势，
 * 先给指针流发 `pointercancel`，真实鼠标就完全拖不动了（合成事件测不出来）。
 */
export interface TrackRowBinding {
  class: string;
  tabIndex: number;
  "aria-label": string;
  title: string;
  onPointerDown: (event: RowPointerEvent) => void;
  onPointerMove: (event: RowPointerEvent) => void;
  onPointerUp: (event: RowPointerEvent) => void;
  onPointerCancel: (event: RowPointerEvent) => void;
  onClick: (event: RowClickEvent) => void;
}

export interface TrackReorderOptions {
  /** 顺序调整后的落库回调：`toIndex` 是「插到第 toIndex 首之前」的插入位。 */
  onMove: (trackId: string, toIndex: number) => void;
  /** 键盘排序后的播报文案；默认只报序号。 */
  describePosition?: (index: number, total: number) => string;
}

export interface TrackReorderResult {
  /** 挂在歌曲列表容器上：用于量行位置、自动滚动与读取行顺序。 */
  containerRef: (element: HTMLElement | null) => void;
  /** 正在拖动的歌曲 id；未拖动时为 `undefined`。 */
  draggingTrackId?: string;
  /** 落点插入位（0..length）；与源位置等价时为 `undefined`。 */
  dropIndex?: number;
  /** 返回应该展开到「歌曲行」容器上的一组属性。 */
  bindRow: (trackId: string) => TrackRowBinding;
}

/**
 * 行内这些元素自己处理指针/键盘语义，长按排序不介入。
 *
 * 只排除多选框与编辑/删除这类行内控件，**不排除**歌曲主体（`.track-main`）：
 * 全局长按的意义就是按住歌名也能拖。
 */
const ROW_CONTROL_SELECTOR =
  ".row-action, .row-select, input, select, textarea, a";

/**
 * 歌曲行「全局长按拖动排序」——按住行内任意位置（除了行内按钮）约 200ms 即可拖动，
 * 不需要专用手柄。
 *
 * 交互契约：
 * - 长按进入拖动；在此之前松开、或移动超过阈值（视为滚动），都按普通点击处理。
 * - 点击歌曲主体仍然播放、点击编辑/删除按钮仍然生效；**只有真正拖动过才会抑制那次 click**，
 *   因此「长按后原地松手」不会把后续点击一并吞掉。
 * - 拖动中高亮被拖动行并在目标位置显示插入线；指针靠近列表上下边缘时自动滚动。
 * - 键盘：行聚焦后 ↑/↓ 上/下移一格，Home/End 移到首尾，每次移动后播报新序号。
 *
 * 顺序即 `Playlist.tracks` 数组顺序，由调用方写回存储；本 hook 不接触存储。
 */
export function useTrackReorder({
  onMove,
  describePosition,
}: TrackReorderOptions): TrackReorderResult {
  const [draggingTrackId, setDraggingTrackId] = useState<string>();
  const [dropIndex, setDropIndex] = useState<number>();
  const longPressTimer = useRef<number>();
  const activeDrag = useRef<ActiveDrag>();
  /** 最近一次结束的按下（click 时用来判断这次按下有没有拖过）。 */
  const pendingDrag = useRef<ActiveDrag>();
  /** 长按是否已把这一次按下变成拖动；`finishDrag` 用它算 `dragged`。 */
  const isDragging = useRef(false);
  const focusFrame = useRef<number>();
  /** 边缘自动滚动的帧循环句柄（同一时刻最多一个）。 */
  const scrollFrame = useRef<number>();
  /** 列表容器上的原生 keydown 监听（AbortController 负责摘除）。 */
  const containerListener = useRef<AbortController>();
  // onMove/describePosition 通常是行内箭头函数，每次渲染都会变；用 ref 固定住，避免进入回调依赖。
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const describeRef = useRef(describePosition);
  describeRef.current = describePosition;
  // 同上的理由：原生监听器只装一次，必须每次都取到最新的处理函数。
  const onKeyDownRef = useRef<(event: KeyboardEvent) => void>(() => {});

  const readRows = useCallback(
    (element: HTMLElement): HTMLElement[] =>
      Array.from(element.querySelectorAll<HTMLElement>(".track-row")),
    [],
  );

  const readTrackIds = useCallback(
    (element: HTMLElement): string[] =>
      readRows(element).map((row) => row.dataset.trackId ?? ""),
    [readRows],
  );

  /** 由指针纵坐标算落点插入位：第一行「中线在指针下方」的那一行之前即插入位。 */
  const computeDropIndex = useCallback(
    (element: HTMLElement, clientY: number): number => {
      const rows = readRows(element);
      for (let index = 0; index < rows.length; index += 1) {
        const bounds = rows[index].getBoundingClientRect();
        if (clientY < bounds.top + bounds.height / 2) {
          return index;
        }
      }

      return rows.length;
    },
    [readRows],
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current !== undefined) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
  }, []);

  const stopFocusRestore = useCallback(() => {
    if (focusFrame.current !== undefined) {
      cancelAnimationFrame(focusFrame.current);
      focusFrame.current = undefined;
    }
  }, []);

  /**
   * 重排会让移动过的行重建 DOM 子树（旧节点被移除），焦点因此丢失。
   * 键盘排序后要把焦点交回同一首歌所在的行，否则按一次方向键焦点就丢了。
   *
   * 聚焦目标是行内的歌曲主体（`.track-main`）而不是 `<div>` 行本身：
   * 浏览器点击的默认行为会把焦点给被点的按钮，行 `<div>` 上的焦点会被顶掉，
   * 按钮则是稳定、可靠的聚焦点，而行的 capture 阶段监听器对行内任何焦点都生效。
   */
  const restoreRowFocus = useCallback(
    (element: HTMLElement | null, trackId: string) => {
      stopFocusRestore();
      // 等一帧，确保 Preact 已经把重排后的 DOM 提交上去。
      focusFrame.current = requestAnimationFrame(() => {
        focusFrame.current = undefined;
        findTrackRow(element, trackId)
          ?.querySelector<HTMLElement>(".track-main")
          ?.focus();
      });
    },
    [stopFocusRestore],
  );

  const updateDropIndex = useCallback(
    (drag: ActiveDrag) => {
      const next = resolveDropIndex(
        readTrackIds(drag.listElement).indexOf(drag.trackId),
        computeDropIndex(drag.listElement, drag.pointerY),
      );
      if (drag.dropIndex === next) {
        return;
      }

      drag.dropIndex = next;
      setDropIndex(next);
    },
    [computeDropIndex, readTrackIds],
  );

  const stopEdgeScroll = useCallback(() => {
    if (scrollFrame.current !== undefined) {
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = undefined;
    }
  }, []);

  /**
   * 本帧要滚多少像素：正数向下、负数向上、0 表示指针不在边缘带或已经滚到头。
   *
   * 越靠近边缘步长越大（线性插值到 `EDGE_SCROLL_MAX_STEP_PX`），
   * 到达滚动边界时返回 0，让帧循环自然停下而不是空转。
   */
  const edgeScrollStep = useCallback((drag: ActiveDrag): number => {
    const { listElement, pointerY } = drag;
    const bounds = listElement.getBoundingClientRect();
    const topDistance = pointerY - bounds.top;
    const bottomDistance = bounds.bottom - pointerY;

    if (topDistance < EDGE_SCROLL_ZONE_PX && listElement.scrollTop > 0) {
      const intensity = 1 - Math.max(topDistance, 0) / EDGE_SCROLL_ZONE_PX;
      return -Math.ceil(intensity * EDGE_SCROLL_MAX_STEP_PX);
    }

    if (
      bottomDistance < EDGE_SCROLL_ZONE_PX &&
      listElement.scrollTop + listElement.clientHeight <
        listElement.scrollHeight - 1
    ) {
      const intensity = 1 - Math.max(bottomDistance, 0) / EDGE_SCROLL_ZONE_PX;
      return Math.ceil(intensity * EDGE_SCROLL_MAX_STEP_PX);
    }

    return 0;
  }, []);

  /**
   * 边缘自动滚动的帧循环：只要拖动还在进行就每帧尝试滚动，**指针静止也继续**。
   *
   * 滚动会改变每一行的视口坐标，所以每帧滚完都要重算落点插入位；
   * 指针离开边缘带、滚到边界、拖动结束或组件卸载时循环停止。
   */
  const stepEdgeScroll = useCallback(() => {
    scrollFrame.current = undefined;
    const drag = activeDrag.current;
    if (!drag || !drag.started || drag.settled) {
      return;
    }

    const step = edgeScrollStep(drag);
    if (step === 0) {
      return;
    }

    drag.listElement.scrollTop += step;
    updateDropIndex(drag);
    scrollFrame.current = requestAnimationFrame(stepEdgeScroll);
  }, [edgeScrollStep, updateDropIndex]);

  /** 幂等启动：拖动开始时调用一次，之后由帧循环自我续期。 */
  const ensureEdgeScroll = useCallback(() => {
    if (scrollFrame.current === undefined) {
      scrollFrame.current = requestAnimationFrame(stepEdgeScroll);
    }
  }, [stepEdgeScroll]);

  const startDragging = useCallback(
    (drag: ActiveDrag) => {
      cancelLongPress();
      if (drag.settled || drag.started) {
        return;
      }

      drag.started = true;
      // 这一次按下已经变成拖动：松手时据此吞掉紧随其后的 click。
      isDragging.current = true;
      setDraggingTrackId(drag.trackId);
      // 捕获到 pointerdown 的那一行上，指针移出行/列表后仍能收到事件。
      capturePointer(drag);
      updateDropIndex(drag);
      ensureEdgeScroll();
    },
    [cancelLongPress, ensureEdgeScroll, updateDropIndex],
  );

  // 卸载时清理计时器/帧循环/原生监听：收起面板或切到设置视图后不应留下后台循环。
  useEffect(
    () => () => {
      cancelLongPress();
      stopFocusRestore();
      stopEdgeScroll();
      containerListener.current?.abort();
      containerListener.current = undefined;
      activeDrag.current = undefined;
    },
    [cancelLongPress, stopEdgeScroll, stopFocusRestore],
  );

  const onPointerDown = useCallback(
    (trackId: string, event: RowPointerEvent) => {
      if (
        !event.isPrimary ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      // 行内按钮保留自己的语义：点编辑/删除不会变成拖动。
      if (
        event.target instanceof Element &&
        event.target.closest(ROW_CONTROL_SELECTOR)
      ) {
        return;
      }

      // 列表元素现取，避免把首帧的 `container = null` 冻进回调。
      const listElement =
        event.currentTarget.closest<HTMLElement>(".track-list");
      if (!listElement) {
        return;
      }

      // 这一次按下先假定是普通点击；真的进入拖动时才置成 true。
      isDragging.current = false;

      const row = event.currentTarget;
      cancelLongPress();
      activeDrag.current = {
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        row,
        listElement,
        trackId,
        originPointerY: event.clientY,
        pointerY: event.clientY,
        started: false,
        settled: false,
        dragged: false,
      };

      const drag = activeDrag.current;
      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = undefined;
        startDragging(drag);
      }, REORDER_LONG_PRESS_MS);
    },
    [cancelLongPress, startDragging],
  );

  const onPointerMove = useCallback(
    (event: RowPointerEvent) => {
      const drag = activeDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      drag.pointerY = event.clientY;
      if (!drag.started) {
        // 长按还没到时间：明显移动即视为滚动/滑动，放弃这次拖动。
        if (
          Math.abs(event.clientY - drag.originPointerY) > LONG_PRESS_SLOP_PX
        ) {
          cancelLongPress();
          stopEdgeScroll();
          activeDrag.current = undefined;
        }
        return;
      }

      // 拖动中接管手势：挡住触摸滚动与长按弹出的文本选择/上下文菜单。
      event.preventDefault();
      updateDropIndex(drag);
      // 指针停住时帧循环会自己走到边界或离开边缘带；从非边缘带重新移回边缘时需要再踢一脚。
      ensureEdgeScroll();
    },
    [cancelLongPress, ensureEdgeScroll, stopEdgeScroll, updateDropIndex],
  );

  const finishDrag = useCallback(
    (event: RowPointerEvent, commit: boolean, moved: boolean) => {
      const drag = activeDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      cancelLongPress();
      stopEdgeScroll();
      drag.settled = true;
      // 记下「这次按下有没有拖动过」，随后到来的 click 据此决定是否吞掉。
      drag.dragged =
        isDragging.current &&
        (moved ||
          Math.abs(event.clientY - drag.originPointerY) > CLICK_SLOP_PX);
      isDragging.current = false;
      pendingDrag.current = drag;
      activeDrag.current = undefined;
      releasePointer(drag, event.pointerId);
      setDraggingTrackId(undefined);
      setDropIndex(undefined);

      if (!drag.started) {
        return;
      }
      drag.started = false;

      if (commit && drag.dropIndex !== undefined) {
        const listElement = drag.listElement;
        // 键盘用户可能先聚焦这一行再用指针拖动，此时把焦点还回去。
        const refocus = isFocused(drag.row);
        onMoveRef.current(drag.trackId, drag.dropIndex);
        if (refocus) {
          restoreRowFocus(listElement, drag.trackId);
        }
      }
    },
    [cancelLongPress, restoreRowFocus, stopEdgeScroll],
  );

  const onPointerUp = useCallback(
    (event: RowPointerEvent) => finishDrag(event, true, false),
    [finishDrag],
  );
  const onPointerCancel = useCallback(
    (event: RowPointerEvent) => finishDrag(event, false, true),
    [finishDrag],
  );

  /**
   * click 的三种命运：
   *
   * - 原地点击（未移动、未长按）：放行——点歌曲播放、点行留白只聚焦；
   * - 拖动手势 / 按住后移开手指（位移超过 `CLICK_SLOP_PX`）：吞掉，
   *   否则松手瞬间会顺手触发播放；
   * - 其余情况（长按后原地松手）：放行。
   */
  const onClick = useCallback((event: RowClickEvent) => {
    const dragged = Boolean(pendingDrag.current?.dragged);
    pendingDrag.current = undefined;
    if (dragged) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    // 普通点击：把键盘焦点留在这一行上，方便紧接着用方向键调整。
    // 浏览器默认会把焦点给被点的按钮，所以让出一拍再收回。
    const row = event.currentTarget;
    void Promise.resolve().then(() => {
      if (!rowHasFocusedControl(row) && !isFocused(row)) {
        row.focus();
      }
    });
  }, []);

  /** 读屏播报：列表元素由调用方传入，避免依赖只在挂载时读取的 state。 */
  const announcePosition = useCallback(
    (listElement: HTMLElement, index: number) => {
      const total = readRows(listElement).length;
      const region = getAnnounceRegion(listElement);
      // 先清空再写入，保证连续两次移动到同一位置也会被读屏软件重新播报。
      region.textContent = "";
      region.textContent =
        describeRef.current?.(index, total) ?? `已移动到第 ${index + 1} 首`;
    },
    [readRows],
  );

  /**
   * 排序键盘处理：↑/↓ 移一格、Home/End 移到首尾。
   *
   * 挂在**列表容器的 capture 阶段**（见下面 `attachContainer`）：焦点通常落在行内的
   * 播放按钮上，方向键不会冒泡到行、也拿不到 `currentTarget === row`，
   * 所以不能按 Preact 合成事件写在行上。只接管方向键/Home/End，回车与空格仍留给按钮。
   *
   * 注意这里**不能依赖 `container` state**：监听器只在挂载时装一次，
   * 依赖 state 会把首帧（`container` 还是 `null`）的处理函数永久留在元素上。
   * 列表元素一律从 `event.currentTarget` 现取。
   */
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const listElement =
        event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
      if (!listElement) {
        return;
      }

      const key = event.key;
      if (
        key !== "ArrowUp" &&
        key !== "ArrowDown" &&
        key !== "Home" &&
        key !== "End"
      ) {
        return;
      }

      // 只对「焦点所在的那一行」生效。
      const row =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(".track-row")
          : null;
      const trackId = row?.dataset.trackId;
      if (!trackId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const move = resolveKeyboardMove(
        readTrackIds(listElement).map((id) => ({ id })),
        trackId,
        key,
      );
      if (!move) {
        return;
      }

      onMoveRef.current(trackId, move.toIndex);
      announcePosition(listElement, move.index);
      // 重排会重建这一行的 DOM，把焦点交回同一首歌以支持连续调整。
      restoreRowFocus(listElement, trackId);
    },
    [announcePosition, readTrackIds, restoreRowFocus],
  );
  onKeyDownRef.current = onKeyDown;

  /**
   * 列表容器：既是量行位置的参照，也是排序键盘监听的落点。
   *
   * 监听器用原生 capture 方式装在容器上、只装一次，避免依赖「每行一个 ref」——
   * 行的 `bindRow()` 每次渲染都会产生新的函数引用，Preact 只比较函数身份，
   * 新建的 ref 不会被调用，挂在行上的监听器就会丢。
   */
  const attachContainer = useCallback((element: HTMLElement | null) => {
    if (!element || containerListener.current) {
      return;
    }

    const controller = new AbortController();
    element.addEventListener("keydown", onKeyDownRef.current, {
      capture: true,
      signal: controller.signal,
    });
    containerListener.current = controller;
  }, []);

  const bindRow = useCallback(
    (trackId: string): TrackRowBinding => ({
      class: `track-row ${
        draggingTrackId === trackId ? "reorder-source" : ""
      }`.trim(),
      tabIndex: 0,
      title: "按住拖动调整顺序，也可用方向键",
      "aria-label": "调整歌曲顺序（上下方向键）",
      onPointerDown: (event) => onPointerDown(trackId, event),
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onClick,
    }),
    [
      draggingTrackId,
      onClick,
      onPointerCancel,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    ],
  );

  return { containerRef: attachContainer, draggingTrackId, dropIndex, bindRow };
}

/**
 * 找到某首歌所在的行（重排后 DOM 是新的，必须按 `data-track-id` 现查）。
 */
function findTrackRow(
  element: HTMLElement | null,
  trackId: string,
): HTMLElement | undefined {
  return (
    element?.querySelector<HTMLElement>(
      `.track-row[data-track-id="${trackId}"]`,
    ) ?? undefined
  );
}

/**
 * 面板挂在 Shadow DOM 里，`document.activeElement` 只会回到宿主节点，
 * 因此必须问元素自己所在的根节点。
 */
function isFocused(element: HTMLElement): boolean {
  const root = element.getRootNode();
  return root instanceof Document || root instanceof ShadowRoot
    ? root.activeElement === element
    : false;
}

/**
 * 行内**文本类**控件（编辑器里的输入框、下拉框）已经有焦点时不要抢走，
 * 否则刚点进输入框就会被行偷走焦点。
 *
 * 按钮不算：点行内按钮后仍把焦点收回行上，这样紧接着按方向键就能调整顺序。
 */
function rowHasFocusedControl(row: HTMLElement): boolean {
  const root = row.getRootNode();
  const active = (root as Document | ShadowRoot).activeElement;
  if (!active || active === row || !row.contains(active)) {
    return false;
  }

  return active.matches(
    'input, textarea, select, [contenteditable="true"], [contenteditable=""]',
  );
}

/**
 * 指针捕获在部分环境（无活动指针的合成事件、旧浏览器）会抛异常，
 * 捕获失败只影响「指针移出列表后还能收到事件」，因此失败时静默降级。
 */
function capturePointer(drag: ActiveDrag): void {
  try {
    if (!drag.row.hasPointerCapture(drag.pointerId)) {
      drag.row.setPointerCapture(drag.pointerId);
    }
  } catch {
    // 无活动指针时捕获不被支持，继续用普通冒泡事件拖动。
  }
}

function releasePointer(drag: ActiveDrag, pointerId: number): void {
  try {
    if (drag.row.hasPointerCapture(pointerId)) {
      drag.row.releasePointerCapture(pointerId);
    }
  } catch {
    // 同上：释放失败不影响已经结束的拖动。
  }
}

/** 读屏播报区：放在列表容器内部，`aria-live` 才能被辅助技术稳定命中。 */
function getAnnounceRegion(container: HTMLElement): HTMLElement {
  const existing = container.querySelector<HTMLElement>(
    ".track-reorder-status",
  );
  if (existing) {
    return existing;
  }

  const region = document.createElement("div");
  region.className = "track-reorder-status";
  region.setAttribute("role", "status");
  region.setAttribute("aria-live", "polite");
  container.append(region);
  return region;
}
