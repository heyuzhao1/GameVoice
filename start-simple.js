#!/usr/bin/env node

/**
 * GameVoice 简化启动脚本
 * 用于快速启动开发服务器和Electron应用
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const http = require('http');
const https = require('https');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// 日志函数
function log(message, color = colors.white, prefix = '') {
  console.log(`${color}${prefix}${message}${colors.reset}`);
}

function info(message) {
  log(message, colors.cyan, '[INFO] ');
}

function success(message) {
  log(message, colors.green, '[SUCCESS] ');
}

function warning(message) {
  log(message, colors.yellow, '[WARNING] ');
}

function error(message) {
  log(message, colors.red, '[ERROR] ');
}

// 检查依赖
function checkDependencies() {
  info('检查依赖...');

  const requiredCommands = ['node', 'npm'];
  const missingCommands = [];

  for (const cmd of requiredCommands) {
    try {
      execSync(`${cmd} --version`, { stdio: 'ignore' });
    } catch (err) {
      missingCommands.push(cmd);
    }
  }

  if (missingCommands.length > 0) {
    error(`缺少必要依赖: ${missingCommands.join(', ')}`);
    error('请安装 Node.js 和 npm 后再试');
    return false;
  }

  // 检查 package.json
  const packagePath = path.join(__dirname, 'package.json');
  if (!fs.existsSync(packagePath)) {
    error('找不到 package.json');
    return false;
  }

  success('依赖检查通过');
  return true;
}

// 安装依赖
function installDependencies() {
  info('安装依赖...');

  return new Promise((resolve, reject) => {
    const npmInstall = spawn('npm', ['install'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    npmInstall.on('close', (code) => {
      if (code === 0) {
        success('依赖安装完成');
        resolve();
      } else {
        error('依赖安装失败');
        reject(new Error(`npm install 退出代码: ${code}`));
      }
    });

    npmInstall.on('error', (err) => {
      error(`依赖安装错误: ${err.message}`);
      reject(err);
    });
  });
}

function waitForHttp(url, timeoutMs = 30000) {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`等待服务就绪超时: ${url}`));
        return;
      }

      try {
        const client = url.startsWith('https:') ? https : http;
        const req = client.request(url, { method: 'GET' }, (res) => {
          res.resume();
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
            resolve();
          } else {
            setTimeout(check, 300);
          }
        });

        req.on('error', () => {
          setTimeout(check, 300);
        });

        req.end();
      } catch (e) {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

function startDevServer() {
  info('启动开发服务器...');

  return new Promise((resolve, reject) => {
    const vite = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    waitForHttp('http://localhost:5173', 45000)
      .then(() => {
        success('开发服务器已就绪: http://localhost:5173');
        resolve(vite);
      })
      .catch((err) => {
        error(err.message);
        try {
          vite.kill();
        } catch { }
        reject(err);
      });

    vite.on('close', (code) => {
      if (code !== 0) {
        warning(`开发服务器退出，代码: ${code}`);
      }
    });

    vite.on('error', (err) => {
      error(`开发服务器启动错误: ${err.message}`);
      reject(err);
    });
  });
}

// 启动Electron应用
function startElectronApp(devServer) {
  info('启动Electron应用...');

  return new Promise((resolve, reject) => {
    const electron = spawn('npm', ['run', 'electron'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        NODE_ENV: 'development'
      }
    });

    electron.on('close', (code) => {
      info(`Electron应用已退出，代码: ${code}`);

      if (devServer) {
        info('关闭开发服务器...');
        try {
          devServer.kill();
        } catch { }
      }

      resolve();
    });

    electron.on('error', (err) => {
      error(`Electron启动错误: ${err.message}`);
      reject(err);
    });

    success('Electron应用已启动');
  });
}

// 仅启动开发服务器（用于Web开发）
async function startDevServerOnly() {
  info('仅启动开发服务器（Web模式）...');

  const vite = await startDevServer();

  return new Promise((resolve, reject) => {
    vite.on('close', (code) => {
      if (code !== 0) {
        error(`开发服务器异常退出，代码: ${code}`);
        reject(new Error(`Vite 退出代码: ${code}`));
      } else {
        resolve();
      }
    });

    vite.on('error', (err) => {
      error(`开发服务器启动错误: ${err.message}`);
      reject(err);
    });
  });
}

// 构建应用
function buildApp() {
  info('构建应用...');

  return new Promise((resolve, reject) => {
    const build = spawn('npm', ['run', 'build'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    build.on('close', (code) => {
      if (code === 0) {
        success('应用构建完成');
        resolve();
      } else {
        error(`构建失败，代码: ${code}`);
        reject(new Error(`构建退出代码: ${code}`));
      }
    });

    build.on('error', (err) => {
      error(`构建错误: ${err.message}`);
      reject(err);
    });
  });
}

// 打包应用
function packageApp() {
  info('打包应用...');

  return new Promise((resolve, reject) => {
    const package = spawn('npm', ['run', 'package'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    package.on('close', (code) => {
      if (code === 0) {
        success('应用打包完成');
        resolve();
      } else {
        error(`打包失败，代码: ${code}`);
        reject(new Error(`打包退出代码: ${code}`));
      }
    });

    package.on('error', (err) => {
      error(`打包错误: ${err.message}`);
      reject(err);
    });
  });
}

// 清理构建文件
function cleanBuild() {
  info('清理构建文件...');

  const buildDir = path.join(__dirname, 'dist');
  const outDir = path.join(__dirname, 'out');

  try {
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true });
      info(`已删除: ${buildDir}`);
    }

    if (fs.existsSync(outDir)) {
      fs.rmSync(outDir, { recursive: true });
      info(`已删除: ${outDir}`);
    }

    success('清理完成');
  } catch (err) {
    warning(`清理时出错: ${err.message}`);
  }
}

// 显示帮助信息
function showHelp() {
  console.log(`
${colors.bright}${colors.cyan}GameVoice 启动脚本${colors.reset}

${colors.bright}使用方法:${colors.reset}
  node start-simple.js [命令]

${colors.bright}可用命令:${colors.reset}
  ${colors.green}dev${colors.reset}         启动完整开发环境（开发服务器 + Electron）
  ${colors.green}web${colors.reset}         仅启动开发服务器（Web模式）
  ${colors.green}build${colors.reset}       构建应用
  ${colors.green}package${colors.reset}     打包应用
  ${colors.green}clean${colors.reset}       清理构建文件
  ${colors.green}install${colors.reset}     安装依赖
  ${colors.green}help${colors.reset}        显示此帮助信息

${colors.bright}示例:${colors.reset}
  node start-simple.js dev      # 启动开发环境
  node start-simple.js web      # 仅启动Web开发服务器
  node start-simple.js build    # 构建应用
  `);
}

// 主函数
async function main() {
  console.log(`
${colors.bright}${colors.magenta}
   ██████  █████  ███    ███ ███████ ██    ██ ██████  ██ ███████ ███████
  ██      ██   ██ ████  ████ ██      ██    ██ ██   ██ ██ ██      ██
  ██      ███████ ██ ████ ██ █████   ██    ██ ██████  ██ █████   ███████
  ██      ██   ██ ██  ██  ██ ██      ██    ██ ██   ██ ██ ██           ██
   ██████ ██   ██ ██      ██ ███████  ██████  ██   ██ ██ ███████ ███████
${colors.reset}
  ${colors.dim}低延迟游戏开黑语音程序${colors.reset}
  `);

  const args = process.argv.slice(2);
  const command = args[0] || 'dev';

  try {
    // 检查依赖
    if (!checkDependencies()) {
      process.exit(1);
    }

    switch (command) {
      case 'dev':
        // 完整开发环境
        await installDependencies();
        const devServer = await startDevServer();
        await startElectronApp(devServer);
        break;

      case 'web':
        // 仅Web开发
        await installDependencies();
        await startDevServerOnly();
        break;

      case 'build':
        // 构建应用
        await installDependencies();
        await buildApp();
        break;

      case 'package':
        // 打包应用
        await installDependencies();
        await buildApp();
        await packageApp();
        break;

      case 'clean':
        // 清理
        cleanBuild();
        break;

      case 'install':
        // 安装依赖
        await installDependencies();
        break;

      case 'help':
      default:
        showHelp();
        break;
    }
  } catch (err) {
    error(`执行失败: ${err.message}`);
    process.exit(1);
  }
}

// 处理退出信号
process.on('SIGINT', () => {
  info('\n收到退出信号，正在关闭...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  info('\n收到终止信号，正在关闭...');
  process.exit(0);
});

// 启动
if (require.main === module) {
  main().catch((err) => {
    error(`未处理的错误: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  checkDependencies,
  installDependencies,
  startDevServer,
  startElectronApp,
  buildApp,
  packageApp,
  cleanBuild
};
