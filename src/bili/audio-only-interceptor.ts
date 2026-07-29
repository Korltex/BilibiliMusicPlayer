import {
  isPlayurlUrl,
  rewritePlayurlPayload,
  rewritePlayurlText,
  type PlayurlRewriteReason,
} from "./playurl-rewriter";

export type AudioOnlyInterceptionReason =
  | PlayurlRewriteReason
  | "fetch-rewrite-failed"
  | "playinfo-nonconfigurable"
  | "playinfo-rewrite-failed"
  | "xhr-rewrite-failed"
  | "unsupported-response-type";

export interface AudioOnlyInterceptionOutcome {
  supported: boolean;
  reason: AudioOnlyInterceptionReason;
}

type PageWindow = Window &
  typeof globalThis & {
    __playinfo__?: unknown;
  };

type OutcomeListener = (outcome: AudioOnlyInterceptionOutcome) => void;

interface XhrState {
  url: string;
  processed: boolean;
  response?: unknown;
  text?: string;
}

const INSTALL_KEY = Symbol.for("bilibili-music-player:audio-only-interceptors");

export function installAudioOnlyInterceptors(
  pageWindow: PageWindow,
  onOutcome: OutcomeListener,
): void {
  const installTarget = pageWindow as unknown as Record<PropertyKey, unknown>;
  if (installTarget[INSTALL_KEY]) {
    return;
  }

  Object.defineProperty(installTarget, INSTALL_KEY, {
    configurable: false,
    value: true,
  });

  installPlayinfoInterceptor(pageWindow, onOutcome);
  installFetchInterceptor(pageWindow, onOutcome);
  installXhrInterceptor(pageWindow, onOutcome);
}

function installPlayinfoInterceptor(
  pageWindow: PageWindow,
  onOutcome: OutcomeListener,
): void {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(
      pageWindow,
      "__playinfo__",
    );
    if (descriptor && !descriptor.configurable) {
      onOutcome({
        supported: false,
        reason: "playinfo-nonconfigurable",
      });
      return;
    }

    let playinfo = descriptor?.get
      ? descriptor.get.call(pageWindow)
      : descriptor?.value;
    if (playinfo !== undefined) {
      const result = rewritePlayurlPayload(playinfo);
      playinfo = result.value;
      reportRewriteResult(result, onOutcome);
    }

    Object.defineProperty(pageWindow, "__playinfo__", {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get: () => playinfo,
      set: (value: unknown) => {
        try {
          const result = rewritePlayurlPayload(value);
          playinfo = result.value;
          reportRewriteResult(result, onOutcome);
        } catch {
          playinfo = value;
          onOutcome({
            supported: false,
            reason: "playinfo-rewrite-failed",
          });
        }
      },
    });
  } catch {
    onOutcome({
      supported: false,
      reason: "playinfo-rewrite-failed",
    });
  }
}

function installFetchInterceptor(
  pageWindow: PageWindow,
  onOutcome: OutcomeListener,
): void {
  const rawFetch = pageWindow.fetch;
  if (typeof rawFetch !== "function") {
    return;
  }

  pageWindow.fetch = async function (
    this: typeof pageWindow,
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = requestUrl(pageWindow, input);
    const response = await Reflect.apply(rawFetch, this, [input, init]);
    if (!isPlayurlUrl(url)) {
      return response;
    }

    try {
      const text = await response.clone().text();
      const result = rewritePlayurlText(url, text);
      reportRewriteResult(result, onOutcome);
      if (!result.changed) {
        return response;
      }

      return createRewrittenResponse(pageWindow, response, result.value);
    } catch {
      onOutcome({
        supported: false,
        reason: "fetch-rewrite-failed",
      });
      return response;
    }
  };
}

