'use strict';

// 读取 ASAR 归档内 package.json 的版本号，用于安装/卸载前的版本一致性校验。
// 用法:
//   node scripts/asar-version.js <路径到 asar-engine.js> <路径到 app.asar>
//   node scripts/asar-version.js <路径到 app.asar>

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
let enginePath = null;
let asarPath = null;

if (args.length === 1) {
  asarPath = args[0];
} else if (args.length >= 2) {
  enginePath = args[0];
  asarPath = args[1];
}

if (!asarPath) {
  process.stderr.write('用法: node asar-version.js [<asar-engine.js>] <app.asar>\n');
  process.exit(64);
}
if (enginePath && !fs.existsSync(enginePath)) {
  process.stderr.write(`找不到 asar 引擎: ${enginePath}\n`);
  process.exit(66);
}
if (!fs.existsSync(asarPath)) {
  process.stderr.write(`找不到 asar 文件: ${asarPath}\n`);
  process.exit(66);
}

try {
  if (enginePath) {
    const { loadAsarEngine } = require(path.resolve(enginePath));
    const engine = loadAsarEngine();
    const pkg = JSON.parse(engine.extractFile(asarPath, 'package.json').toString('utf8'));
    process.stdout.write(String(pkg.version || 'unknown'));
  } else {
    const { readAsarPackageVersion } = require(path.resolve(__dirname, '..', 'components', 'chinese-localization', 'asar-version.js'));
    const ver = readAsarPackageVersion(asarPath);
    if (!ver) throw new Error('无法解析 package.json 版本');
    process.stdout.write(String(ver));
  }
} catch (err) {
  process.stderr.write(`读取失败: ${err.message}\n`);
  process.exit(1);
}
