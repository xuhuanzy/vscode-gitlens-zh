# GitLens 中文汉化版

本仓库是 [GitLens](https://github.com/gitkraken/vscode-gitlens) 的中文汉化维护版本。

## 当前定位

- 持续维护 GitLens 的中文本地化
- 汉化工作遵循 `openspec/config.yaml` 中的原则：优先由 `./i18n` 工具链主导，只在必要边界对运行时代码做最小接入

如果你想了解 GitLens 的完整功能介绍、截图和官方说明，请查看上游仓库 README：

- 上游项目: <https://github.com/gitkraken/vscode-gitlens>

## 当前汉化边界

- 已覆盖 `package` manifest 文案
- 已覆盖 webview 静态 HTML 文案
- 已覆盖 webview 运行时 UI 文案的主要受控输出
- 已覆盖 commit display / formatter 的主要受控展示文案

## 目录说明

- `./i18n`
  汉化 tooling 目录，负责 extract、catalog sync、pending report、glossary / passthrough policy、proofreader 和各 surface 的脚本入口。
- `src/i18n`
  运行时代码与 runtime catalog 目录。
- `src/i18n/webviews`
  webview host/client runtime helper 以及它们消费的 catalog。
- `src/i18n/commitDisplay`
  commit display runtime adapter 以及它消费的 catalog。
- `package.nls.json` / `package.nls.zh-cn.json`
  VS Code manifest localization 的根目录 catalog；这是当前目录结构中的特例。

更具体的边界说明可参考：

- `i18n/README.md`
- `openspec/config.yaml`
