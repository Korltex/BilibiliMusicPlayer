export type MediaChangeReason = "media" | "route";
export type MediaListener = (
  media: HTMLMediaElement | null,
  reason: MediaChangeReason,
) => void;

export class MediaLocator {
  private current: HTMLMediaElement | null = null;
  private currentUrl = location.href;
  private mutationObserver?: MutationObserver;
  private scanTimer?: number;
  private routeTimer?: number;
  private scanQueued = false;

  constructor(private readonly listener: MediaListener) {}

  start(): void {
    this.scan();

    this.mutationObserver = new MutationObserver(() => this.queueScan());
    this.mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });

    this.scanTimer = window.setInterval(() => this.scan(), 1_000);
    this.routeTimer = window.setInterval(() => {
      if (location.href === this.currentUrl) {
        return;
      }

      this.currentUrl = location.href;
      this.listener(this.current, "route");
      this.queueScan();
    }, 300);
  }

  stop(): void {
    this.mutationObserver?.disconnect();
    window.clearInterval(this.scanTimer);
    window.clearInterval(this.routeTimer);
  }

  private queueScan(): void {
    if (this.scanQueued) {
      return;
    }

    this.scanQueued = true;
    window.setTimeout(() => {
      this.scanQueued = false;
      this.scan();
    }, 100);
  }

  private scan(): void {
    const candidate = findActiveMedia();
    if (candidate === this.current) {
      return;
    }

    this.current = candidate;
    this.listener(candidate, "media");
  }
}

export function findActiveMedia(): HTMLMediaElement | null {
  const candidates = [
    ...document.querySelectorAll<HTMLMediaElement>("video, audio"),
  ].filter(
    (media) =>
      media.isConnected &&
      !media.closest("#bilibili-music-player-host") &&
      media.getAttribute("aria-hidden") !== "true",
  );

  return (
    candidates.sort((left, right) => mediaScore(right) - mediaScore(left))[0] ??
    null
  );
}

function mediaScore(media: HTMLMediaElement): number {
  const area = media.clientWidth * media.clientHeight;
  const ready = media.readyState > 0 ? 1_000_000 : 0;
  const hasDuration = Number.isFinite(media.duration) ? 100_000 : 0;
  const playing = media.paused ? 0 : 10_000_000;
  return playing + ready + hasDuration + area;
}
