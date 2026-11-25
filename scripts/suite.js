#!/usr/bin/env node
'use strict';

/**
 * Antigravity Chinese Suite - 跨平台统一编排器
 * 协调 chinese-localization（整包汉化）与 context-viewer（增量上下文看板）的安装、卸载、状态查询与环境诊断。
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const LC_DIR = path.join(ROOT_DIR, 'components', 'chinese-localization');
const CV_DIR = path.join(ROOT_DIR, 'components', 'context-viewer');
const PKG_PATH = path.join(ROOT_DIR, 'package.json');

const MIN_NODE_LOC_ONLY = '18.18.0';
const MIN_NODE_WITH_VIEWER = '22.4.0';

function getSuiteMeta() {
  try {
    return JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  } catch (_) {
    return { name: 'antigravity-chinese-suite', version: '1.0.0' };
  }
}

/**
 * 解析语义化版本号，剥离前导 v 及预发布后缀（如 v23.0.0-nightly.1 -> [23, 0, 0]）。
 */
function parseSemver(versionStr) {
  const cleaned = String(versionStr || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0]
    .split('+')[0];
  if (!cleaned || !/^\d+(\.\d+)*$/.test(cleaned)) return null;
  const parts = cleaned.split('.').map((n) => parseInt(n, 10));
  while (parts.length < 3) parts.push(0);
  return parts.slice(0, 3);
}

