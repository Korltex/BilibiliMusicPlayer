# Bilibili Music Player

一个基于 `vite-plugin-monkey` 的 Bilibili 用户脚本。它在视频页面中添加悬浮音乐播放器，直接控制页面已有的 `<video>/<audio>`，不自行请求、下载或缓存音频。

## 当前功能

- 播放、暂停、上一首和下一首
- 进度跳转、音量和静音
- 视频标题、UP 主和封面读取
- 多歌单创建、删除和持久化
- 将当前视频添加为歌曲
- 为歌曲设置开始和结束时间
- 顺序、列表循环、单曲循环和随机播放
- 到达片段终点后自动切歌
- 切换不同 BV 后恢复播放队列
- Bilibili SPA 页面变化后重新绑定媒体元素
- 多标签页播放权协调
- Media Session 系统媒体控制
- 可选纯音频模式：移除 DASH 视频候选，只保留 Bilibili 原生音频播放

## 环境

- Node.js 22 或更高版本
- npm 10 或更高版本
- Chrome 或 Edge
- Tampermonkey

## 开发

```powershell
npm install
npm run dev
```

Vite 会生成开发版用户脚本安装地址。Tampermonkey 弹出安装页面后确认安装，然后打开：

```text
https://www.bilibili.com/video/{BV号}/
```

如果目标页面的 CSP 阻止开发脚本注入，使用正式构建进行测试：

```powershell
npm run build
npm run preview
```

## 验证

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format:check
```

构建产物：

```text
dist/bilibili-music-player.user.js
dist/bilibili-music-player.meta.js
```

## 使用

1. 打开任意普通 Bilibili 视频页。
2. 点击页面右下方的音乐按钮。
3. 新建或选择歌单。
4. 点击“将当前视频添加到歌单”。
5. 按需填写片段开始和结束时间。
6. 点击歌单中的歌曲开始播放。
7. 如需节省带宽，点击控制区的耳机按钮；页面会重载并恢复当前进度。

## 当前限制

- 当前只匹配普通 `/video/` 页面。
- 暂未接入收藏夹、合集和分P批量导入。
- 纯音频模式只改写 Bilibili 已取得的 DASH 清单，不解析、下载或保存 CDN 地址。
- 纯音频是 best-effort 功能；只有混流 `durl`、缺少 DASH 音频或拦截失败时会回退正常视频并显示原因。
- 跨 BV 切歌需要页面导航，可能出现短暂停顿。
- 浏览器拒绝自动播放时，需要点击一次播放按钮。
- 关闭播放标签页后无法继续发声，但歌单和进度会保存。

更多实现说明见 [架构文档](docs/architecture.md) 和 [测试文档](docs/testing.md)。
