export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function toStartSecond(value: number): number {
  return Math.floor(value);
}

export function toEndSecond(value: number): number {
  return Math.ceil(value);
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) {
    return "00:00";
  }

  const totalSeconds = Math.floor(value);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  }

  return [minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}
