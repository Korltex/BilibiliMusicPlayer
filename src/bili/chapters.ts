import { toEndSecond, toStartSecond } from "../core/time";

export interface VideoChapter {
  title: string;
  startTime: number;
  endTime: number;
  cover?: string;
}

export interface VideoChapterSource {
  bvid: string;
  page?: number;
  cid?: number;
}

export interface VideoChapterResult {
  cid?: number;
  chapters: VideoChapter[];
}

interface FetchVideoChapterOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
}

export async function fetchVideoChapters(
  source: VideoChapterSource,
  options: FetchVideoChapterOptions = {},
): Promise<VideoChapterResult> {
  const fetcher = options.fetcher ?? fetch;
  let cid = validPositiveInteger(source.cid) ? source.cid : undefined;

  try {
    if (cid === undefined) {
      const viewUrl = new URL("https://api.bilibili.com/x/web-interface/view");
      viewUrl.searchParams.set("bvid", source.bvid);
      const viewResponse = await fetcher(viewUrl, {
        credentials: "include",
        signal: options.signal,
      });
      const viewPayload = await readSuccessfulPayload(viewResponse);
      const pages = readRecord(viewPayload?.data)?.pages;
      const pageIndex = validPositiveInteger(source.page) ? source.page - 1 : 0;
      const selectedPage = Array.isArray(pages)
        ? readRecord(pages[pageIndex])
        : undefined;
      const resolvedCid = selectedPage?.cid;
      cid = validPositiveInteger(resolvedCid) ? resolvedCid : undefined;
    }

    if (cid === undefined) {
      return { chapters: [] };
    }

    const playerUrl = new URL("https://api.bilibili.com/x/player/wbi/v2");
    playerUrl.searchParams.set("bvid", source.bvid);
    playerUrl.searchParams.set("cid", String(cid));
    const playerResponse = await fetcher(playerUrl, {
      credentials: "include",
      signal: options.signal,
    });
    const playerPayload = await readSuccessfulPayload(playerResponse);
    const viewPoints = readRecord(playerPayload?.data)?.view_points;

    return {
      cid,
      chapters: parseVideoChapters(viewPoints),
    };
  } catch {
    return { cid, chapters: [] };
  }
}

export function parseVideoChapters(value: unknown): VideoChapter[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): VideoChapter[] => {
    const record = readRecord(entry);
    const title =
      typeof record?.content === "string" ? record.content.trim() : "";
    const rawStart = record?.from;
    const rawEnd = record?.to;

    if (
      !title ||
      typeof rawStart !== "number" ||
      typeof rawEnd !== "number" ||
      !Number.isFinite(rawStart) ||
      !Number.isFinite(rawEnd) ||
      rawStart < 0 ||
      rawEnd <= rawStart
    ) {
      return [];
    }

    const startTime = toStartSecond(rawStart);
    const endTime = toEndSecond(rawEnd);
    if (endTime <= startTime) {
      return [];
    }

    const rawCover = record?.imgUrl;
    const cover =
      typeof rawCover === "string" && rawCover.trim()
        ? rawCover.trim().replace(/^http:/i, "https:")
        : undefined;

    return [
      {
        title,
        startTime,
        endTime,
        ...(cover ? { cover } : {}),
      },
    ];
  });
}

async function readSuccessfulPayload(
  response: Response,
): Promise<Record<string, unknown> | undefined> {
  if (!response.ok) {
    return undefined;
  }

  const payload = readRecord(await response.json());
  return payload?.code === 0 ? payload : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

function validPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}
