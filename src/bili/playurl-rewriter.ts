export type PlayurlRewriteReason =
  | "rewritten"
  | "already-audio-only"
  | "durl-only"
  | "missing-dash"
  | "missing-audio"
  | "invalid-payload"
  | "invalid-json"
  | "not-playurl";

export interface PlayurlRewriteResult<T = unknown> {
  value: T;
  changed: boolean;
  supported: boolean;
  reason: PlayurlRewriteReason;
}

export interface PlayurlTextRewriteResult extends PlayurlRewriteResult<string> {}

type JsonRecord = Record<string, unknown>;

const PLAYURL_PATH = /^\/x\/player\/(?:wbi\/)?playurl\/?$/;

export function isPlayurlUrl(url: unknown): boolean {
  if (typeof url !== "string" || !url) {
    return false;
  }

  try {
    return PLAYURL_PATH.test(new URL(url, "https://www.bilibili.com").pathname);
  } catch {
    return false;
  }
}

export function rewritePlayurlText(
  url: unknown,
  text: string,
): PlayurlTextRewriteResult {
  if (!isPlayurlUrl(url)) {
    return {
      value: text,
      changed: false,
      supported: false,
      reason: "not-playurl",
    };
  }

  try {
    const result = rewritePlayurlPayload(JSON.parse(text));
    return {
      ...result,
      value: result.changed ? JSON.stringify(result.value) : text,
    };
  } catch {
    return {
      value: text,
      changed: false,
      supported: false,
      reason: "invalid-json",
    };
  }
}

export function rewritePlayurlPayload(payload: unknown): PlayurlRewriteResult {
  if (!isRecord(payload)) {
    return unchanged(payload, "invalid-payload");
  }

  const dashPaths = [
    ["data", "dash"],
    ["result", "dash"],
    ["data", "video_info", "dash"],
  ] as const;
  const dashCandidates = dashPaths
    .map((path) => getPath(payload, path))
    .filter(isRecord);

  if (dashCandidates.length === 0) {
    return unchanged(
      payload,
      containsDurl(payload) ? "durl-only" : "missing-dash",
    );
  }

  let hasAudio = false;
  let alreadyAudioOnly = false;
  const clone = cloneValue(payload);
  let changed = false;

  for (const path of dashPaths) {
    const sourceDash = getPath(payload, path);
    const targetDash = getPath(clone, path);
    if (!isRecord(sourceDash) || !isRecord(targetDash)) {
      continue;
    }

    if (!Array.isArray(sourceDash.audio) || sourceDash.audio.length === 0) {
      continue;
    }

    hasAudio = true;
    if (!Array.isArray(sourceDash.video)) {
      continue;
    }

    if (sourceDash.video.length === 0) {
      alreadyAudioOnly = true;
      continue;
    }

    targetDash.video = [];
    changed = true;
  }

  if (changed) {
    return {
      value: clone,
      changed: true,
      supported: true,
      reason: "rewritten",
    };
  }

  if (alreadyAudioOnly) {
    return {
      value: payload,
      changed: false,
      supported: true,
      reason: "already-audio-only",
    };
  }

  return unchanged(payload, hasAudio ? "missing-dash" : "missing-audio");
}

function unchanged<T>(
  value: T,
  reason: Exclude<
    PlayurlRewriteReason,
    "rewritten" | "already-audio-only" | "invalid-json" | "not-playurl"
  >,
): PlayurlRewriteResult<T> {
  return {
    value,
    changed: false,
    supported: false,
    reason,
  };
}

function containsDurl(payload: JsonRecord): boolean {
  return [
    ["data", "durl"],
    ["result", "durl"],
    ["data", "video_info", "durl"],
  ].some((path) => Array.isArray(getPath(payload, path)));
}

function getPath(value: unknown, path: readonly string[]): unknown {
  let current = value;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneValue<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (!value || typeof value !== "object") {
    return value;
  }

  const cached = seen.get(value);
  if (cached) {
    return cached as T;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (const item of value) {
      clone.push(cloneValue(item, seen));
    }
    return clone as T;
  }

  const clone: JsonRecord = {};
  seen.set(value, clone);
  for (const [key, item] of Object.entries(value)) {
    clone[key] = cloneValue(item, seen);
  }
  return clone as T;
}
