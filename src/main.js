const { app, BrowserWindow, ipcMain, crashReporter } = require('electron');
const path = require('path');
const fs = require('fs');
const { startSignalingServer } = require('./signaling-server');

// 保持窗口对象的全局引用，避免被垃圾回收
let mainWindow;
let signalingServer;

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
    ? "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173 ws://127.0.0.1:8765; connect-src 'self' ws: wss: http: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
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
      const script = `
        (function() {
          return new Promise((resolve) => {
            const startedAt = Date.now();
            const tick = () => {
              try {
                const input = document.querySelector('input[placeholder="输入房间ID"]');
                const buttons = Array.from(document.querySelectorAll('button'));
                const joinBtn = buttons.find(b => (b.textContent || '').trim() === '加入房间');

                if (input && joinBtn) {
                  input.value = ${JSON.stringify(autoJoinRoomId)};
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  joinBtn.click();
                  resolve({ ok: true, clicked: true });
                  return;
                }

                if (Date.now() - startedAt > 15000) {
                  resolve({ ok: false, clicked: false, foundInput: !!input, foundJoinBtn: !!joinBtn });
                  return;
                }

                setTimeout(tick, 300);
              } catch (e) {
                resolve({ ok: false, error: String(e) });
              }
            };
            tick();
          });
        })();
      `;
      mainWindow.webContents
        .executeJavaScript(script, true)
        .then((result) => logLine('autojoin-result', result))
        .catch((e) => logLine('autojoin-failed', e && e.stack ? e.stack : String(e)));
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
