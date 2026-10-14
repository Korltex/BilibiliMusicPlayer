# AI 项目上下文说明（给其他人工智能阅读）

> 本文档的目的：让一个没有上下文的全新 AI 代理，在只读这一份文件的情况下，快速、准确地理解本项目「是什么、怎么跑、代码放在哪、有哪些不能违反的约束」。
> 它不替代 `docs/architecture.md`（架构）与 `docs/testing.md`（测试），而是把两者与源码事实合并成一份「自然语言 + 关键标识符」的入口文档。
> 文中所有具体数值、键名、函数名均来自当前工作区源码，不是推测。

---

## 1. 一句话定义

这是一个**运行在浏览器用户脚本引擎（篡改猴 Tampermonkey）里的 Bilibili 网页版音乐播放器**：
它在 B 站视频页面上注入一个悬浮在 Shadow DOM 里的播放器面板，允许用户把 B 站视频（或视频中的一段时间片段）收藏成自己的歌单，然后用「切歌、循环、随机、跨视频播放」的方式把 B 站当作音乐播放器使用。

它**不是**下载器、不是音频提取器、不是第三方 B 站客户端。它不请求播放地址，也不保存任何媒体文件，只操作页面里**已经存在**的 `<video>`/`<audio>` 元素（`play()` / `pause()` / `currentTime` / `volume`）。

---

## 2. 事实卡（AI 速查）

| 项目         | 值                                                                                                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 产物形态     | 单个用户脚本 `dist/bilibili-music-player.user.js`（`dist/` 已被 git 跟踪）                                                                                                    |
| 技术栈       | TypeScript（strict）+ Preact 10 + `@preact/signals` + Vite + `vite-plugin-monkey`                                                                                             |
| 包名 / 版本  | `bilibili-music-player` / `0.1.9`（`package.json`，用户脚本头部 `@version` 必须与之一致）                                                                                     |
| 作者 / 许可  | Korltex / MIT                                                                                                                                                                 |
| 匹配范围     | `https://www.bilibili.com/video/*` 与 `https://space.bilibili.com/*`（后者只在空间收藏页 `favlist` 挂载 UI，其它空间页保持惰性）                                              |
| 注入时机     | `@run-at document-start`；`@noframes`                                                                                                                                         |
| 外部运行时   | Preact / preact-hooks / jsx-runtime / signals-core / signals，全部走 jsDelivr 固定版本 URL + `#sha256=…` 子资源校验（清单见 `scripts/userscript-runtime.json`）               |
| 运行环境 API | `$` 虚拟模块提供的 `GM_getValue` / `GM_setValue` / `GM_addValueChangeListener` / `GM_removeValueChangeListener` / `unsafeWindow`                                              |
| 包管理器命令 | `npm run build`（`tsc --noEmit` → `vite build` → 构建审计）、`npm test`（Vitest）、`npm run test:e2e`（Playwright，需先 build）、`npm run test:e2e:real`（真实 B 站烟雾测试） |
| 代码规模     | `src/` 约 26 个文件；核心是 `src/playback/player-engine.ts`、`src/app/App.tsx`、`src/app/store.ts`                                                                            |
| 主要语言     | 源码注释与 UI 文案为简体中文；UI 文案在 `vite.config.ts` 中声明了 `zh-CN` / `zh-TW` / `en` 三语元数据                                                                         |

---

## 3. 硬约束（先看这一节，能避免大半错误改动）

1. **只控制现有播放器。** 不允许主动请求 `playurl`、不允许解析 DASH 分片、不允许下载或缓存媒体文件。唯一例外是「纯音频模式」的响应改写（见第 6.5 节），它也只改写页面**已经拿到**的清单，不新增请求。
2. **不依赖 B 站私有播放器对象。** 定位播放器只能靠 DOM（`video, audio` 元素 + 打分），不能依赖 B 站内部 JS 实例或未公开字段。
3. **B 站接口字段不得进入播放核心。** `Track` 是唯一的核心数据契约；未来接入收藏夹/合集时，必须在独立的 `src/sources/` 适配层把接口数据转换成 `Track`。
4. **构建产物必须保持「人类可读、未压缩」。** Greasy Fork 要求：`minify: false`、`cssMinify: false`、CSS 以可读字符串数组形式内联、最长行 ≤ 1000 字符、总体积 ≤ 2 MB。`scripts/audit-userscript.mjs` 会硬性校验这些，违反即构建失败。
5. **禁止动态代码。** 构建审计禁止 `eval(`、`new Function(`、`createElement("script")`。
6. **新增第三方依赖要过审计。** 依赖必须是 `package.json` 中的直接依赖并锁定精确版本，同时登记到 `scripts/userscript-runtime.json`（模块名、全局变量名、jsDelivr URL、本地文件路径、版本）和 `THIRD_PARTY_NOTICES.txt`。图标不允许打包 `lucide-preact`，图标是手写内联在 `src/app/icons.tsx` 里的。
7. **存储结构必须向后兼容。** 所有持久化数据都带 `version` 字段；字段变更要在 `src/storage/*-schema.ts` 中写迁移逻辑，直接改结构会丢用户歌单。
8. **不改 B 站页面本身的行为（除纯音频模式外）。** 纯音频模式关闭时，不得覆盖任何页面网络 API。
9. **歌单备份导入必须「失败即停」。** 校验只能走 `storage/backup.ts` 的 `parsePlaylistBackup()`，**不得**用 `migrateAppData()` 兜底（它对非法输入会静默回退成默认空歌单，用在导入上等于悄悄清空用户歌单）；解析失败、读取失败、用户取消都必须保留当前歌单库。导入是**全量覆盖**，只写 `bilibili-music-player:data`（经 `AppStore.replaceLibrary()` 一次写入），不得改写 `audio-only`、`layout`、`settings` 等其它键。

---

## 4. 目录地图与模块职责

