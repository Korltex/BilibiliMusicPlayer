/*
 * 外部来源适配层共用的 HTTP 小工具（无副作用、可在 node 环境单测）。
 * 收藏夹与合集两条链路都复用这里的限流、中止与响应读取逻辑。
 */

export function readRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}

export function createAbortError(): Error {
  return Object.assign(new Error("已中止导入"), { name: "AbortError" });
}

export function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const onAbort = () => {
      clearTimeout(timer);
      reject(createAbortError());
    };

    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/** 800ms ~ 1500ms 随机延迟，降低翻页连打触发风控的概率。 */
export function randomDelay(signal: AbortSignal | undefined): Promise<void> {
  return sleep(800 + Math.random() * 700, signal);
}

export function asNetworkError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}
