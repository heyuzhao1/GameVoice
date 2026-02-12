# GameVoice 打包指南

本文档详细介绍了如何将 GameVoice 应用打包为 Windows 可执行文件。

## 项目结构

```
GameVoice/
├── src/                    # Electron主进程代码
│   ├── main.js           # 主进程入口
│   ├── audio-manager.js  # 音频管理
│   ├── p2p-manager.js    # P2P连接管理
│   ├── room-manager.js   # 房间管理
│   └── voice-app.js      # 语音应用逻辑
├── ui/                    # React前端界面
│   ├── App.jsx           # 主应用组件
│   ├── main.jsx          # React入口
│   ├── index.html        # HTML模板
│   └── index.css         # 样式文件
├── dist/                  # 构建输出目录
├── release/              # 打包输出目录
├── assets/               # 静态资源
├── build/                # 构建配置
├── scripts/              # 构建脚本
├── package.json          # 项目配置
├── electron-builder.json # Electron打包配置
├── vite.config.js        # Vite配置
└── tailwind.config.js    # Tailwind CSS配置
```

## 打包工具

项目使用以下工具进行打包：

- **electron-builder**: 26.7.0 - Electron应用打包工具
- **vite**: 5.2.0 - 前端构建工具
- **terser**: 5.46.0 - JavaScript压缩工具

## 打包命令

### 开发命令

```bash
# 启动开发服务器
npm run dev

# 启动Electron应用（开发模式）
npm start

# 构建React应用
npm run build

# 预览构建结果
npm run preview
```

### 打包命令

```bash
# 完整打包流程（构建 + 打包）
npm run dist

# Windows安装包
npm run dist:win

# Windows便携版
npm run dist:portable

# 所有平台
npm run dist:all

# 仅打包目录（不创建安装包）
npm run package
```

### 高级打包脚本

```bash
# 使用自定义打包脚本
node scripts/build.js          # 默认打包为目录
node scripts/build.js dir      # 打包为目录
node scripts/build.js portable # 打包为便携版
node scripts/build.js nsis     # 打包为安装包
```

## 打包配置

### electron-builder.json

主要配置选项：

```json
{
  "appId": "com.gamevoice.app",
  "productName": "GameVoice",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "src/**/*",
    "node_modules/**/*",
    "package.json"
  ],
  "win": {
    "target": ["dir", "portable", "nsis"],
    "icon": "assets/icon.ico",
    "legalTrademarks": "GameVoice",
    "requestedExecutionLevel": "asInvoker"
  }
}
```

### 图标要求

应用需要以下图标文件：

1. **Windows图标**: `assets/icon.ico` (建议256x256像素)
2. **PNG图标**: `assets/icon.png` (建议256x256像素)
3. **macOS图标**: `assets/icon.icns` (建议1024x1024像素)

如果没有图标文件，打包脚本会自动创建占位符。

## 打包流程

### 1. 环境准备

确保已安装：
- Node.js 18.0.0 或更高版本
- npm 9.0.0 或更高版本

### 2. 安装依赖

```bash
npm install
```

### 3. 构建应用

```bash
# 构建React前端
npm run build

# 检查构建结果
ls -la dist/
```

### 4. 打包Electron应用

```bash
# 方法1: 使用npm脚本
npm run dist:win

# 方法2: 使用自定义脚本
node scripts/build.js nsis
```

### 5. 验证打包结果

打包完成后，检查以下目录：

- `release/win-unpacked/` - 解压版应用
- `release/GameVoice Setup 0.1.0.exe` - Windows安装包
- `release/GameVoice-Portable.exe` - 便携版应用

## 常见问题

### 1. 图标文件缺失

**问题**: 打包时提示图标文件不存在
**解决**: 创建图标文件或使用占位符

```bash
# 自动创建占位符图标
node scripts/build.js
```

### 2. 签名错误

**问题**: Windows代码签名失败
**解决**: 禁用签名（仅用于测试）

```bash
# 在electron-builder.json中添加
"win": {
  "signAndEditExecutable": false
}
```

### 3. 文件大小过大

**问题**: 打包后的应用文件过大
**解决**: 优化依赖和资源

- 使用 `asar` 打包（默认启用）
- 排除不必要的文件
- 压缩资源文件

### 4. 运行时错误

**问题**: 打包的应用无法启动
**解决**: 检查依赖和路径

1. 确认所有依赖已正确安装
2. 检查 `package.json` 中的 `main` 字段
3. 验证资源文件路径

## 优化建议

### 1. 减小包体积

- 使用 `npm prune --production` 移除开发依赖
- 配置 `electron-builder.json` 中的 `files` 字段，排除不必要的文件
- 启用 `asar` 压缩

### 2. 性能优化

- 使用代码分割
- 懒加载非关键模块
- 优化图片和资源

### 3. 安全性

- 启用上下文隔离
- 使用安全的IPC通信
- 验证用户输入

## 发布流程

### 1. 版本管理

```bash
# 更新版本号
npm version patch  # 0.1.0 → 0.1.1
npm version minor  # 0.1.0 → 0.2.0
npm version major  # 0.1.0 → 1.0.0
```

### 2. 创建发布包

```bash
# 构建所有平台的安装包
npm run dist:all

# 验证发布包
ls -la release/
```

### 3. 发布到分发平台

- **GitHub Releases**: 上传安装包
- **官方网站**: 提供下载链接
- **应用商店**: 提交到Microsoft Store

## 技术支持

如果遇到打包问题，请：

1. 检查控制台输出
2. 查看 `release/builder-debug.yml` 日志文件
3. 参考 [electron-builder文档](https://www.electron.build/)
4. 查看项目中的 `TROUBLESHOOTING.md` 文件

## 更新日志

### v0.1.0 (2024-02-08)
- 初始版本
- 支持Windows打包
- 基本的语音聊天功能
- P2P连接管理