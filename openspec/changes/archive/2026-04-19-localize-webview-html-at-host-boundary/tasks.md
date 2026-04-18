## 1. Webview HTML Catalog 工具链

- [x] 1.1 增加 fork-local `i18n/webviews` 工具链以及 webview HTML 本地化 catalog 所需的共享工具
- [x] 1.2 为首阶段 Settings webview 静态 HTML 范围实现抽取能力，将生成后的静态 HTML 输入转换为英文 catalog
- [x] 1.3 为 webview HTML catalog 实现 zh-CN 同步与待翻译报告能力，并支持稳定 key 与 fallback identity 规则

## 2. Host 边界本地化流水线

- [x] 2.1 在 `src/webviews/webviewController.ts` 中，将 host-side webview HTML 本地化插入到 `workspace.fs.readFile(uri)` 与 `replaceWebviewHtmlTokens()` 之间
- [x] 2.2 确保本地化流程只作用于受控的静态 HTML 文本与属性，且不会改写运行时 webview token 占位符
- [x] 2.3 将首阶段覆盖范围限定为 Settings webview 的生成 HTML 面，保持 Lit/TypeScript 运行时字符串不变

## 3. 已本地化模板缓存

- [x] 3.1 为已本地化的 webview HTML 模板增加有界 cache，key 维度至少包含 webview file、locale、source identity 与 catalog identity
- [x] 3.2 实现“仅在同 identity 内允许 stale 刷新”的行为，禁止跨 locale 或 catalog identity 复用 stale 结果
- [x] 3.3 验证 cache 永远不会存储包含 CSP nonce、bootstrap state、instance ID 或解析后 webview URI 的最终渲染 HTML

## 4. 验证与文档

- [x] 4.1 生成首批 Settings 用的英文与 zh-CN webview HTML catalog，并补充第一批翻译条目
- [x] 4.2 验证 Settings webview 在本地化模式与英文 fallback 模式下的渲染结果，包括 refresh/reload 路径
- [x] 4.3 运行相关 build/tests，并更新当前分支下新的 webview HTML 本地化工作流文档
