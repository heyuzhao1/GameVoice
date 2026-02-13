const { app, BrowserWindow, ipcMain, crashReporter } = require('electron');
const path = require('path');
const fs = require('fs');
const { startSignalingServer } = require('./signaling-server');

// 注册协议处理
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('voicechat', process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient('voicechat')
}

// 保持窗口对象的全局引用，避免被垃圾回收
let mainWindow;
let signalingServer;

// 单实例锁
// 在开发环境下允许运行多个实例
const isDev = process.env.NODE_ENV === 'development';
if (!isDev) {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  }
}

const userDataPath = app.getPath('userData');
const logDir = path.join(userDataPath, 'logs');
const logFile = path.join(logDir, 'main.log');

function logLine(...args) {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    const line = `[${new Date().toISOString()}] ${args
      .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
      .join(' ')}\n`;
    fs.appendFileSync(logFile, line, 'utf8');
  } catch (_) { }
  try {
    console.log(...args);
  } catch (_) { }
}

function handleDeepLink(url) {
  logLine('deep-link', url);
  if (!url || typeof url !== 'string') return;
  
  // 格式: voicechat://room/ROOM_ID
  const match = url.match(/voicechat:\/\/room\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const roomId = match[1];
    logLine('deep-link-room', roomId);
    if (mainWindow && mainWindow.webContents) {
      // 确保页面加载完成
      if (mainWindow.webContents.isLoading()) {
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('join-room-via-link', roomId);
        });
      } else {
        mainWindow.webContents.send('join-room-via-link', roomId);
      }
    }
  }
}

// 处理协议链接启动 (macOS)
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// 处理协议链接启动 (Windows/Linux)
app.on('second-instance', (event, commandLine, workingDirectory) => {
  // 当运行第二个实例时，焦点聚焦到主窗口
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    
    // 从命令行参数中提取 URL
    const url = commandLine.find(arg => arg.startsWith('voicechat://'));
    if (url) {
      handleDeepLink(url);
    }
  }
});

process.on('uncaughtException', (err) => {
  logLine('uncaughtException', err && err.stack ? err.stack : String(err));
});

process.on('unhandledRejection', (reason) => {
  logLine('unhandledRejection', reason && reason.stack ? reason.stack : String(reason));
});

try {
  crashReporter.start({
    productName: 'GameVoice',
    uploadToServer: false,
    compress: true
  });
} catch (_) { }

if (process.env.GAMEVOICE_DISABLE_HARDWARE_ACCELERATION === '1') {
  app.disableHardwareAcceleration();
}

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'GameVoice - 游戏开黑语音',
    frame: true,
    transparent: false,
    backgroundColor: '#1a1a1a'
  });

  const distIndexPath = path.join(__dirname, '../dist/index.html');
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const hasDist = fs.existsSync(distIndexPath);
  const isDev = process.env.NODE_ENV === 'development' || !hasDist;

  // 添加Content Security Policy
  const csp = process.env.NODE_ENV === 'development'
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173 ws://127.0.0.1:8765; connect-src 'self' ws: wss: http: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' blob: data:;"
    : "default-src 'self'; connect-src 'self' ws: wss: http: https: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' blob: data:;";

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp]
      }
    });
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logLine('renderer', { level, message, line, sourceId });
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logLine('did-fail-load', { errorCode, errorDescription, validatedURL, isMainFrame });
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logLine('render-process-gone', details);
  });

  mainWindow.webContents.on('unresponsive', () => {
    logLine('unresponsive');
  });

  mainWindow.webContents.on('responsive', () => {
    logLine('responsive');
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    if (process.env.GAMEVOICE_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  } else {
    mainWindow.loadFile(distIndexPath);
  }

  // 处理权限请求
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ['media', 'audioCapture', 'mediaKeySystem'];
    if (allowedPermissions.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // 处理权限检查 (同步) - 修复 Windows 上 enumerateDevices 返回空的问题
  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const allowedPermissions = ['media', 'audioCapture', 'mediaKeySystem'];
    if (allowedPermissions.includes(permission)) {
      return true;
    }
    return false;
  });

  // 检查媒体访问权限 (macOS)
  const { systemPreferences } = require('electron');
  const checkMediaAccess = async () => {
    if (process.platform === 'darwin') {
      const status = systemPreferences.getMediaAccessStatus('microphone');
      if (status === 'not-determined') {
        const success = await systemPreferences.askForMediaAccess('microphone');
        console.log('麦克风权限请求结果:', success);
      }
    }
  };
  checkMediaAccess();

  // 窗口关闭时触发
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 优化性能设置
  mainWindow.webContents.on('did-finish-load', () => {
    // 启用硬件加速
    mainWindow.webContents.setZoomFactor(1.0);
    mainWindow.webContents.setVisualZoomLevelLimits(1, 1);

    const autoJoinRoomId = (process.env.GAMEVOICE_AUTOJOIN_ROOM_ID || '').trim();
    if (autoJoinRoomId) {
      // 这里的自动加入逻辑可能需要更新以使用新的 join-room-via-link 机制
      // 或者保持不变作为备用
      mainWindow.webContents.send('join-room-via-link', autoJoinRoomId);
    }
  });
}

// Electron 初始化完成
app.whenReady().then(() => {
  const signalingPort = Number(process.env.GAMEVOICE_SIGNALING_PORT || 8765);
  try {
    signalingServer = startSignalingServer({
      port: signalingPort,
      log: (...args) => logLine(...args)
    });
    logLine('signaling-server-started', { signalingPort });
  } catch (e) {
    if (e && e.code === 'EADDRINUSE') {
      logLine('signaling-server-port-in-use', { signalingPort });
    } else {
      logLine('signaling-server-start-failed', e && e.stack ? e.stack : String(e));
    }
  }

  createWindow();

  // 检查启动参数中是否有 URL (Windows/Linux 首次启动)
  const url = process.argv.find(arg => arg.startsWith('voicechat://'));
  if (url) {
    setTimeout(() => handleDeepLink(url), 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  try {
    if (signalingServer) await signalingServer.close();
  } catch (_) { }
});

// IPC 通信处理
ipcMain.handle('get-app-info', () => {
  return {
    version: app.getVersion(),
    name: app.getName(),
    platform: process.platform
  };
});

ipcMain.handle('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('maximize-window', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

// 性能优化：降低后台资源占用
app.on('browser-window-blur', () => {
  if (mainWindow) {
    if (typeof mainWindow.webContents.setBackgroundThrottling === 'function') {
      mainWindow.webContents.setBackgroundThrottling(true);
    }
  }
});

app.on('browser-window-focus', () => {
  if (mainWindow) {
    if (typeof mainWindow.webContents.setBackgroundThrottling === 'function') {
      mainWindow.webContents.setBackgroundThrottling(false);
    }
  }
});

// 处理命令行参数
if (process.argv.includes('--low-latency')) {
  app.commandLine.appendSwitch('high-dpi-support', '1');
  app.commandLine.appendSwitch('force-device-scale-factor', '1');
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

console.log('GameVoice 主进程启动完成');
