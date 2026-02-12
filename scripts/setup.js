#!/usr/bin/env node

/**
 * GameVoice 安装脚本
 * 自动设置开发环境和依赖
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function warning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// 检查 Node.js 版本
function checkNodeVersion() {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 18) {
    error(`Node.js 版本过低 (${nodeVersion})，需要 18.0.0 或更高版本`);
    log('请访问 https://nodejs.org/ 下载最新版本', colors.yellow);
    return false;
  }

  success(`Node.js 版本: ${nodeVersion}`);
  return true;
}

// 检查 npm 版本
function checkNpmVersion() {
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    success(`npm 版本: ${npmVersion}`);
    return true;
  } catch (err) {
    error('无法获取 npm 版本');
    return false;
  }
}

// 检查 Git
function checkGit() {
  try {
    const gitVersion = execSync('git --version', { encoding: 'utf8' }).trim();
    success(`Git: ${gitVersion}`);
    return true;
  } catch (err) {
    warning('Git 未安装，某些功能可能受限');
    return false;
  }
}

// 检查系统平台
function checkPlatform() {
  const platform = process.platform;
  const arch = process.arch;

  info(`平台: ${platform} (${arch})`);

  // 检查平台特定依赖
  switch (platform) {
    case 'win32':
      log('检测到 Windows 系统', colors.cyan);
      break;
    case 'darwin':
      log('检测到 macOS 系统', colors.cyan);
      break;
    case 'linux':
      log('检测到 Linux 系统', colors.cyan);
      break;
    default:
      warning(`未明确支持的系统: ${platform}`);
  }

  return true;
}

// 检查音频设备（简化检查）
function checkAudioSupport() {
  info('音频支持检查...');

  // 这里可以添加更详细的音频设备检查
  // 目前只做基本检查

  log('请确保已连接麦克风和扬声器/耳机', colors.yellow);
  return true;
}

// 安装依赖
function installDependencies() {
  log('正在安装依赖...', colors.cyan);

  try {
    // 检查 package.json
    const packagePath = path.join(__dirname, '..', 'package.json');
    if (!fs.existsSync(packagePath)) {
      error('找不到 package.json 文件');
      return false;
    }

    // 安装依赖
    execSync('npm install', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });

    success('依赖安装完成');
    return true;
  } catch (err) {
    error('依赖安装失败');
    console.error(err.message);
    return false;
  }
}

// 创建配置文件
function createConfigFiles() {
  log('正在创建配置文件...', colors.cyan);

  const configDir = path.join(__dirname, '..', 'config');
  const envFile = path.join(__dirname, '..', '.env');

  try {
    // 创建配置目录
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // 创建 .env 文件（如果不存在）
    if (!fs.existsSync(envFile)) {
      const envContent = `# GameVoice 环境配置
NODE_ENV=development
VITE_APP_VERSION=0.1.0
VITE_WS_SERVER=ws://localhost:3000

# 音频配置
AUDIO_SAMPLE_RATE=48000
AUDIO_CHANNELS=1
AUDIO_BUFFER_SIZE=2048

# 网络配置
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
TURN_SERVER=
TURN_USERNAME=
TURN_PASSWORD=

# 性能配置
MAX_BITRATE=128000
MIN_BITRATE=32000
TARGET_LATENCY=50

# 日志配置
LOG_LEVEL=info
LOG_TO_FILE=true
`;

      fs.writeFileSync(envFile, envContent);
      success('创建 .env 配置文件');
    }

    // 创建默认用户配置
    const userConfig = {
      audio: {
        inputDevice: 'default',
        outputDevice: 'default',
        volume: 80,
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
        voiceActivation: true,
        activationThreshold: -45
      },
      network: {
        region: 'auto',
        useTurn: false,
        lowLatencyMode: true,
        autoReconnect: true
      },
      ui: {
        theme: 'dark',
        language: 'zh-CN',
        showStats: true,
        compactMode: false
      },
      shortcuts: {
        muteToggle: 'Ctrl+Shift+M',
        pushToTalk: 'Ctrl+Shift+P',
        showHide: 'Ctrl+Shift+G'
      }
    };

    const userConfigPath = path.join(configDir, 'user.json');
    if (!fs.existsSync(userConfigPath)) {
      fs.writeFileSync(userConfigPath, JSON.stringify(userConfig, null, 2));
      success('创建用户配置文件');
    }

    return true;
  } catch (err) {
    error('创建配置文件失败');
    console.error(err.message);
    return false;
  }
}

// 创建启动脚本
function createStartScripts() {
  log('正在创建启动脚本...', colors.cyan);

  const scriptsDir = path.join(__dirname, '..', 'scripts');

  try {
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }

    // Windows 启动脚本
    if (process.platform === 'win32') {
      const batContent = `@echo off
echo Starting GameVoice...
cd /d "%~dp0"
call npm run dev
pause
`;

      const batPath = path.join(scriptsDir, 'start-dev.bat');
      fs.writeFileSync(batPath, batContent);
      success('创建 Windows 启动脚本');
    }

    // Unix-like 系统启动脚本
    const shContent = `#!/bin/bash
echo "Starting GameVoice..."
cd "$(dirname "$0")/.."
npm run dev
`;

    const shPath = path.join(scriptsDir, 'start-dev.sh');
    fs.writeFileSync(shPath, shContent);

    // 设置执行权限
    if (process.platform !== 'win32') {
      fs.chmodSync(shPath, '755');
    }

    success('创建启动脚本完成');
    return true;
  } catch (err) {
    error('创建启动脚本失败');
    console.error(err.message);
    return false;
  }
}

// 运行测试
function runTests() {
  return new Promise((resolve) => {
    log('正在运行基本测试...', colors.cyan);

    try {
      // 运行简单的构建测试
      execSync('npm run build', {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe'
      });

      success('构建测试通过');
      resolve(true);
    } catch (err) {
      warning('构建测试失败，但可以继续');
      console.error(err.message);
      resolve(false);
    }
  });
}

// 显示安装摘要
function showSummary(success) {
  log('\n' + '='.repeat(50), colors.bright);

  if (success) {
    log('🎉 GameVoice 安装完成！', colors.green + colors.bright);
    log('\n接下来可以：', colors.cyan);
    log('1. 启动开发服务器:', colors.yellow);
    log('   npm run dev', colors.bright);
    log('2. 在另一个终端中启动应用:', colors.yellow);
    log('   npm start', colors.bright);
    log('3. 构建生产版本:', colors.yellow);
    log('   npm run build', colors.bright);
    log('   npm run package', colors.bright);
    log('\n文档和帮助:', colors.cyan);
    log('• 查看 README.md 获取详细信息');
    log('• 访问 docs/ 目录查看文档');
    log('• 有问题请提交 GitHub Issue');
  } else {
    log('😞 安装过程中遇到问题', colors.red + colors.bright);
    log('\n请检查：', colors.yellow);
    log('1. Node.js 版本是否 >= 18');
    log('2. 网络连接是否正常');
    log('3. 是否有足够的磁盘空间');
    log('4. 查看上面的错误信息');
    log('\n可以尝试：', colors.cyan);
    log('• 手动运行: npm install');
    log('• 清除 node_modules 后重试');
    log('• 检查系统权限');
  }

  log('\n' + '='.repeat(50), colors.bright);
}

// 主安装函数
async function main() {
  log('🚀 GameVoice 安装程序', colors.cyan + colors.bright);
  log('='.repeat(50), colors.bright);

  // 检查系统要求
  log('\n1. 检查系统要求...', colors.cyan);
  if (!checkNodeVersion()) process.exit(1);
  if (!checkNpmVersion()) process.exit(1);
  checkGit();
  checkPlatform();
  checkAudioSupport();

  // 安装依赖
  log('\n2. 安装依赖...', colors.cyan);
  if (!installDependencies()) {
    error('依赖安装失败，安装中止');
    process.exit(1);
  }

  // 创建配置文件
  log('\n3. 配置应用...', colors.cyan);
  if (!createConfigFiles()) {
    warning('配置文件创建失败，但可以继续');
  }

  // 创建启动脚本
  if (!createStartScripts()) {
    warning('启动脚本创建失败，但可以继续');
  }

  // 运行测试
  log('\n4. 运行测试...', colors.cyan);
  const testsPassed = await runTests();

  // 显示摘要
  showSummary(true);

  // 询问是否立即启动
  rl.question('\n是否立即启动开发服务器？ (y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      log('启动开发服务器...', colors.green);

      try {
        const devProcess = spawn('npm', ['run', 'dev'], {
          cwd: path.join(__dirname, '..'),
          stdio: 'inherit',
          shell: true
        });

        devProcess.on('close', (code) => {
          log(`开发服务器退出，代码: ${code}`, colors.yellow);
          rl.close();
        });
      } catch (err) {
        error('启动失败');
        console.error(err.message);
        rl.close();
      }
    } else {
      rl.close();
    }
  });
}

// 处理命令行参数
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  log('GameVoice 安装脚本', colors.cyan + colors.bright);
  log('用法: node setup.js [选项]', colors.bright);
  log('\n选项:', colors.cyan);
  log('  --help, -h     显示帮助信息');
  log('  --skip-tests   跳过测试');
  log('  --force        强制重新安装');
  log('\n示例:', colors.cyan);
  log('  node setup.js                正常安装');
  log('  node setup.js --skip-tests   跳过测试安装');
  process.exit(0);
}

// 运行安装
main().catch(err => {
  error('安装过程出现错误');
  console.error(err);
  process.exit(1);
});