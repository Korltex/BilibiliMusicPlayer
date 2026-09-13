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

| 项目 | 值 |
| --- | --- |
| 产物形态 | 单个用户脚本 `dist/bilibili-music-player.user.js`（`dist/` 已被 git 跟踪） |
| 技术栈 | TypeScript（strict）+ Preact 10 + `@preact/signals` + Vite + `vite-plugin-monkey` |
| 包名 / 版本 | `bilibili-music-player` / `0.1.8`（`package.json`，用户脚本头部 `@version` 必须与之一致） |
| 作者 / 许可 | Korltex / MIT |
| 匹配范围 | `https://www.bilibili.com/video/*` 与 `https://space.bilibili.com/*`（后者只在空间收藏页 `favlist` 挂载 UI，其它空间页保持惰性） |
| 注入时机 | `@run-at document-start`；`@noframes` |
| 外部运行时 | Preact / preact-hooks / jsx-runtime / signals-core / signals，全部走 jsDelivr 固定版本 URL + `#sha256=…` 子资源校验（清单见 `scripts/userscript-runtime.json`） |
| 运行环境 API | `$` 虚拟模块提供的 `GM_getValue` / `GM_setValue` / `GM_addValueChangeListener` / `GM_removeValueChangeListener` / `unsafeWindow` |
| 包管理器命令 | `npm run build`（`tsc --noEmit` → `vite build` → 构建审计）、`npm test`（Vitest）、`npm run test:e2e`（Playwright，需先 build）、`npm run test:e2e:real`（真实 B 站烟雾测试） |
| 代码规模 | `src/` 约 26 个文件；核心是 `src/playback/player-engine.ts`、`src/app/App.tsx`、`src/app/store.ts` |
| 主要语言 | 源码注释与 UI 文案为简体中文；UI 文案在 `vite.config.ts` 中声明了 `zh-CN` / `zh-TW` / `en` 三语元数据 |

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

---

## 4. 目录地图与模块职责

