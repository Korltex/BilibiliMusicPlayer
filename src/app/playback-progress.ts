export interface PlaybackProgressInput {
  currentTime: number;
  startTime: number;
  endTime?: number;
  duration: number;
  storedDuration: number;
}

export function calculatePlaybackProgress({
  currentTime,
  startTime,
  endTime,
  duration,
  storedDuration,
}: PlaybackProgressInput): number {
  const fallbackEnd = duration > 0 ? duration : storedDuration;
  const effectiveEnd = endTime ?? fallbackEnd;
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(startTime) ||
    !Number.isFinite(effectiveEnd) ||
    effectiveEnd <= startTime
  ) {
    return 0;
  }

  return Math.min(
    1,
    Math.max(0, (currentTime - startTime) / (effectiveEnd - startTime)),
  );
}