function compareSemver(a, b) {
  const pa = Array.isArray(a) ? a : parseSemver(a);
  const pb = Array.isArray(b) ? b : parseSemver(b);
  if (!pa || !pb) return null;
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] || 0;
    const vb = pb[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

function checkNodeRequirement({ skipViewer = false, nodeVersion = process.version } = {}) {
  const required = skipViewer ? MIN_NODE_LOC_ONLY : MIN_NODE_WITH_VIEWER;
  const cmp = compareSemver(nodeVersion, required);
  return {
    ok: cmp !== null && cmp >= 0,
    current: String(nodeVersion),
    required,
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = Array.from(argv);
  const opts = {
    command: null,
    appDir: '',
    skipLocalization: false,
    skipViewer: false,
    onlyViewer: false,
    removeBackup: false,
    yes: false,
    forceStop: false,
    dryRun: false,
    json: false,
    help: false,
    version: false,
    unknownArg: null,
  };

  for (let i = 0; i < args.length; i++) {
    const a = String(args[i]);
    if (a === '--help' || a === '-h') {
      opts.help = true;
      return opts;
    }
    if (a === '--version' || a === '-v') {
      opts.version = true;
      return opts;
    }
    if (a === '--app-dir' || a === '-AppDir') {
      if (i + 1 >= args.length || String(args[i + 1]).startsWith('-')) {
        opts.unknownArg = `${a} (缺少目录参数)`;
        return opts;
      }
      opts.appDir = String(args[++i]);
      continue;
    }
    if (a.startsWith('--app-dir=')) {
      opts.appDir = a.slice('--app-dir='.length);
      continue;
    }
    if (a === '--skip-localization') {
      opts.skipLocalization = true;
      continue;
    }
    if (a === '--skip-viewer') {
      opts.skipViewer = true;
      continue;
    }
    if (a === '--only-viewer') {
      opts.onlyViewer = true;
      continue;
    }
    if (a === '--remove-backup') {
      opts.removeBackup = true;
      continue;
    }
    if (a === '--yes' || a === '-y') {
      opts.yes = true;
      continue;
    }
    if (a === '--force-stop') {
      opts.forceStop = true;
      continue;
    }
    if (a === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (a === '--json') {
      opts.json = true;
      continue;
    }
    if (a.startsWith('-')) {
      opts.unknownArg = a;
      return opts;
    }
    if (!opts.command) {
      const cmd = a.toLowerCase();
      if (!['install', 'uninstall', 'status', 'doctor', 'help'].includes(cmd)) {
        opts.unknownArg = a;
        return opts;
      }
      opts.command = cmd;
      continue;
    }
    opts.unknownArg = a;
    return opts;
  }

  if (!opts.command) opts.command = 'status';
  if (opts.command === 'help') opts.help = true;
  return opts;
}

function printUsage() {
  const meta = getSuiteMeta();
  console.log(`
Antigravity Chinese Suite v${meta.version}
用法:
  node scripts/suite.js <command> [options]

命令:
  install     按正确顺序安装套件（汉化整包重打 → 上下文看板增量注入）
  uninstall   卸载套件并安全还原官方原版 app.asar（支持 --only-viewer）
  status      查看汉化与看板安装状态及备份一致性
  doctor      全面诊断 Node 环境、@electron/asar 缓存、安装路径与进程占用

选项:
  --app-dir <path>      指定 Antigravity 安装目录（macOS 指向 .app/Contents）
  --skip-localization   [install] 跳过汉化，仅安装上下文看板
  --skip-viewer         [install] 跳过上下文看板，仅安装汉化
  --only-viewer         [uninstall] 仅移除上下文看板，保留简体中文汉化
  --remove-backup       [uninstall] 还原后删除 app.asar.bak 官方备份
  --force-stop          自动结束运行中的 Antigravity / language_server 进程
  --yes, -y             非交互模式（遇进程占用且未指定 --force-stop 时直接中止）
  --dry-run             预演执行步骤，不写入或修改任何文件
  --json                [status / doctor] 输出结构化 JSON
  -h, --help            显示帮助信息
  -v, --version         显示套件版本
`.trim());
}

function requireLocalizeSafe() {
  const prevArgv = process.argv;
  process.argv = prevArgv.slice(0, 2);
  try {
    return require(path.join(LC_DIR, 'localize.js'));
  } finally {
    process.argv = prevArgv;
  }
}

function loadLocalizationHelpers({ includeLocalize = false } = {}) {
  const autoRestore = require(path.join(LC_DIR, 'auto-restore.js'));
  const asarVersion = require(path.join(LC_DIR, 'asar-version.js'));
  const processCheck = require(path.join(LC_DIR, 'process-check.js'));
  const localize = includeLocalize ? requireLocalizeSafe() : null;
  return { localize, autoRestore, asarVersion, processCheck };
}

function loadViewerHelpers() {
  const asarEngine = require(path.join(CV_DIR, 'asar-engine.js'));
  const modulesConfig = require(path.join(CV_DIR, 'modules-config.js'));
  return { asarEngine, modulesConfig };
}

function getResourcesDir(appDir, platform = process.platform) {
  const upperPath = path.join(appDir, 'Resources');
  const lowerPath = path.join(appDir, 'resources');
  if (platform === 'darwin') {
    if (fs.existsSync(upperPath)) return upperPath;
    if (fs.existsSync(lowerPath)) return lowerPath;
    return upperPath;
  }
  if (fs.existsSync(lowerPath)) return lowerPath;
  if (fs.existsSync(upperPath)) return upperPath;
  return lowerPath;
}

function resolvePaths(customAppDir = '', platform = process.platform) {
  const { asarEngine } = loadViewerHelpers();

  let appDir = customAppDir ? path.resolve(customAppDir) : '';
  if (!appDir) {
    const { localize } = loadLocalizationHelpers({ includeLocalize: true });
    try {
      appDir = localize.getAppDir(localize.getHostUsername(), true, '');
    } catch (_) {
      appDir = '';
    }
    const candidateRes = appDir ? getResourcesDir(appDir, platform) : '';
    if (!candidateRes || !fs.existsSync(path.join(candidateRes, 'app.asar'))) {
      try {
        const detectedAsar = asarEngine.findAsarPath();
        if (detectedAsar) {
          appDir = path.dirname(path.dirname(detectedAsar));
        }
      } catch (_) {}
    }
  }

  // 若用户在 macOS 传入了 /Applications/Antigravity.app 而非 .../Contents，自动补全 Contents
  if (platform === 'darwin' && appDir && appDir.endsWith('.app') && fs.existsSync(path.join(appDir, 'Contents'))) {
    appDir = path.join(appDir, 'Contents');
  }

  const resourcesDir = getResourcesDir(appDir, platform);
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');
  return { appDir, resourcesDir, asarPath, backupPath };
}

function findRunningAntigravityProcesses({ platform = process.platform, run = execFileSync } = {}) {
  if (platform === 'win32') {
    const out = run('tasklist.exe', ['/FO', 'CSV', '/NH'], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      timeout: 5000,
    });
    const matched = [];
    for (const rawLine of String(out).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const m = /^"([^"]+)","([^"]+)"/.exec(line);
      if (!m) continue;
      const name = m[1];
      const pid = m[2];
      if (/^(antigravity|language_server).*\.exe$/i.test(name)) {
        matched.push({ name, pid });
      }
    }
    return matched;
  }

  const { processCheck } = loadLocalizationHelpers();
  const running = processCheck.isAppRunningStrict({ platform, run });
  return running ? [{ name: 'Antigravity', pid: 'running' }] : [];
}

function stopRunningAntigravityProcesses({ platform = process.platform, run = execFileSync } = {}) {
  if (platform === 'win32') {
    const procs = findRunningAntigravityProcesses({ platform, run });
    const uniqueNames = Array.from(new Set(procs.map((p) => p.name)));
    for (const imageName of uniqueNames) {
      try {
        run('taskkill.exe', ['/F', '/IM', imageName], {
          stdio: 'ignore',
          windowsHide: true,
          timeout: 5000,
        });
      } catch (err) {
        if (err && err.status === 128) continue;
        throw err;
      }
    }
    return;
  }
  const { processCheck } = loadLocalizationHelpers();
  processCheck.stopAntigravityProcesses({ platform, run });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function askEnter(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(promptText, () => {
      rl.close();
      resolve();
    });
  });
}

async function ensureAppStopped({ yes = false, forceStop = false, dryRun = false } = {}) {
  let procs = findRunningAntigravityProcesses();
  if (procs.length === 0) {
    return { stopped: true, procs: [] };
  }

  const desc = procs.map((p) => `${p.name}(${p.pid})`).join(', ');
  if (dryRun) {
    return { stopped: false, procs, desc, dryRunWarning: true };
  }

  if (forceStop) {
    console.log(`  [INFO] 检测到运行中的进程: ${desc}，正在按 --force-stop 结束...`);
    stopRunningAntigravityProcesses();
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      procs = findRunningAntigravityProcesses();
      if (procs.length === 0) return { stopped: true, procs: [] };
    }
    return { stopped: false, procs, desc: procs.map((p) => `${p.name}(${p.pid})`).join(', ') };
  }

  if (yes || !process.stdin.isTTY) {
    return { stopped: false, procs, desc };
  }

  console.log(`  [WARN] 检测到仍在运行的进程: ${desc}`);
  console.log('  请先保存工作并完全退出 Antigravity（Windows 请右键系统托盘图标点击「退出」）。');
  await askEnter('  退出完成后按 Enter 继续（Ctrl+C 取消）: ');
  await sleep(1500);
  procs = findRunningAntigravityProcesses();
  if (procs.length > 0) {
    return { stopped: false, procs, desc: procs.map((p) => `${p.name}(${p.pid})`).join(', ') };
  }
  return { stopped: true, procs: [] };
}

