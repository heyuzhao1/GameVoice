# GameVoice - 游戏开黑语音程序（v0.2.0）

一款专为游戏玩家设计的低延迟语音通话桌面应用，聚焦同城玩家低延迟沟通与稳定连接体验。

## 已实现功能

- **P2P 语音通信**：WebRTC 直连，减少中转延迟
- **房间机制**：创建/加入房间，在线成员实时展示
- **音频设备管理**：进入房间前即可选择输入设备，支持热插拔
- **权限与设备检测优化**：提前请求麦克风权限，异步扫描、缓存设备列表
- **语音处理**：语音激活、降噪、回声消除
- **UI 体验升级**：骨架屏、渐进式加载、动画开关与更流畅的交互反馈

## 技术架构

- **前端界面**：Electron + React + Tailwind CSS
- **音频处理**：WebRTC / Opus / Web Audio API
- **网络层**：WebSocket / STUN / TURN / ICE
- **构建打包**：Vite + Electron Builder

## 快速开始

### 环境要求

- Node.js >= 18

### 安装依赖

```bash
npm install
```

### 开发运行

```bash
npm start
```

## 打包发布

### 生成安装包（Windows）

```bash
npm run dist
```

产物输出到 `release/`，包括：

- `GameVoice Setup 0.2.0.exe`（安装版）
- `GameVoice-Portable.exe`（便携版）

### 常用脚本

```bash
npm run dev          # 启动 Vite 开发服务
npm run build        # 打包前端资源
npm run dist         # 生成安装包
npm run dist:portable # 生成便携版
```

## 项目结构

```
GameVoice/
├── src/            # 核心源代码（主进程/逻辑）
├── ui/             # 前端界面
├── audio/          # 音频处理模块
├── network/        # 网络连接模块
├── scripts/        # 构建脚本
└── docs/           # 文档
```

## 相关文档

- QUICK_START.md
- INSTALL.md
- USER_GUIDE.md
- TROUBLESHOOTING.md
