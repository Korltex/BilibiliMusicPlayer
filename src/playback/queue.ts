import type { PlayMode, Playlist, Track } from "../core/types";

interface QueueSelectionOptions {
  direction: 1 | -1;
  automatic?: boolean;
  random?: () => number;
}

export function selectAdjacentTrack(
  playlist: Playlist | undefined,
  currentTrackId: string | undefined,
  mode: PlayMode,
  options: QueueSelectionOptions,
): Track | undefined {
  const tracks = playlist?.tracks ?? [];
  if (tracks.length === 0) {
    return undefined;
  }

  const currentIndex = Math.max(
    0,
    tracks.findIndex((track) => track.id === currentTrackId),
  );

  if (mode === "single-loop" && options.automatic) {
    return tracks[currentIndex];
  }

  if (mode === "shuffle" && tracks.length > 1) {
    const random = options.random ?? Math.random;
    const offset = 1 + Math.floor(random() * (tracks.length - 1));
    return tracks[(currentIndex + offset) % tracks.length];
  }

  const nextIndex = currentIndex + options.direction;
  if (nextIndex >= 0 && nextIndex < tracks.length) {
    return tracks[nextIndex];
  }

  if (mode === "list-loop" || mode === "single-loop") {
    return tracks[(nextIndex + tracks.length) % tracks.length];
  }

  return undefined;
}
