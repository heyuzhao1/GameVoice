#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const releaseDir = path.join(projectRoot, 'release');

console.log('🚀 GameVoice 打包脚本启动...');
console.log(`项目根目录: ${projectRoot}`);

// 清理函数
function cleanReleaseDir() {
  if (fs.existsSync(releaseDir)) {
    console.log('🧹 清理旧的 release 目录...');
    fs.rmSync(releaseDir, { recursive: true, force: true });
  }
}

// 构建React应用
function buildReactApp() {
  console.log('🔨 构建React应用...');
  try {
    execSync('npm run build', { cwd: projectRoot, stdio: 'inherit' });
    console.log('✅ React应用构建完成');
  } catch (error) {
    console.error('❌ React应用构建失败:', error.message);
    process.exit(1);
  }
}

// 检查必要文件
function checkRequiredFiles() {
  console.log('📋 检查必要文件...');

  const requiredFiles = [
    'package.json',
    'src/main.js',
    'dist/index.html',
    'electron-builder.json'
  ];

  const missingFiles = [];

  for (const file of requiredFiles) {
    const filePath = path.join(projectRoot, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    console.error('❌ 缺少必要文件:', missingFiles.join(', '));
    process.exit(1);
  }

  console.log('✅ 所有必要文件都存在');
}

// 创建图标占位符
function createIconPlaceholder() {
  console.log('🎨 创建图标占位符...');

  const iconDir = path.join(projectRoot, 'assets');
  if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
  }

  const iconFiles = [
    { name: 'icon.ico', content: 'Windows图标占位符' },
    { name: 'icon.png', content: 'PNG图标占位符' },
    { name: 'icon.icns', content: 'macOS图标占位符' }
  ];

  for (const icon of iconFiles) {
    const iconPath = path.join(iconDir, icon.name);
    if (!fs.existsSync(iconPath)) {
      fs.writeFileSync(iconPath, icon.content);
      console.log(`  创建: ${icon.name}`);
    }
  }

  console.log('✅ 图标文件准备完成');
}

// 打包Electron应用
function packageElectronApp(target = 'dir') {
  console.log(`📦 打包Electron应用 (${target})...`);

  try {
    let command;
    if (target === 'dir') {
      command = 'npx electron-builder --dir --config.win.signAndEditExecutable=false';
    } else if (target === 'portable') {
      command = 'npx electron-builder --win portable --config.win.signAndEditExecutable=false';
    } else if (target === 'nsis') {
      command = 'npx electron-builder --win nsis --config.win.signAndEditExecutable=false';
    } else {
      command = 'npx electron-builder --config.publish=never --config.win.signAndEditExecutable=false';
    }

    execSync(command, { cwd: projectRoot, stdio: 'inherit' });
    console.log(`✅ Electron应用打包完成 (${target})`);
  } catch (error) {
    console.error(`❌ Electron应用打包失败 (${target}):`, error.message);
    process.exit(1);
  }
}

// 验证打包结果
function verifyBuildResult() {
  console.log('🔍 验证打包结果...');

  const unpackedDir = path.join(releaseDir, 'win-unpacked');
  if (!fs.existsSync(unpackedDir)) {
    console.error('❌ 打包目录不存在');
    process.exit(1);
  }

  const requiredBuildFiles = [
    'GameVoice.exe',
    'resources/app/package.json',
    'resources/app/dist/index.html',
    'resources/app/src/main.js'
  ];

  const missingBuildFiles = [];

  for (const file of requiredBuildFiles) {
    const filePath = path.join(unpackedDir, file);
    if (!fs.existsSync(filePath)) {
      missingBuildFiles.push(file);
    }
  }

  if (missingBuildFiles.length > 0) {
    console.error('❌ 打包结果不完整，缺少文件:', missingBuildFiles.join(', '));
    process.exit(1);
  }

  console.log('✅ 打包结果验证通过');

  // 显示打包信息
  const exePath = path.join(unpackedDir, 'GameVoice.exe');
  const stats = fs.statSync(exePath);
  const fileSize = (stats.size / (1024 * 1024)).toFixed(2);

  console.log('\n📊 打包信息:');
  console.log(`  可执行文件: ${exePath}`);
  console.log(`  文件大小: ${fileSize} MB`);
  console.log(`  输出目录: ${unpackedDir}`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const target = args[0] || 'dir';

  console.log(`🎯 目标: ${target}`);
  console.log('='.repeat(50));

  try {
    // 步骤1: 清理
    cleanReleaseDir();

    // 步骤2: 检查文件
    checkRequiredFiles();

    // 步骤3: 创建图标
    createIconPlaceholder();

    // 步骤4: 构建React应用
    buildReactApp();

    // 步骤5: 打包Electron应用
    packageElectronApp(target);

    // 步骤6: 验证结果
    verifyBuildResult();

    console.log('\n🎉 打包流程完成!');
    console.log('='.repeat(50));
    console.log('\n📝 使用说明:');
    console.log('  1. 运行打包的应用:');
    console.log(`    双击 ${path.join(releaseDir, 'win-unpacked', 'GameVoice.exe')}`);
    console.log('  2. 创建安装包:');
    console.log('    npm run dist:win    # Windows安装包');
    console.log('    npm run dist:portable # 便携版');
    console.log('  3. 开发模式:');
    console.log('    npm run dev         # 启动开发服务器');
    console.log('    npm start           # 启动Electron应用');

  } catch (error) {
    console.error('❌ 打包过程出错:', error.message);
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}

module.exports = {
  cleanReleaseDir,
  buildReactApp,
  checkRequiredFiles,
  createIconPlaceholder,
  packageElectronApp,
  verifyBuildResult
};