function atomicCopyFile(srcPath, destPath) {
  const stagePath = path.join(path.dirname(destPath), `${path.basename(destPath)}.stage-${process.pid}-${Date.now()}`);
  try {
    fs.copyFileSync(srcPath, stagePath);
    fs.renameSync(stagePath, destPath);
  } catch (err) {
    try {
      if (fs.existsSync(stagePath)) fs.unlinkSync(stagePath);
    } catch (_) {}
    throw err;
  }
}

function resolveAsarCliStatus() {
  const localRoots = [
    path.join(LC_DIR, 'node_modules', '@electron', 'asar', 'bin', 'asar.js'),
    path.join(ROOT_DIR, 'node_modules', '@electron', 'asar', 'bin', 'asar.js'),
  ];
  for (const p of localRoots) {
    if (fs.existsSync(p)) return { available: true, source: 'local-node_modules', path: p };
  }
  const cacheRoots = [];
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    cacheRoots.push(path.join(process.env.LOCALAPPDATA, 'npm-cache', '_npx'));
  }
  cacheRoots.push(path.join(os.homedir(), '.npm', '_npx'));
  for (const root of cacheRoots) {
    if (!fs.existsSync(root)) continue;
    try {
      for (const d of fs.readdirSync(root)) {
        const candidate = path.join(root, d, 'node_modules', '@electron', 'asar', 'bin', 'asar.js');
        if (fs.existsSync(candidate)) {
          return { available: true, source: 'npx-cache', path: candidate };
        }
      }
    } catch (_) {}
  }
  return { available: false, source: 'npx-on-demand', path: null };
}

function inspectAsarSnapshot(asarPath, backupPath) {
  const { autoRestore, asarVersion } = loadLocalizationHelpers();
  const { asarEngine, modulesConfig } = loadViewerHelpers();

  const asarExists = fs.existsSync(asarPath);
  const backupExists = fs.existsSync(backupPath);

  const asarSize = asarExists ? fs.statSync(asarPath).size : 0;
  const appVersion = asarExists ? asarVersion.readAsarPackageVersion(asarPath) : null;
  const isLocalized = asarExists ? autoRestore.isLocalizedAsar(asarPath) : false;

  let diskModules = null;
  let viewerPatched = false;
  let viewerDiskVersion = null;
  if (asarExists) {
    try {
      diskModules = modulesConfig.inspectDiskModules(asarPath, { useCache: false });
      viewerPatched = Boolean(diskModules && diskModules.meter);
    } catch (_) {}
    if (viewerPatched) {
      try {
        const engine = asarEngine.loadAsarEngine();
        const manifestRaw = engine.extractFile(asarPath, 'dist/meter-manifest.json');
        const parsed = JSON.parse(manifestRaw.toString('utf8'));
        if (parsed && parsed.version) viewerDiskVersion = String(parsed.version);
      } catch (_) {}
    }
  }

  let backupVersion = null;
  let backupLocalized = false;
  let backupViewerPatched = false;
  let backupValidForCurrent = false;
  if (backupExists) {
    backupVersion = asarVersion.readAsarPackageVersion(backupPath);
    backupLocalized = autoRestore.isLocalizedAsar(backupPath);
    try {
      const bm = modulesConfig.inspectDiskModules(backupPath, { useCache: false });
      backupViewerPatched = Boolean(bm && bm.meter);
    } catch (_) {}
    backupValidForCurrent = Boolean(
      appVersion &&
      backupVersion &&
      appVersion === backupVersion &&
      !backupLocalized &&
      !backupViewerPatched
    );
  }

  return {
    asarExists,
    asarSize,
    appVersion,
    isLocalized,
    viewerPatched,
    viewerDiskVersion,
    backupExists,
    backupVersion,
    backupLocalized,
    backupViewerPatched,
    backupValidForCurrent,
  };
}