```text
src/
├── entry.tsx                    入口：Shadow DOM 挂载、Web 全屏隐藏、键盘事件隔离、生命周期清理
├── styles.css                   播放器全部样式（注入 Shadow DOM，与页面样式隔离）
├── app/                         Preact UI + 应用状态 + 本地布局
│   ├── App.tsx                  主界面（四种显示形态 + 完整面板 + 歌曲编辑器 + 设置接线）
│   ├── ConfirmModal.tsx         插件内确认弹窗（删除歌单 / 删除歌曲，替代 window.confirm）
│   ├── ImportFavModal.tsx       「批量导入」弹窗（收藏夹 / 合集 / 视频选集）
│   ├── SettingsPanel.tsx        设置视图（窗口与外观 / 数据管理 / 关于，三个可折叠分区）
│   ├── BackupModal.tsx          「导入歌单」弹窗（本地 JSON 备份的全量覆盖二次确认）
│   ├── download.ts              触发本地文件下载（blob URL，延后释放）
│   ├── minimal-player.tsx       单行极简播放器
│   ├── player-controls.tsx      共用传输控件条（完整/极简两种 variant）
│   ├── store.ts                 AppStore：两个 signal（共享数据 / 本标签页会话）+ 持久化写入门面
│   ├── use-draggable-position.ts / draggable-position.ts  指针拖动与视口内钳制
│   ├── use-track-reorder.ts     歌曲行全局长按拖动排序（自动滚动 + 键盘）
│   ├── track-order.ts           纯函数：数组内移动歌曲（插入位语义、键盘移动、落点归一化）
│   ├── track-selection.ts       纯函数：按 track.id 维护多选集合（切换/全选/清理失效 id/按列表序解析）
│   ├── playback-progress.ts     环形进度百分比计算
│   └── icons.tsx                内联 SVG 图标
├── bili/                        B 站页面适配层（唯一允许接触页面细节的地方）
│   ├── media-locator.ts         发现并跟踪当前媒体元素
│   ├── metadata.ts              读取 bvid / 分P / 标题 / UP 主 / 封面，构造 Track
│   ├── page-route.ts            纯函数：判定页面路由（视频页 / 空间收藏页 / 其它），决定是否挂载 UI
│   ├── chapters.ts              调用 B 站公开 API 拉取视频章节（亮点）
│   ├── video-cover.ts           按 bvid 从 `view` 接口取封面 + 缩略图 + 缓存/退避（可单测，失败开放）
│   ├── audio-only-controller.ts 纯音频模式的开关、状态机与页面表现
│   ├── audio-only-interceptor.ts `__playinfo__` / fetch / XHR 拦截安装
│   └── playurl-rewriter.ts      纯函数：把 playurl 响应改写成「仅音频」（可单测）
├── sources/                     外部来源（收藏夹 / 视频合集 / 单个视频）→ `Track` 的适配层
│   ├── import-url.ts            纯函数：统一解析导入链接（收藏夹 / 合集 / 视频）为目标结构，可单测
│   ├── bilibili-fav.ts          收藏夹分页拉取、失效过滤、多P 拆分、映射为 Track（可单测）
│   ├── bilibili-season.ts       视频合集 season 拉取与映射（接口 `seasons_archives_list`；导入期**不逐条查详情**，见 6.8）
│   ├── bilibili-video.ts        视频详情 + 合集嗅探（`web-interface/view` 的 `ugc_season`）+ 分P 展开为独立 Track
│   └── http.ts                  适配层共用的随机限流、可中止 sleep、响应读取
├── core/                        无副作用基础件：types.ts / id.ts / time.ts
├── playback/                    播放逻辑（不碰 DOM 细节、不碰存储实现）
│   ├── player-engine.ts         状态机 + 媒体事件绑定 + 跨视频/恢复播放 + Media Session
│   ├── now-playing.ts           纯函数：合成当前播放条目 + 变化比较（周期性校正的去抖依据）
│   └── queue.ts                 纯函数：根据播放模式选上一首/下一首
└── storage/                     持久化与迁移
    ├── schema.ts                AppData v1 默认值与迁移（GM key: bilibili-music-player:data）
    ├── repository.ts            GM 读写 + 远端变更订阅
    ├── backup.ts                歌单备份：导出格式、文件名、严格解析与校验（纯逻辑，可单测）
    ├── playback-session.ts      PlaybackSession 迁移与 sessionStorage 仓库
    ├── layout-schema.ts / layout.ts  UI 位置与上次打开模式（GM key: bilibili-music-player:layout）
    └── settings-schema.ts / settings.ts  界面偏好：播放器打开方式与迁移（GM key: bilibili-music-player:settings）
```

依赖方向是单向的：`app → playback → bili/storage/core`，`app → sources`（外部来源适配层，被 `app` 使用），`storage` 与 `playback/queue`、`bili/playurl-rewriter`、`sources/bilibili-fav` 都是可单测的纯逻辑层。**新增功能时优先把逻辑放进纯函数模块，而不是塞进组件。**

---

## 5. 核心数据模型（`src/core/types.ts`）

```text
Track            一首歌 = 一个 B 站视频或视频中的一段
                 { id, bvid, cid?, page?, title, uploader?, cover?,
                   startTime, endTime?, duration, addedAt, source }
                 时间单位是「整秒」；startTime 向下取整、endTime 向上取整（core/time.ts）
                 endTime 省略 = 播放到视频结尾；source ∈ manual | collection | favorite

Playlist         { id, name, tracks[], createdAt, updatedAt }

PlaybackSnapshot { playlistId, trackId?, currentTime, resumeRequested, updatedAt }
                 本标签页「正在播什么、播到哪、是否需要恢复播放」

PlaybackSession  { activePlaylistId, playMode, playback }
                 本标签页会话（sessionStorage），playMode 的**权威来源**

AppData (v1)     { version:1, playlists[], activePlaylistId, playMode, volume, playback }
                 共享数据（GM 存储），跨标签页同步

NowPlayingState  { trackId?, title, uploader?, cover?, startTime, endTime?, storedDuration }
RuntimePlayerState { mediaReady, playing, currentTime, duration, volume, muted,
                     playbackContext: 'page'|'playlist', nowPlaying,
                     requiresInteraction, message? }
                 PlayerEngine 对外暴露的只读运行时状态，UI 只渲染它
```

两个容易踩坑的点：

- **`playMode` 有两处**：`AppData.playMode`（共享存储里的历史字段/初始值）与 `PlaybackSession.playMode`（本标签页实际生效值）。`AppStore.setPlayMode()` 只写会话，因此播放模式是**每标签页独立**的。
- **`volume` 是共享的**（写入 GM 存储），但引擎只在 `bindMedia()` 时把它写回 `media.volume`；别指望别处改音量会自动推到其它标签页的媒体元素。

---

## 6. 关键机制（自然语言详解）

### 6.1 启动与挂载（`src/entry.tsx`）

脚本在 `document-start` 执行。**先判定页面路由**（`bili/page-route.ts`）：只有在视频页才调用 `audioOnlyController.start()`——纯音频模式必须在页面脚本运行前决定是否安装拦截器。随后在 `documentElement` 上创建宿主 `div#bilibili-music-player-host`，挂 `shadowRoot`，把内联样式与 `#bilibili-music-player-root` 一起塞进去，再 `render(<App/>)`。UI 与页面样式完全隔离。

**路由门控**：只有视频页与空间收藏页（`space.bilibili.com/<mid>/favlist`）会挂载 UI。其它空间页保持惰性——只留一个 300ms 的 URL 轮询，等 SPA 路由切到收藏页再挂载（从空间首页点「收藏」也能直接出现按钮，无需刷新）。挂载后同一个轮询会同步宿主上的 `data-outside-route`，离开支持的路由时用 CSS 隐藏 UI。在收藏页这类**没有播放器**的页面上，点悬浮按钮会直接进入完整面板并打开导入收藏夹弹窗。

同时做三件事：① 用 `MutationObserver` 监听 `.bpx-player-container[data-screen="web"]`，进入 B 站网页全屏时给宿主加 `data-web-fullscreen` 以隐藏自己的 UI；② 在挂载点上 `stopPropagation` 掉 `keydown`/`keyup`，避免播放器输入触发 B 站快捷键；③ 在 `pagehide`（且非 bfcache 恢复）时停止引擎并卸载。

### 6.2 媒体元素定位（`src/bili/media-locator.ts`）

B 站是 SPA，`<video>` 会被替换。`MediaLocator` 用三条互补的路径发现媒体元素：`MutationObserver`（元素增删）、每 1 秒定时扫描（补偿异步渲染）、每 300 毫秒比对 `location.href`（识别 SPA 跳转/分P切换，回调 reason = `"route"`）。

候选元素是页面里所有 `video, audio`，排除宿主内部的和 `aria-hidden="true"` 的，然后按打分取最高分：`正在播放(10^7) > 已就绪(10^6) > 有时长(10^5) > 可见面积`。只有「当前元素发生变化」时才通知 `PlayerEngine`。

### 6.3 播放引擎状态机（`src/playback/player-engine.ts`，项目的心脏）

`PlayerEngine` 是唯一在 UI、存储、媒体元素之间做协调的类，它做四件事：

