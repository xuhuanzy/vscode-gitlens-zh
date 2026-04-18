## Why

GitLens 的 webview HTML 中仍然有大量硬编码的用户可见文案，尤其集中在 Settings webview。若在每个源码位置逐个替换这些文案，将会引入一大块 fork 本地 diff，不利于持续跟进和合并上游。因此我们需要一条新的本地化路径：保留上游维护的 webview 源码，在 host 侧的 webview HTML 边界统一应用本地化。

## What Changes

- 在 extension host 读取 `dist/webviews/*.html` 之后、运行时 webview token 替换之前，为静态 webview HTML 模板增加 host 边界本地化能力。
- 避免为静态 HTML 本地化在每个字符串位置做源码改写，从而保持上游 webview HTML 源文件和 provider 调用点仍然是可读的英文源码。
- 引入独立于 `package.nls.json` / `package.nls.zh-cn.json` 的 webview HTML 本地化 catalog 与工具链。
- 为已本地化的 HTML 模板引入有界 stale cache，以减少重复解析和 catalog 查找成本。
- 明确禁止缓存最终渲染后的 webview HTML，因为其中包含 CSP nonce、bootstrap state、webview 实例标识以及解析后的 webview URI。
- 首阶段仅覆盖 Settings webview 的静态 HTML 与 partials，Lit/TypeScript 运行时字符串留到后续 change 处理。

## Capabilities

### New Capabilities

- `webview-html-localization`: 定义静态 webview HTML 模板在 host 边界完成本地化的工作流，要求尽量减少对上游源码的扰动，并安全地缓存已本地化模板。

### Modified Capabilities

None.

## Impact

- Affected code: `src/webviews/webviewController.ts`，以及新增的 fork-local `i18n/webviews` 支持代码。
- Affected artifacts: 新增独立于 package manifest catalog 的 webview HTML 英文与 zh-CN catalog。
- Affected build/runtime behavior: 从 `dist/webviews/*.html` 读取的 webview HTML 在现有 `#{...}` token 替换之前，可能先经过本地化处理。
- Initial affected surface: `src/webviews/apps/settings/settings.html` 与 `src/webviews/apps/settings/partials/*.html`，通过它们生成的 `dist/webviews/settings.html` 产物进入首阶段覆盖范围。
