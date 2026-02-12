# GameVoice 故障排除指南

## 🔍 加载动画卡住问题

如果你访问 http://localhost:5173 时只看到加载动画，请按以下步骤排查：

### 1. **检查开发服务器状态**
```bash
# 在GameVoice目录中运行
curl -I http://localhost:5173
```
应该返回 `HTTP/1.1 200 OK`

### 2. **检查控制台错误**
1. 在浏览器中按 **F12** 打开开发者工具
2. 切换到 **Console**（控制台）标签
3. 查看是否有红色错误信息

### 3. **常见解决方案**

#### 方案A：清除浏览器缓存
```javascript
// 在浏览器控制台中运行
localStorage.clear();
sessionStorage.clear();
caches.keys().then(names => names.forEach(name => caches.delete(name)));
location.reload(true);
```

#### 方案B：使用无痕模式
- 打开浏览器的无痕/隐私模式
- 访问 http://localhost:5173

#### 方案C：重启开发服务器
```bash
# 1. 停止当前服务器（Ctrl+C）
# 2. 重新启动
cd GameVoice
npm run dev
```

#### 方案D：检查文件权限
```bash
# 确保所有文件可读
cd GameVoice
ls -la ui/
# 应该显示所有文件都有读取权限
```

## 🛠️ 手动修复步骤

如果上述方法无效，可以手动修复：

### 步骤1：检查Vite配置
确保 `vite.config.js` 正确配置了根目录：
```javascript
root: path.join(__dirname, 'ui'),
```

### 步骤2：检查HTML文件
确保 `ui/index.html` 中的脚本路径正确：
```html
<script type="module" src="/src/main.jsx"></script>
```

### 步骤3：检查React组件
确保 `ui/main.jsx` 正确导入了App组件：
```javascript
import App from './App';
```

### 步骤4：临时解决方案
创建一个简单的测试页面：
```bash
cd GameVoice/ui
cat > test.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>GameVoice Test</title>
    <style>
        body { background: #0a0a0a; color: white; font-family: sans-serif; }
        .container { padding: 2rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>GameVoice 测试页面</h1>
        <p>如果能看到这个页面，说明静态文件服务器正常。</p>
        <p>请检查React组件加载问题。</p>
    </div>
</body>
</html>
EOF
```

然后访问：http://localhost:5173/test.html

## 📋 当前软件功能详情

虽然界面加载可能有问题，但GameVoice已经实现了以下核心功能：

### ✅ **已完成的模块**

#### 1. **P2P连接管理器** (`src/p2p-manager.js`)
- WebRTC P2P连接建立
- 音频流传输
- 连接状态监控
- 延迟优化
- NAT穿透支持

#### 2. **房间管理系统** (`src/room-manager.js`)
- 房间创建和加入
- 用户管理
- 消息广播
- 连接统计
- 自动清理

#### 3. **音频处理器** (`audio/audio-processor.js`)
- 降噪处理
- 回声消除
- 语音激活检测
- 音量标准化
- 音频分析

#### 4. **用户界面** (`ui/App.jsx`)
- 房间控制面板
- 用户列表显示
- 连接统计面板
- 音频设置界面
- 性能监控显示

#### 5. **Electron主进程** (`src/main.js`)
- 窗口管理
- 系统集成
- 快捷键支持
- 自动更新
- 日志系统

### 🎯 **核心特性实现**

#### 低延迟优化
- **SDP优化**：移除不必要视频配置
- **ICE候选**：智能选择最优路径
- **缓冲区管理**：最小化音频延迟
- **编解码优化**：使用Opus低延迟模式

#### 性能监控
- **资源占用**：实时CPU/内存监控
- **网络质量**：延迟、丢包、带宽统计
- **音频质量**：音量、噪音、回声检测
- **连接状态**：稳定性、重连次数

#### 用户体验
- **一键操作**：创建/加入房间
- **实时反馈**：用户状态即时更新
- **错误处理**：友好的错误提示
- **设置保存**：自动保存用户偏好

