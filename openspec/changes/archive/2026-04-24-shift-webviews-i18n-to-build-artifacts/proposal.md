## Why

当前 webviews i18n 对静态 shell 与动态页面采用了两条不同路径：

- `settings` 等静态 shell 通过生成派生 localized HTML artifact，并由 `WebviewController` 选择最终壳页
- `welcome`、`rebase`、`home`、`commitDetails`、`timeline` 等动态页面则依赖 controller 注入的 runtime localization payload 与 DOM 本地化 runtime，在页面加载后扫描文本、属性、Shadow DOM 与后续变更再做替换

这条动态 runtime 路径虽然保持了对上游 `src/webviews/apps/**` 模板源码的低侵入，但运行时过重：

- 引入文本扫描、模板匹配、`MutationObserver`、`attachShadow` hook 等复杂逻辑
- 把本地化正确性延后到 DOM 渲染之后，增加调试难度与时序复杂度
- 让 controller 同时承担“选择最终产物”和“注入翻译引擎”两种职责

对当前分支来说，真正必须优先满足的约束仍然是“最小侵入上游源码、便于持续 rebase”。因此我们不能改为在 Lit 页面模板中广泛手写 `t()` 调用，也不能把 i18n 改动扩散到 `src/webviews/apps/**`。更合适的方向是：保持上游源码不变，把动态页面的本地化从 runtime DOM 替换转为构建期派生 JS/HTML artifact，并继续把切入点收敛在 `i18n/**`、`src/i18n/**` 与 `src/webviews/webviewController.ts`。

## What Changes

- 为动态 webview 页面引入“构建期派生本地化脚本产物”方案：基于英文源码或英文构建产物与 authority 翻译结果，生成 locale-specific runtime script artifact，而不是在页面加载后通过通用 DOM runtime 替换文本
- 保留静态 shell 的 localized HTML artifact 路线，并将其与动态页面的 localized JS artifact 一起视为统一的 build artifact 选择问题
- 将 `WebviewController` 的职责收敛为“按 locale 选择最终 HTML / JS 产物并完成既有 token 注入”，不再承担动态翻译 runtime 的注入与执行
- 在本次 change 中正式将 `welcome`、`rebase`、`home`、`commitDetails`、`timeline` 与 `graph` 纳入动态页面 rollout，统一验证 Lit 模板提取、派生脚本生成、controller 产物选择与首屏本地化路径；`patchDetails` 与 mixed-renderer 边界继续 deferred
- 在本次 change 中直接删除现有 runtime localization bundle / DOM runtime 路线，以及 `i18n/domains/webviews` 中仅服务于该路线的生成逻辑；只有在 AST 派生编译流程中仍被复用的低层提取/模板能力才允许保留
- 允许为切换到 AST/build-artifact 路线做破坏性更新，无需为旧 runtime schema、旧注入协议、旧生成输出或旧加载路径保留任何兼容性代码

## Capabilities

### Modified Capabilities

- `webviews-localization`: 从“静态 shell artifact + 动态 runtime bundle/runtime injection”调整为“静态 shell artifact + 动态 localized script artifact”
- `message-catalog-sync`: webviews domain 的输出模型从 runtime key / runtime bundle 为主，扩展为可生成 locale-specific JS/HTML artifact 的 build output pipeline

## Impact

- 影响 `i18n/domains/webviews/**` 的 generator、workflow、tests 与输出布局
- 影响 `src/i18n/**` 中 webview runtime 本地化相关模块，其中动态 DOM runtime 及其 payload 注入能力将在本次 change 中直接删除
- 影响 `src/webviews/webviewController.ts` 的 HTML 装配逻辑，使其支持按 locale 选择派生脚本产物，并移除通用翻译 runtime 注入逻辑
- 影响 `welcome`、`rebase`、`home`、`commitDetails`、`timeline` 与 `graph` 的动态页面产物生成与加载路径，并保留 `patchDetails` 与 mixed-renderer 边界为后续扩展项