/**
 * 计算重装或安装汉化前是否需要先复位为纯净基底。
 */
function getInstallPlan(snapshot, { skipLocalization = false, skipViewer = false } = {}) {
  const steps = [];
  if (!skipLocalization) {
    if ((snapshot.isLocalized || snapshot.viewerPatched) && snapshot.backupValidForCurrent) {
      steps.push('restore-clean-backup-first');
    } else if (snapshot.viewerPatched) {
      steps.push('strip-viewer-before-localization');
    }
    steps.push('run-localization');
  }
  if (!skipViewer) {
    steps.push('run-viewer-install');
  }
  return steps;
}

async function runStatus(opts, { logOutput = true } = {}) {
  const meta = getSuiteMeta();
  const { appDir, resourcesDir, asarPath, backupPath } = resolvePaths(opts.appDir);
  const nodeCheck = checkNodeRequirement({ skipViewer: false });
  const snap = inspectAsarSnapshot(asarPath, backupPath);

  let viewerPkgVersion = null;
  try {
    viewerPkgVersion = JSON.parse(fs.readFileSync(path.join(CV_DIR, 'package.json'), 'utf8')).version;
  } catch (_) {}

  let localizationPkgVersion = null;
  try {
    localizationPkgVersion = JSON.parse(fs.readFileSync(path.join(LC_DIR, 'package.json'), 'utf8')).version;
  } catch (_) {}

  const report = {
    suiteVersion: meta.version,
    platform: process.platform,
    arch: process.arch,
    node: nodeCheck,
    appDir,
    resourcesDir,
    asarPath,
    backupPath,
    components: {
      chineseLocalization: {
        present: fs.existsSync(path.join(LC_DIR, 'localize.js')),
        version: localizationPkgVersion,
        installed: snap.isLocalized,
      },
      contextViewer: {
        present: fs.existsSync(path.join(CV_DIR, 'cli.js')),
        packageVersion: viewerPkgVersion,
        installed: snap.viewerPatched,
        diskVersion: snap.viewerDiskVersion,
      },
    },
    asar: {
      exists: snap.asarExists,
      sizeBytes: snap.asarSize,
      version: snap.appVersion,
    },
    backup: {
      exists: snap.backupExists,
      version: snap.backupVersion,
      versionMatch: Boolean(snap.appVersion && snap.backupVersion && snap.appVersion === snap.backupVersion),
      clean: !snap.backupLocalized && !snap.backupViewerPatched,
      validForCurrent: snap.backupValidForCurrent,
    },
  };

  if (logOutput) {
    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('');
      console.log(`Antigravity Chinese Suite v${meta.version} - 状态`);
      console.log(`安装目录: ${appDir || '(未检测到)'}`);
      console.log(`Node.js : ${nodeCheck.current} (${nodeCheck.ok ? '满足 >= 22.4.0' : '低于 22.4.0'})`);
      if (!snap.asarExists) {
        console.log('app.asar: 未找到（客户端未安装或请使用 --app-dir 指定目录）');
      } else {
        console.log(`app.asar: ${snap.asarSize.toLocaleString('en-US')} 字节 | 客户端版本: ${snap.appVersion || '未知'}`);
        if (snap.backupExists) {
          const flags = [];
          if (!report.backup.versionMatch) flags.push('版本不一致');
          if (!report.backup.clean) flags.push('备份疑似被修改');
          const mark = flags.length ? ` [${flags.join(' / ')}]` : ' [正常]';
          console.log(`官方备份: 存在 (v${snap.backupVersion || '未知'})${mark}`);
        } else {
          console.log('官方备份: 不存在（安装汉化时会自动生成，仅装看板由 context-viewer 自管）');
        }
        console.log('');
        console.log('--- 汉化组件 ---');
        console.log(`  状态: ${snap.isLocalized ? '已汉化' : '未汉化（原版）'} | 组件版本: v${localizationPkgVersion || '未知'}`);
        console.log('');
        console.log('--- 上下文看板 ---');
        console.log(`  状态: ${snap.viewerPatched ? `已注入 (磁盘 v${snap.viewerDiskVersion || '未知'})` : '未注入'} | 组件版本: v${viewerPkgVersion || '未知'}`);
      }
      console.log('');
    }
  }

  return { report, exitCode: snap.asarExists ? 0 : 1 };
}

