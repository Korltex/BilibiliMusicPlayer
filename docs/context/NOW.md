# 当前状态

> 记录范围：当前检出工作区；核对日期：2026-10-18。本文不代表安装、用户验收或发布状态。

## 当前目标

最近一轮已确认的产品目标是「B 站首页也能打开播放器」：在 `https://www.bilibili.com/` 显示悬浮按钮，点击后可以查看、切换、新建、删除、编辑歌单与歌曲；点歌单里的歌曲跳转到对应视频页并按既有逻辑播放。视频页、列表播放页、专题页与空间收藏页的既有行为保持不变。任务未授权提交或发布。

## 进展

- 路由新增 `home`（`www.bilibili.com` 的根路径与旧版入口 `/index.html`，查询串与 hash 不影响判定）：`supportsPlayerUi(home) === true`（挂 UI）、`isPlaybackPage(home) === false`（不装纯音频拦截器、不绑定媒体）。见 [page-route.ts](../../src/bili/page-route.ts)。
- `@match` 扩为 8 条：首页 4 条（`/`、`/?*`、`/index.html`、`/index.html?*`）+ 原有的 video / list / festival / space。补 `?*` 是因为 `@match` 的 path 与**查询串整体匹配**（MDN Match patterns），`https://www.bilibili.com/` 不匹配 `/?spm_id_from=333.788.0.0`；构建审计 `scripts/audit-userscript.mjs` 的精确名单已同步，`dist/` 已重新构建，未改版本号、未提交。
- 首页不绑定页面媒体：`PlayerEngine.handleMediaChange()` 在非播放页直接 `bindMedia(null)`。现场取证（真实首页）显示初始 DOM 没有任何 `<video>`，但鼠标悬停视频卡片会插入一个正在播放的预览 `<video>`（约 248×140、blob 源）；若不拦截，面板进度/播放键与「将当前视频添加到歌单」都会指向该预览。见 [player-engine.ts](../../src/playback/player-engine.ts)。
- 悬浮按钮分支调整：空间收藏页仍直接进完整面板并打开导入弹窗；首页改走正常的 `showPanel(resolveOpenMode(...))`，按用户偏好打开（偏好为极简时先出极简条，可再展开）。见 [App.tsx](../../src/app/App.tsx)。
- 新增测试：`tests/page-route.test.ts` 的首页路由用例（含 `/?spm_id_from=…`、`?msource=…`、`/index.html?…`）、[tests/e2e/home-page.spec.ts](../../tests/e2e/home-page.spec.ts) 10 条（新增「带跟踪参数的首页」与「旧版 `/index.html` 首页」挂载用例，`openHome` 改为按 origin + pathname 路由以便覆盖任意首页形态）、真实站点用例（首页 + 专题页）见 [tests/real/real-bilibili.spec.ts](../../tests/real/real-bilibili.spec.ts)。

## 验证

- `npm run build` 通过（`tsc --noEmit` + vite build + 构建审计）；`dist/bilibili-music-player.user.js` 头部为 8 条 `@match`（首页 4 条在首位）。
- 单元测试 **200/200**、默认 e2e **143/143**（其中首页用例 10 条）、真实站点测试 **4/4**（`playwright.real.config.ts`：视频页、专题页、首页、纯音频）。
- 首页「不绑定预览媒体」这条 e2e 做过红→绿验证：临时从构建产物里去掉该判断后，该用例失败（播放键变为可用）。
- `?spm_id_from=…` 首页的修复依据是 MDN 的 Match patterns 规范（path 含查询串、`#` 片段忽略），并已用单元/e2e 锁住；`@match` 本身只有在 Tampermonkey 里才会真正生效，自动化测试只能验证运行期路由与元数据审计。
- 回归过程中发现 `player.spec.ts` 的「视口缩到 390px 后面板不越界」断言是**竞态**（读 boundingBox 早于钳制重渲染，隔离重跑 3 次有 2 次失败），已改成 `expect.poll` 等待钳制落定，修后 `--repeat-each=3` 稳定通过；这是测试取样问题，不是本次功能改动引入的行为回归。
- 上述验证均为本地/真实站点自动化检查，不代表用户验收或发布。

## 阻塞

- 无已确认的阻塞。

## 下一步

- 等待用户验收首页体验；如需发布，需另行授权（版本号、提交与发布动作都未执行）。
- 已知边界：专题页若把播放器放在 iframe 里仍不接管；首页不提供播放能力（只能管理歌单并跳转到视频页）。

## 证据入口

- 项目用途和使用前提：[README.md](../../README.md)
- 架构事实：[architecture.md](../architecture.md)
- 测试步骤：[testing.md](../testing.md)
- 长参考（路由门控、引擎状态机、测试覆盖）：[AI-CONTEXT.md](../AI-CONTEXT.md)
- 版本与命令来源：[package.json](../../package.json)
