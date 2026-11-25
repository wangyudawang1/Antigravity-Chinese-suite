#!/usr/bin/env node
'use strict';

/**
 * 检查两个上游仓库的最新提交/发行版，与当前 package.json 中记录的版本进行比对。
 * 支持 GITHUB_TOKEN / GH_TOKEN 环境变量，或在受限环境下自动回退至 gh CLI。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PKG_PATH = path.resolve(__dirname, '..', 'package.json');

async function fetchJson(endpoint) {
  const url = `https://api.github.com/${endpoint}`;
  const headers = {
    'User-Agent': 'Antigravity-Chinese-suite-checker',
    'Accept': 'application/vnd.github+json',
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      return res.json();
    }
    if (res.status === 403 || res.status === 429) {
      const out = execFileSync('gh', ['api', endpoint], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      return JSON.parse(out);
    }
    throw new Error(`HTTP ${res.status} (${url})`);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new Error(`GitHub API 请求受限且未安装 gh CLI，请设置 GITHUB_TOKEN 后重试`);
    }
    throw err;
  }
}

async function main() {
  const pkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf8'));
  const upstream = pkg.upstream || {};

  console.log(`Antigravity Chinese Suite v${pkg.version} - 上游版本检查\n`);

  if (upstream.chineseLocalization) {
    const lc = upstream.chineseLocalization;
    const latestCommit = await fetchJson(`repos/${lc.repo}/commits?per_page=1`);
    const latestTag = await fetchJson(`repos/${lc.repo}/releases/latest`).catch(() => null);
    const sha = latestCommit?.[0]?.sha?.slice(0, 7) || 'unknown';
    const msg = (latestCommit?.[0]?.commit?.message || '').split('\n')[0];
    console.log(`[1] ${lc.repo}`);
    console.log(`    当前收录: commit ${lc.commit} (v${lc.version})`);
    console.log(`    上游最新: commit ${sha}${latestTag?.tag_name ? ` / release ${latestTag.tag_name}` : ''}`);
    console.log(`    最新提交: ${msg}`);
    console.log(`    状态    : ${sha === lc.commit ? '已是最新' : '有新提交可供评估同步'}\n`);
  }

  if (upstream.contextViewer) {
    const cv = upstream.contextViewer;
    const latestTag = await fetchJson(`repos/${cv.repo}/releases/latest`);
    const tag = latestTag?.tag_name || 'unknown';
    console.log(`[2] ${cv.repo}`);
    console.log(`    当前收录: ${cv.tag}`);
    console.log(`    上游最新: ${tag} (${latestTag?.published_at || ''})`);
    console.log(`    状态    : ${tag === cv.tag ? '已是最新' : '有新版本可供评估同步'}\n`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[FAIL] 检查上游失败: ${err.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main };
