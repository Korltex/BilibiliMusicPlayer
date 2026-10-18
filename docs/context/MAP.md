# 目录与配置映射

本文仅记录定位项目资料和运行对象所需的关系；详细模块与运行流程见 [architecture.md](../architecture.md)。

## 目录职责

| 路径 | 用途与权威资料 |
|---|---|
| `src/entry.tsx` | 用户脚本入口与 Shadow DOM 挂载，详见架构说明“运行流程” |
| `src/app/` | Preact 界面与应用状态 |
| `src/bili/` | B 站页面、媒体、元数据及纯音频适配 |
| `src/core/` | 类型、ID 与时间工具 |
| `src/playback/` | 队列、片段与播放状态机 |
| `src/storage/` | GM 存储、会话存储与数据迁移 |
| `src/sources/` | 收藏夹、视频合集和单视频来源适配 |
| `tests/` | 单元、模拟浏览器与真实网站测试；步骤见 [testing.md](../testing.md) |
| `scripts/` | 构建审计、运行时清单及相关辅助脚本 |
| `docs/` | 项目说明及 context 路由资料 |
| `dist/` | 当前工作区的用户脚本构建产物；构建后以实际配置和结果核对 |

## 版本、配置与产物

- 包名、当前版本和 npm 命令以根目录 [package.json](../../package.json) 为准；本次核对到的版本为 `0.1.9`。
- 用户脚本入口、匹配规则、输出文件名和元数据文件选项以 [vite.config.ts](../../vite.config.ts) 为准。当前配置指定入口 `src/entry.tsx`、产物名 `bilibili-music-player.user.js`，并启用元数据文件。
- 当前工作区可见产物为 `dist/bilibili-music-player.user.js` 与 `dist/bilibili-music-player.meta.js`。这是路径核对，不代表本次运行过构建或安装了产物。
- README 说明目标运行环境为浏览器中的 Tampermonkey。实际用户脚本安装来源、托管地址或发布位置：待核实。

## 定位方式

从 [PROJECT_INDEX.md](../../PROJECT_INDEX.md) 按当前任务跳转；涉及架构细节时读取 `architecture.md` 相关章节，不需要遍历目录或文件清单。
