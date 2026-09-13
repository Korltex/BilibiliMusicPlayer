import { render } from "preact";
import style from "./styles.css?style";
import { App } from "./app/App";
import { appStore } from "./app/store";
import { audioOnlyController } from "./bili/audio-only-controller";
import { getPageRoute, supportsPlayerUi } from "./bili/page-route";
import { PlayerEngine } from "./playback/player-engine";

const HOST_ID = "bilibili-music-player-host";
const BILIBILI_PLAYER_SELECTOR = ".bpx-player-container";
const BILIBILI_WEB_FULLSCREEN_SELECTOR = `${BILIBILI_PLAYER_SELECTOR}[data-screen="web"]`;
const ROUTE_POLL_INTERVAL = 300;

// 纯音频模式必须在页面脚本运行前决定是否安装拦截器，因此只在视频页启动。
if (getPageRoute() === "video") {
  audioOnlyController.start();
}

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

let mounted = false;

function mount(): void {
  if (mounted) {
    return;
  }

  if (document.getElementById(HOST_ID)) {
    mounted = true;
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

  mounted = true;
  syncRouteVisibility(host);

  // SPA 路由变化：在空间页之间跳转时同步显示/隐藏 UI。
  let currentHref = location.href;
  const routeWatcher = window.setInterval(() => {
    if (location.href === currentHref) {
      return;
    }

    currentHref = location.href;
    syncRouteVisibility(host);
  }, ROUTE_POLL_INTERVAL);

  window.addEventListener(
    "pagehide",
    (event) => {
      if (event.persisted) {
        return;
      }

      window.clearInterval(routeWatcher);
      stopObservingWebFullscreen();
      stopIsolatingKeyboardEvents();
      engine.stop();
      render(null, mountPoint);
    },
    { once: true },
  );
}

function syncRouteVisibility(host: HTMLElement): void {
  host.toggleAttribute("data-outside-route", !supportsPlayerUi());
}

function start(): void {
  if (supportsPlayerUi()) {
    mount();
    return;
  }

  // 其它 space 页保持惰性：只等路由真正切到收藏页再挂载。
  let currentHref = location.href;
  const pendingRouteWatcher = window.setInterval(() => {
    if (location.href === currentHref) {
      return;
    }

    currentHref = location.href;
    if (!supportsPlayerUi()) {
      return;
    }

    window.clearInterval(pendingRouteWatcher);
    mount();
  }, ROUTE_POLL_INTERVAL);
}

if (document.documentElement) {
  start();
} else {
  document.addEventListener("readystatechange", start, { once: true });
}
