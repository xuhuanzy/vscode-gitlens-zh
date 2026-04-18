## 1. Host 运行时本地化注入

- [x] 1.1 在 host webview HTML 边界读取 webview catalog，并构造 locale/runtime translation payload
- [x] 1.2 使用 CSP nonce 注入 runtime i18n payload，并同步 `<html lang>`
- [x] 1.3 保持静态 HTML 模板本地化和最终 token replacement 的安全边界不变

## 2. Webview 共享渲染边界

- [x] 2.1 增加运行时 exact-match 本地化 core，支持空白保留和歧义翻译丢弃
- [x] 2.2 在 `GlElement` / `GlWebviewApp` / legacy `App` 层接入 DOM 本地化
- [x] 2.3 使用 MutationObserver 覆盖后续追加节点，并避免无翻译表时启用观察器

## 3. Runtime Catalog 工具链

- [x] 3.1 扩展 `i18n/webviews` 生成流程，从 `src/webviews/apps` 抽取运行时 UI 文案
- [x] 3.2 将运行时 catalog 与 Settings 静态 HTML catalog 合并进 `webviews.nls.json`
- [x] 3.3 同步 `webviews.nls.zh-cn.json` 并补充第一批常见 webview 文案翻译

## 4. 验证与文档

- [x] 4.1 增加运行时本地化 core 行为测试
- [x] 4.2 更新 `i18n/webviews` README，说明静态 HTML 与运行时 DOM 两条路径
- [x] 4.3 运行 `generate:webview-localization-assets`、`generate:webview-nls:zh-cn`、`build:quick`，并处理发现的问题
