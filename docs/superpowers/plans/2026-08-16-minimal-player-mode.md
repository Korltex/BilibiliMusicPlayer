# Minimal Player Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent `396 × 56px` single-row minimal player that reuses the existing playback controls and can switch to and from the full panel without changing playback state.

**Architecture:** Normalize the last open panel mode in the existing layout repository, calculate circular progress through a pure helper, and render a dedicated `MinimalPlayer` component from `App`. Extract the duplicated transport buttons into `PlayerControls` so the full and minimal views call the same callbacks; keep the playback engine, queue, audio-only controller, and song storage unchanged.

**Tech Stack:** TypeScript 7, Preact 10, `@preact/signals`, CSS, Vitest 4, Playwright 1.62, Vite 8, `vite-plugin-monkey`.

## Global Constraints

- The minimal player width is `min(396px, calc(100vw - 24px))`, its standard height is `56px`, and it must never exceed `400px`.
- Keep one row; do not render the cover, app icon, app name, version, current time, total time, or a linear playback progress range.
- Keep title, uploader, audio-only, play mode, previous, circular play/pause progress, next, speaker plus volume range, expand, and close visible.
- The circular progress is read-only; seeking remains available only in the full panel.
- Full and minimal panels share the existing `panel` position.
- Do not add global shortcuts, dependencies, userscript `@grant` entries, or changes to playback engine, queue, audio-only interception, chapter reading, or song storage semantics.
- Preserve all unrelated working-tree changes already present before this plan.

---

## File Structure

- `src/storage/layout-schema.ts`: normalize the persisted last open panel mode together with existing positions.
- `src/storage/layout.ts`: expose one method for saving the last open panel mode.
- `src/app/playback-progress.ts`: pure calculation for the read-only circular progress.
- `src/app/player-controls.tsx`: shared audio-only, play-mode, previous, play/pause, next, and volume controls.
- `src/app/minimal-player.tsx`: single-row minimal player, drag binding, expand/close actions, and temporary interaction prompt.
- `src/app/App.tsx`: own three-state display selection and render launcher, full panel, or minimal player.
- `src/app/icons.tsx`: add compact/expand glyphs using the existing local SVG system.
- `src/styles.css`: size, layout, ring, focus, status, and responsive rules.
- `tests/layout.test.ts`: layout-mode migration and validation tests.
- `tests/playback-progress.test.ts`: circular progress edge-case tests.
- `tests/e2e/player.spec.ts`: mode switching, controls, progress, dimensions, dragging, persistence, keyboard, and fullscreen coverage.
- `tests/e2e/audio-only.spec.ts`: minimal-mode audio-only state and failure-tooltip coverage.
- `dist/bilibili-music-player.user.js` and `dist/bilibili-music-player.meta.js`: regenerated userscript artifacts.

---

### Task 0: Checkpoint the Existing Chapter-Selection Work

**Files:**

- Existing modified: `dist/bilibili-music-player.meta.js`
- Existing modified: `dist/bilibili-music-player.user.js`
- Existing modified: `scripts/audit-userscript.mjs`
- Existing modified: `src/app/App.tsx`
- Existing modified: `src/app/icons.tsx`
- Existing modified: `src/bili/metadata.ts`
- Existing modified: `src/styles.css`
- Existing modified: `tests/e2e/player.spec.ts`
- Existing untracked: `src/bili/chapters.ts`
- Existing untracked: `tests/chapters.test.ts`

**Interfaces:**

- Produces: a clean committed baseline for the previously implemented Bilibili chapter combobox.
- Consumes: only changes that were already present before minimal-player implementation starts.

- [ ] **Step 1: Confirm the pre-existing change set**

Run: `git status --short`

Expected: exactly the chapter source/tests, their `App.tsx`/icon/style integration, the audit newline fix, and regenerated `dist` files listed above. Stop if any additional source file appears.

- [ ] **Step 2: Re-verify the existing chapter work**

Run: `npm test`

Run: `npm run build`

