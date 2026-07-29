# 架构说明

## 设计边界

脚本只控制 Bilibili 页面已有的媒体元素：

```text
HTMLMediaElement.play()
HTMLMediaElement.pause()
HTMLMediaElement.currentTime
HTMLMediaElement.volume
```

它不会请求 `playurl`、解析 DASH 音频流或缓存媒体文件。

## 模块

```text
src/
├── app/          Preact UI 和应用状态
├── bili/         Bilibili 页面、媒体元素和元数据适配
├── core/         类型、ID 和时间工具
├── playback/     队列、片段、跨标签页和播放状态机
├── storage/      GM 存储和数据迁移
├── entry.tsx     Shadow DOM 挂载入口
└── styles.css    隔离后的播放器样式
```

## 运行流程

```mermaid
flowchart LR
    A["用户脚本启动"] --> B["挂载 Shadow DOM"]
    A --> C["读取 GM 存储"]
    A --> D["MediaLocator 扫描页面"]
    D --> E["绑定当前 HTMLMediaElement"]
    E --> F["PlayerEngine 同步状态"]
    F --> G["Preact 播放器界面"]
    G --> F
    F --> H["歌单与片段控制"]
    H --> I{"歌曲是否在当前 BV"}
    I -- 是 --> E
    I -- 否 --> J["保存恢复请求并导航"]
    J --> A
```

## 页面适配

`MediaLocator` 同时使用：

- `MutationObserver`：发现媒体元素被创建或替换。
- 定时扫描：补偿 Bilibili 内部异步渲染。
- URL 变化检测：识别 SPA 导航和分P切换。

候选媒体元素按照播放状态、就绪状态、时长和可见面积评分，不依赖 Bilibili 私有播放器对象。

## 持久化

数据通过以下 GM API 保存：

```text
GM_getValue
GM_setValue
GM_addValueChangeListener
GM_removeValueChangeListener
```

数据结构包含版本号，后续字段变化应在 `storage/schema.ts` 中增加迁移，不能直接破坏旧歌单。

播放进度最多每十秒保存一次，并在 `pagehide` 时补充保存，避免高频持久化写入。

## 跨视频与跨标签页

不同 BV 的歌曲通过保存 `resumeRequested` 后导航到对应视频页。新页面定位媒体元素后恢复片段起点并尝试播放。

`BroadcastChannel` 用于播放权声明。当另一个 Bilibili 标签页开始播放时，当前标签页自动暂停，避免两个页面同时出声。

## 后续扩展点

收藏夹和合集应放入独立 `sources/` 适配层，转换为统一的 `Track`，不能让 Bilibili 接口字段直接进入播放核心。
