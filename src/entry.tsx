import { render } from "preact";
import style from "./styles.css?style";
import { App } from "./app/App";
import { appStore } from "./app/store";
import { audioOnlyController } from "./bili/audio-only-controller";
import { PlayerEngine } from "./playback/player-engine";

const HOST_ID = "bilibili-music-player-host";
const BILIBILI_PLAYER_SELECTOR = ".bpx-player-container";
const BILIBILI_WEB_FULLSCREEN_SELECTOR = `${BILIBILI_PLAYER_SELECTOR}[data-screen="web"]`;

audioOnlyController.start();

function containsBilibiliPlayer(node: Node): boolean {
  return (
    node instanceof Element &&
    (node.matches(BILIBILI_PLAYER_SELECTOR) ||
      node.querySelector(BILIBILI_PLAYER_SELECTOR) !== null)
  );
}

function observeWebFullscreen(host: HTMLElement): () => void {
  const syncVisibility = () => {
    host.toggleAttribute(
      "data-web-fullscreen",
      document.querySelector(BILIBILI_WEB_FULLSCREEN_SELECTOR) !== null,
    );
  };

  const observer = new MutationObserver((mutations) => {
    const relevantMutation = mutations.some(
      (mutation) =>
        mutation.type === "attributes" ||
        [...mutation.addedNodes, ...mutation.removedNodes].some(
          containsBilibiliPlayer,
        ),
    );

    if (relevantMutation) {
      syncVisibility();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-screen"],
    childList: true,
    subtree: true,
  });
  syncVisibility();

  return () => observer.disconnect();
}

function isolateKeyboardEvents(mountPoint: HTMLElement): () => void {
  const stopPropagation = (event: KeyboardEvent) => {
    event.stopPropagation();
  };

  mountPoint.addEventListener("keydown", stopPropagation);
  mountPoint.addEventListener("keyup", stopPropagation);

  return () => {
    mountPoint.removeEventListener("keydown", stopPropagation);
    mountPoint.removeEventListener("keyup", stopPropagation);
  };
}

function mount(): void {
  if (document.getElementById(HOST_ID)) {
    return;
  }

  const host = document.createElement("div");
  host.id = HOST_ID;
  const shadowRoot = host.attachShadow({ mode: "open" });
  const mountPoint = document.createElement("div");
  mountPoint.id = "bilibili-music-player-root";
  shadowRoot.append(style, mountPoint);
  document.documentElement.append(host);
  const stopObservingWebFullscreen = observeWebFullscreen(host);
  const stopIsolatingKeyboardEvents = isolateKeyboardEvents(mountPoint);

  const engine = new PlayerEngine(appStore);
  engine.start();
  render(
    <App store={appStore} engine={engine} audioOnly={audioOnlyController} />,
    mountPoint,
  );

  window.addEventListener(
    "pagehide",
    () => {
      stopObservingWebFullscreen();
      stopIsolatingKeyboardEvents();
      engine.stop();
      render(null, mountPoint);
    },
    { once: true },
  );
}

if (document.documentElement) {
  mount();
} else {
  document.addEventListener("readystatechange", mount, { once: true });
}
