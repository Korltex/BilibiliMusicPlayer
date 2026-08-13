const BILIBILI_API_ORIGIN = "https://api.bilibili.com";

export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
  cover?: string;
}

export interface VideoChapterReference {
  bvid: string;
  page?: number;
  cid?: number;
}

export interface VideoChapterResult {
  cid?: number;
  chapters: VideoChapter[];
}

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function readVideoChapters(
  reference: VideoChapterReference,
  options: { signal?: AbortSignal; fetch?: FetchLike } = {},
): Promise<VideoChapterResult> {
  const request = options.fetch ?? fetch;
  let cid = validPositiveInteger(reference.cid);

  if (cid === undefined) {
    try {
      cid = await readPageCid(reference, request, options.signal);
    } catch {
      return { chapters: [] };
    }
  }

  if (cid === undefined) {
    return { chapters: [] };
  }

  try {
    const url = new URL("/x/player/wbi/v2", BILIBILI_API_ORIGIN);
    url.searchParams.set("bvid", reference.bvid);
    url.searchParams.set("cid", String(cid));
    const response = await request(url, {
      credentials: "include",
      signal: options.signal,
    });

    if (!response.ok) {
      return { cid, chapters: [] };
    }

    return {
      cid,
      chapters: parseVideoChapters(await response.json()),
    };
  } catch {
    return { cid, chapters: [] };
  }
}

export function parseVideoChapters(payload: unknown): VideoChapter[] {
  if (!isRecord(payload) || payload.code !== 0 || !isRecord(payload.data)) {
    return [];
  }

  const viewPoints = payload.data.view_points;
  if (!Array.isArray(viewPoints)) {
    return [];
  }

  return viewPoints.flatMap((viewPoint) => {
    if (!isRecord(viewPoint)) {
      return [];
    }

    const title =
      typeof viewPoint.content === "string" ? viewPoint.content.trim() : "";
    const rawStart = viewPoint.from;
    const rawEnd = viewPoint.to;
    if (
      !title ||
      typeof rawStart !== "number" ||
      !Number.isFinite(rawStart) ||
      rawStart < 0 ||
      typeof rawEnd !== "number" ||
      !Number.isFinite(rawEnd) ||
      rawEnd <= rawStart
    ) {
      return [];
    }

    const startTime = Math.floor(rawStart);
    const endTime = Math.ceil(rawEnd);
    if (endTime <= startTime) {
      return [];
    }

    const cover =
      typeof viewPoint.imgUrl === "string" && viewPoint.imgUrl.trim()
        ? viewPoint.imgUrl.trim()
        : undefined;
    return [{ title, startTime, endTime, cover }];
  });
}

async function readPageCid(
  reference: VideoChapterReference,
  request: FetchLike,
  signal?: AbortSignal,
): Promise<number | undefined> {
  const url = new URL("/x/web-interface/view", BILIBILI_API_ORIGIN);
  url.searchParams.set("bvid", reference.bvid);
  const response = await request(url, {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    return undefined;
  }

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.code !== 0 || !isRecord(payload.data)) {
    return undefined;
  }

  const pages = payload.data.pages;
  if (!Array.isArray(pages)) {
    return undefined;
  }

  const requestedPage = validPositiveInteger(reference.page) ?? 1;
  const matchingPage = pages.find(
    (page) => isRecord(page) && page.page === requestedPage,
  );
  return isRecord(matchingPage)
    ? validPositiveInteger(matchingPage.cid)
    : undefined;
}

function validPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
