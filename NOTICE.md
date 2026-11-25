# NOTICE / 上游署名与分发说明

本仓库（**Antigravity-Chinese-suite**）是以下两个 MIT 开源项目的**统一编排与整合套件**，自身不主张对组件代码的著作权。各组件原件均以 MIT License 分发，其 `LICENSE` 文件原样保留在 `components/<组件>/LICENSE`。

## 1. Antigravity 深度汉化补丁

- 上游仓库：<https://github.com/antigravity-cn-community/Antigravity-Chinese-Localization>
- 著作权：Copyright (c) 2026 aabbWei；现由 antigravity-cn-community 组织联合维护
- 许可：MIT License
- 本仓库收录版本：commit `e66b515`（上游 package.json 版本 `2.35.0`，2026-11-24）
- 收录方式：保留完整运行时脚本（`localize.js`、`src/`、`process-check.js`、`auto-restore.js`、`asar-version.js` 等）、上游测试与文档，**零修改上游业务代码**。
- 精简剔除的非运行时/专有产物：
  - 去除 `.git`、`.github`、`.vscode`
  - 去除 `extracted/`（上游解包后的宿主源码样本，避免分发第三方专有产物及 Windows 260 字符路径冲突；安装时由 `localize.js --now` 直接在用户本机从官方 `app.asar` 动态解包）
  - 去除 `app.asar.ready`（仅用于上游 2.35.0 静态离线包的制品，本套件统一走动态解包注入以兼容 2.35.x）
  - 去除 `docs/stargazers.json`、`docs/star_history_light.*`、`docs/cover_16_9.jpg` 等大体积展示素材

## 2. Antigravity 对话上下文查看器与 Token 用量看板

- 上游仓库：<https://github.com/elviscjn-cjn/antigravity-context-viewer>
- 著作权：Copyright (c) 2026 Antigravity Context Viewer Contributors；作者 ELVISCHEN
- 许可：MIT License
- 本仓库收录版本：tag `v0.9.2`（2026-11-23）
- 收录方式：保留完整源码、`i18n/` 词典、`src/`、测试与轻量 PNG 截图，**零修改上游业务代码**。
- 精简剔除的非运行时素材：
  - 去除 `.git` 与上游 `.github`
  - 去除 `assets/*.mp4` 与 `assets/*.gif`（约 39 MB 演示录屏/动图）

## 3. 本仓库新增内容

以下文件由本仓库编写，以 MIT License 发布（Copyright (c) 2026 Antigravity-Chinese-suite contributors）：

- `scripts/suite.js`、`scripts/asar-version.js`、`scripts/check-upstream.js`
- `install.ps1`、`uninstall.ps1`、`status.ps1`、`doctor.ps1`
- `一键安装.bat`、`一键卸载.bat`、`查看状态.bat`、`环境诊断.bat`
- `install.sh`、`uninstall.sh`、`status.sh`、`doctor.sh`
- `tests/suite.test.js`、`.github/workflows/ci.yml`、Issue/PR 模板
- `package.json`、`README.md`、`NOTICE.md`、`CHANGELOG.md`、`LICENSE`、`.gitattributes`、`.gitignore`

## 4. 二次分发要求

依据 MIT License，任何复制、修改、再分发本仓库内容的行为需同时满足：

1. 保留上述著作权声明与许可声明（各组件目录内的 `LICENSE` 与本 `NOTICE.md`）；
2. 不得删除或替换上游作者署名；
3. 若对组件代码做了修改，需在说明文档中标注修改内容与时间。

本仓库的安装器仅调用组件自带脚本对用户本机 `resources/app.asar` 进行动态安装，本仓库自身不分发任何客户端二进制或闭源制品。

## 5. 问题归属

本仓库非官方发行版，未获上述项目背书。若遇到安装顺序、环境诊断或脚本问题，请在本仓库提交 Issue；若涉及汉化词条遗漏或看板内部功能，请前往对应上游仓库反馈。