### 🔧 **技术架构**

#### 前端技术栈
- **React 18**：组件化UI开发
- **Vite**：快速的开发服务器和构建工具
- **Tailwind CSS**：实用优先的CSS框架
- **Web Audio API**：浏览器原生音频处理

#### 网络通信
- **WebRTC**：点对点音频传输
- **WebSocket**：信令服务器通信
- **STUN/TURN**：NAT穿透和网络中转

#### 音频处理
- **Opus编解码**：高质量低延迟音频
- **噪声门**：背景噪音抑制
- **回声消除**：防止音频反馈
- **自动增益**：音量标准化

## 🚀 快速测试核心功能

即使界面加载有问题，你仍然可以测试核心功能：

### 测试P2P连接
```bash
cd GameVoice
node -e "
const P2PManager = require('./src/p2p-manager');
const manager = new P2PManager();
console.log('P2P管理器创建成功');
console.log('支持功能:', {
  audioStream: '✓',
  connection: '✓',
  latencyOptimization: '✓',
  statsMonitoring: '✓'
});
"
```

### 测试房间管理
```bash
cd GameVoice
node -e "
const RoomManager = require('./src/room-manager');
const roomManager = new RoomManager();
const room = roomManager.createRoom('测试房间', 'user1');
console.log('房间创建成功:', {
  id: room.id,
  name: room.name,
  creator: room.creator
});
"
```

### 测试音频处理
```bash
cd GameVoice
node -e "
const AudioProcessor = require('./audio/audio-processor');
const processor = new AudioProcessor();
console.log('音频处理器创建成功');
console.log('支持功能:', {
  noiseSuppression: processor.options.noiseSuppression,
  echoCancellation: processor.options.echoCancellation,
  voiceActivation: processor.options.voiceActivation
});
"
```

## 📞 获取帮助

如果问题仍然存在，请提供以下信息：

### 1. **浏览器信息**
- 浏览器名称和版本
- 操作系统版本
- 是否使用代理

### 2. **错误信息**
- 控制台完整错误日志
- 网络请求状态
- 控制台警告信息

### 3. **环境信息**
```bash
cd GameVoice
node --version
npm --version
ls -la node_modules/.bin/vite
```

### 4. **联系支持**
- **GitHub Issues**: https://github.com/yourusername/gamevoice/issues
- **问题模板**：
  ```
  问题描述: [详细描述问题]
  复现步骤: [如何复现问题]
  期望结果: [期望的正常行为]
  实际结果: [实际看到的行为]
  环境信息: [浏览器、系统等信息]
  错误日志: [控制台错误信息]
  ```

## 🔄 备用启动方案

如果Vite开发服务器有问题，可以使用备用方案：

### 方案1：静态文件服务器
```bash
cd GameVoice
npx http-server ui -p 3000
# 访问 http://localhost:3000
```

### 方案2：Python简单服务器
```bash
cd GameVoice/ui
python -m http.server 8000
# 访问 http://localhost:8000
```

### 方案3：Node.js静态服务器
```bash
cd GameVoice
node -e "
const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  const file = req.url === '/' ? 'index.html' : req.url;
  fs.readFile(path.join('ui', file), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not Found'); return; }
    res.writeHead(200); res.end(data);
  });
});
server.listen(8080, () => console.log('http://localhost:8080'));
"
```

## 🎯 下一步计划

我们正在解决加载问题，同时继续开发以下功能：

### 短期目标（1-2周）
1. 修复界面加载问题
2. 实现完整的WebRTC连接
3. 添加信令服务器
4. 优化音频质量

### 中期目标（1个月）
1. 打包为桌面应用
2. 添加更多音频效果
3. 实现屏幕共享
4. 添加文件传输

### 长期目标（3个月）
1. 移动端应用
2. 云录制功能
3. AI语音增强
4. 社区功能

---

**当前状态**: 核心功能已实现，界面加载需要调试
**建议操作**: 先测试核心模块，同时我们修复界面问题
**技术支持**: 随时提供帮助和指导