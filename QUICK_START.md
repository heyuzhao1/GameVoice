# GameVoice 快速启动指南

由于 Electron 安装可能遇到网络问题，这里提供一个基于 Web 的简化启动方案，让你可以先体验 GameVoice 的核心功能。

## 方案一：Web 版本（推荐）

### 1. 启动开发服务器
```bash
cd GameVoice
npm run dev
```

### 2. 在浏览器中访问
打开浏览器，访问：http://localhost:5173

### 3. 体验功能
- 查看 UI 界面设计
- 测试房间管理功能
- 查看连接统计模拟
- 体验设置面板

## 方案二：简化 Electron 启动

### 1. 安装必要依赖
```bash
cd GameVoice
npm install --no-optional
```

### 2. 创建简化启动脚本
创建 `start-simple.js`：
```javascript
const { app, BrowserWindow } = require('electron');

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 加载本地开发服务器
  win.loadURL('http://localhost:5173');

  // 或者加载在线演示
  // win.loadURL('https://gamevoice-demo.netlify.app');
}

app.whenReady().then(createWindow);
```

### 3. 运行简化版本
```bash
node start-simple.js
```

## 核心功能演示

即使没有完整的 Electron 安装，你仍然可以体验：

### ✅ 已实现功能
1. **UI 界面** - 完整的游戏语音程序界面
2. **房间管理** - 创建、加入、离开房间
3. **用户列表** - 显示在线用户和状态
4. **连接统计** - 实时显示延迟、带宽等信息
5. **音频设置** - 设备选择和音量控制
6. **性能监控** - CPU/内存占用显示

### 🔧 技术架构
- **前端框架**: React + Vite
- **样式系统**: Tailwind CSS
- **音频处理**: Web Audio API（浏览器原生）
- **网络通信**: WebSocket + WebRTC（模拟）
- **状态管理**: React Hooks

## 项目结构概览

```
GameVoice/
├── ui/                    # 用户界面
│   ├── App.jsx           # 主应用组件
│   ├── main.jsx          # 入口文件
│   └── index.html        # HTML模板
├── src/                  # 核心逻辑
│   ├── p2p-manager.js    # P2P连接管理
│   ├── room-manager.js   # 房间管理
│   └── main.js          # Electron主进程
├── audio/                # 音频处理
│   └── audio-processor.js # 音频处理器
├── network/              # 网络模块
├── tests/                # 测试代码
└── docs/                 # 文档
```

## 下一步开发计划

### 阶段 1：完善 Web 版本
1. 实现真实的 WebRTC 音频传输
2. 添加信令服务器（WebSocket）
3. 实现完整的房间管理
4. 添加音频处理效果

### 阶段 2：Electron 集成
1. 解决 Electron 安装问题
2. 添加系统托盘支持
3. 实现全局快捷键
4. 添加自动更新

### 阶段 3：高级功能
1. 语音激活检测优化
2. 回声消除算法改进
3. 网络自适应编码
4. 跨平台打包

## 故障排除

### 常见问题

#### 1. 开发服务器无法启动
```bash
# 检查端口占用
netstat -ano | findstr :5173

# 使用其他端口
npm run dev -- --port 3000
```

#### 2. 样式加载问题
```bash
# 重新安装 Tailwind
npm install tailwindcss@latest autoprefixer@latest

# 重新生成 CSS
npx tailwindcss -i ./ui/index.css -o ./dist/output.css
```

#### 3. 模块导入错误
```bash
# 清除缓存
rm -rf node_modules/.vite

# 重新安装依赖
npm install
```

#### 4. Electron 安装失败
```bash
# 使用淘宝镜像
npm config set electron_mirror https://npm.taobao.org/mirrors/electron/

# 或跳过二进制下载
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm install
```

## 在线演示

我们计划部署一个在线演示版本，包含以下功能：
- 基本的语音通话
- 房间创建和加入
- 用户状态显示
- 连接质量监控

访问地址：https://gamevoice-demo.netlify.app（即将上线）

## 贡献代码

即使没有完整的开发环境，你仍然可以：

1. **改进 UI 设计** - 修改 `ui/` 目录下的文件
2. **添加新功能** - 在 Web 版本中实现
3. **修复 Bug** - 报告和修复问题
4. **编写文档** - 完善使用指南

## 获取帮助

- **GitHub Issues**: https://github.com/yourusername/gamevoice/issues
- **Discord 社区**: https://discord.gg/gamevoice
- **电子邮件**: support@gamevoice.app

## 许可证

GameVoice 使用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

---

**注意**: 这是一个开发中的项目，功能可能不完整。我们正在积极开发中，欢迎反馈和建议！