1. **绑定媒体**：`bindMedia()` 用 `AbortController` 统一管理监听器（`play`/`pause`/`timeupdate`/`durationchange`/`loadedmetadata`/`volumechange`/`ended`），把元素状态同步进 `state` signal。
2. **上下文区分**：`playbackContext` 只有两个值。`"page"` = 用户在看普通视频（插件不介入切歌、不识别片段）；`"playlist"` = 插件歌单正在播放。切换依据是 URL 查询参数 **`bili_music=1`**（`hasPlaylistRouteMarker()`）加上「当前页面与目标 Track 的 bvid 与分P一致」。这个标记是「同一 BV 既在歌单里、用户又只是普通点进来」这类场景的判别关键。
3. **片段边界**：`timeupdate` 中，若当前 Track 有 `endTime` 且 `currentTime >= endTime - 0.15`，触发 `next(true)`（自动切下一首）；用 `segmentAdvancing` + 500ms 定时器防止重复触发。`ended` 事件同样走 `next(true)`。
4. **恢复播放**：`requestTrack()` 写入 `resumeRequested=true`，然后要么直接在当前页恢复，要么 `location.assign(buildTrackUrl(track))` 跳到目标视频页（URL 带 `bili_music=1`，分P用 `p` 参数）。新页面媒体就绪后 `resumeRequestedTrack()` 把 `currentTime` 设到上次进度（若进度已落出片段范围则回到 `startTime`），再 `tryPlay()`；`play()` 被浏览器拒绝时置 `requiresInteraction=true` 并给出中文提示，UI 显示「点击继续播放」。
5. **页面校正（不要把它改回一次性快照）**：`reconcilePage()` 每秒运行一次，重新评估 `playbackContext` 并调用 `refreshNowPlaying()` 重读页面元数据；结果由 `playback/now-playing.ts` 的 `resolveNowPlaying()` / `nowPlayingEquals()` 计算与比较，**没变化就不写 `state`、不重建 `MediaMetadata`**。原因：B 站同文档换视频时 URL 先变、标题/UP 主 DOM 后渲染，过去只在 route 事件和一次 1 秒重试里读 DOM，导致「面板一直显示上一个视频」；暂停时没有 `timeupdate`，所以校正必须由定时器驱动。`loadedmetadata`/`durationchange`/`play`/`pageshow`（BFCache）会额外立即校正一次。
6. **封面三层兜底（不要退化成只读 `og:image`）**：`og:image` 是首屏 SSR 写入的，同文档换视频时不保证更新，所以封面优先级是 ①`bili/video-cover.ts` 按当前 bvid 调 `view` 接口取 `pic`（转 `@120w_120h_1c.webp` 方图、按 bvid 缓存、失败退避 5 分钟）→ ② 页面分享卡片封面 `img[src*="!web-video-share-cover"]`（客户端按当前视频渲染，浏览器已缓存同一张图，不产生新请求）→ ③ `og:image` → `<video>.poster`。实测脚本发出的 `view` 请求会被 B 站风控返回 412，此时第 ② 层是主要兜底；三层都拿不到就沿用页面已有封面，绝不清空。

引擎还接管 **Media Session**（系统媒体键/锁屏控制）：`play`/`pause`/`previoustrack`/`nexttrack`/`seekto`/`seekbackward`/`seekforward` 以及元数据与进度上报，全部 `try/catch` 包裹以兼容旧浏览器。

### 6.4 队列与播放模式（`src/playback/queue.ts`）

`selectAdjacentTrack(playlist, currentTrackId, mode, { direction, automatic })` 是纯函数，四种模式：

- `sequence` 顺序播放：到边界返回 `undefined`（自动播放时引擎会 `pause()` 并退回 `page` 上下文）。
- `list-loop` 列表循环：越界回绕。
- `single-loop` 单曲循环：仅在 `automatic=true` 时返回当前曲（手动点「下一首」仍会前进）。
- `shuffle` 随机播放：在当前索引基础上加 `1..n-1` 的偏移取模，因此**长度 >1 时永不重复当前曲**。

游标不在歌单里时（`currentIndex === -1`）：`direction=1` 返回第一首，`direction=-1` 返回最后一首。

### 6.5 纯音频模式（`src/bili/`，本项目技术含量最高的部分）

目标是「只听声音、不花视频带宽」，做法是在**页面播放器之前**把 B 站自己请求到的播放清单改成只有音频：

- `installAudioOnlyInterceptors()` 在 `document-start` 一次性安装三个拦截器（用 `Symbol.for(...)` + 不可配置属性做重入保护），并且只作用于 `unsafeWindow`（页面上下文），因为改写必须在页面脚本看到数据之前完成：
  1. **`window.__playinfo__`**：用 `get`/`set` 访问器包住首屏内联播放信息，读取和写入都过一遍改写。
  2. **`fetch`**：包装后对 `/x/player/(wbi/)playurl` 的响应做 `clone().text()` → 改写 → 重建 `Response`（顺带删掉 `content-encoding`/`content-length` 并保留 `url`/`redirected`/`type`）。
  3. **`XMLHttpRequest`**：改写 `prototype.open` 记录 URL，并重写 `response` / `responseText` 的 getter，按 `responseType` 分别处理 `""`/`text`、`json`、`arraybuffer`（`TextDecoder`/`TextEncoder`），其它类型直接放弃改写并上报。
- 真正的改写逻辑在 `playurl-rewriter.ts`，是**无副作用纯函数**：只认三种已知结构（`data.dash`、`result.dash`、`data.video_info.dash`），只有在 `dash.audio` 非空时才把 `dash.video` 置空数组；输入先深拷贝（`cloneValue` 带 `WeakMap` 防环），未改写时**原样返回原对象**。
- **失败开放（fail-open）**：`durl`、缺 DASH、缺音频、畸形 JSON、非目标 URL、不可配置的 `__playinfo__`……任何异常都保持原响应，并把 `reason` 上报。`AudioOnlyController` 把结果映射为 `off → detecting → active | fallback` 状态，`fallback` 时 UI 显示「纯音频模式未生效，已回退正常视频：<原因>」，并**不会**声称节省了带宽。
- 画面隐藏只是表现层：往 `documentElement` 加 `data-bmp-audio-only="active"`，配合一段独立于 Shadow DOM 的页面级 CSS（`visibility: hidden`）只隐藏 `<video>` 画面，不动控制条。真正的带宽/解码节省来自「播放器拿不到视频分片地址」。
- 开关**双向都要整页重载**（`location.replace()`，用 `t=<整数秒>` 参数恢复进度），因为必须让 B 站重建 MSE 缓冲。这就是为什么进度恢复有两套机制：普通播放靠 URL `t` 参数，歌单播放靠 `PlaybackSnapshot`。

### 6.6 存储分层、多标签页与远端变更

| 数据                                         | 位置             | 键                                              | 作用域                                |
| -------------------------------------------- | ---------------- | ----------------------------------------------- | ------------------------------------- |
| 歌单、歌曲、音量                             | GM 存储          | `bilibili-music-player:data`                    | 所有标签页共享                        |
| 当前歌单、播放模式、当前歌曲、进度、恢复请求 | `sessionStorage` | `bilibili-music-player:playback-session`        | **单个标签页**，关闭标签页即消失      |
| UI 位置、上次打开模式                        | GM 存储          | `bilibili-music-player:layout`                  | 所有标签页共享                        |
| 界面偏好（播放器打开方式）                   | GM 存储          | `bilibili-music-player:settings`                | 所有标签页共享，**不并入 layout**     |
| 纯音频开关                                   | GM 存储          | `bilibili-music-player:audio-only`              | 启动期偏好，**不进入歌单数据结构**    |
| 歌单备份文件                                 | 用户本地磁盘     | `bilibili-music-player-playlists-<时间戳>.json` | 手动导出 / 导入，插件不自动写、不上传 |

`AppRepository.subscribe()` 用 `GM_addValueChangeListener` **只处理 `remote === true`** 的变更（避免自己写入触发回环）。收到远端歌单变更后，`PlayerEngine` 里的 `effect()` 会检查：若「活动歌单被切换」或「正在播放的歌曲已在所有歌单中被删除」，就安全退出歌单播放（清掉 `resumeRequested`、把上下文切回 `"page"`、移除 URL 标记）。其它歌单的增删改不影响本标签页播放。

**当前工作区状态（重要）**：跨标签页协调器 `src/playback/tab-coordinator.ts` 已被删除（`git status` 显示为 `D`，改动尚未提交），因此现在的行为是**各标签页完全独立播放**，互不暂停、互不覆盖进度。如果你在别处看到「同一时间只允许一个歌单播放实例」的描述，那是历史版本（commit `dc94715`）的行为。

进度写入做了节流：`timeupdate` 中最多每 10 秒保存一次，外加 `pagehide` 兜底。

### 6.7 界面形态与拖动（`src/app/App.tsx`）

