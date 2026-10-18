# 项目索引

## 项目定位

Bilibili Music Player 是运行在浏览器用户脚本管理器中的 B 站网页音乐播放器。用途、功能和基本使用方式见 [README.md](README.md)。

## 按任务定位资料

| 当前任务 | 按需查阅 |
|---|---|
| 了解用途、功能或安装前提 | [README.md](README.md) 的项目介绍、功能和注意事项 |
| 理解模块关系、启动或播放流程 | [docs/architecture.md](docs/architecture.md) 的“模块”“运行流程”及相关专题 |
| 修改某个模块或行为 | 先看 [docs/architecture.md](docs/architecture.md) 对应专题；再从 `src/` 搜索相关符号。仅在机制细节相关时定位 [docs/AI-CONTEXT.md](docs/AI-CONTEXT.md) 对应标题 |
| 修改存储、会话或迁移 | [docs/architecture.md](docs/architecture.md) 的“持久化”；需要时查 [docs/AI-CONTEXT.md](docs/AI-CONTEXT.md) 的“存储分层、多标签页与远端变更” |
| 查找测试命令、覆盖范围或发布前检查 | [docs/context/RUNBOOK.md](docs/context/RUNBOOK.md) 的操作入口和 [docs/testing.md](docs/testing.md) 的相关测试章节 |
| 接续当前工作或检查阻塞 | [docs/context/NOW.md](docs/context/NOW.md) 的当前状态及证据入口 |
| 定位目录、版本、构建配置或产物 | [docs/context/MAP.md](docs/context/MAP.md)，再按需查看其中指向的配置项 |
| 查找已确认的项目选择 | [docs/context/DECISIONS.md](docs/context/DECISIONS.md) |
| 查看已证实的问题和验证缺口 | [docs/context/RISKS.md](docs/context/RISKS.md) |
| 追溯过去的工作 | 先看 [docs/context/history/README.md](docs/context/history/README.md)，再搜索匹配记录后阅读 |

## 使用方式

先遵循根目录 [AGENTS.md](AGENTS.md)，再按当前任务选择最相关的路由。读取命中章节和必要上下文即可；信息足够时停止。长参考、历史记录和索引均按需使用。