Run: `npx playwright test tests/e2e/player.spec.ts -g "selects video chapters|keeps manual track editing"`

Expected: all commands PASS before the baseline commit.

- [ ] **Step 3: Commit only the existing chapter work**

```bash
git add dist/bilibili-music-player.meta.js dist/bilibili-music-player.user.js scripts/audit-userscript.mjs src/app/App.tsx src/app/icons.tsx src/bili/chapters.ts src/bili/metadata.ts src/styles.css tests/chapters.test.ts tests/e2e/player.spec.ts
git commit -m "feat: add Bilibili chapter selection"
```

Run `git status --short` after the commit. Expected: the worktree is clean before minimal-player implementation starts.

---

### Task 1: Persist the Last Open Panel Mode

**Files:**

- Modify: `tests/layout.test.ts`
- Modify: `src/storage/layout-schema.ts`
- Modify: `src/storage/layout.ts`

**Interfaces:**

- Produces: `type OpenPanelMode = "full" | "minimal"`
- Produces: normalized `LayoutData.lastOpenMode: OpenPanelMode`
- Produces: `LayoutRepository.saveLastOpenMode(mode: OpenPanelMode): void`
- Consumes: existing `GM_getValue`, `GM_setValue`, positions, and layout key.

- [ ] **Step 1: Write failing layout-mode tests**

Extend `tests/layout.test.ts` with exact expectations for defaults, valid values, invalid values, and coordinate preservation:

```ts
it("defaults old layout data to the full panel", () => {
  expect(
    migrateLayoutData({
      version: 1,
      launcher: { x: 24, y: 36 },
      panel: { x: 180, y: 90 },
    }),
  ).toEqual({
    version: 1,
    launcher: { x: 24, y: 36 },
    panel: { x: 180, y: 90 },
    lastOpenMode: "full",
  });
});

it("keeps valid minimal mode and rejects invalid stored modes", () => {
  expect(migrateLayoutData({ version: 1, lastOpenMode: "minimal" })).toEqual({
    version: 1,
    lastOpenMode: "minimal",
  });
  expect(migrateLayoutData({ version: 1, lastOpenMode: "compact" })).toEqual({
    version: 1,
    lastOpenMode: "full",
  });
});
```

Update the existing invalid-version expectation to `{ version: 1, lastOpenMode: "full" }`.

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `npm test -- tests/layout.test.ts`

Expected: FAIL because `lastOpenMode` is absent.

- [ ] **Step 3: Normalize and save panel mode**

In `src/storage/layout-schema.ts`, add:

```ts
export type OpenPanelMode = "full" | "minimal";

export interface LayoutData {
  version: 1;
  launcher?: ViewportPosition;
  panel?: ViewportPosition;
  lastOpenMode: OpenPanelMode;
}

const DEFAULT_LAYOUT: LayoutData = {
  version: 1,
  lastOpenMode: "full",
};

function readOpenPanelMode(value: unknown): OpenPanelMode {
  return value === "minimal" ? "minimal" : "full";
}
```

Return `lastOpenMode: readOpenPanelMode(candidate.lastOpenMode)` from `migrateLayoutData` while preserving valid positions.

In `src/storage/layout.ts`, import `OpenPanelMode` and add:

```ts
saveLastOpenMode(lastOpenMode: OpenPanelMode): void {
  GM_setValue(LAYOUT_STORAGE_KEY, {
    ...this.load(),
    lastOpenMode,
  });
}
```

- [ ] **Step 4: Run the focused unit test and verify GREEN**

Run: `npm test -- tests/layout.test.ts`

Expected: all layout tests PASS.

- [ ] **Step 5: Commit only this task**

```bash
git add src/storage/layout-schema.ts src/storage/layout.ts tests/layout.test.ts
git commit -m "feat: persist minimal player mode"
```

---

### Task 2: Calculate Read-Only Circular Progress

**Files:**

- Create: `tests/playback-progress.test.ts`
- Create: `src/app/playback-progress.ts`

