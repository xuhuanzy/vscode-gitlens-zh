## Why

`settings.html` 的静态 HTML 本地化已经落在 host 边界，但 GitLens 还有多个 webview 页面：Welcome、Home、Commit Details、Rebase、Timeline、Graph、Composer、Patch Details 等。这些页面的顶层 `.html` 基本只是 `<gl-*>` 壳层，真实用户可见文案主要由 Lit、TypeScript、少量 React 和运行时 DOM 渲染产生。

如果为这些页面逐个把字符串改成显式本地化函数调用，会在上游源码里形成大量 fork-local diff，不利于持续合并上游。因此下一阶段需要继续遵守“底层拦截、最小破坏”的方向，在 webview 渲染边界统一处理运行时文案。

## What Changes

- 在 host 生成 webview HTML 时注入当前 locale 与运行时翻译表，而不是修改每个 webview provider 的调用点。
- 在 webview 共享基类层读取运行时翻译表，并对 Lit/legacy DOM 渲染出的文本节点和受控属性做本地化。
- 扩展 `i18n/webviews` 工具链，从 `src/webviews/apps` 中保守抽取运行时 UI 文案并合并进 `webviews.nls.json`。
- 复用 `webviews.nls.zh-cn.json` 和现有 zh-CN override 流程，为其他 webview 页面补充第一批常见文案翻译。
- 保持静态 HTML 模板本地化 cache 与最终 webview HTML 的安全边界不变。

## Capabilities

### New Capabilities

- `webview-runtime-localization`: 定义 webview 运行时文案在 host 注入和 webview 渲染边界完成本地化的工作流。

### Modified Capabilities

- `webview-html-localization`: 继续作为静态 HTML 模板路径，和运行时文案共享 webview catalog，但两条执行路径保持分离。

## Impact

- Affected code: `src/webviews/webviewController.ts`、`src/webviews/webviewHtmlLocalization.ts`、`src/webviews/apps/shared/*`、`i18n/webviews/*`。
- Affected artifacts: `webviews.nls.json`、`webviews.nls.zh-cn.json`。
- Affected runtime behavior: webview HTML 会获得一个 CSP nonce 保护的运行时 i18n payload；共享 webview 基类会自动本地化已渲染 DOM 的文本节点和受控属性。
- Initial runtime coverage: 不再仅限 `settings`，而是覆盖共享 webview 基类可触达的 Lit/legacy DOM 输出；动态插值句式先通过 exact-match 文案覆盖，复杂语法留给后续显式模板能力。
