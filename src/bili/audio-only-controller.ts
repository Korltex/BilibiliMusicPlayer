import { signal } from "@preact/signals";
import { GM_getValue, GM_setValue, unsafeWindow } from "$";
import {
  installAudioOnlyInterceptors,
  type AudioOnlyInterceptionOutcome,
  type AudioOnlyInterceptionReason,
} from "./audio-only-interceptor";

export type AudioOnlyStatus = "off" | "detecting" | "active" | "fallback";

export interface AudioOnlyState {
  requested: boolean;
  status: AudioOnlyStatus;
  reason?: AudioOnlyInterceptionReason;
}

const STORAGE_KEY = "bilibili-music-player:audio-only";
const STYLE_ID = "bilibili-music-player-audio-only-style";
const ROOT_ATTRIBUTE = "data-bmp-audio-only";
const PAGE_STYLE = `
html[${ROOT_ATTRIBUTE}="active"] .bpx-player-video-wrap video,
html[${ROOT_ATTRIBUTE}="active"] #bilibili-player video,
html[${ROOT_ATTRIBUTE}="active"] .bilibili-player-video video,
html[${ROOT_ATTRIBUTE}="active"] video.bpx-player-video {
  visibility: hidden !important;
}
`;

export class AudioOnlyController {
  readonly state = signal<AudioOnlyState>(createInitialState());

  private started = false;
  private diagnosticLogged = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!this.state.peek().requested) {
      return;
    }

    installAudioOnlyInterceptors(unsafeWindow, (outcome) =>
      this.handleOutcome(outcome),
    );
  }

  toggle(currentTime = 0): void {
    this.setEnabled(!this.state.peek().requested, currentTime);
  }

  setEnabled(enabled: boolean, currentTime = 0): void {
    GM_setValue(STORAGE_KEY, enabled);
    this.state.value = {
      requested: enabled,
      status: enabled ? "detecting" : "off",
    };
    this.applyPagePresentation(false);

    const url = new URL(location.href);
    const resumeTime = Number.isFinite(currentTime)
      ? Math.max(0, Math.floor(currentTime))
      : 0;
    if (resumeTime > 0) {
      url.searchParams.set("t", String(resumeTime));
    } else {
      url.searchParams.delete("t");
    }
    location.replace(url.href);
  }

  private handleOutcome(outcome: AudioOnlyInterceptionOutcome): void {
    if (outcome.reason === "not-playurl") {
      return;
    }

    const active = outcome.supported;
    this.state.value = {
      requested: true,
      status: active ? "active" : "fallback",
      reason: outcome.reason,
    };
    this.applyPagePresentation(active);

    if (!this.diagnosticLogged) {
      this.diagnosticLogged = true;
      console.info("[Bilibili Music Player] audio-only", {
        status: active ? "active" : "fallback",
        reason: outcome.reason,
      });
    }
  }

  private applyPagePresentation(active: boolean): void {
    const root = document.documentElement;
    if (!root) {
      document.addEventListener(
        "readystatechange",
        () => this.applyPagePresentation(this.state.peek().status === "active"),
        { once: true },
      );
      return;
    }

    if (active) {
      ensurePageStyle(root);
      root.setAttribute(ROOT_ATTRIBUTE, "active");
    } else {
      root.removeAttribute(ROOT_ATTRIBUTE);
    }
  }
}

function createInitialState(): AudioOnlyState {
  const stored = GM_getValue<unknown>(STORAGE_KEY, false);
  const requested = stored === true || stored === 1 || stored === "1";
  return {
    requested,
    status: requested ? "detecting" : "off",
  };
}

function ensurePageStyle(root: HTMLElement): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = PAGE_STYLE;
  (document.head ?? root).append(style);
}

export const audioOnlyController = new AudioOnlyController();