**Interfaces:**

- Produces: `interface PlaybackProgressInput`
- Produces: `calculatePlaybackProgress(input: PlaybackProgressInput): number`, returning a finite fraction from `0` through `1`.
- Consumes: current time, start time, optional end time, runtime duration, and stored duration.

- [ ] **Step 1: Write the failing progress tests**

Create `tests/playback-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculatePlaybackProgress } from "../src/app/playback-progress";

describe("minimal player progress", () => {
  it("calculates progress across a playlist segment", () => {
    expect(
      calculatePlaybackProgress({
        currentTime: 461.5,
        startTime: 364,
        endTime: 559,
        duration: 900,
        storedDuration: 900,
      }),
    ).toBe(0.5);
  });

  it("uses runtime then stored duration when no segment end exists", () => {
    expect(
      calculatePlaybackProgress({
        currentTime: 60,
        startTime: 0,
        duration: 240,
        storedDuration: 300,
      }),
    ).toBe(0.25);
    expect(
      calculatePlaybackProgress({
        currentTime: 75,
        startTime: 0,
        duration: 0,
        storedDuration: 300,
      }),
    ).toBe(0.25);
  });

  it("clamps bounds and returns zero for invalid ranges", () => {
    const base = { startTime: 10, endTime: 20, duration: 0, storedDuration: 0 };
    expect(calculatePlaybackProgress({ ...base, currentTime: 5 })).toBe(0);
    expect(calculatePlaybackProgress({ ...base, currentTime: 25 })).toBe(1);
    expect(
      calculatePlaybackProgress({ ...base, currentTime: Number.NaN }),
    ).toBe(0);
    expect(
      calculatePlaybackProgress({
        currentTime: 10,
        startTime: 10,
        endTime: 10,
        duration: 0,
        storedDuration: 0,
      }),
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Run the focused unit test and verify RED**

Run: `npm test -- tests/playback-progress.test.ts`

Expected: FAIL because `src/app/playback-progress.ts` does not exist.

- [ ] **Step 3: Implement the pure calculation**

Create `src/app/playback-progress.ts`:

```ts
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
```

- [ ] **Step 4: Run the focused unit test and verify GREEN**

Run: `npm test -- tests/playback-progress.test.ts`

Expected: all progress tests PASS.

- [ ] **Step 5: Commit only this task**

```bash
git add src/app/playback-progress.ts tests/playback-progress.test.ts
git commit -m "feat: calculate minimal player progress"
```

---

### Task 3: Add Shared Controls and the Minimal Player Surface

**Files:**

- Create: `src/app/player-controls.tsx`
- Create: `src/app/minimal-player.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/icons.tsx`
- Modify: `src/styles.css`
- Modify: `tests/e2e/player.spec.ts`

**Interfaces:**

- Consumes: `OpenPanelMode`, `LayoutRepository.saveLastOpenMode`, `calculatePlaybackProgress`, `RuntimePlayerState`, `PlayMode`, `AudioOnlyState`, and `DraggablePositionBinding`.
- Produces: `PlayerControls(props: PlayerControlsProps)` shared by both panels.
- Produces: `MinimalPlayer(props: MinimalPlayerProps)`.
- Produces: `Minimize2` and `Maximize2` local SVG icons.
- Produces: accessible regions named `Bilibili 音乐播放器` and `Bilibili 音乐播放器（极简模式）`.

- [ ] **Step 1: Write the failing mode-switching E2E test**

Add `MINIMAL_PLAYER_URL` and a test-page route to `tests/e2e/player.spec.ts`. Use `installLocalStorageGm`, `installMockMedia`, and `injectBuiltUserscript`, then add:

```ts
test("switches between full, minimal, and launcher modes", async ({ page }) => {
  await openMinimalPlayerTestPage(page);

  const launcher = page.getByRole("button", {
    name: "打开 Bilibili 音乐播放器",
  });
  await launcher.click();

  const full = page.getByRole("region", { name: "Bilibili 音乐播放器" });
  const headerButtons = full.locator(".header-actions > button");
  await expect(headerButtons).toHaveCount(3);
  await expect(headerButtons.nth(0)).toHaveAttribute(
    "aria-label",
    "重置图标和播放器位置",
  );
  await expect(headerButtons.nth(1)).toHaveAttribute(
    "aria-label",
    "进入极简模式",
  );
  await expect(headerButtons.nth(2)).toHaveAttribute(
    "aria-label",
    "收起播放器",
  );

  await headerButtons.nth(1).click();
  const minimal = page.getByRole("region", {
    name: "Bilibili 音乐播放器（极简模式）",
  });
  await expect(minimal).toBeVisible();
  await expect(full).toHaveCount(0);

  const box = (await minimal.boundingBox())!;
  expect(box.width).toBeLessThanOrEqual(396.5);
  expect(box.height).toBeCloseTo(56, 0);

  await minimal.getByRole("button", { name: "收起播放器" }).click();
  await launcher.click();
  await expect(minimal).toBeVisible();

  await minimal.getByRole("button", { name: "展开完整播放器" }).click();
  await expect(full).toBeVisible();
});
```

Define `openMinimalPlayerTestPage(page)` beside the existing E2E helpers. It routes a page containing title `极简播放器测试`, uploader `测试作者`, and one `<video>`, installs GM storage, navigates, installs a 240-second mock media element, and injects the built userscript.

- [ ] **Step 2: Build and run the focused E2E test to verify RED**

Run: `npm run build`

Run: `npx playwright test tests/e2e/player.spec.ts -g "switches between full, minimal, and launcher modes"`

Expected: FAIL because the full header has no minimal-mode button or minimal region.

- [ ] **Step 3: Add the shared control interface**

Create `src/app/player-controls.tsx` with this public contract:

```ts
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
```

Move the existing audio-only, play-mode, previous, play/pause, next, and volume markup from `App.tsx` into `PlayerControls`. Preserve all current labels, classes, icon states, and callbacks. For `variant === "minimal"`, wrap the play button with:

```tsx
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
```

Export the existing `audioOnlyButtonLabel` helper so `App` can continue deriving the full-panel fallback message from the same text source.

- [ ] **Step 4: Add the minimal player component**

Create `src/app/minimal-player.tsx` with this contract:

```ts
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
```

Calculate progress with:

```ts
const progress = calculatePlaybackProgress({
  currentTime: runtime.currentTime,
  startTime: runtime.nowPlaying.startTime,
  endTime: runtime.nowPlaying.endTime,
  duration: runtime.duration,
  storedDuration: runtime.nowPlaying.storedDuration,
});
```

Render title/uploader, `PlayerControls variant="minimal"`, an expand button, and a close button. Show `等待播放器` and omit the uploader when `runtime.mediaReady` is false. Attach the existing drag handlers to the section and ignore pointer-down events whose composed target is inside `button`, `input`, `select`, `textarea`, or `a`.

- [ ] **Step 5: Replace the boolean display state in App**

In `src/app/App.tsx`, create one module-level `LayoutRepository` and use:

```ts
type DisplayMode = "launcher" | OpenPanelMode;
const [displayMode, setDisplayMode] = useState<DisplayMode>("launcher");