四种显示形态，状态在组件内：`launcher`（圆形悬浮按钮）→ `full`（完整面板）→ `minimal`（单行极简播放器，宽 ≤400px）→ `settings`（设置视图，见 6.10）。形态切换**不改变任何播放状态**（不暂停、不跳时间、不改模式/音量/纯音频）。上次打开的形态持久化在布局存储里，默认 `full`；悬浮按钮打开哪个形态由 `settings` 里的 `openMode` 偏好决定（`remember` 时用 `lastOpenMode`）。

完整面板标题栏的按钮固定为四个：批量导入（`StarPlus`）、极简模式（`Minimize2`）、设置（`Settings` 齿轮）、收起播放器（`X`）。**「重置位置」不在标题栏**，它住在设置的「窗口与外观」里。

`useDraggablePosition("launcher" | "panel")` 实现指针拖动：4px 阈值区分点击与拖动、`setPointerCapture`、实时按视口钳制坐标（`clampPosition`）、结束后写入布局存储，并提供 `consumeSuppressedClick()` 防止拖动末尾误触发点击。完整面板、极简播放器与设置视图**共用 `panel` 坐标**；设置里的「重置位置」清空两处坐标。发生 `resize` 或元素尺寸变化时用 `ResizeObserver` 重新钳制。`panel` 额外开启 `pinDefaultAnchor`：没有已保存坐标时（首次打开或重置后）把 CSS 默认的右下角停靠位置量成显式左上角坐标，此后**面板顶边固定**，歌单内容变多/变少只让底边向下延伸或向上收起；「重置位置」后重新固化，布局存储里不会写入这组默认坐标。

`App` 里还包含歌曲编辑器（`TrackEditor`）：可改标题、起止时间，并用 `fetchVideoChapters()` 调用 B 站公开接口（`/x/web-interface/view` 解析 cid → `/x/player/wbi/v2` 取 `view_points`）识别视频章节。章节以可键盘操作的下拉列表（combobox）呈现，**选中某章即把歌名与起止时间填入表单，保存后成为一首歌（一次一首，不是批量导入）**；没有章节时仍可完全手动填写。章节解析（`parseVideoChapters`）是纯函数，只接受 `content` + 合法 `from`/`to` 的条目，封面 `http:` 会被升成 `https:`。

删除歌单 / 删除歌曲 / **批量删除歌曲**都走插件内 `ConfirmModal`（`src/app/ConfirmModal.tsx`），**不使用 `window.confirm`**：工具栏垃圾桶按钮、歌曲行垃圾桶按钮、批量操作栏的【删除】只把待删对象写进 `playlistPendingDeletion` / `trackPendingDeletion` / `batchPendingDeletion` 状态（该状态同时充当"弹窗是否打开"与文案数据源），弹窗里【取消】和右上角关闭图标只关弹窗，只有【确定】才调用 `store.removePlaylist()` / `store.removeTrack()` / `store.removeTracks()`。弹窗外壳复用「批量导入」的视觉规范——`styles.css` 里 `.modal-overlay/.modal-card/.modal-actions/.modal-button/.modal-warning` 与 `.import-fav-*` 是同一组规则，改一处两边同时生效。

**歌曲排序（`use-track-reorder.ts` + `track-order.ts`）**：顺序就是 `Playlist.tracks` 的数组顺序，因此**没有新增数据字段、没有迁移**。交互契约（**全局长按，没有专用手柄**）：

1. 整行都是拖动入口（`.track-row` 带 `user-select: none`、`cursor: grab`、`tabIndex = 0`；歌曲主体 `.track-main` 额外带 `touch-action: none`）。唯一例外是行内的**多选框与动作按钮**（`ROW_CONTROL_SELECTOR = ".row-action, .row-select, input, select, textarea, a"`，即复选框、编辑、删除），它们保留原生语义。**`ROW_CONTROL_SELECTOR` 不能把 `button` 全排除**，否则歌曲主体（`.track-main` 也是 `<button>`）没法长按拖动。
2. 鼠标与触摸走同一条 Pointer Events 路径（只认主指针与左键）：按住行内任意位置满 `REORDER_LONG_PRESS_MS = 200ms` 才进入拖动（源行加 `.reorder-source` 淡出）；在此之前松开、或指针移动超过 `LONG_PRESS_SLOP_PX = 8px`（视为滚动），都按普通点击处理，不排序。
3. 拖动中由指针纵坐标算落点插入位（第一行中线在指针下方即插到它之前），在目标行顶边画 `.track-drop-indicator`（落到队尾时画在最后一行的底边，`.tail`）。
4. **边缘自动滚动**（长歌单必需，短列表滚不动所以容易漏测）：指针进入列表**可视区**上下 `EDGE_SCROLL_ZONE_PX = 28px` 边缘带后，`ensureEdgeScroll()` 启动一个 `requestAnimationFrame` 帧循环 `stepEdgeScroll()`；每帧按 `edgeScrollStep()` 调整 `listElement.scrollTop`（越靠边越快，上限 `EDGE_SCROLL_MAX_STEP_PX = 14`），**滚完立刻重算落点**（滚动会改变每一行的视口坐标）。循环在「指针静止」时也继续，停止条件是：指针离开边缘带、滚到上下边界（步长为 0）、`pointerup`/`pointercancel`、或组件卸载（`stopEdgeScroll()`）。`end` 与 「长按未达时长就移动而取消」两条路径都必须调用 `stopEdgeScroll()`，否则会留下后台帧循环。
5. **click 的三种命运**（不能无条件 `preventDefault()`，那会让「点歌曲」失效）：原地点击放行；拖动手势 / 按住后移开手指（纵位移超过 `CLICK_SLOP_PX = 6px`）吞掉，否则松手瞬间会顺手播放；长按后原地松手放行。判定靠 `pendingDrag`（`finishDrag` 里把这一按的 `dragged` 记下来）而不是 `activeDrag`——click 到达时 `activeDrag` 已经清空。
6. 键盘：行聚焦后 ↑/↓ 上/下移一格、Home/End 移到首尾，移动后写入 `.track-reorder-status`（`role="status"`，视觉上 1px 隐藏）播报「已移动到第 N 首」。焦点通常落在行内的播放按钮上，所以该监听器是**挂在列表容器 capture 阶段的原生 `keydown`**，通过 `event.target.closest(".track-row")` 找当前行；写在行的 Preact `onClick/onKeyDown` 上收不到（子按钮会先处理）。
7. **`toIndex` 一律是「插入位」**（移动前数组的下标，0..length），由 `track-order.ts` 统一扣掉「源条目被摘除后左移一位」的偏移；`resolveKeyboardMove()` 同时返回插入位 `toIndex` 与移动后的 `index`（播报用），两者不要混用，`AppStore.moveTrack()` 只接插入位。
8. 无变化（原地、歌曲不存在、越界已钳制到原位）时纯函数返回 `undefined`，`AppStore.moveTrack()` 直接返回、**不写存储**，避免无意义的 `updatedAt` 变更与跨标签页广播。
9. 播放中的歌曲由稳定的 `trackId` 标识，重排不改会话，当前曲目继续播放，只有之后的上一首/下一首按新顺序选择；只改当前活动歌单，其它歌单不动。
10. **Preact 会重建被移动那一行的 DOM 子树**，焦点因此丢失；排序后必须用 `restoreRowFocus()`（`requestAnimationFrame` + 按 `data-track-id` 重新查询）把焦点交回同一首歌。聚焦目标是行内的 `.track-main` 而不是 `<div>` 行本身——点击的默认行为会把焦点给被点的按钮，行上的焦点会被顶掉。判断焦点要用元素所在根节点的 `activeElement`（面板在 Shadow DOM 里，`document.activeElement` 只会回到宿主节点）。
11. **一个反复踩到的坑：挂在行上的 ref 会丢。** `bindRow()` 每次渲染都返回新的函数引用，而 Preact 只比较 ref 的函数身份、不相等时才调用，于是新 ref 不会被调用、用旧 ref 装的原生监听器就可能落在已经被替换的节点上。所以列表级的原生监听统一挂在**容器**上、只装一次，并且**处理函数不能闭包 `container` state**（首帧它是 `null`，会把「直接 return」的版本永久留在元素上）——容器元素一律从 `event.currentTarget` 现取；需要最新逻辑时经 `onKeyDownRef` 转一手。
12. **行内不要加 `draggable` 属性。** HTML5 原生拖动会在鼠标按住并移动时抢走手势，先给指针流发 `pointercancel`，拖到一半就被判成「取消」，真实鼠标**完全拖不动**。这个坑用 `page.dispatchEvent` 的合成 `PointerEvent` 测不出来（没有原生拖动判定），只有 `page.mouse` 的真鼠标序列会暴露，所以 `tests/e2e/track-reorder.spec.ts` 里专门留了一组真鼠标用例锚住它。
13. **自动滚动必须用溢出列表验证。** 短列表（3 首）的 `.track-list` 是 `scrollHeight === clientHeight`，把指针放到边缘带也滚不动——只用短列表测排序就永远发现不了「忘了实现自动滚动」。`tests/e2e/helpers/long-list.ts` 提供 14 首的夹具（面板高 720px 时列表可视约 395px、可滚约 361px），并把 `.track-list` 的 scrollTop / 落点插入线读出来；`tests/e2e/track-reorder.spec.ts` 末尾六条用例覆盖：向下滚 + 落点跟到末尾 + 松手持久化、离开边缘带停止并可重新启动、向上滚回顶部后插入到第 1 首前、**全程真鼠标且指针停住不动仍然继续滚**（`page.mouse`，最贴近用户报告的「拖到边缘不滚动」）、`pointercancel` 取消拖动后停循环且不落库、以及**列表没有溢出时恒为不滚动**（`edgeScrollStep()` 返回 0，帧循环立即退出而不空转）。合成 pointermove 只改坐标、不改 `page.mouse` 状态，所以指针**可以停住不动**；真鼠标那条用例则用来排除「只有合成事件才滚」的假阳性。

