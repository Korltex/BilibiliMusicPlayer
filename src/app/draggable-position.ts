export interface ViewportPosition {
  x: number;
  y: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export function clampPosition(
  position: ViewportPosition,
  elementSize: ViewportSize,
  viewportSize: ViewportSize,
): ViewportPosition {
  const maximumX = Math.max(0, viewportSize.width - elementSize.width);
  const maximumY = Math.max(0, viewportSize.height - elementSize.height);

  return {
    x: Math.min(maximumX, Math.max(0, position.x)),
    y: Math.min(maximumY, Math.max(0, position.y)),
  };
}

export function positionsEqual(
  first: ViewportPosition,
  second: ViewportPosition,
): boolean {
  return first.x === second.x && first.y === second.y;
}
