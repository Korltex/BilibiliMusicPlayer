# 当前状态

> 记录范围：当前检出工作区；核对日期：2026-10-27。本文不代表安装、用户验收或发布状态。

## 当前目标

本轮完成的是「歌单重命名」：在歌单工具栏的「新建歌单」与「删除当前歌单」之间增加「重命名当前歌单」按钮，点开后把选择器原地换成预填名称的输入框（自动聚焦并全选），可保存或取消；空名称不可保存；重名允许；保存只改名称，不影响歌曲、当前选中歌单与正在播放的会话。

上一轮已完成的「歌单恢复」仍是当前有效行为（见下）：刷新、关闭播放器、关闭标签页或重开浏览器后恢复上次使用的歌单；恢复只恢复歌单选择，不自动播放，不破坏跨页面续播。选择口径为**全局记住**（`AppData.activePlaylistId`）。任务未授权提交或发布。

## 进展

### 歌单重命名（本轮）

- [store.ts](../../src/app/store.ts) 新增 `renamePlaylist(playlistId, name)`：`trim()` 后为空或与原名相同直接返回（不写存储、不广播），否则一次 `commitLibrary()` 只改 `name` 与 `updatedAt`。
- [App.tsx](../../src/app/App.tsx) 歌单工具栏改为二选一渲染：常态是「选择器 + 新建 + 重命名（`Pencil` 15，与「编辑歌曲」同一图标组件）+ 删除」；编辑态整体换成 `<form class="playlist-toolbar">`，内含预填并自动全选名称的输入框、「保存歌单名称」「取消重命名」。Enter 提交、Escape 取消、名称 trim 后为空时保存禁用；重命名与「新建歌单」输入行互斥，切换歌单自动退出编辑态。
- [styles.css](../../src/styles.css) 给 `.playlist-toolbar` 补 `margin: 0`（编辑态它是 `<form>`），新增 `.playlist-toolbar input` 与 `:focus`，与选择器同高 32px、同 `flex: 1`，切换编辑态时工具栏高度不变。
- 新增 [playlist-rename.spec.ts](../../tests/e2e/playlist-rename.spec.ts) 9 条 e2e：按钮顺序与 `title`、原地编辑与预填全选、Enter/取消、空白名称禁用、单歌单可改名、重名允许、保存只改名称（`id`/`createdAt`/`tracks`/选中歌单不变、`updatedAt` 更新）、重命名期间播放会话不动、下次会话名称保留、全程不弹原生 `dialog`。
- 无存储结构、无迁移、无 userscript 元数据改动；未改新建/删除/编辑歌曲的既有行为。
- 文档同步：[architecture.md](../architecture.md) 持久化一节补重命名口径；[AI-CONTEXT.md](../AI-CONTEXT.md) §6.7 新增「歌单工具栏」段落、§8 测试清单补 `playlist-restore.spec.ts` 与 `playlist-rename.spec.ts`。

### 歌单恢复（上一轮，仍然有效）

- 根因：`selectPlaylist()` 原本只写 `sessionStorage` 会话，从不写 `AppData.activePlaylistId`，因此新会话（新标签页 / 重开浏览器）只能回落到默认歌单；同标签页刷新本来就正常。
- [store.ts](../../src/app/store.ts)：`selectPlaylist()` 在共享值不同时用一次 `commitLibrary()` 写入 `activePlaylistId`，随后重置本标签页会话；`createPlaylist()` / `importPlaylist()` 把「歌单写入 + 恢复目标」合并成同一次写入；`removePlaylist()` 修正悬空的 `activePlaylistId`。新增私有助手 `applyActivePlaylist()` / `resetSessionPlaylist()`。
- 未改动存储结构与 userscript 元数据：沿用既有 `AppData.activePlaylistId` 字段，无迁移。恢复取值顺序仍由 `resolvePlaylistId()` 决定：会话 → 共享 `activePlaylistId` → 第一张歌单。
- 新增 [playlist-restore.spec.ts](../../tests/e2e/playlist-restore.spec.ts) 6 条 e2e，并在 [playback-session.test.ts](../../tests/playback-session.test.ts) 增加 3 条单元测试。

## 验证

- `npx tsc --noEmit` 通过；`npx prettier --check` 对改动文件无差异。
- 单元测试 **203/203** 通过。
- `npm run build` 通过：`[userscript audit] passed: 5 pinned runtimes, 239077 bytes, longest line 730`。
- 默认 e2e **158/158 全部通过**（149 条既有 + 9 条重命名）。
- 布局实测（Playwright 量取）：420px 视口下工具栏 394×48，选择器 253 + 三个 34px 按钮，`scrollWidth === clientWidth`；编辑态输入框 292 + 两个按钮，高度仍 48（不跳）。320px 视口下工具栏 294 宽，选择器 153 + 三个 34px 按钮，编辑态输入框 192，均无横向溢出。
- 歌单恢复的 6 条 e2e 曾做红→绿验证（stash 掉 `store.ts` 后 4 失败），版本号断言做过陈旧构建验证。
- 上述验证均为本地自动化检查，不代表用户验收或发布。

## 阻塞

- 无已确认的阻塞。

## 下一步

- 等待用户验收歌单重命名与歌单恢复行为；如需发布（版本号、提交、推送）需另行授权。
- 已知边界：多标签页共享「上次使用的歌单」为最后写入者生效，其它标签页的选择器在下一次新会话时才跟随。

## 证据入口

- 项目用途和使用前提：[README.md](../../README.md)
- 架构事实：[architecture.md](../architecture.md)
- 测试步骤：[testing.md](../testing.md)
- 长参考（路由门控、引擎状态机、测试覆盖）：[AI-CONTEXT.md](../AI-CONTEXT.md)
- 版本与命令来源：[package.json](../../package.json)