14. **行内控件的位置会反过来影响排序测试**：行首 30px 现在是常驻复选框列（`.track-row` 的 `grid-template-columns: 30px minmax(0,1fr) 32px 32px`）。用坐标点击歌曲行的既有用例（`row.click({ position: { x: 6 } })` 之类）会落到复选框上，必须把 x 挪到 `.track-main` 覆盖的范围内（如 `x: 36`）。

**歌曲多选与批量删除（`track-selection.ts` + `App.tsx` + `store.removeTracks()`）**：

- **常驻复选框**：每行左侧始终有一个复选框，没有「进入多选模式」这一步。真实 `<input type="checkbox">` 透明铺满整个 30px 列当热区（读屏/键盘语义都是原生的），可见方块由 `.row-select-box` 自绘（选中 = 粉色底 + 白色对勾），它带 `pointer-events: none`，保证命中测试落在真实 `input` 上。勾选的行加 `.track-row.selected`（浅粉底）。
- **行内不显示歌曲序号**：`.track-main` 只有「标题 + 作者·片段」与时长两列（`grid-template-columns: minmax(0, 1fr) auto`）；「当前播放的那首」只靠 `.track-row.active`（左侧强调条 + 深色底）标记。
- **选择状态是纯界面状态**：`App.tsx` 里的 `selection: ReadonlySet<string>`，**不写 `AppData`、没有新字段、没有迁移**，刷新即清空。一律用 `track.id` 记录——用下标会在排序后指向别的歌。纯逻辑在 `src/app/track-selection.ts`（`toggleTrackSelection` / `selectAllTracks` / `pruneTrackSelection` / `resolveSelectedTrackIds` / `countSelectedTracks` / `areAllTracksSelected`），都是不可变操作，无变化时返回原引用以便 `useState` 短路。
- **失效 id 清理**：切换歌单或删除歌曲后 `useEffect` 调 `pruneTrackSelection()`；渲染用的 `selectedTrackIds` / 计数另有一层过滤，天然忽略残留 id。
- **批量操作栏**：`.batch-bar` 只在 `selectedTrackCount > 0` 时渲染，并且是 `.track-list` 的**兄弟节点**（不是浮层、不进滚动容器）——因此不会遮挡歌曲，也不会把面板撑出横向溢出；「全选」在已全选时禁用（否则点击是空操作、含义含糊），「取消」清空选择。
- **批量删除**：点【删除】先把 `{ playlistName, trackIds }` 快照进 `batchPendingDeletion`，弹 `ConfirmModal`（标题「批量删除歌曲」，正文 `确定删除“{歌单名}”中的 N 首歌曲？`）；【取消】/右上角关闭不动数据，【确定】才调 `store.removeTracks(trackIds)` 并清空选择。
- **一次批量删除 = 一次存储更新**：`store.removeTracks()` 只做一次 `commitLibrary()`（一次 `GM_setValue` + 一次跨标签页广播），并且**只改当前歌单**；没有任何条目被真正删除时直接返回、不写存储。删到正在播放的歌曲时走 `reconcileSession()` 的既有路径：退出歌单播放上下文，但页面视频继续播放。

### 6.8 批量导入（`src/sources/` + `src/app/ImportFavModal.tsx`）

三种入口先由 `parseImportUrl`（`import-url.ts`）归一化：收藏夹 `favlist?fid=<mlid>`、合集 `favlist?fid=<season_id>&ftype=collect&ctype=21`、视频 `/video/BV…`（先 `view` 嗅探 `ugc_season`，有合集就转走合集路径）。

判据不能只看 `ctype`：`ctype` 表示「收藏对象的内容类型」（11 稿件 / 21 合集），只有 `ftype=collect`（或省略 ftype）时的 `fid` 才是 season_id；**`ftype=create` 是我创建的收藏夹，`fid` 始终是 mlid**，收藏页给自家收藏夹的链接会写成 `ftype=create&ctype=21`，误当合集送进合集接口只会拿到 `code -404`「合集不存在或链接无效」。反过来，把 season_id 当 mlid 送给 `/x/v3/fav/*` 会**静默返回别人的收藏夹**（id 空间重叠），所以 `ftype=create` 的链接带 ownerMid 交给 `assertFavOwner` 校验归属。

导入策略按数据源的能力分档，**不要为了「精确」把详情请求加回导入期**：

| 来源                             | 列表是否带分P数        | 导入期行为                                                                                                                   |
| -------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 收藏夹 `/x/v3/fav/resource/list` | 带（`medias[].page`）  | 单P 用列表元数据；仅 `partCount > 1` 的条目才查一次详情并按分P 拆分                                                          |
| 合集 `seasons_archives_list`     | **不带**               | **一个条目 = 一条 `Track`**（无 `page` → 播放落在 P1，无 `cid`），导入期**零详情请求**；多P 不拆分，留给后续「按需补全」能力 |
| 视频入口                         | 由详情直接给出 `pages` | 按分P 拆分（这一步本来就要查详情）                                                                                           |

两条通用约定（收藏夹与合集两条路径都适用）：**进度按条目回报且单位一致**——`loaded` 数的是「已处理条目数」（`processed = 已导入 + 已跳过`），与 `total`（收藏夹 `media_count` / 合集 `meta.total`，都是条目数）同单位；**不要用 `tracks.length`**，多P 拆分后的曲目数会大于条目数，进度会冲成 `88/27（100%）`，也会让合集的终止判断提前 break。回报频率是**逐条**（不是每页一次），否则慢页期间进度长时间不动。**逐条循环里不要放等待**，限流只放在翻页之间——合集用 `seasonPageDelay`（200–400ms；`page_size` 取接口上限 100，408 条 = 5 页）、命中风控（HTTP 412 / `code` -352、-412）按 1s/2s/4s 退避**重试同一页**，用尽才报错；不要换回为详情接口准备的 `randomDelay`（0.8–1.5s）去翻页，那只会让 408 条多等十几秒并放大「假死」观感（收藏夹路径的 `randomDelay` 用在「多P 条目查详情」之前，是它该待的地方）。确认阶段（`fetchSeasonInfo`）刻意**不做退避重试**：风控/异常立刻反馈，用户直接重试即可。

