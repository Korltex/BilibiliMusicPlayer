import type { AudioOnlyState } from "../bili/audio-only-controller";
import type { AudioOnlyInterceptionReason } from "../bili/audio-only-interceptor";
import type { PlayMode, RuntimePlayerState } from "../core/types";
import {
  Headphones,
  ListMusic,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "./icons";

export interface PlayerControlsProps {
  variant: "full" | "minimal";
  playMode: PlayMode;
  runtime: RuntimePlayerState;
  audioOnlyState: AudioOnlyState;
  progress?: number;
  onToggleAudioOnly: () => void;
  onCyclePlayMode: () => void;
  onPrevious: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
}

const PLAY_MODE_LABELS: Record<PlayMode, string> = {
  sequence: "顺序播放",
  "list-loop": "列表循环",
  "single-loop": "单曲循环",
  shuffle: "随机播放",
};

export function PlayerControls({
  variant,
  playMode,
  runtime,
  audioOnlyState,
  progress,
  onToggleAudioOnly,
  onCyclePlayMode,
  onPrevious,
  onTogglePlayback,
  onNext,
  onToggleMute,
  onSetVolume,
}: PlayerControlsProps) {
  const playButton = (
    <button
      class="play-button"
      type="button"
      title={runtime.playing ? "暂停" : "播放"}
      aria-label={runtime.playing ? "暂停" : "播放"}
      disabled={!runtime.mediaReady}
      onClick={onTogglePlayback}
    >
      {runtime.playing ? (
        <Pause size={22} fill="currentColor" aria-hidden="true" />
      ) : (
        <Play size={22} fill="currentColor" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <div class={`transport transport-${variant}`}>
      <button
        class={`icon-button audio-mode-button ${audioOnlyState.status}`}
        type="button"
        title={audioOnlyButtonLabel(audioOnlyState)}
        aria-label={audioOnlyButtonLabel(audioOnlyState)}
        aria-pressed={audioOnlyState.requested}
        onClick={onToggleAudioOnly}
      >
        <Headphones size={19} aria-hidden="true" />
      </button>
      <button
        class="icon-button"
        type="button"
        title={PLAY_MODE_LABELS[playMode]}
        aria-label={PLAY_MODE_LABELS[playMode]}
        onClick={onCyclePlayMode}
      >
        <PlayModeIcon mode={playMode} />
      </button>
      <button
        class="icon-button"
        type="button"
        title="上一首"
        aria-label="上一首"
        disabled={!runtime.mediaReady}
        onClick={onPrevious}
      >
        <SkipBack size={20} aria-hidden="true" />
      </button>
      {variant === "minimal" ? (
        <div
          class="circular-play-control"
          style={{ "--play-progress": String((progress ?? 0) * 100) }}
        >
          <svg class="circular-progress" viewBox="0 0 40 40" aria-hidden="true">
            <circle class="circular-progress-track" cx="20" cy="20" r="18" />
            <circle
              class="circular-progress-value"
              cx="20"
              cy="20"
              r="18"
              pathLength="100"
            />
          </svg>
          {playButton}
          <span
            class="visually-hidden"
            role="progressbar"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((progress ?? 0) * 100)}
          />
        </div>
      ) : (
        playButton
      )}
      <button
        class="icon-button"
        type="button"
        title="下一首"
        aria-label="下一首"
        disabled={!runtime.mediaReady}
        onClick={onNext}
      >
        <SkipForward size={20} aria-hidden="true" />
      </button>
      <div class="volume-control">
        <button
          class="icon-button"
          type="button"
          title={runtime.muted ? "取消静音" : "静音"}
          aria-label={runtime.muted ? "取消静音" : "静音"}
          onClick={onToggleMute}
        >
          {runtime.muted || runtime.volume === 0 ? (
            <VolumeX size={19} aria-hidden="true" />
          ) : (
            <Volume2 size={19} aria-hidden="true" />
          )}
        </button>
        <input
          class="range volume-range"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={runtime.muted ? 0 : runtime.volume}
          aria-label="音量"
          onInput={(event) => onSetVolume(Number(event.currentTarget.value))}
        />
      </div>
    </div>
  );
}

function PlayModeIcon({ mode }: { mode: PlayMode }) {
  switch (mode) {
    case "list-loop":
      return <Repeat size={19} aria-hidden="true" />;
    case "single-loop":
      return <Repeat1 size={19} aria-hidden="true" />;
    case "shuffle":
      return <Shuffle size={19} aria-hidden="true" />;
    default:
      return <ListMusic size={19} aria-hidden="true" />;
  }
}

export function audioOnlyButtonLabel(state: AudioOnlyState): string {
  switch (state.status) {
    case "detecting":
      return "纯音频模式正在检测播放流；点击关闭并重载";
    case "active":
      return "纯音频模式已生效；点击关闭并重载";
    case "fallback":
      return `纯音频模式未生效，已回退正常视频：${audioOnlyReasonLabel(state.reason)}；点击关闭并重载`;
    default:
      return "开启纯音频模式并重载页面";
  }
}

export function audioOnlyReasonLabel(
  reason: AudioOnlyInterceptionReason | undefined,
): string {
  switch (reason) {
    case "durl-only":
      return "当前视频只提供音视频混流";
    case "missing-audio":
      return "DASH 清单没有可用音频";
    case "missing-dash":
    case "invalid-payload":
      return "未找到可改写的 DASH 清单";
    case "invalid-json":
      return "播放清单不是有效 JSON";
    case "unsupported-response-type":
      return "播放器使用了暂不支持的响应格式";
    case "playinfo-nonconfigurable":
      return "首屏播放信息无法拦截";
    case "playinfo-rewrite-failed":
    case "fetch-rewrite-failed":
    case "xhr-rewrite-failed":
      return "播放清单拦截失败";
    default:
      return "当前播放格式不受支持";
  }
}