async function runDoctor(opts) {
  const { report: st } = await runStatus(opts, { logOutput: false });
  const asarCli = resolveAsarCliStatus();
  let runningProcs = [];
  let procCheckError = null;
  try {
    runningProcs = findRunningAntigravityProcesses();
  } catch (err) {
    procCheckError = err.message;
  }

  const nodeLocOnly = checkNodeRequirement({ skipViewer: true });
  const checks = [
    {
      id: 'node-viewer',
      name: 'Node.js 版本 (>= 22.4.0)',
      status: st.node.ok ? 'pass' : (nodeLocOnly.ok ? 'warn' : 'fail'),
      detail: st.node.ok
        ? `${st.node.current} 满足全套组件要求`
        : (nodeLocOnly.ok
          ? `${st.node.current} 仅满足汉化 (>=18.18)，上下文看板需要 >= 22.4.0`
          : `${st.node.current} 过低，请升级到 Node.js >= 22.4.0`),
    },
    {
      id: 'components',
      name: '套件组件完整性',
      status: (st.components.chineseLocalization.present && st.components.contextViewer.present) ? 'pass' : 'fail',
      detail: (st.components.chineseLocalization.present && st.components.contextViewer.present)
        ? 'chinese-localization 与 context-viewer 均就绪'
        : '缺少组件脚本，请完整下载或克隆仓库',
    },
    {
      id: 'asar-target',
      name: 'Antigravity 客户端 (app.asar)',
      status: st.asar.exists ? 'pass' : 'fail',
      detail: st.asar.exists
        ? `v${st.asar.version || '未知'} (${st.asarPath})`
        : `未找到 ${st.asarPath}，请使用 --app-dir 指定安装路径`,
    },
    {
      id: 'official-backup',
      name: '官方原版备份 (app.asar.bak)',
      status: !st.asar.exists
        ? 'warn'
        : (st.backup.exists
          ? (st.backup.validForCurrent ? 'pass' : 'warn')
          : 'warn'),
      detail: !st.asar.exists
        ? '客户端不存在，跳过备份检查'
        : (!st.backup.exists
          ? '尚未创建备份（首次安装汉化时会自动创建）'
          : (st.backup.validForCurrent
            ? `v${st.backup.version} 完整且纯净`
            : `存在异常：备份 v${st.backup.version || '未知'} 与当前 v${st.asar.version || '未知'} 不一致或已被污染`)),
    },
    {
      id: 'asar-cli',
      name: '@electron/asar 打包工具缓存',
      status: asarCli.available ? 'pass' : 'warn',
      detail: asarCli.available
        ? `已缓存 (${asarCli.source})`
        : '本地未缓存，首次汉化将通过 npx 下载 @electron/asar；国内网络可设 npm_config_registry=https://registry.npmmirror.com',
    },
    {
      id: 'processes',
      name: 'Antigravity 进程占用检查',
      status: procCheckError ? 'warn' : (runningProcs.length === 0 ? 'pass' : 'warn'),
      detail: procCheckError
        ? `检查失败: ${procCheckError}`
        : (runningProcs.length === 0
          ? '未检测到运行中的客户端进程'
          : `运行中: ${runningProcs.map((p) => `${p.name}(${p.pid})`).join(', ')}（安装/卸载前需退出）`),
    },
  ];

  const hasFail = checks.some((c) => c.status === 'fail');
  const payload = {
    suiteVersion: st.suiteVersion,
    platform: st.platform,
    arch: st.arch,
    healthy: !hasFail,
    checks,
    status: st,
  };

  if (opts.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log('');
    console.log(`Antigravity Chinese Suite v${st.suiteVersion} - 环境诊断`);
    console.log(`系统: ${st.platform} (${st.arch}) | Node: ${st.node.current}`);
    console.log('');
    for (const c of checks) {
      const badge = c.status === 'pass' ? '[PASS]' : (c.status === 'warn' ? '[WARN]' : '[FAIL]');
      console.log(`  ${badge} ${c.name}`);
      console.log(`         ${c.detail}`);
    }
    console.log('');
    console.log(hasFail ? '结论: 存在阻断项 [FAIL]，请按上方提示修复后再安装。' : '结论: 核心条件就绪，可执行安装或状态操作。');
    console.log('');
  }

  return { report: payload, exitCode: hasFail ? 1 : 0 };
}