第三条约定：**「这一条拿不到」不等于「整单失败」**。收藏夹列表的 `medias[].attr` 只标"删除"类失效（`1` 其他原因删除、`9` UP 自删），**稿件记录已被清掉但条目仍是 `attr = 0`** 的情况（详情接口返回 `-404`、`62002` 等）只有 `/x/web-interface/view` 能发现。所以收藏夹路径里「多P 条目查详情」必须**按条目** try/catch：命中 `VideoUnavailableError`（`bilibili-video.ts`，覆盖 `-404/-400/62002/62004` 与"响应里没有稿件"）就计入 `skipped` 继续下一条，并 `console.warn` 出 bvid/标题（跳过但不静默；UI 摘要只报「已跳过 N 个失效视频」，不再细分来源）；风控（HTTP 412 / `code` -352）与网络异常照旧上抛，不要一起吞掉。**不要**为了发现"不可见的单P"而对每个条目都查详情——那是每条一次请求，等于把刚拆掉的坑挖回来；单P 的不可见条目目前仍会静默进歌单，这是已知限制。

### 6.9 歌单备份：导出与全量导入（`src/storage/backup.ts` + `src/app/SettingsPanel.tsx` + `src/app/BackupModal.tsx`）

入口只有一处：设置的「数据管理」分区（工具栏的数据库按钮与标题栏都**不再**提供备份入口）。`导出备份` 在设置里**内联一步完成**——`createPlaylistBackup()` + `serializePlaylistBackup()` + `app/download.ts` 的 `downloadTextFile()`，行内显示「已开始下载备份文件」；`从备份恢复` 打开 `BackupModal`（**导入专用**，没有导出小节）走下面的确认流程。概念设计的页脚也是这个分工：「选择项立即生效；备份操作单独确认。」

导出/导入只针对**歌单库**——歌单名称、歌曲、`bvid`、分P（`page`/`cid`）、片段起止时间、标题、UP 主、封面、`source`。**不进备份也不覆盖**：音量、播放进度与当前播放会话、纯音频开关、悬浮按钮/面板位置、极简模式状态、设置偏好。

备份文件格式（`PlaylistLibraryBackup`，`JSON.stringify(data, null, 2)`，可读）：

```json
{
  "format": "bilibili-music-player-backup",
  "formatVersion": 1,
  "exportedAt": "2026-10-01T03:04:05.000Z",
  "appVersion": "0.1.9",
  "library": { "version": 1, "playlists": [] }
}
```

文件名 `bilibili-music-player-playlists-YYYYMMDD-HHmmss.json`（本地时间）。导出走 `Blob` + 隐藏 `<a download>`，全程不修改任何数据。`copyPlaylist()`/`copyTrack()` 逐字段复制，因此 `Track` 之外的新字段不会意外泄漏进文件。

`parsePlaylistBackup(text, now?)` 是纯函数，按顺序识别三种输入，并返回来源标记 `source`（`"backup"` / `"tampermonkey-storage"` / `"legacy-app-data"`）供 UI 如实展示：① 标准备份（`format === "bilibili-music-player-backup"` 且 `formatVersion === 1`）；② Tampermonkey「存储」页复制出来的完整 JSON（取 `bilibili-music-player:data` 键，**其它键如 `audio-only`/`layout` 一律忽略、绝不回写**）；③ 旧版直接导出的 `AppData` 对象。

校验规则（任一条不满足即抛 `BackupError`，调用方必须保持当前歌单库原样）：文件 ≤ 10 MiB（`MAX_BACKUP_BYTES`，读文件前查 `File.size`、解析时查文本字节数）；必须是 JSON 对象；库 `version` 与 `formatVersion` 必须是可识别版本；至少一张歌单；歌单 ID 非空且全局唯一；歌曲 ID 非空且全局唯一；歌曲必须有有效 `bvid`/`title`/`startTime`/`duration`/`addedAt`/`source`；`endTime` 存在时必须晚于 `startTime`。开始/结束时间只要求「有限数字」（历史备份里的小数秒合法，不取整）；`uploader`/`cover`/`cid`/`page` 类型不合法时**丢弃该字段**而不是拒绝整份备份。

**硬约束：导入校验绝不能复用 `migrateAppData()`。** 它在输入非法时会静默回退成一张默认空歌单，用在导入上就等于「用户以为恢复成功、实际原有歌单已被替换成空歌单」。`src/storage/schema.ts` 只服务于启动加载，导入必须**失败并且不动数据**；`tests/backup.test.ts` 里有专门用例锁住这条（非法输入不产生默认歌单）。

导入流程（`BackupModal` 的状态机 `idle → preview → confirming → done`）：选择文件 → 解析校验 → 预览「来源 / 将导入 X 个歌单 · Y 首歌曲 / 当前歌库 A 个歌单 · B 首歌曲」→【导入并覆盖】→ 二次确认「会替换全部歌单…不会自动备份，且无法撤销」→【确认导入】。取消、关闭弹窗、读取失败、校验失败都不会写存储。

确认后由 `App.tsx` 的 `restoreLibrary()` 处理：**若当前是插件歌单播放上下文（`playbackContext === "playlist"`），先 `engine.currentMedia?.pause()` + `engine.exitPlaylistPlayback()`**（清 `resumeRequested`、上下文回 `"page"`、移除 URL 上的 `bili_music=1`），再调用 `store.replaceLibrary(parsed.playlists)`。`replaceLibrary()` 与 `importPlaylist()` 不同，是**无条件整体替换** `playlists`（文件里没有的歌单会被删除）、不做按 ID 合并；它保留本机 `volume` 与 `AppData.playMode` 历史字段，把 `activePlaylistId` 设为导入列表第一张歌单，清空 `playback` 的当前曲目/进度/恢复请求，并把本标签页会话重置到第一张歌单（保留本标签页 `PlaybackSession.playMode`），**只调用一次 `GM_setValue`** 写歌单库，避免其它标签页观察到中间状态。导入后不自动播放、不跳转视频。

导入完成后弹窗停在设置视图里，要看歌单库需按「返回播放器」——`tests/e2e/backup.spec.ts` 里的相关用例都补了这一步。

### 6.10 设置视图（`src/app/SettingsPanel.tsx`）

标题栏齿轮（`aria-label="设置"`）把 `displayMode` 切到 `settings`。它**复用 `.player-panel` 容器与 `panel` 拖拽坐标**（同宽、内容区内部滚动），因此没有第二套窗口/位置存储；头部是「← 返回播放器 / 设置 / × 收起播放器」，返回箭头回到进入设置前的形态（`settingsOrigin`），并且**不写 `lastOpenMode`**——否则「记住上次」会被一次设置跳转污染。

三个分区都用 `<button aria-expanded aria-controls>` + `role="region"` 的可折叠结构。展开状态是**组件内的 `ReadonlySet<SectionId>`**（默认空集 = 三个分区全部折叠），三个分区**各自独立开关**：展开一个不会收起别的，可以同时展开多个；这样设置面板不会被单一分区的强制收起打断操作，但也可能被拉得较长（面板自身 `max-height` + 内容区滚动兜底）。标题行统一底色、分区之间用一条分隔线，分区图标用强调色，说明文字用比 `--muted` 稍亮的 `--muted-strong`；粉色只留给分区图标、选中项（分段控件）与主要交互，覆盖风险只用琥珀提示卡。标题行的下拉箭头用 `margin-left: auto` 吸到**最右边缘**，所以「窗口与外观」（右侧无摘要）与「数据管理」「关于」（右侧有摘要）的箭头在同一列；右侧摘要改用 `flex: 0 1 auto`，不再撑满中间空间：

