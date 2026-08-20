import type { AudioOnlyState } from "../bili/audio-only-controller";
import type { PlayMode, RuntimePlayerState } from "../core/types";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { calculatePlaybackProgress } from "./playback-progress";
import { Maximize2, X } from "./icons";
import { PlayerControls } from "./player-controls";
import type { DraggablePositionBinding } from "./use-draggable-position";

export interface MinimalPlayerProps {
  playMode: PlayMode;
  runtime: RuntimePlayerState;
  audioOnlyState: AudioOnlyState;
  drag: DraggablePositionBinding;
  onToggleAudioOnly: () => void;
  onCyclePlayMode: () => void;
  onPrevious: () => void;
  onTogglePlayback: () => void;
  onNext: () => void;
  onToggleMute: () => void;
  onSetVolume: (volume: number) => void;
  onExpand: () => void;
  onClose: () => void;
}

export function MinimalPlayer({
  playMode,
  runtime,
  audioOnlyState,
  drag,
  onToggleAudioOnly,
  onCyclePlayMode,
  onPrevious,
  onTogglePlayback,
  onNext,
  onToggleMute,
  onSetVolume,
  onExpand,
  onClose,
}: MinimalPlayerProps) {
  const [interactionPromptVisible, setInteractionPromptVisible] =
    useState(false);
  const [interactionPromptPlacement, setInteractionPromptPlacement] = useState<
    "above" | "below"
  >("above");
  const playerElement = useRef<HTMLElement | null>(null);
  const setPlayerElement = useCallback(
    (element: HTMLElement | null) => {
      playerElement.current = element;
      drag.ref(element);
    },
    [drag.ref],
  );
  const progress = calculatePlaybackProgress({
    currentTime: runtime.currentTime,
    startTime: runtime.nowPlaying.startTime,
    endTime: runtime.nowPlaying.endTime,
    duration: runtime.duration,
    storedDuration: runtime.nowPlaying.storedDuration,
  });

  useEffect(() => {
    if (!runtime.requiresInteraction) {
      setInteractionPromptVisible(false);
      return;
    }

    setInteractionPromptVisible(true);
    const timeout = window.setTimeout(
      () => setInteractionPromptVisible(false),
      5_000,
    );
    return () => window.clearTimeout(timeout);
  }, [runtime.message, runtime.requiresInteraction]);

  useLayoutEffect(() => {
    const element = playerElement.current;
    if (!interactionPromptVisible || !element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    const promptExtent = 38;
    const nextPlacement =
      bounds.bottom + promptExtent <= window.innerHeight ||
      bounds.top < promptExtent
        ? "below"
        : "above";
    setInteractionPromptPlacement(nextPlacement);
  }, [drag.style?.left, drag.style?.top, interactionPromptVisible]);

  return (
    <section
      ref={setPlayerElement}
      class="minimal-player"
      style={drag.style}
      aria-label="Bilibili 音乐播放器（极简模式）"
      onPointerDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest("button, input, select, textarea, a")
        ) {
          return;
        }
        drag.onPointerDown(event);
      }}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
    >
      <div class="minimal-now-playing">
        <strong title={runtime.nowPlaying.title}>
          {runtime.mediaReady ? runtime.nowPlaying.title : "等待播放器"}
        </strong>
        {runtime.mediaReady && runtime.nowPlaying.uploader && (
          <span title={runtime.nowPlaying.uploader}>
            {runtime.nowPlaying.uploader}
          </span>
        )}
      </div>
      <PlayerControls
        variant="minimal"
        playMode={playMode}
        runtime={runtime}
        audioOnlyState={audioOnlyState}
        progress={progress}
        onToggleAudioOnly={onToggleAudioOnly}
        onCyclePlayMode={onCyclePlayMode}
        onPrevious={onPrevious}
        onTogglePlayback={onTogglePlayback}
        onNext={onNext}
        onToggleMute={onToggleMute}
        onSetVolume={onSetVolume}
      />
      {interactionPromptVisible && (
        <button
          class={`minimal-interaction-prompt ${interactionPromptPlacement}`}
          type="button"
          aria-label="点击继续播放"
          onClick={onTogglePlayback}
        >
          点击继续播放
        </button>
      )}
      <button
        class="icon-button minimal-action-button"
        type="button"
        title="展开完整播放器"
        aria-label="展开完整播放器"
        onClick={onExpand}
      >
        <Maximize2 size={18} aria-hidden="true" />
      </button>
      <button
        class="icon-button close-panel-button minimal-action-button"
        type="button"
        title="收起播放器"
        aria-label="收起播放器"
        onClick={onClose}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </section>
  );
}