function runViewerCli(args) {
  const cvCli = path.join(CV_DIR, 'cli.js');
  execFileSync(process.execPath, [cvCli, ...args], {
    cwd: CV_DIR,
    stdio: 'inherit',
  });
}

async function runLocalizationInDir(appDir) {
  const { localize } = loadLocalizationHelpers({ includeLocalize: true });
  const prevCwd = process.cwd();
  process.chdir(LC_DIR);
  try {
    await localize.runLocalizationWorkflow(appDir);
  } finally {
    process.chdir(prevCwd);
  }
}

async function runInstall(opts) {
  if (opts.skipLocalization && opts.skipViewer) {
    console.error('[FAIL] 不能同时指定 --skip-localization 和 --skip-viewer。');
    return 1;
  }

  const meta = getSuiteMeta();
  console.log('');
  console.log(`Antigravity Chinese Suite v${meta.version} - 统一安装器`);

  // 1. 环境检查
  console.log('\n=== 1/5 环境检查 ===');
  const nodeCheck = checkNodeRequirement({ skipViewer: opts.skipViewer });
  if (!nodeCheck.ok) {
    console.error(`  [FAIL] 当前 Node.js ${nodeCheck.current} 低于要求的 ${nodeCheck.required}。请升级后重试: https://nodejs.org/`);
    return 1;
  }
  console.log(`  [OK]   Node.js ${nodeCheck.current}`);

  if (!fs.existsSync(path.join(LC_DIR, 'localize.js')) || !fs.existsSync(path.join(CV_DIR, 'cli.js'))) {
    console.error('  [FAIL] 组件目录缺失，请完整解压或克隆仓库后再运行。');
    return 1;
  }
  console.log('  [OK]   组件目录完整');

  const { appDir, asarPath, backupPath } = resolvePaths(opts.appDir);
  if (!appDir || !fs.existsSync(asarPath)) {
    console.error(`  [FAIL] 未找到 ${asarPath}。请确认 Antigravity 已安装，或使用 --app-dir 指定安装目录。`);
    return 1;
  }
  console.log(`  [OK]   目标目录: ${appDir}`);

  // 2. 进程检查
  console.log('\n=== 2/5 确认客户端已退出 ===');
  const procRes = opts._skipProcessCheck
    ? { stopped: true, procs: [] }
    : await ensureAppStopped({ yes: opts.yes, forceStop: opts.forceStop, dryRun: opts.dryRun });
  if (!procRes.stopped) {
    if (opts.dryRun) {
      console.log(`  [WARN] [dry-run] 检测到运行中的进程: ${procRes.desc}（实际安装前需退出）`);
    } else {
      console.error(`  [FAIL] 客户端仍在运行 (${procRes.desc})，安装已中止（未修改任何文件）。`);
      return 2;
    }
  } else {
    console.log('  [OK]   客户端未运行');
  }

  const snapBefore = inspectAsarSnapshot(asarPath, backupPath);
  const planSteps = getInstallPlan(snapBefore, {
    skipLocalization: opts.skipLocalization,
    skipViewer: opts.skipViewer,
  });

  if (opts.dryRun) {
    console.log('\n=== [dry-run] 预演计划（未修改任何文件） ===');
    console.log(`  当前客户端版本: v${snapBefore.appVersion || '未知'}`);
    console.log(`  当前状态: 已汉化=${snapBefore.isLocalized}, 已注入看板=${snapBefore.viewerPatched}, 官方备份有效=${snapBefore.backupValidForCurrent}`);
    console.log(`  将执行步骤: ${planSteps.join(' -> ')}`);
    return 0;
  }

  // 3. 汉化
  let localizationRan = false;
  if (!opts.skipLocalization) {
    console.log('\n=== 3/5 安装简体中文汉化 ===');
    if (planSteps.includes('restore-clean-backup-first')) {
      console.log('  [INFO] 检测到已有补丁痕迹，先从纯净官方备份复位基底以保证幂等重装...');
      atomicCopyFile(backupPath, asarPath);
    } else if (planSteps.includes('strip-viewer-before-localization')) {
      console.log('  [INFO] 检测到已安装上下文看板，先剥离看板以便汉化安全解包...');
      try {
        runViewerCli(['restore', '--path', asarPath]);
      } catch (_) {
        runViewerCli(['restore', '--in-place', '--path', asarPath]);
      }
    }
    await runLocalizationInDir(appDir);
    localizationRan = true;
    console.log('  [OK]   汉化已写入 app.asar');
  } else {
    console.log('\n=== 3/5 跳过汉化 (--skip-localization) ===');
  }

  // 4. 看板
  if (!opts.skipViewer) {
    console.log('\n=== 4/5 安装上下文与 Token 看板 ===');
    try {
      runViewerCli(['install', '--disk-only', '--path', asarPath]);
      console.log('  [OK]   看板已写入 app.asar');
    } catch (err) {
      console.error(`  [FAIL] 看板注入失败: ${err.message}`);
      if (localizationRan) {
        console.error('  [提示] 简体中文汉化已成功生效；您可以：');
        console.error('         1) 修复问题后执行 --skip-localization 单独重试看板；或');
        console.error('         2) 执行卸载脚本恢复官方英文原版。');
      }
      return 1;
    }
  } else {
    console.log('\n=== 4/5 跳过看板 (--skip-viewer) ===');
  }

  // 5. 安装后复核
  console.log('\n=== 5/5 安装后复核 ===');
  const snapAfter = inspectAsarSnapshot(asarPath, backupPath);
  if (snapAfter.backupValidForCurrent) {
    console.log(`  [OK]   官方原版备份: ${backupPath} (v${snapAfter.backupVersion})`);
  } else if (snapAfter.backupExists) {
    console.log(`  [WARN] 官方备份版本 (v${snapAfter.backupVersion || '未知'}) 与当前客户端不一致或非纯净备份`);
  } else if (!opts.skipLocalization) {
    console.log('  [WARN] 未找到 app.asar.bak，后续无法通过套件一键还原英文原版');
  }

  let verifyFailed = false;
  if (!opts.skipLocalization) {
    if (snapAfter.isLocalized) {
      console.log(`  [OK]   汉化状态: 已安装 (客户端 v${snapAfter.appVersion || '未知'})`);
    } else {
      console.error('  [FAIL] 汉化状态: 未检测到汉化标记');
      verifyFailed = true;
    }
  }
  if (!opts.skipViewer) {
    if (snapAfter.viewerPatched) {
      console.log(`  [OK]   看板状态: 已注入 (磁盘 v${snapAfter.viewerDiskVersion || '未知'}, 宿主 v${snapAfter.appVersion || '未知'})`);
    } else {
      console.error('  [FAIL] 看板状态: 未检测到注入标记');
      verifyFailed = true;
    }
  }

  console.log('');
  if (verifyFailed) {
    console.error('安装复核发现异常，请检查上方日志。');
    return 1;
  }

  if (!opts.skipLocalization && !opts.skipViewer) {
    console.log('安装完成！重新打开 Antigravity：界面应为简体中文，顶栏出现上下文与额度圆环。');
  } else if (!opts.skipLocalization) {
    console.log('汉化安装完成！重新打开 Antigravity：界面应为简体中文。');
  } else {
    console.log('上下文看板安装完成！重新打开 Antigravity：顶栏应出现上下文与额度圆环。');
  }

  if (process.platform === 'darwin') {
    console.log('macOS 提示：因修改了 app.asar，如遇签名拦截请执行:');
    console.log('  xattr -cr "/Applications/Antigravity.app" && codesign --force --deep --sign - "/Applications/Antigravity.app"');
  }
  console.log('如需还原，请运行卸载脚本。');
  return 0;
}

