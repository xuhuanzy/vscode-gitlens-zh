# I18n Workflow

当前 i18n 结构已切为 `core + domain adapter`：

- `i18n/core` 负责通用 occurrence、reference、output reference、authority、workset、report 模型
- `i18n/domains/manifest` 负责 `package.json` / `package.nls*` 的提取、对账与生成
- `i18n/domains/webviews` 当前覆盖 `settings` 静态 HTML shell 的端到端提取/生成，以及 `settings` / `welcome` / `rebase` / `home` / `commitDetails` / `timeline` 的运行时消息 bundle 生成；controller 会在底层注入 DOM 本地化 runtime，`graph`、`patchDetails` 与其他 mixed-renderer 或后续页面族仍通过 deferred issues 显式保留在后续范围
- `i18n/domains/runtimeDynamic` 负责 formatter / quickpicks 这类扩展宿主动态 UI 文案的只读源码提取、对账、报告与 `.work` 本地化源码产物生成；webpack 构建期 loader 会在不修改 `src/**` 调用点的前提下将这些产物注入扩展 bundle

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

## Runtime Dynamic Domain

- `i18n/catalog/formatter.catalog.json` / `i18n/catalog/quickpicks.catalog.json` 保留 formatter 与 quickpicks runtime dynamic domain 的 occurrence、source reference、runtime output reference 与对账信息
- `i18n/worksets/formatter.zh-cn.json` / `i18n/worksets/quickpicks.zh-cn.json` 保留对应翻译工作状态与 `occurrenceIds`
- `i18n/reports/formatter-pending.json` / `i18n/reports/quickpicks-pending.json` 是对应域的派生进度视图
- `.work/i18n/runtime-dynamic-sources/zh-cn/{formatter,quickpicks}/**` 是由 workflow 基于上游英文源码 AST 派生的本地化源码产物；构建时通过 `i18n/domains/runtimeDynamic/localizedRuntimeDynamicSourceLoader.cjs` 以内存替换方式注入 extension bundle, 不直接修改或替代 `src/**`
- 任何需要改动应用源码以消费 runtime dynamic 产物的路径, 必须先通过 source-touchpoint review; 禁止为了本地化在上层 commands、picker flows、views、services 中大面积添加调用点
- `pnpm run build:quick` / `pnpm run watch:quick` 会触发 runtime dynamic source generation；如果 VS Code Extension Host 已启动, 需要重新加载窗口才能看到新的 bundle

常用命令：

1. `pnpm run sync:formatter-nls` / `pnpm run sync:quickpicks-nls`
2. `pnpm run report:formatter-nls:zh-cn:pending` / `pnpm run report:quickpicks-nls:zh-cn:pending`
3. `pnpm run promote:formatter-nls:zh-cn` / `pnpm run promote:quickpicks-nls:zh-cn`
4. `pnpm run generate:formatter-nls` / `pnpm run generate:quickpicks-nls`
5. `pnpm run build:quick` 或启动对应 watch 任务后重新加载 Extension Host

## Override Selector 语义

- `occurrence`：只覆盖一个具体 occurrence
- `anchor`：覆盖同一稳定锚点
- `scope`：覆盖某个 domain scope 下的 occurrence
- `output`：覆盖某个具体输出目标