const showPanel = (mode: OpenPanelMode) => {
  layoutRepository.saveLastOpenMode(mode);
  setDisplayMode(mode);
};
```

Launcher click loads `layoutRepository.load().lastOpenMode`. Full and minimal close set only `displayMode` to `launcher`. Add the `Minimize2` button between reset and close in `.header-actions`; its callback is `showPanel("minimal")`. Render `MinimalPlayer` when `displayMode === "minimal"` and pass the same engine, audio-only, play-mode, and drag callbacks used by the full controls. Replace the full panel transport markup with `PlayerControls variant="full"`.

- [ ] **Step 6: Add icons and exact base styles**

In `src/app/icons.tsx`, add local `Minimize2` and `Maximize2` icons using the existing `SvgIcon` wrapper:

```tsx
export function Minimize2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </SvgIcon>
  );
}

export function Maximize2(props: IconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M15 3h6v6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
      <path d="M9 21H3v-6" />
    </SvgIcon>
  );
}
```

In `src/styles.css`, add `.minimal-player` to the pointer-enabled surfaces and implement these invariants:

```css
.minimal-player {
  position: fixed;
  right: 20px;
  bottom: 20px;
  display: flex;
  width: min(396px, calc(100vw - 24px));
  height: 56px;
  align-items: center;
  gap: 2px;
  padding: 0 6px;
  overflow: visible;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg);
  box-shadow: 0 12px 36px rgb(0 0 0 / 38%);
  pointer-events: auto;
  touch-action: none;
}

