# GameVoice - 游戏开黑语音程序 (v0.2.0)

[![Electron](https://img.shields.io/badge/Electron-v34.0.0-blue.svg)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-v18.0.0-61dafb.svg)](https://reactjs.org/)
[![WebRTC](https://img.shields.io/badge/WebRTC-P2P-orange.svg)](https://webrtc.org/)

一款专为游戏玩家设计的低延迟语音通话桌面应用，基于 Electron + React + WebRTC 构建。支持局域网零配置联机，亦可部署信令服务器实现广域网通信。

---

## 🚀 项目现状 (Project Status)

目前版本 (**v0.2.0**) 已实现核心的语音通话功能，**完全支持局域网 (LAN) 内的多人语音互通**。

### ✅ 已实现功能

- **P2P 低延迟语音**：基于 WebRTC Mesh 架构，去中心化直连。
- **局域网联机**：
  - 主机端自动获取并显示局域网 IP。
  - 客户端可通过输入主机 IP 连接，无需外网服务器。
- **便捷邀请**：
  - 支持复制“房间号”。
  - 支持复制“邀请链接” (`voicechat://room/123`)，点击链接直接拉起应用入会。
- **音频管理**：
  - 输入/输出设备热插拔检测与切换。
  - 实时音量监控与静音控制。
  - 噪声抑制 (Noise Suppression) 与回声消除 (Echo Cancellation)。
- **现代化 UI**：
  - 暗色游戏风格界面。
  - 平滑的过渡动画与骨架屏加载体验。
  - 网络状态 (延迟/丢包/带宽) 实时统计。

### 🚧 待完善/限制 (Limitations)

- **广域网 (WAN) 通信**：
  - 目前信令服务器默认运行在用户本地。若需跨网段（如跨城市）通信，**必须**将信令服务器部署在公网 IP 上。
  - **NAT 穿透**：目前仅配置了公共 STUN 服务器。对于对称型 NAT (Symmetric NAT) 或严格防火墙环境，**需要部署 TURN 服务器**才能保证 100% 连接成功率。
- **人数限制**：
  - 由于采用 Mesh 架构（每个人都连其他人），建议单房间人数控制在 **8人以内**，否则带宽和 CPU 消耗会显著增加。

---

## 🛠️ 技术架构

```mermaid
graph TD
    UserA[用户 A (主机)] -- WebSocket (信令) --> SigServer[信令服务器]
    UserB[用户 B] -- WebSocket (信令) --> SigServer
    UserA <== WebRTC (UDP/音频流) ==> UserB
```

- **信令层 (Signaling)**: WebSocket (Node.js)，负责交换 SDP 和 ICE Candidate。
- **传输层 (Transport)**: WebRTC (UDP)，点对点加密传输音频。
- **前端 (Frontend)**: React + Tailwind CSS + Lucide Icons。
- **框架 (Framework)**: Electron (主进程负责系统交互，渲染进程负责 UI 与 WebRTC)。

---

## 📖 使用指南

### 场景一：局域网开黑 (推荐)

无需任何服务器配置，适合宿舍、网吧或同一 WiFi 下使用。

1.  **主机 (房主)**：
    - 启动应用 -> 点击设置 (⚙️)。
    - 复制 **“本机局域网 IP”** (例如 `192.168.1.5`) 发给朋友。
    - 创建房间。
2.  **客机 (朋友)**：
    - 启动应用 -> 点击设置 (⚙️)。
    - 在 **“信令服务器地址”** 中输入主机的地址：`ws://192.168.1.5:8765`。
    - 输入房间号加入，或点击主机发的链接。

### 场景二：广域网/跨网联机

需要拥有一台公网服务器 (云服务器)。

1.  **部署信令服务器**：
    - 将 `src/signaling-server.js` 部署到云服务器，并开放 8765 端口。
2.  **配置客户端**：
    - 所有用户在设置中将“信令服务器地址”改为云服务器 IP (例如 `ws://123.45.67.89:8765`)。
    - (可选) 在 `.env` 或代码中配置 TURN 服务器以增强穿透能力。

---

## 📦 开发与构建

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 常用命令

```bash
# 安装依赖
npm install

# 启动开发环境 (同时启动 React 和 Electron)
npm start

# 打包 Windows 版本
npm run dist

# 打包 macOS 版本 (需在 macOS 系统下运行)
npm run dist:mac
```

---

## 🔮 未来路线图 (Roadmap)

如果要将本项目打造为成熟的商业级语音软件，后续开发建议：

1.  **架构升级**：引入 **SFU (Selective Forwarding Unit)** (如 mediasoup/Jitsi)，将 Mesh 架构改为星型架构，支持百人/千人同时在线。
2.  **账户系统**：接入 OAuth 或手机号登录，实现好友系统和持久化用户 ID。
3.  **安全增强**：
    - 信令升级为 WSS (WebSocket Secure)。
    - 房间加入鉴权 (密码/Token)。
4.  **全平台支持**：适配 Linux 与移动端 (React Native/Flutter)。