1. **窗口与外观**（两行）：`打开时 [记住上次 | 完整模式 | 极简模式]` 是三段原生 `input[type=radio]`（`role="radiogroup"`，标签与控件同一行），写 `settingsRepository.saveOpenMode()`；`悬浮位置 [重置位置]` 同一行，调用既有的 `launcherDrag.resetPosition()` + `panelDrag.resetPosition()`。标签列 `min-width: 56px`，分段控件铺满剩余宽度：左边缘与「重置位置」同列、右边缘与分区标题行右边缘对齐（`tests/e2e/settings.spec.ts` 断言两者 `boundingBox()` 的 `x` 与右边界相等）。
2. **数据管理**：标题旁常显 `N 个歌单 · M 首歌曲`；展开后是 `导出备份`（内联下载）与 `从备份恢复`（打开 `BackupModal`）+ 琥珀色警告卡。两个按钮都刻意用中性色——恢复是覆盖操作，不做成看起来首选的强调按钮。
3. **关于**：标题旁常显 `版本 x.y.z`；展开后给出常用信息（应用、版本、许可、存储）。

`SettingsPanel` 不写任何存储：偏好、导出、导入、重置全部由 `App` 以回调传入，组件只持有折叠状态。弹窗通过 `children` 渲染在面板 `<section>` 内部——这样 `.modal-overlay`（`position: absolute; inset: 0`）才会相对面板定位并继承 `.player-panel` 的 `pointer-events: auto`；`.modal-overlay` 自身也显式声明了 `pointer-events: auto` 作为兜底。

---

## 7. 生命周期全景（一次典型使用）

```text
1. 打开 B 站视频页 → 用户脚本在 document-start 执行
2. 若纯音频开关为开：先装 __playinfo__/fetch/XHR 拦截器（可能改写 dash.video）
3. 挂载 Shadow DOM 宿主 → 渲染 launcher 悬浮按钮
4. PlayerEngine.start()：加载 GM 歌单 → 加载本标签页会话 → 启动 MediaLocator → 绑定 <video> → 建立 store effect
5. 用户点悬浮按钮 → 打开完整面板（或上次的极简模式）
6. 用户点「将当前视频添加到歌单」（或在歌曲编辑器里选章节）→ 读取页面元数据 → 生成 Track → 写入共享歌单（GM）+ 广播给其它标签页
7. 用户点某首歌 → 写入 resumeRequested → 同页则立刻恢复，不同 BV 则导航到 /video/<bvid>/?bili_music=1[&p=N]
8. 新页面重新走 1~4，识别 bili_music=1 与目标 Track 匹配 → 进入 playlist 上下文 → 定位到进度 → 播放
9. 播放中：timeupdate 同步 UI、检查片段结尾、每 10 秒存进度；Media Session 同步系统媒体键
10. 歌单被其它标签页改动 → 若当前歌单/当前歌曲消失 → 安全退出歌单播放（回到 page 上下文）
11. 关闭/刷新标签页：pagehide 保存进度；sessionStorage 会话随标签页结束而清除，歌单仍在
```

---

## 8. 构建与发布链路

`npm run build` = `tsc --noEmit`（类型检查，不产出文件）→ `vite build` → `node scripts/audit-userscript.mjs`。

`vite.config.ts` 中有四处非默认配置值得注意：

1. `monkey({...})`：用户脚本元数据（`@match`、`@require`、`@run-at`、多语言名称与描述）与输出文件名（`bilibili-music-player.user.js`，同时生成 `.meta.js`）。
2. **`@require` 的 SHA-256 子资源校验**：构建时读取 `node_modules` 中的本地 UMD 文件算哈希，拼成 `https://cdn.jsdelivr.net/npm/<pkg>@<exact>…js#sha256=…`，确保 CDN 文件与本地锁定的依赖完全一致。
3. `externalGlobals`：把 preact 等模块映射到 CDN 暴露的全局变量，所以框架不进产物（也避免体积超标）。
4. 自定义插件 `readableCssOutput()`：把 Vite 内联的样式字符串展开成逐行字符串数组，并要求**恰好存在一个**内联样式表，否则构建报错。

`scripts/audit-userscript.mjs` 的校验项（构建即门禁）：`@require` 顺序/版本/哈希、`@match` 必须恰好是 video 页 + space 页两条且顺序固定、`@version` 与 `package.json` 一致、MIT 许可声明、依赖必须是精确版本、禁止打包 `lucide-preact`、体积 ≤2MB、`THIRD_PARTY_NOTICES.txt` 全文内联、最长行 ≤1000、关键业务符号（`installAudioOnlyInterceptors`/`rewritePlayurlPayload`/`PlayerEngine`）必须保留、禁止 `eval`/`new Function`/动态 script、禁止框架开发态标记、CSS 必须可读。

`npm run verify:cdn` 会访问 jsDelivr 校验这些 URL 仍然可用且哈希匹配。

---

## 9. 测试体系