async function runUninstall(opts) {
  const meta = getSuiteMeta();
  console.log('');
  console.log(`Antigravity Chinese Suite v${meta.version} - ${opts.onlyViewer ? '仅卸载上下文看板' : '卸载并还原官方英文原版'}`);

  console.log('\n=== 1/4 环境检查 ===');
  const { appDir, asarPath, backupPath } = resolvePaths(opts.appDir);
  if (!appDir || !fs.existsSync(asarPath)) {
    console.error(`  [FAIL] 未找到 ${asarPath}。请确认 Antigravity 已安装，或使用 --app-dir 指定安装目录。`);
    return 1;
  }
  console.log(`  [OK]   找到 app.asar (${asarPath})`);

  console.log('\n=== 2/4 确认客户端已退出 ===');
  const procRes = opts._skipProcessCheck
    ? { stopped: true, procs: [] }
    : await ensureAppStopped({ yes: opts.yes, forceStop: opts.forceStop, dryRun: opts.dryRun });
  if (!procRes.stopped) {
    if (opts.dryRun) {
      console.log(`  [WARN] [dry-run] 检测到运行中的进程: ${procRes.desc}（实际卸载前需退出）`);
    } else {
      console.error(`  [FAIL] 客户端仍在运行 (${procRes.desc})，卸载已中止（未修改任何文件）。`);
      return 2;
    }
  } else {
    console.log('  [OK]   客户端未运行');
  }

  const snapBefore = inspectAsarSnapshot(asarPath, backupPath);
  if (opts.dryRun) {
    console.log('\n=== [dry-run] 预演计划（未修改任何文件） ===');
    console.log(`  当前状态: 已汉化=${snapBefore.isLocalized}, 已注入看板=${snapBefore.viewerPatched}, 官方备份有效=${snapBefore.backupValidForCurrent}`);
    console.log(`  操作模式: ${opts.onlyViewer ? '仅移除看板（保留汉化）' : '完整还原官方原版'}`);
    return 0;
  }

  console.log('\n=== 3/4 还原上下文看板 ===');
  if (snapBefore.viewerPatched) {
    try {
      runViewerCli(['restore', '--path', asarPath]);
    } catch (err) {
      console.log(`  [WARN] 常规备份还原未适用 (${err.message})，尝试原位剥离看板 (--in-place)...`);
      runViewerCli(['restore', '--in-place', '--path', asarPath]);
    }
    console.log('  [OK]   看板模块已移除');
  } else {
    console.log('  [OK]   看板未注入，跳过');
  }

  if (opts.onlyViewer) {
    console.log('\n=== 4/4 保留简体中文汉化 (--only-viewer) ===');
    console.log('  [OK]   已完成看板卸载，当前汉化与原版备份保持不变。');
    return 0;
  }

  console.log('\n=== 4/4 还原官方原版 app.asar ===');
  const snapAfterViewer = inspectAsarSnapshot(asarPath, backupPath);

  if (!snapAfterViewer.isLocalized && !snapAfterViewer.viewerPatched) {
    console.log('  [OK]   当前 app.asar 已是纯净官方原版，无需覆盖备份。');
    if (opts.removeBackup && fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      console.log('  [OK]   已按 --remove-backup 删除 app.asar.bak');
    }
    console.log('\n卸载完成，客户端为官方英文原版。');
    return 0;
  }

  if (!fs.existsSync(backupPath)) {
    console.error(`  [FAIL] 未找到官方备份 ${backupPath}，无法还原汉化修改。`);
    console.error('  [提示] 请重新安装官方 Antigravity 客户端以恢复纯净原版。');
    return 1;
  }

  console.log(`  当前 app.asar 版本: ${snapAfterViewer.appVersion || '未知'}`);
  console.log(`  备份 app.asar.bak 版本: ${snapAfterViewer.backupVersion || '未知'}`);

  if (!snapAfterViewer.appVersion || !snapAfterViewer.backupVersion) {
    console.error('  [FAIL] 版本读取失败，为避免白屏已中止覆盖。');
    return 1;
  }
  if (snapAfterViewer.appVersion !== snapAfterViewer.backupVersion) {
    console.error('  [FAIL] 备份版本与当前客户端版本不一致（官方可能已更新），已中止覆盖以免白屏。');
    console.error('  [提示] 请重新安装官方客户端，或重新执行安装脚本。');
    return 1;
  }
  if (snapAfterViewer.backupLocalized || snapAfterViewer.backupViewerPatched) {
    console.error('  [FAIL] 检测到 app.asar.bak 已被补丁污染，拒绝覆盖。请重装官方客户端。');
    return 1;
  }

  atomicCopyFile(backupPath, asarPath);
  console.log('  [OK]   已恢复官方原版 app.asar');

  if (opts.removeBackup) {
    fs.unlinkSync(backupPath);
    console.log('  [OK]   官方备份已按 --remove-backup 删除');
  } else {
    console.log(`  官方备份保留在: ${backupPath}（下次安装可直接校验复用）`);
  }

  console.log('\n卸载完成，客户端已恢复官方英文原版。');
  return 0;
}

