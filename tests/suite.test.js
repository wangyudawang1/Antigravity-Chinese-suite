'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const SUITE_JS = path.join(ROOT_DIR, 'scripts', 'suite.js');
const ASAR_VERSION_JS = path.join(ROOT_DIR, 'scripts', 'asar-version.js');
const CV_ENGINE_JS = path.join(ROOT_DIR, 'components', 'context-viewer', 'asar-engine.js');

const suite = require(SUITE_JS);
const { builtinAsar } = require(CV_ENGINE_JS);

async function makeSyntheticAppDir({ version = '2.35.1', localized = false, viewerPatched = false } = {}) {
  const tmpRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ag-suite-test-')));
  const srcDir = path.join(tmpRoot, 'src');
  const resDir = path.join(tmpRoot, process.platform === 'darwin' ? 'Resources' : 'resources');
  fs.mkdirSync(path.join(srcDir, 'dist'), { recursive: true });
  fs.mkdirSync(resDir, { recursive: true });

  fs.writeFileSync(path.join(srcDir, 'package.json'), JSON.stringify({ name: 'antigravity', version }), 'utf8');
  let utilsCode = 'function invokeWindowLoadUrl() { return true; }\n';
  if (viewerPatched) {
    utilsCode += '/* __AG_CONTEXT_METER_START__ */\nfunction installContextMeter(win) {}\n/* __AG_CONTEXT_METER_END__ */\n';
    fs.writeFileSync(path.join(srcDir, 'dist', 'meter-manifest.json'), JSON.stringify({ version: '0.9.2' }), 'utf8');
  }
  fs.writeFileSync(path.join(srcDir, 'dist', 'utils.js'), utilsCode, 'utf8');
  fs.writeFileSync(
    path.join(srcDir, 'dist', 'preload.js'),
    localized ? '// Antigravity 2.0 Chinese Localization Engine\n' : '// clean preload\n',
    'utf8'
  );

  const asarPath = path.join(resDir, 'app.asar');
  await builtinAsar.createPackage(srcDir, asarPath);
  return { tmpRoot, resDir, asarPath, backupPath: path.join(resDir, 'app.asar.bak') };
}

describe('scripts/suite.js unit logic', () => {
  it('parses and compares semver including prerelease tags', () => {
    assert.deepEqual(suite.parseSemver('v22.4.0'), [22, 4, 0]);
    assert.deepEqual(suite.parseSemver('v23.0.0-nightly.1'), [23, 0, 0]);
    assert.equal(suite.compareSemver('v22.4.0', '22.4.0'), 0);
    assert.equal(suite.compareSemver('v23.0.0-rc.1', '22.4.0'), 1);
    assert.equal(suite.compareSemver('v18.18.0', '22.4.0'), -1);
  });

  it('enforces Node thresholds differently for full suite vs localization-only', () => {
    assert.equal(suite.checkNodeRequirement({ skipViewer: false, nodeVersion: 'v22.4.0' }).ok, true);
    assert.equal(suite.checkNodeRequirement({ skipViewer: false, nodeVersion: 'v20.11.0' }).ok, false);
    assert.equal(suite.checkNodeRequirement({ skipViewer: true, nodeVersion: 'v20.11.0' }).ok, true);
    assert.equal(suite.checkNodeRequirement({ skipViewer: true, nodeVersion: 'v16.20.0' }).ok, false);
  });

  it('parses CLI flags accurately', () => {
    const o1 = suite.parseArgs(['install', '--app-dir', '/tmp/ag', '--skip-viewer', '--force-stop', '--dry-run']);
    assert.equal(o1.command, 'install');
    assert.equal(o1.appDir, '/tmp/ag');
    assert.equal(o1.skipViewer, true);
    assert.equal(o1.forceStop, true);
    assert.equal(o1.dryRun, true);
    assert.equal(o1.unknownArg, null);

    const o2 = suite.parseArgs(['uninstall', '--only-viewer', '-y']);
    assert.equal(o2.command, 'uninstall');
    assert.equal(o2.onlyViewer, true);
    assert.equal(o2.yes, true);

    const o3 = suite.parseArgs(['status', '--bogus']);
    assert.equal(o3.unknownArg, '--bogus');
  });

  it('plans clean-base restoration before re-installing when backup is valid', () => {
    const plan = suite.getInstallPlan({
      isLocalized: true,
      viewerPatched: true,
      backupValidForCurrent: true,
    });
    assert.deepEqual(plan, ['restore-clean-backup-first', 'run-localization', 'run-viewer-install']);

    const planNoBak = suite.getInstallPlan({
      isLocalized: false,
      viewerPatched: true,
      backupValidForCurrent: false,
    });
    assert.deepEqual(planNoBak, ['strip-viewer-before-localization', 'run-localization', 'run-viewer-install']);
  });
});