.minimal-now-playing {
  min-width: 0;
  width: 84px;
  flex: 0 1 84px;
  cursor: move;
  user-select: none;
}

.circular-progress-value {
  stroke-dasharray: var(--play-progress) 100;
  stroke: var(--accent);
}
```

Complete the ring with gray track, `transform: rotate(-90deg)`, `transform-origin: center`, `pointer-events: none`, a `36px` minimal play button, compact `26–28px` icon buttons, a short `42px` volume range, ellipsis for both metadata lines, and a visible `:focus-visible` outline. Add `.visually-hidden` using the standard one-pixel clipping pattern. Preserve the full panel's current sizes through variant-specific selectors.

- [ ] **Step 7: Build and run the focused E2E test to verify GREEN**

Run: `npm run build`

Run: `npx playwright test tests/e2e/player.spec.ts -g "switches between full, minimal, and launcher modes"`

Expected: PASS; existing full panel remains visible and functional.

- [ ] **Step 8: Commit only this task**

```bash
git add src/app/App.tsx src/app/player-controls.tsx src/app/minimal-player.tsx src/app/icons.tsx src/styles.css tests/e2e/player.spec.ts
git commit -m "feat: add minimal player surface"
```

---

### Task 4: Verify Minimal Controls, Progress, Dimensions, and Persistence

**Files:**

- Modify: `tests/e2e/player.spec.ts`
- Modify: `src/app/minimal-player.tsx`
- Modify: `src/app/player-controls.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- Consumes: Task 3's minimal region and shared control labels.
- Produces: persistent minimal reopening, fully functional controls, correct accessible progress, and exact compact visual exclusions.

- [ ] **Step 1: Write failing control and persistence assertions**

Add a test named `minimal player keeps controls visible and persists its mode` that:

```ts
await openMinimalPlayerTestPage(page, { currentTime: 60, duration: 240 });
await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
await page.getByRole("button", { name: "进入极简模式" }).click();

const minimal = page.getByRole("region", {
  name: "Bilibili 音乐播放器（极简模式）",
});
await expect(minimal).toContainText("极简播放器测试");
await expect(minimal).toContainText("测试作者");
await expect(
  minimal.locator(".cover, .brand, .time-row, .progress-range"),
).toHaveCount(0);
await expect(
  minimal.getByRole("progressbar", { name: "播放进度" }),
).toHaveAttribute("aria-valuenow", "25");
await expect(minimal.locator('input[type="range"]')).toHaveCount(1);

await minimal.getByRole("button", { name: "播放", exact: true }).click();
await expect(
  minimal.getByRole("button", { name: "暂停", exact: true }),
).toBeVisible();
await minimal.getByRole("button", { name: "列表循环" }).click();
await expect(minimal.getByRole("button", { name: "单曲循环" })).toBeVisible();
await minimal.getByRole("button", { name: "静音" }).click();
await expect(minimal.getByRole("button", { name: "取消静音" })).toBeVisible();

await minimal.getByRole("button", { name: "收起播放器" }).click();
await page.reload();
await installMockMedia(page, 240, 60);
await injectBuiltUserscript(page);
await page.getByRole("button", { name: "打开 Bilibili 音乐播放器" }).click();
await expect(minimal).toBeVisible();
```