- **单元测试（Vitest，node 环境，`tests/**/*.test.ts`）**：覆盖纯逻辑——时间格式化与钳制、四种播放模式的边界、歌曲排序的插入位语义（`tests/track-order.test.ts`：向前/向后移动、`length` 追加到末尾、越界钳制、原地不动返回 `undefined`、不改动入参、`resolveKeyboardMove()` 的 `toIndex` 与 `index`、`resolveDropIndex()` 的落点归一化）、歌曲多选的集合语义（`tests/track-selection.test.ts`：切换选中/取消、不可变、全选与「已全选时返回原引用」、清理失效 id（含无变化返回原引用、空歌单清空）、按列表顺序解析选中 id、只统计仍存在的歌曲、空歌单不算全选）、播放条目的合成与变化比较（`tests/now-playing.test.ts`）、封面 URL 规范化与按 bvid 缓存/退避（`tests/video-cover.test.ts`）、设置偏好迁移与 `resolveOpenMode()` 透传（`tests/settings-schema.test.ts`）、默认歌单/非法持久化数据恢复、播放会话初始化与无效歌曲回退、playurl 改写（三种 DASH 结构 + `durl`/缺音频/畸形 JSON 的失败开放且不修改输入）、章节解析、进度百分比，以及导入链路的**契约测试**：`tests/sources-bilibili-season.test.ts` 里有「408 条合集 = **5 次列表请求** + **0 次详情请求**」「`page_size=100`」「逐条进度 = 1…408」「多P 条目只产出单条 `-p1`」「HTTP 412 退避后重试同一页」「退避阶梯用尽才报风控错」「翻页礼让间隔 200~400ms」的用例，`tests/sources-bilibili-fav.test.ts` 锁住收藏夹的分页/失效过滤/多P 拆分、「进度只数条目、不数多P 拆分后的曲目数」（`loaded <= total`）、以及「列表没标失效但详情 `-404` 的条目只跳过自己、风控 412 仍然上抛」。`tests/backup.test.ts` 锁住歌单备份：导出→解析往返字段完整、文件里不含音量/播放会话/纯音频/布局、文件名格式、Tampermonkey 原始存储与旧版 `AppData` 两种兼容输入、以及空/损坏/未来版本/空歌单/重复 ID/错误时间范围/非法 source/超 10 MiB **一律抛错且不产生默认歌单**。
- **浏览器测试（Playwright，`tests/e2e/`）**：**加载的是构建产物**（`tests/helpers/userscript.ts` 读 `dist/*.user.js` 并把 CDN 运行时文件内联进去），所以必须先 `npm run build`。测试用 `page.route()` 把 `https://www.bilibili.com/video/BV1…` 伪造成假 B 站页面，用 `addInitScript` 注入 `localStorage` 版的 `GM_*` 替身，并用 `Object.defineProperties` 伪造 `<video>` 的 `paused/currentTime/duration/readyState/volume/muted` 与 `play()/pause()`。`tests/e2e/player.spec.ts` 覆盖挂载与媒体控制、拖拽位置持久化、面板顶边固定、片段整秒边界与旧数据归一化、章节选择、删除确认（弹窗取消/关闭/确定三条路径，并断言全程不弹原生 dialog）、队列游标与上下文判定、歌单播放会话刷新恢复、bfcache 恢复、网页全屏隐藏、极简模式布局/进度/键盘可达性；`tests/e2e/audio-only.spec.ts` 覆盖 `__playinfo__`、fetch、XHR 三种拦截与失败回退、开关双向重载；`tests/e2e/tab-coordination.spec.ts` 覆盖多标签页**互相独立**播放、以及远端删除当前歌曲后本标签页安全退出歌单播放；`tests/e2e/metadata-refresh.spec.ts` 用 `history.pushState` + 延迟写 DOM 复现 B 站同文档跳转，锁住「面板标题/UP 主自动收敛」「无变化时不重建 MediaMetadata」，以及封面三层兜底：接口封面优先、接口风控/无封面时退回分享卡片封面、每个视频只请求一次接口；`tests/e2e/import-fav.spec.ts` 覆盖收藏夹/合集/视频三种入口的导入与覆盖导入、错误提示，并断言合集导入期间详情接口被请求 **0** 次（`viewRequests === 0`）；`tests/e2e/backup.spec.ts` 覆盖歌单备份：从设置内联导出产生可读 JSON 下载（文件名 + 核心内容 + 不修改数据）、经设置进入导入弹窗并全量替换歌单库（选择器只剩导入的歌单、音量与共享 playMode 保留）、Tampermonkey 原始存储导入且 `audio-only`/`layout`/`settings` 不被改动、取消/关闭/非法文件都不动数据、以及「导入前先暂停媒体并退出插件歌单播放上下文」；`tests/e2e/track-reorder.spec.ts` 覆盖歌曲排序：全局长按拖动改顺序并写入 `tracks` 数组（含落点指示线与末尾插入，按住歌曲主体同样可拖）、未满长按时长的点击仍是播放且不排序、长按前移动会取消拖动、拖动不误触编辑/删除、播放中重排后当前曲目继续播放且下一首/上一首按新顺序、刷新后顺序保留、行内键盘 ↑/↓/Home 排序且焦点始终留在同一首歌上、**长列表（14 首，见 6.7 第 13 条）的边缘自动滚动**（向下滚 + 落点跟到末尾 + 松手持久化、离开边缘带停止并可重新启动、向上滚回顶部后插入到第 1 首前），以及**用 `page.mouse` 的真鼠标用例**（左键拖动真的改顺序、点行首复选框只聚焦不播放不排序、点歌曲行播放）。`tests/e2e/track-batch-delete.spec.ts` 覆盖常驻复选框与批量删除：每行都有复选框且未选中时不显示操作栏、点复选框只改选择（不播放、不排序、无「歌曲数量/选择歌曲」行）、点歌名仍播放且编辑/单首删除不受影响、全选/取消/已全选时「全选」禁用、批量删除弹窗取消不改数据、确认后**只删当前歌单选中的那些**且歌单库**只写一次**（用 `GM_setValue` 计数探针断言）、删掉正在播放的歌曲后页面视频继续播放且别的歌单不受影响、拖动重排后选中项按 `track.id` 跟着同一首歌、在复选框上长按不会进入拖动而歌曲主体仍能排序、320px 窄视口无横向溢出且操作栏不遮挡歌曲（行内各段不重叠、操作栏从列表底边之下开始）、以及长列表滚动后再批量删除仍然精确命中选中项。新增 e2e 用例时注意三点：一次拖动必须全程共用同一个 `pointerId`（否则 `pointermove` 会被当成别的指针忽略）；注入 `GM_*` 替身的 `addInitScript` 会在刷新后重跑，初始化歌单库要加「键已存在就不覆盖」的判断，否则「刷新后顺序保留」永远测不出来；**拖动类交互必须补真鼠标用例**，合成 `PointerEvent` 会绕过浏览器的原生拖动判定（见 6.7 第 12 条）；`tests/e2e/settings.spec.ts` 覆盖设置视图：齿轮打开 / ← 返回原形态 / × 回悬浮按钮、三种打开方式落盘并决定悬浮按钮的打开结果（含「记住上次」透传 `lastOpenMode`）、**三个分区默认全部折叠且可同时展开**（展开一个不影响别的、点标题只收起自己）、三个标题行的下拉箭头贴同一列右边缘、设置内重置位置清空两个坐标、内联导出下载内容可被 `parsePlaylistBackup` 解析、`导入备份` 打开弹窗、「关于」展开后显示真实版本与备份格式、折叠区 `aria-expanded` 切换、键盘可选分段控件、打开设置不打断歌单播放、390px 窄视口不越界。
- **真实网站烟雾测试（`tests/real/`，独立配置 `playwright.real.config.ts`）**：访问真实公开 B 站视频页注入正式构建，验证媒体定位与面板挂载；其中一个用例断言纯音频模式下只请求音频分片、不请求视频分片。它依赖外部网络，不纳入默认命令。

---

## 10. 明确的非目标（防止「幻觉式需求」）

- 不下载、不转码、不缓存音视频；不提供离线播放。
- 不跨站点工作：`@match` 只有 B 站 `/video/` 页面与 `space.bilibili.com` 空间页（后者只在收藏页 `favlist` 显示 UI，其它空间页脚本惰性加载、不渲染任何东西）。
- 不修改 B 站账号数据（收藏、投币等）；只读取公开的视频/章节接口（`/x/web-interface/view`、`/x/player/wbi/v2`）、当前登录用户的收藏夹内容（`/x/v3/fav/*`）以及公开的视频合集（`/x/polymer/web-space/seasons_archives_list`）——全部只读、不写回 B 站。合集导入**只读列表接口**，不会为了分P 对每个视频各发一次 `/x/web-interface/view`（见 6.8）。封面复用 `/x/web-interface/view`：同一 bvid 最多请求一次，失败退避 5 分钟；接口被风控（412）时改用页面分享卡片封面，不重试、不清空已有封面。
- 不收集、不上传任何用户数据。
- 不试图绕过会员/区域限制：能被改写的只有页面本来就能拿到的清单。
- 纯音频模式不承诺总是生效；抢不到拦截时机或结构不匹配时**必须**回退并如实提示。

---

## 11. 改代码前的检查清单

1. 逻辑放对层了吗？（纯计算 → `core/` 或纯函数模块；DOM/页面细节 → 仅 `bili/`；存储 → `storage/` 并带迁移）
2. 改了持久化结构吗？（升 `version` + 写迁移 + 补单测）
3. 动了纯音频链路吗？（`playurl-rewriter` 必须保持纯函数、失败开放、不修改输入；补 `tests/playurl-rewriter.test.ts` 用例）
4. 新增依赖或图标了吗？（更新 `scripts/userscript-runtime.json`、`THIRD_PARTY_NOTICES.txt`、`package.json` 精确版本；图标手写进 `icons.tsx`）
5. 跑过 `npm run build`（含审计）再跑 `npm run test:e2e`？改了 `dist/` 意味着构建产物需要一起提交。
6. 是否影响了「普通视频播放不应被插件干扰」这条底线？（上下文 `page` vs `playlist`、`bili_music=1` 标记、多标签页独立性）

---

## 12. 术语表（中英对照）

| 中文        | 代码标识符        | 含义                                                |
| ----------- | ----------------- | --------------------------------------------------- |
| 用户脚本    | userscript        | 由篡改猴注入页面的 JS，产物为单个 `.user.js`        |
| 歌单        | `Playlist`        | 用户创建、跨标签页共享的歌曲集合                    |
| 歌曲 / 片段 | `Track`           | 一个视频或视频中的一段时间（`startTime`~`endTime`） |
| 播放会话    | `PlaybackSession` | 单标签页的当前歌单、播放模式、当前歌曲与进度        |
| 播放上下文  | `playbackContext` | `page`（普通视频）或 `playlist`（插件歌单）         |
| 播放引擎    | `PlayerEngine`    | 协调媒体元素、存储与 UI 的状态机                    |
| 纯音频模式  | audio-only        | 改写播放清单去掉视频分片、只听声音                  |
| 失败开放    | fail-open         | 任何异常都保持原样并回退，而不是破坏页面            |
| 共享数据    | `AppData`         | 写入 GM 存储、广播给所有标签页的数据                |
| 布局数据    | `LayoutData`      | 悬浮按钮/面板坐标与上次打开形态                     |