describe('scripts/asar-version.js integration', () => {
  it('reads version from synthetic ASAR with 1-arg and 2-arg forms', async () => {
    const fx = await makeSyntheticAppDir({ version: '2.35.9' });
    try {
      const v2 = execFileSync(process.execPath, [ASAR_VERSION_JS, CV_ENGINE_JS, fx.asarPath], { encoding: 'utf8' }).trim();
      assert.equal(v2, '2.35.9');

      const v1 = execFileSync(process.execPath, [ASAR_VERSION_JS, fx.asarPath], { encoding: 'utf8' }).trim();
      assert.equal(v1, '2.35.9');
    } finally {
      fs.rmSync(fx.tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('suite status / doctor / uninstall against isolated synthetic appDir', () => {
  it('reports clean status and doctor JSON for isolated synthetic installation', async () => {
    const fx = await makeSyntheticAppDir({ version: '2.35.1', localized: false, viewerPatched: false });
    try {
      fs.copyFileSync(fx.asarPath, fx.backupPath);

      const stOut = execFileSync(process.execPath, [SUITE_JS, 'status', '--app-dir', fx.tmpRoot, '--json'], { encoding: 'utf8' });
      const st = JSON.parse(stOut);
      assert.equal(st.asar.exists, true);
      assert.equal(st.asar.version, '2.35.1');
      assert.equal(st.backup.exists, true);
      assert.equal(st.backup.validForCurrent, true);
      assert.equal(st.components.chineseLocalization.installed, false);
      assert.equal(st.components.contextViewer.installed, false);

      const docOut = execFileSync(process.execPath, [SUITE_JS, 'doctor', '--app-dir', fx.tmpRoot, '--json'], { encoding: 'utf8' });
      const doc = JSON.parse(docOut);
      assert.equal(doc.healthy, true);
      const asarCheck = doc.checks.find((c) => c.id === 'asar-target');
      assert.equal(asarCheck.status, 'pass');
    } finally {
      fs.rmSync(fx.tmpRoot, { recursive: true, force: true });
    }
  });

  it('restores polluted/localized ASAR cleanly from valid app.asar.bak on uninstall', async () => {
    const fx = await makeSyntheticAppDir({ version: '2.35.1', localized: true, viewerPatched: false });
    try {
      // Create a clean official backup matching version 2.35.1
      const cleanDir = path.join(fx.tmpRoot, 'clean_src');
      fs.mkdirSync(path.join(cleanDir, 'dist'), { recursive: true });
      fs.writeFileSync(path.join(cleanDir, 'package.json'), JSON.stringify({ name: 'antigravity', version: '2.35.1' }), 'utf8');
      fs.writeFileSync(path.join(cleanDir, 'dist', 'utils.js'), 'function invokeWindowLoadUrl() { return true; }\n', 'utf8');
      fs.writeFileSync(path.join(cleanDir, 'dist', 'preload.js'), '// clean\n', 'utf8');
      await builtinAsar.createPackage(cleanDir, fx.backupPath);

      const beforeSnap = suite.inspectAsarSnapshot(fx.asarPath, fx.backupPath);
      assert.equal(beforeSnap.isLocalized, true);
      assert.equal(beforeSnap.backupValidForCurrent, true);

      const code = await suite.runUninstall({ appDir: fx.tmpRoot, yes: true, onlyViewer: false, removeBackup: false, _skipProcessCheck: true });
      assert.equal(code, 0);

      const afterSnap = suite.inspectAsarSnapshot(fx.asarPath, fx.backupPath);
      assert.equal(afterSnap.isLocalized, false);
      assert.equal(fs.existsSync(fx.backupPath), true);
    } finally {
      fs.rmSync(fx.tmpRoot, { recursive: true, force: true });
    }
  });

  it('handles viewer-only clean state during uninstall without failing on missing app.asar.bak', async () => {
    const fx = await makeSyntheticAppDir({ version: '2.35.1', localized: false, viewerPatched: false });
    try {
      assert.equal(fs.existsSync(fx.backupPath), false);
      const code = await suite.runUninstall({ appDir: fx.tmpRoot, yes: true, onlyViewer: false, removeBackup: false, _skipProcessCheck: true });
      assert.equal(code, 0);
    } finally {
      fs.rmSync(fx.tmpRoot, { recursive: true, force: true });
    }
  });

  it('supports --dry-run on install and uninstall without mutating files', async () => {
    const fx = await makeSyntheticAppDir({ version: '2.35.1', localized: false, viewerPatched: false });
    try {
      const mtimeBefore = fs.statSync(fx.asarPath).mtimeMs;
      execFileSync(process.execPath, [SUITE_JS, 'install', '--app-dir', fx.tmpRoot, '--dry-run', '--yes'], { encoding: 'utf8' });
      execFileSync(process.execPath, [SUITE_JS, 'uninstall', '--app-dir', fx.tmpRoot, '--dry-run', '--yes'], { encoding: 'utf8' });
      assert.equal(fs.statSync(fx.asarPath).mtimeMs, mtimeBefore);
      assert.equal(fs.existsSync(fx.backupPath), false);
    } finally {
      fs.rmSync(fx.tmpRoot, { recursive: true, force: true });
    }
  });
});

describe('repository hygiene, licenses, and encoding invariants', () => {
  it('contains all required LICENSE and NOTICE files', () => {
    const required = [
      'LICENSE',
      'NOTICE.md',
      'README.md',
      'CHANGELOG.md',
      'package.json',
      'components/chinese-localization/LICENSE',
      'components/context-viewer/LICENSE',
    ];
    for (const rel of required) {
      assert.equal(fs.existsSync(path.join(ROOT_DIR, rel)), true, `Missing required file: ${rel}`);
    }
  });

  it('excludes bloated/proprietary artifacts and keeps every file under 5 MB', () => {
    assert.equal(fs.existsSync(path.join(ROOT_DIR, 'components/chinese-localization/extracted')), false);
    assert.equal(fs.existsSync(path.join(ROOT_DIR, 'components/chinese-localization/app.asar.ready')), false);

    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          assert.notEqual(ext, '.mp4', `Unexpected video artifact: ${full}`);
          assert.notEqual(ext, '.gif', `Unexpected gif artifact: ${full}`);
          const size = fs.statSync(full).size;
          assert.ok(size < 5 * 1024 * 1024, `File exceeds 5 MB (${size} bytes): ${full}`);
        }
      }
    }
    walk(ROOT_DIR);
  });

  it('stores all .ps1 scripts as UTF-8 with BOM + CRLF and parses cleanly in PS 5.1', () => {
    const ps1Files = fs.readdirSync(ROOT_DIR).filter((f) => f.endsWith('.ps1'));
    assert.ok(ps1Files.length >= 4);
    for (const f of ps1Files) {
      const full = path.join(ROOT_DIR, f);
      const buf = fs.readFileSync(full);
      assert.equal(buf[0], 0xef, `${f} missing UTF-8 BOM byte 0`);
      assert.equal(buf[1], 0xbb, `${f} missing UTF-8 BOM byte 1`);
      assert.equal(buf[2], 0xbf, `${f} missing UTF-8 BOM byte 2`);
      const text = buf.toString('utf8');
      assert.ok(text.includes('\r\n'), `${f} must use CRLF`);

      if (process.platform === 'win32') {
        const psCmd = `$e=$null;$t=$null;[System.Management.Automation.Language.Parser]::ParseFile('${full.replace(/'/g, "''")}',[ref]$t,[ref]$e)|Out-Null;if($e.Count -gt 0){$e|ForEach-Object{Write-Error $_.Message};exit 1}`;
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCmd], { stdio: 'pipe' });
      }
    }
  });
});