Read the GM-backed layout from local storage and assert `lastOpenMode === "minimal"` while `version`, launcher position, and panel position remain present.

- [ ] **Step 2: Run the focused E2E test and verify RED**

Run: `npm run build && npx playwright test tests/e2e/player.spec.ts -g "minimal player keeps controls visible"`

Expected: FAIL on any missing control state, progress value, storage preference, or compact exclusion.

- [ ] **Step 3: Complete control wiring and compact sizing**

Ensure every minimal callback directly invokes the same operation as the full panel:

```ts
onToggleAudioOnly={() =>
  audioOnly.toggle(engine.currentMedia?.currentTime ?? runtime.currentTime)
}
onCyclePlayMode={cyclePlayMode}
onPrevious={() => engine.previous()}
onTogglePlayback={() => void engine.togglePlayback()}
onNext={() => engine.next()}
onToggleMute={() => engine.toggleMute()}
onSetVolume={(volume) => engine.setVolume(volume)}
```

Disable play, previous, and next when `runtime.mediaReady` is false. Keep the audio-only, play-mode, volume, expand, and close controls available. Ensure the progress element is not focusable and the only range input is the volume slider.

- [ ] **Step 4: Run focused and existing primary E2E tests**

Run: `npm run build`

Run: `npx playwright test tests/e2e/player.spec.ts -g "mounts, controls media|switches between full|minimal player keeps controls visible"`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit only this task**

```bash
git add src/app/minimal-player.tsx src/app/player-controls.tsx src/styles.css tests/e2e/player.spec.ts
git commit -m "test: cover minimal player controls"
```

---

### Task 5: Add Dragging, Interaction Prompt, Audio-Only Tooltip, Keyboard, and Fullscreen Coverage

**Files:**

- Modify: `tests/e2e/player.spec.ts`
- Modify: `tests/e2e/audio-only.spec.ts`
- Modify: `src/app/minimal-player.tsx`
- Modify: `src/app/player-controls.tsx`
- Modify: `src/styles.css`

**Interfaces:**

- Consumes: `runtime.requiresInteraction`, `runtime.message`, `audioOnlyButtonLabel`, shared panel drag binding, and the host's existing `data-web-fullscreen` behavior.
- Produces: `minimal-interaction-prompt` visible for at most 5 seconds and cleared immediately when interaction is no longer required.

- [ ] **Step 1: Write failing E2E tests for edge behavior**

Extend the draggable test to enter minimal mode, drag from `.minimal-now-playing`, expand, and assert the full panel's `x` and `y` match the minimal panel's saved top-left coordinates after viewport clamping.

Add an interaction test whose first `media.play()` rejects and second call succeeds:

```ts
await minimal.getByRole("button", { name: "播放", exact: true }).click();
const prompt = minimal.getByRole("button", { name: "点击继续播放" });
await expect(prompt).toBeVisible();
await prompt.click();
await expect(
  minimal.getByRole("button", { name: "暂停", exact: true }),
).toBeVisible();
await expect(prompt).toHaveCount(0);
```

Add keyboard assertions that `Tab` reaches the controls, space activates the focused minimal play button, and the page's existing space-key listener count remains zero.

Extend the web-fullscreen test to enter minimal mode before setting `data-screen="web"`, then assert the minimal region hides and restores.

In `tests/e2e/audio-only.spec.ts`, enter minimal mode in the fallback fixture and assert:

```ts
const minimalAudioButton = page
  .getByRole("region", { name: "Bilibili 音乐播放器（极简模式）" })
  .locator(".audio-mode-button");
await expect(minimalAudioButton).toHaveClass(/fallback/);
await expect(minimalAudioButton).toHaveAttribute(
  "title",
  "纯音频模式未生效，已回退正常视频：当前视频只提供音视频混流；点击关闭并重载",
);
```

