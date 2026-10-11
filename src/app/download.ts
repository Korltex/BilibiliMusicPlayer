/**
 * 触发一次本地文件下载。
 *
 * 立刻 `revokeObjectURL` 会打断部分浏览器的下载，因此延后释放这次性的 blob URL。
 */
export function downloadTextFile(fileName: string, text: string): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