function installXhrInterceptor(
  pageWindow: PageWindow,
  onOutcome: OutcomeListener,
): void {
  const XHR = pageWindow.XMLHttpRequest;
  if (!XHR) {
    return;
  }

  const prototype = XHR.prototype;
  const responseDescriptor = Object.getOwnPropertyDescriptor(
    prototype,
    "response",
  );
  const responseTextDescriptor = Object.getOwnPropertyDescriptor(
    prototype,
    "responseText",
  );
  if (
    !responseDescriptor?.configurable ||
    !responseDescriptor.get ||
    !responseTextDescriptor?.configurable ||
    !responseTextDescriptor.get
  ) {
    onOutcome({
      supported: false,
      reason: "xhr-rewrite-failed",
    });
    return;
  }

  const states = new WeakMap<XMLHttpRequest, XhrState>();
  const rawOpen = prototype.open;
  const rawResponseGet = responseDescriptor.get;
  const rawResponseTextGet = responseTextDescriptor.get;

  try {
    Object.defineProperty(prototype, "response", {
      ...responseDescriptor,
      get(this: XMLHttpRequest) {
        const original = rawResponseGet.call(this);
        return rewriteXhrValue(
          pageWindow,
          this,
          original,
          states,
          onOutcome,
          "response",
        );
      },
    });

    Object.defineProperty(prototype, "responseText", {
      ...responseTextDescriptor,
      get(this: XMLHttpRequest) {
        // Keep the native exception for non-text response types.
        const original = rawResponseTextGet.call(this);
        return rewriteXhrValue(
          pageWindow,
          this,
          original,
          states,
          onOutcome,
          "text",
        );
      },
    });

    prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      states.set(this, {
        url: String(url),
        processed: false,
      });
      return Reflect.apply(rawOpen, this, [method, url, ...rest]);
    } as typeof prototype.open;
  } catch {
    onOutcome({
      supported: false,
      reason: "xhr-rewrite-failed",
    });
  }
}

function rewriteXhrValue(
  pageWindow: PageWindow,
  xhr: XMLHttpRequest,
  original: unknown,
  states: WeakMap<XMLHttpRequest, XhrState>,
  onOutcome: OutcomeListener,
  requestedValue: "response" | "text",
): unknown {
  const state = states.get(xhr);
  if (
    !state ||
    xhr.readyState !== pageWindow.XMLHttpRequest.DONE ||
    !isPlayurlUrl(state.url)
  ) {
    return original;
  }

  if (!state.processed) {
    state.processed = true;
    try {
      switch (xhr.responseType) {
        case "":
        case "text": {
          const text = String(original ?? "");
          const result = rewritePlayurlText(state.url, text);
          reportRewriteResult(result, onOutcome);
          state.text = result.value;
          state.response = result.value;
          break;
        }
        case "json": {
          const result = rewritePlayurlPayload(original);
          reportRewriteResult(result, onOutcome);
          state.response = result.value;
          break;
        }
        case "arraybuffer": {
          if (!(original instanceof pageWindow.ArrayBuffer)) {
            state.response = original;
            onOutcome({
              supported: false,
              reason: "xhr-rewrite-failed",
            });
            break;
          }

          const text = new pageWindow.TextDecoder("utf-8").decode(original);
          const result = rewritePlayurlText(state.url, text);
          reportRewriteResult(result, onOutcome);
          state.response = result.changed
            ? new pageWindow.TextEncoder().encode(result.value).buffer
            : original;
          break;
        }
        default:
          state.response = original;
          onOutcome({
            supported: false,
            reason: "unsupported-response-type",
          });
      }
    } catch {
      state.response = original;
      onOutcome({
        supported: false,
        reason: "xhr-rewrite-failed",
      });
    }
  }

  return requestedValue === "text" ? state.text : state.response;
}

function requestUrl(pageWindow: PageWindow, input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof pageWindow.URL) {
    return input.href;
  }
  return input.url;
}

function createRewrittenResponse(
  pageWindow: PageWindow,
  original: Response,
  text: string,
): Response {
  const headers = new pageWindow.Headers(original.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");

  const rewritten = new pageWindow.Response(text, {
    status: original.status,
    statusText: original.statusText,
    headers,
  });

  for (const property of ["url", "redirected", "type"] as const) {
    try {
      Object.defineProperty(rewritten, property, {
        configurable: true,
        value: original[property],
      });
    } catch {
      // Metadata preservation is best-effort and does not affect the body.
    }
  }

  return rewritten;
}

function reportRewriteResult(
  result: {
    supported: boolean;
    reason: PlayurlRewriteReason;
  },
  onOutcome: OutcomeListener,
): void {
  onOutcome({
    supported: result.supported,
    reason: result.reason,
  });
}
