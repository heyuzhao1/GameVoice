# GameVoice 安装指南

## 系统要求

### 最低配置
- **操作系统**: Windows 10/11, macOS 10.15+, Linux (Ubuntu 20.04+)
- **内存**: 4GB RAM
- **存储**: 500MB 可用空间
- **网络**: 宽带互联网连接
- **音频**: 麦克风和扬声器/耳机

### 推荐配置
- **操作系统**: Windows 11, macOS 12+, Ubuntu 22.04+
- **内存**: 8GB RAM 或更高
- **处理器**: 4核 CPU 或更高
- **网络**: 稳定的宽带连接（上传/下载 > 5Mbps）
- **音频**: USB 耳机或独立麦克风

## 安装步骤

### 方法一：快速安装（推荐）

1. **安装 Node.js** (版本 18 或更高)
   - 访问 [Node.js 官网](https://nodejs.org/)
   - 下载并安装 LTS 版本

2. **克隆或下载项目**
   ```bash
   git clone https://github.com/yourusername/gamevoice.git
   cd gamevoice
   ```

3. **安装依赖**
   ```bash
   npm install
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   ```

5. **在另一个终端中启动 Electron**
   ```bash
   npm start
   ```

### 方法二：使用预构建版本（即将推出）

1. 从 [Releases 页面](https://github.com/yourusername/gamevoice/releases) 下载对应平台的安装包
2. 运行安装程序
3. 启动 GameVoice 应用

## 开发环境配置

### 1. 安装开发工具
```bash
# 安装 Electron 构建工具
npm install -g electron-forge

# 安装代码检查工具
npm install -g eslint

# 安装 TypeScript（可选）
npm install -g typescript
```

### 2. 配置编辑器
推荐使用 VS Code 并安装以下扩展：
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- React/Redux/React-Native snippets

### 3. 环境变量
创建 `.env` 文件：
```env
NODE_ENV=development
VITE_APP_VERSION=0.1.0
VITE_WS_SERVER=ws://localhost:3000
```

## 构建应用

### 开发构建
```bash
npm run build
```

### 生产构建
```bash
# 打包为可执行文件
npm run package

# 创建安装程序
npm run make
```

### 平台特定构建
```bash
# Windows
npm run make -- --platform=win32

# macOS
npm run make -- --platform=darwin

# Linux
npm run make -- --platform=linux
```

## 故障排除

### 常见问题

#### 1. 音频设备无法识别
- 检查麦克风权限
- 确保音频设备已连接并启用
- 重启应用或电脑

#### 2. 网络连接失败
- 检查防火墙设置
- 确保 STUN 服务器可访问
- 尝试使用 TURN 服务器

#### 3. 高延迟问题
- 关闭其他占用带宽的应用
- 使用有线网络连接
- 选择最近的服务器区域

#### 4. 应用崩溃
- 检查系统日志
- 更新显卡驱动
- 减少同时运行的应用程序

### 调试模式

启动应用时添加调试参数：
```bash
npm start -- --debug
```

查看日志文件：
- Windows: `%APPDATA%/GameVoice/logs/`
- macOS: `~/Library/Logs/GameVoice/`
- Linux: `~/.config/GameVoice/logs/`

## 性能优化

### 1. 降低资源占用
```bash
# 启动低资源模式
npm start -- --low-latency
```

### 2. 禁用硬件加速（如遇图形问题）
```bash
npm start -- --disable-gpu
```

### 3. 启用详细日志
```bash
npm start -- --verbose
```

## 更新应用

### 自动更新（生产版本）
应用会自动检查更新并在后台下载。

### 手动更新
1. 备份当前配置
2. 下载新版本
3. 覆盖安装
4. 恢复配置

## 卸载

### Windows
1. 控制面板 → 程序和功能
2. 选择 GameVoice → 卸载

### macOS
1. 将 GameVoice 拖到废纸篓
2. 清空废纸篓

### Linux
```bash
# 如果通过包管理器安装
sudo apt remove gamevoice

# 如果手动安装
rm -rf ~/.config/GameVoice
rm -rf /opt/gamevoice
```

## 获取帮助

- **文档**: [docs.gamevoice.app](https://docs.gamevoice.app)
- **社区**: [Discord 服务器](https://discord.gg/gamevoice)
- **问题反馈**: [GitHub Issues](https://github.com/yourusername/gamevoice/issues)
- **电子邮件**: support@gamevoice.app

## 贡献指南

想要贡献代码？请查看 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 许可证

GameVoice 使用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。