async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv);
  if (opts.version) {
    console.log(getSuiteMeta().version);
    return 0;
  }
  if (opts.unknownArg) {
    console.error(`[FAIL] 未知或无效参数: ${opts.unknownArg}`);
    printUsage();
    return 1;
  }
  if (opts.help) {
    printUsage();
    return 0;
  }

  if (opts.command === 'status') {
    const { exitCode } = await runStatus(opts, { logOutput: true });
    return exitCode;
  }
  if (opts.command === 'doctor') {
    const { exitCode } = await runDoctor(opts);
    return exitCode;
  }
  if (opts.command === 'install') {
    return runInstall(opts);
  }
  if (opts.command === 'uninstall') {
    return runUninstall(opts);
  }
  printUsage();
  return 1;
}

if (require.main === module) {
  main()
    .then((code) => {
      process.exitCode = typeof code === 'number' ? code : 0;
    })
    .catch((err) => {
      console.error(`[FAIL] 执行异常: ${err && err.stack ? err.stack : err}`);
      process.exitCode = 1;
    });
}

module.exports = {
  parseSemver,
  compareSemver,
  checkNodeRequirement,
  parseArgs,
  resolvePaths,
  findRunningAntigravityProcesses,
  atomicCopyFile,
  inspectAsarSnapshot,
  getInstallPlan,
  runStatus,
  runDoctor,
  runInstall,
  runUninstall,
  main,
};
