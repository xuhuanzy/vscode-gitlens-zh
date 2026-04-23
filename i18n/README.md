# I18n Workflow

当前 i18n 结构已切为 `core + domain adapter`：

- `i18n/core` 负责通用 occurrence、reference、output reference、authority、workset、report 模型
- `i18n/domains/manifest` 负责 `package.json` / `package.nls*` 的提取、对账与生成
- `i18n/domains/webviews` 当前覆盖 `settings` 静态 HTML shell 的端到端提取/生成，以及 `settings` / `welcome` / `rebase` / `home` / `commitDetails` / `timeline` 的运行时消息 bundle 生成；controller 会在底层注入 DOM 本地化 runtime，`graph`、`patchDetails` 与其他 mixed-renderer 或后续页面族仍通过 deferred issues 显式保留在后续范围

`i18n/authority/zh-cn/overrides.json` 统一承载 `occurrence` / `anchor` / `scope` / `output` 四类覆盖规则。

## Manifest Domain

- `i18n/catalog/package.catalog.json` 保留 manifest domain 的 occurrence、source reference、output reference 与对账信息
- `i18n/worksets/package.zh-cn.json` 保留 manifest 翻译工作状态与 `occurrenceIds`
- `i18n/reports/package-pending.json` 是 manifest 域的派生进度视图

常用命令：

1. `pnpm run sync:package-nls`
2. `pnpm run report:package-nls:zh-cn:pending`
3. `pnpm run promote:package-nls:zh-cn`
4. `pnpm run generate:package-nls`

## Webviews Domain

- `i18n/catalog/webviews.catalog.json` 保留 webviews domain 的 occurrence、source reference 与 runtime output reference
- `i18n/worksets/webviews.zh-cn.json` 保留 webviews 翻译工作状态与 `occurrenceIds`
- `i18n/reports/webviews-pending.json` 是 webviews 域的派生进度视图
- `src/i18n/webviews/zh-cn/settings.html` 是由 workflow 生成的本地化静态壳页真源，运行时优先从 `src/i18n/webviews` 读取，构建产物回退到 `dist/webviews/i18n`
- `.work/i18n/webviews-sources/zh-cn/src/webviews/apps/welcome/**` 是由 workflow 基于上游英文源码 AST 派生的本地化动态源码真源，webpack 会再将其编译为 `dist/webviews/i18n/zh-cn/welcome.js`
- `patchDetails` 与其余尚未接入的 mixed-renderer / follow-up 页面当前不会生成本地化脚本产物，而是通过 catalog reconciliation 中的 deferred issues 暴露后续范围

常用命令：

1. `pnpm run sync:webview-nls`
2. `pnpm run report:webview-nls:zh-cn:pending`
3. `pnpm run promote:webview-nls:zh-cn`
4. `pnpm run generate:webview-nls`
5. `pnpm run build:webviews`

## Override Selector 语义

- `occurrence`：只覆盖一个具体 occurrence
- `anchor`：覆盖同一稳定锚点
- `scope`：覆盖某个 domain scope 下的 occurrence
- `output`：覆盖某个具体输出目标
