import type { JSX, TargetedPointerEvent } from "preact";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { LayoutRepository, type LayoutTarget } from "../storage/layout";
import {
  clampPosition,
  positionsEqual,
  type ViewportPosition,
} from "./draggable-position";

const DRAG_THRESHOLD = 4;
const layoutRepository = new LayoutRepository();

type DragPointerEvent = TargetedPointerEvent<HTMLElement>;

interface ActiveDrag {
  pointerId: number;
  captureElement: HTMLElement;
  movedElement: HTMLElement;
  originPointerX: number;
  originPointerY: number;
  originPosition: ViewportPosition;
  lastPosition: ViewportPosition;
  dragged: boolean;
}

export interface DraggablePositionBinding {
  ref: (element: HTMLElement | null) => void;
  style?: JSX.CSSProperties;
  onPointerDown: (event: DragPointerEvent) => void;
  onPointerMove: (event: DragPointerEvent) => void;
  onPointerUp: (event: DragPointerEvent) => void;
  onPointerCancel: (event: DragPointerEvent) => void;
  consumeSuppressedClick: () => boolean;
  saveCurrentPosition: () => void;
  resetPosition: () => void;
}

function viewportSize() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export interface DraggablePositionOptions {
  /**
   * 没有已保存坐标时，把 CSS 默认停靠位置固化成左上角坐标。
   * 面板默认按右下角停靠（`bottom`），内容变矮时顶边会跟着往下走；
   * 固化后顶边不动，只有底边随内容高度伸缩。
   */
  pinDefaultAnchor?: boolean;
}

export function useDraggablePosition(
  target: LayoutTarget,
  { pinDefaultAnchor = false }: DraggablePositionOptions = {},
): DraggablePositionBinding {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<ViewportPosition | undefined>(
    () => layoutRepository.load()[target],
  );
  const activeDrag = useRef<ActiveDrag>();
  const suppressClick = useRef(false);

  const ref = useCallback((nextElement: HTMLElement | null) => {
    setElement((currentElement) =>
      currentElement === nextElement ? currentElement : nextElement,
    );
  }, []);

  const syncPosition = useCallback(() => {
    if (!element) {
      return;
    }

    setPosition((currentPosition) => {
      const bounds = element.getBoundingClientRect();
      // 元素不可见（例如网页全屏时宿主被隐藏）时量不到真实尺寸，保持现状。
      if (bounds.width === 0 && bounds.height === 0) {
        return currentPosition;
      }

      if (!currentPosition) {
        return pinDefaultAnchor
          ? { x: bounds.left, y: bounds.top }
          : currentPosition;
      }

      const nextPosition = clampPosition(
        currentPosition,
        { width: bounds.width, height: bounds.height },
        viewportSize(),
      );

      return positionsEqual(currentPosition, nextPosition)
        ? currentPosition
        : nextPosition;
    });
  }, [element, pinDefaultAnchor]);

  // 坐标为空的两种情况都要重新固化默认停靠点：首次挂载、以及「重置位置」之后。
  const pinnedDefaultAnchor = pinDefaultAnchor && position === undefined;

  useLayoutEffect(syncPosition, [pinnedDefaultAnchor, syncPosition]);

  useEffect(() => {
    if (!element) {
      return;
    }

    window.addEventListener("resize", syncPosition);
    const resizeObserver = new ResizeObserver(syncPosition);
    resizeObserver.observe(element);

    return () => {
      window.removeEventListener("resize", syncPosition);
      resizeObserver.disconnect();
    };
  }, [syncPosition, element]);

  const onPointerDown = useCallback(
    (event: DragPointerEvent) => {
      if (
        !element ||
        !event.isPrimary ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      const bounds = element.getBoundingClientRect();
      const originPosition = { x: bounds.left, y: bounds.top };
      suppressClick.current = false;
      activeDrag.current = {
        pointerId: event.pointerId,
        captureElement: event.currentTarget,
        movedElement: element,
        originPointerX: event.clientX,
        originPointerY: event.clientY,
        originPosition,
        lastPosition: originPosition,
        dragged: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [element],
  );

  const onPointerMove = useCallback((event: DragPointerEvent) => {
    const drag = activeDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.originPointerX;
    const deltaY = event.clientY - drag.originPointerY;
    if (!drag.dragged && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) {
      return;
    }

    drag.dragged = true;
    const bounds = drag.movedElement.getBoundingClientRect();
    const nextPosition = clampPosition(
      {
        x: drag.originPosition.x + deltaX,
        y: drag.originPosition.y + deltaY,
      },
      { width: bounds.width, height: bounds.height },
      viewportSize(),
    );
    drag.lastPosition = nextPosition;
    setPosition(nextPosition);
    event.preventDefault();
  }, []);

  const finishDrag = useCallback(
    (event: DragPointerEvent, cancelled: boolean) => {
      const drag = activeDrag.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      if (drag.dragged) {
        setPosition(drag.lastPosition);
        layoutRepository.savePosition(target, drag.lastPosition);
        suppressClick.current = !cancelled;
      }

      activeDrag.current = undefined;
      if (drag.captureElement.hasPointerCapture(event.pointerId)) {
        drag.captureElement.releasePointerCapture(event.pointerId);
      }
    },
    [target],
  );

  const onPointerUp = useCallback(
    (event: DragPointerEvent) => finishDrag(event, false),
    [finishDrag],
  );
  const onPointerCancel = useCallback(
    (event: DragPointerEvent) => finishDrag(event, true),
    [finishDrag],
  );
  const consumeSuppressedClick = useCallback(() => {
    if (!suppressClick.current) {
      return false;
    }

    suppressClick.current = false;
    return true;
  }, []);
  const saveCurrentPosition = useCallback(() => {
    if (!element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    const nextPosition = clampPosition(
      { x: bounds.left, y: bounds.top },
      { width: bounds.width, height: bounds.height },
      viewportSize(),
    );
    setPosition(nextPosition);
    layoutRepository.savePosition(target, nextPosition);
  }, [element, target]);
  const resetPosition = useCallback(() => {
    activeDrag.current = undefined;
    suppressClick.current = false;
    setPosition(undefined);
    layoutRepository.clearPosition(target);
  }, [target]);

  return {
    ref,
    style: position
      ? {
          left: position.x,
          top: position.y,
          right: "auto",
          bottom: "auto",
        }
      : undefined,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    consumeSuppressedClick,
    saveCurrentPosition,
    resetPosition,
  };
}
