# 更新日志 (Changelog)

## v1.0.0 (2026-11-25)

### 新增 (Added)
- **跨平台统一编排器 (`scripts/suite.js`)**：完整支持 Windows、macOS 与 Linux，提供 `install`、`uninstall`、`status`、`doctor` 子命令及 `--app-dir`、`--skip-localization`、`--skip-viewer`、`--only-viewer`、`--force-stop`、`--dry-run`、`--json` 选项。
- **环境诊断工具 (`doctor` / `环境诊断.bat` / `doctor.ps1` / `doctor.sh`)**：一键检查 Node.js 版本、组件完整性、Antigravity 安装路径、`app.asar.bak` 纯净度、`@electron/asar` 缓存状态（附国内镜像加速提示）与进程占用。
- **macOS / Linux 原生入口**：新增 `install.sh`、`uninstall.sh`、`status.sh`、`doctor.sh`。
- **上游版本检查器 (`scripts/check-upstream.js`)**：一键对比两个上游仓库的最新提交与发行版。
- **自动化测试与 CI**：新增 `tests/suite.test.js` 与 `.github/workflows/ci.yml`（Windows + Ubuntu 双平台 CI 验证）。

### 修复与优化 (Fixed & Improved)
- **修复 Windows PowerShell 5.1 中文编码解析错误**：为所有 `.ps1` 脚本补全 UTF-8 BOM + CRLF 编码，避免在英文或未开启 UTF-8 Beta 的 Windows 系统中出现语法误报与乱码。
- **修复 `-AppDir` 参数未透传的缺陷**：旧脚本仅检查路径却未传给底层组件；现由 `scripts/suite.js` 将自定义路径准确透传至汉化与看板组件。
- **修复重复安装时的基底污染问题**：再次安装时若检测到已有补丁痕迹且 `app.asar.bak` 有效，会先原子复位纯净官方备份再重新执行「汉化 → 看板」，保证幂等性与稳定性。
- **修复仅安装看板后卸载的误报警告**：无汉化状态下卸载不再错误警告缺失 `app.asar.bak`。
- **修复进程检测遗漏**：补全 Windows 下 `language_server_windows_x64.exe` 等变体进程名的识别，并修复 `查看状态.bat` 忽略错误码的问题。
- **仓库极简瘦身 (~80 MB → ~14.7 MB)**：剔除 `extracted/`（1,167 个 Google 专有解包文件，彻底解决 Windows 260 字符路径克隆报错）、冗余离线包 `app.asar.ready` 与 40 MB 演示视频/GIF，保留全部上游源码、测试与 LICENSE。

### 上游收录基线
- `antigravity-cn-community/Antigravity-Chinese-Localization`: commit `e66b515` (v2.35.0)
- `elviscjn-cjn/antigravity-context-viewer`: tag `v0.9.2`
