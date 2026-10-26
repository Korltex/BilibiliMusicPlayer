# 当前状态

> 记录范围：当前检出工作区；核对日期：2026-10-26。本文不代表安装、用户验收或发布状态。

## 当前目标

当前已确认的产品目标是「歌单恢复」：刷新、关闭播放器、关闭标签页或重开浏览器后，恢复上次使用的歌单，并在选择器与曲目列表里体现；自然播放结束、切歌失败、关闭页面都不得把歌单重置为默认歌单；恢复只恢复歌单选择，不自动播放，且不得破坏既有的跨页面续播。选择口径为**全局记住**（`AppData.activePlaylistId`），并接受一次写入与跨标签广播。任务未授权提交或发布。

## 进展

- 根因：`selectPlaylist()` 只写 `sessionStorage` 会话，从不写 `AppData.activePlaylistId`，因此新会话（新标签页 / 重开浏览器）只能回落到默认歌单；同标签页刷新本来就正常。
- 修改 [store.ts](../../src/app/store.ts)：`selectPlaylist()` 在共享值不同时用一次 `commitLibrary()` 写入 `activePlaylistId`（相同则跳过，避免多余写入与广播），随后重置本标签页会话；`createPlaylist()` / `importPlaylist()` 把「歌单写入 + 恢复目标」合并成同一次 `commitLibrary()`；`removePlaylist()` 在删除后修正悬空的 `activePlaylistId`（回退到第一张剩余歌单）。新增私有助手 `applyActivePlaylist()` / `resetSessionPlaylist()`。
- 未改动存储结构与 userscript 元数据：沿用既有 `AppData.activePlaylistId` 字段，无迁移。恢复取值顺序仍由 `resolvePlaylistId()` 决定：会话 → 共享 `activePlaylistId` → 第一张歌单。
- 新增 [playlist-restore.spec.ts](../../tests/e2e/playlist-restore.spec.ts) 6 条 e2e（选择持久化、同标签页刷新、新标签页、关闭标签页重开、记录歌单被删的回退、既有 `resumeRequested` 续播不被破坏），并在 [playback-session.test.ts](../../tests/playback-session.test.ts) 增加 3 条单元测试（新会话用共享记录、会话歌单被删时回退、全部无效时回退第一张）。
- 文档同步：[architecture.md](../architecture.md) 存储与多标签页两节改为「播放状态与媒体控制各标签页独立，当前歌单选择全局共享」；[AI-CONTEXT.md](../AI-CONTEXT.md) §6.6 存储表补 `activePlaylistId` 行与恢复顺序说明。

## 验证

- `npm run build` 通过（`tsc --noEmit` + vite build + 构建审计）：`[userscript audit] passed: 5 pinned runtimes, 235117 bytes, longest line 730`。
- 单元测试 **203/203** 通过（新增 3 条）；类型检查 `tsc --noEmit` 通过。
- 默认 e2e **149/149 全部通过**。
- 新增的 6 条 e2e 做过红→绿验证：`git stash` 掉 `src/app/store.ts` 后重建，第 1/3/4/5 条失败（4 失败 2 通过），恢复改动后 6/6 通过。
- 版本号断言做过陈旧构建验证：把 `dist` 里的内联 `var version` 临时改成 `0.1.9` 后，该用例失败；还原后通过。这条断言用于发现「改了版本号但忘记重新构建 dist」。
- 上述验证均为本地自动化检查，不代表用户验收或发布。

## 阻塞

- 无已确认的阻塞。

## 下一步

- 等待用户验收歌单恢复行为；如需发布（版本号、提交、推送）需另行授权。
- 已知边界：多标签页共享「上次使用的歌单」为最后写入者生效，其它标签页的选择器在下一次新会话时才跟随。

## 证据入口

- 项目用途和使用前提：[README.md](../../README.md)
- 架构事实：[architecture.md](../architecture.md)
- 测试步骤：[testing.md](../testing.md)
- 长参考（路由门控、引擎状态机、测试覆盖）：[AI-CONTEXT.md](../AI-CONTEXT.md)
- 版本与命令来源：[package.json](../../package.json)