- [ ] **Step 2: Build and run the new edge tests to verify RED**

Run: `npm run build`

Run: `npx playwright test tests/e2e/player.spec.ts tests/e2e/audio-only.spec.ts -g "minimal|drags and persists|web fullscreen"`

Expected: FAIL until drag sharing, temporary prompt, keyboard behavior, minimal fullscreen restoration, and tooltip coverage are complete.

- [ ] **Step 3: Implement the five-second actionable prompt**

In `MinimalPlayer`, use an effect keyed by `runtime.requiresInteraction` and `runtime.message`:

```ts
const [interactionPromptVisible, setInteractionPromptVisible] = useState(false);

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
```

Render a button with class `minimal-interaction-prompt`, exact text and accessible name `点击继续播放`, and `onClick={onTogglePlayback}`. Position it absolutely at `top: calc(100% + 6px)` so it does not change the `56px` player bounds.

- [ ] **Step 4: Complete drag and accessibility guards**

Use the same interactive-target guard as the full header before calling `drag.onPointerDown`. Keep title and uploader attributes on the two truncated metadata lines. Preserve `aria-pressed` and state-specific `title` on audio-only. Add `.minimal-player :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }` and ensure keyboard events inside controls continue to be stopped by the existing player-level keyboard isolation.

- [ ] **Step 5: Run the focused edge tests and verify GREEN**

Run: `npm run build`

Run: `npx playwright test tests/e2e/player.spec.ts tests/e2e/audio-only.spec.ts -g "minimal|drags and persists|web fullscreen"`

Expected: all selected tests PASS.

- [ ] **Step 6: Commit only this task**

```bash
git add src/app/minimal-player.tsx src/app/player-controls.tsx src/styles.css tests/e2e/player.spec.ts tests/e2e/audio-only.spec.ts
git commit -m "feat: finish minimal player interactions"
```

---

### Task 6: Full Regression, Formatting, Build, and Userscript Audit

**Files:**

- Modify: source and tests only if verification exposes a defect covered by this specification.
- Regenerate: `dist/bilibili-music-player.user.js`
- Regenerate: `dist/bilibili-music-player.meta.js`

**Interfaces:**

- Consumes: all tasks above.
- Produces: a type-safe, fully tested, audited userscript build with no new permissions or dependencies.

- [ ] **Step 1: Run formatting checks**

Run: `npm run format:check`

If only changed files fail, run Prettier on the explicit changed paths, then rerun `npm run format:check`. Do not mechanically rewrite unrelated user-owned files.

Expected: PASS.

- [ ] **Step 2: Run type checking and all unit tests**

Run: `npm run typecheck`

Run: `npm test`

Expected: both PASS.

- [ ] **Step 3: Build and audit the userscript**

Run: `npm run build`

Expected: TypeScript, Vite build, and `scripts/audit-userscript.mjs` all PASS; `dist` artifacts are regenerated and contain no new `@grant` or dependency.

- [ ] **Step 4: Run all mocked Playwright tests**

Run: `npm run test:e2e`

Expected: all Playwright tests PASS.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff --check`

Run: `git status --short`

Confirm that only intended minimal-player files, the already-present chapter changes, plan/spec documents, tests, and regenerated distribution artifacts are present. Do not stage unrelated changes.

- [ ] **Step 6: Commit verified implementation files**

```bash
git add src/app/App.tsx src/app/icons.tsx src/app/minimal-player.tsx src/app/player-controls.tsx src/app/playback-progress.ts src/storage/layout-schema.ts src/storage/layout.ts src/styles.css tests/layout.test.ts tests/playback-progress.test.ts tests/e2e/player.spec.ts tests/e2e/audio-only.spec.ts dist/bilibili-music-player.user.js dist/bilibili-music-player.meta.js
git commit -m "feat: add minimal player mode"
```

Do not create a duplicate final commit if Tasks 1–5 already committed every listed implementation change; in that case commit only regenerated distribution artifacts or remaining verification fixes.