```text
src/
├── entry.tsx                    入口：Shadow DOM 挂载、Web 全屏隐藏、键盘事件隔离、生命周期清理
├── styles.css                   播放器全部样式（注入 Shadow DOM，与页面样式隔离）
├── app/                         Preact UI + 应用状态 + 本地布局
│   ├── App.tsx                  主界面（三种显示形态 + 完整面板 + 歌曲编辑器）
│   ├── minimal-player.tsx       单行极简播放器
│   ├── player-controls.tsx      共用传输控件条（完整/极简两种 variant）
│   ├── store.ts                 AppStore：两个 signal（共享数据 / 本标签页会话）+ 持久化写入门面
│   ├── use-draggable-position.ts / draggable-position.ts  指针拖动与视口内钳制
│   ├── playback-progress.ts     环形进度百分比计算
│   └── icons.tsx                内联 SVG 图标
├── bili/                        B 站页面适配层（唯一允许接触页面细节的地方）
│   ├── media-locator.ts         发现并跟踪当前媒体元素
│   ├── metadata.ts              读取 bvid / 分P / 标题 / UP 主 / 封面，构造 Track
│   ├── page-route.ts            纯函数：判定页面路由（视频页 / 空间收藏页 / 其它），决定是否挂载 UI
│   ├── chapters.ts              调用 B 站公开 API 拉取视频章节（亮点）
│   ├── audio-only-controller.ts 纯音频模式的开关、状态机与页面表现
│   ├── audio-only-interceptor.ts `__playinfo__` / fetch / XHR 拦截安装
│   └── playurl-rewriter.ts      纯函数：把 playurl 响应改写成「仅音频」（可单测）
├── sources/                     外部来源（收藏夹 / 视频合集）→ `Track` 的适配层
│   ├── bilibili-fav.ts          解析链接（收藏夹/合集）、收藏夹分页拉取、失效过滤、映射为 Track（可单测）
│   ├── bilibili-season.ts       视频合集 season 拉取与映射（另一套接口 `seasons_archives_list`）
│   └── http.ts                  适配层共用的随机限流、可中止 sleep、响应读取
├── core/                        无副作用基础件：types.ts / id.ts / time.ts
├── playback/                    播放逻辑（不碰 DOM 细节、不碰存储实现）
│   ├── player-engine.ts         状态机 + 媒体事件绑定 + 跨视频/恢复播放 + Media Session
│   └── queue.ts                 纯函数：根据播放模式选上一首/下一首
└── storage/                     持久化与迁移
    ├── schema.ts                AppData v1 默认值与迁移（GM key: bilibili-music-player:data）
    ├── repository.ts            GM 读写 + 远端变更订阅
    ├── playback-session.ts      PlaybackSession 迁移与 sessionStorage 仓库
    ├── layout-schema.ts / layout.ts  UI 位置与上次打开模式（GM key: bilibili-music-player:layout）
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

| 数据 | 位置 | 键 | 作用域 |
| --- | --- | --- | --- |
| 歌单、歌曲、音量 | GM 存储 | `bilibili-music-player:data` | 所有标签页共享 |
| 当前歌单、播放模式、当前歌曲、进度、恢复请求 | `sessionStorage` | `bilibili-music-player:playback-session` | **单个标签页**，关闭标签页即消失 |
| UI 位置、上次打开模式 | GM 存储 | `bilibili-music-player:layout` | 所有标签页共享 |
| 纯音频开关 | GM 存储 | `bilibili-music-player:audio-only` | 启动期偏好，**不进入歌单数据结构** |

`AppRepository.subscribe()` 用 `GM_addValueChangeListener` **只处理 `remote === true`** 的变更（避免自己写入触发回环）。收到远端歌单变更后，`PlayerEngine` 里的 `effect()` 会检查：若「活动歌单被切换」或「正在播放的歌曲已在所有歌单中被删除」，就安全退出歌单播放（清掉 `resumeRequested`、把上下文切回 `"page"`、移除 URL 标记）。其它歌单的增删改不影响本标签页播放。

**当前工作区状态（重要）**：跨标签页协调器 `src/playback/tab-coordinator.ts` 已被删除（`git status` 显示为 `D`，改动尚未提交），因此现在的行为是**各标签页完全独立播放**，互不暂停、互不覆盖进度。如果你在别处看到「同一时间只允许一个歌单播放实例」的描述，那是历史版本（commit `dc94715`）的行为。

进度写入做了节流：`timeupdate` 中最多每 10 秒保存一次，外加 `pagehide` 兜底。

### 6.7 界面形态与拖动（`src/app/App.tsx`）

三种显示形态，状态在组件内：`launcher`（圆形悬浮按钮）→ `full`（完整面板）→ `minimal`（单行极简播放器，宽 ≤400px）。形态切换**不改变任何播放状态**（不暂停、不跳时间、不改模式/音量/纯音频）。上次打开的形态持久化在布局存储里，默认 `full`。

`useDraggablePosition("launcher" | "panel")` 实现指针拖动：4px 阈值区分点击与拖动、`setPointerCapture`、实时按视口钳制坐标（`clampPosition`）、结束后写入布局存储，并提供 `consumeSuppressedClick()` 防止拖动末尾误触发点击。完整面板与极简播放器**共用 `panel` 坐标**；标题栏的「重置位置」按钮清空两处坐标。发生 `resize` 或元素尺寸变化时用 `ResizeObserver` 重新钳制。

`App` 里还包含歌曲编辑器（`TrackEditor`）：可改标题、起止时间，并用 `fetchVideoChapters()` 调用 B 站公开接口（`/x/web-interface/view` 解析 cid → `/x/player/wbi/v2` 取 `view_points`）识别视频章节。章节以可键盘操作的下拉列表（combobox）呈现，**选中某章即把歌名与起止时间填入表单，保存后成为一首歌（一次一首，不是批量导入）**；没有章节时仍可完全手动填写。章节解析（`parseVideoChapters`）是纯函数，只接受 `content` + 合法 `from`/`to` 的条目，封面 `http:` 会被升成 `https:`。

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

- **单元测试（Vitest，node 环境，`tests/**/*.test.ts`）**：覆盖纯逻辑——时间格式化与钳制、四种播放模式的边界、默认歌单/非法持久化数据恢复、播放会话初始化与无效歌曲回退、playurl 改写（三种 DASH 结构 + `durl`/缺音频/畸形 JSON 的失败开放且不修改输入）、章节解析、进度百分比。
- **浏览器测试（Playwright，`tests/e2e/`）**：**加载的是构建产物**（`tests/helpers/userscript.ts` 读 `dist/*.user.js` 并把 CDN 运行时文件内联进去），所以必须先 `npm run build`。测试用 `page.route()` 把 `https://www.bilibili.com/video/BV1…` 伪造成假 B 站页面，用 `addInitScript` 注入 `localStorage` 版的 `GM_*` 替身，并用 `Object.defineProperties` 伪造 `<video>` 的 `paused/currentTime/duration/readyState/volume/muted` 与 `play()/pause()`。`tests/e2e/player.spec.ts` 覆盖挂载与媒体控制、拖拽位置持久化、片段整秒边界与旧数据归一化、章节选择、删除确认、队列游标与上下文判定、歌单播放会话刷新恢复、bfcache 恢复、网页全屏隐藏、极简模式布局/进度/键盘可达性；`tests/e2e/audio-only.spec.ts` 覆盖 `__playinfo__`、fetch、XHR 三种拦截与失败回退、开关双向重载；`tests/e2e/tab-coordination.spec.ts` 覆盖多标签页**互相独立**播放、以及远端删除当前歌曲后本标签页安全退出歌单播放。
- **真实网站烟雾测试（`tests/real/`，独立配置 `playwright.real.config.ts`）**：访问真实公开 B 站视频页注入正式构建，验证媒体定位与面板挂载；其中一个用例断言纯音频模式下只请求音频分片、不请求视频分片。它依赖外部网络，不纳入默认命令。

---

## 10. 明确的非目标（防止「幻觉式需求」）

- 不下载、不转码、不缓存音视频；不提供离线播放。
- 不跨站点工作：`@match` 只有 B 站 `/video/` 页面与 `space.bilibili.com` 空间页（后者只在收藏页 `favlist` 显示 UI，其它空间页脚本惰性加载、不渲染任何东西）。
- 不修改 B 站账号数据（收藏、投币等）；只读取公开的视频/章节接口（`/x/web-interface/view`、`/x/player/wbi/v2`）、当前登录用户的收藏夹内容（`/x/v3/fav/*`）以及公开的视频合集（`/x/polymer/web-space/seasons_archives_list`）——全部只读、不写回 B 站。
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

| 中文 | 代码标识符 | 含义 |
| --- | --- | --- |
| 用户脚本 | userscript | 由篡改猴注入页面的 JS，产物为单个 `.user.js` |
| 歌单 | `Playlist` | 用户创建、跨标签页共享的歌曲集合 |
| 歌曲 / 片段 | `Track` | 一个视频或视频中的一段时间（`startTime`~`endTime`） |
| 播放会话 | `PlaybackSession` | 单标签页的当前歌单、播放模式、当前歌曲与进度 |
| 播放上下文 | `playbackContext` | `page`（普通视频）或 `playlist`（插件歌单） |
| 播放引擎 | `PlayerEngine` | 协调媒体元素、存储与 UI 的状态机 |
| 纯音频模式 | audio-only | 改写播放清单去掉视频分片、只听声音 |
| 失败开放 | fail-open | 任何异常都保持原样并回退，而不是破坏页面 |
| 共享数据 | `AppData` | 写入 GM 存储、广播给所有标签页的数据 |
| 布局数据 | `LayoutData` | 悬浮按钮/面板坐标与上次打开形态 |
