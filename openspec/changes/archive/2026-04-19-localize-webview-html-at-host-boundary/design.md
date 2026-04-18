## Context

之前的 i18n 工作已经通过 fork-local `i18n/package` 工作流完成了 package manifest 产物的本地化，并且明确把运行时字符串排除在范围之外。下一个尚未覆盖的大面就是 webview 内容。对静态 HTML 的扫描结果表明，硬编码英文文本高度集中在 Settings webview 及其 partials 中；而其他多数 webview 的 `.html` 文件只是 host 壳层，真正的用户可见文案由 Lit 或 TypeScript 运行时代码渲染。

当前的 host 流水线会在 `WebviewController.getHtml()` 中读取 `dist/webviews/<fileName>` 生成后的 webview HTML，再调用 `replaceWebviewHtmlTokens()` 注入 `#{state}`、`#{cspNonce}`、`#{webviewId}`、`#{webviewInstanceId}` 以及 webview URI 等运行时值。这为 i18n 分支提供了一个很窄、但很关键的拦截点，可以在不改写上游 webview 源文件和 provider 调用点的情况下，对静态 HTML 模板做本地化。

## Goals / Non-Goals

**Goals:**

- 在 extension-host 的 webview HTML 边界对静态 webview HTML 进行本地化。
- 在静态 HTML 本地化可以集中处理的前提下，尽量保留上游维护的 HTML 与 TypeScript 调用点不变。
- 保持 webview HTML 本地化 catalog 与 package manifest catalog 分离。
- 以有界方式缓存已本地化的 HTML 模板，避免重复解析或重复查找。
- 避免缓存最终渲染后的 webview HTML，因为其中包含运行时 token、CSP nonce、bootstrap state、instance ID 和解析后的 webview URI。
- 首阶段交付 Settings webview 静态 HTML 与 partials 的覆盖。

**Non-Goals:**

- 本次 change 不处理 Lit 模板、TypeScript 生成字符串、命令标签或 package contribution 字符串的本地化。
- 不把 `src/webviews/apps/settings/**/*.html` 改写成显式的逐字符串本地化函数调用。
- 不替代 VS Code 现有的 package manifest 本地化机制。
- 不引入从本地化后的 webview 输出反向抽取回上游源文件的可逆流程。

## Decisions

### 1. Intercept after HTML template read and before runtime token replacement

host 将在 `workspace.fs.readFile(uri)` 读到 HTML 字符串之后、传给 `replaceWebviewHtmlTokens()` 之前完成本地化。

Rationale:

- 输入此时仍然是静态模板，因此本地化可以只处理用户可见的 HTML 文本与属性，而不会碰到序列化后的 bootstrap state。
- CSP nonce、webview ID、placement、state、root URI、webroot URI 等运行时敏感值仍由现有 token 替换流程负责。
- 变更被隔离在公共的 host 边界，而不是分散到每个 webview provider 或每个 HTML 源文件。

Alternatives considered:

- 直接在源 HTML 中加入 `%key%` 或函数调用来本地化。
  - 否决，因为这会在上游 webview 文件上形成大块 fork-local diff。
- 在 `replaceWebviewHtmlTokens()` 之后再做本地化。
  - 否决，因为此时 HTML 中已经包含动态脚本、base64 state、CSP 数据以及解析后的 URI，本地化流程不应解析或改写这些内容。

### 2. Keep webview HTML catalogs independent from package catalogs

webview HTML 本地化将使用 `i18n/webviews` 下的新 catalog 面，而不是复用 `package.nls.json`。

Rationale:

- `package.nls.json` 的职责范围是 package manifest contributions，并且已经在 `i18n/package` 下有清晰的 ownership contract。
- 静态 webview HTML 属于扩展运行时内容，而不是 VS Code contribution metadata。
- 分离 catalog 可以让两条工作流各自演进，而不会把 package 生成与 webview 渲染耦合起来。

Alternatives considered:

- 用 `package.nls.json` 统一承载所有英文字符串。
  - 否决，因为这会混淆 package manifest key 与运行时 HTML key，并削弱已有的 package ownership boundary。

### 3. Use stable structural keys where available

catalog key 在可能的情况下应从结构性 owner 派生，例如 webview file、section ID、setting ID、label `for`、option `value`、`data-action` 或其他稳定的元素身份。只有在无法得到稳定结构身份时，才允许使用基于内容的短哈希作为兜底。

Rationale:

- owner-based key 能容忍不同 UI 控件下重复出现的相同英文文本。
- 结构性 key 在翻译内容调整时更不容易抖动。
- 哈希兜底可以保证工作流完整，而不必为了补标识而强行修改源码。

Alternatives considered:

- 用英文原文本身作为 key。
  - 否决，因为重复标签会冲突，而且英文文案调整会导致 key 重命名。
- 在所有位置强制增加显式 `data-i18n` 属性。
  - 对首阶段范围来说不合适，因为这仍然会造成较大的上游冲突面。

### 4. Cache localized templates, not final webview HTML

可缓存的单位应是“运行时 token 替换之前的已本地化模板”。cache key 至少必须包含 webview file name、当前 locale、源模板 identity 和 catalog identity。由于 webview 模板数量本身不大，cache 容量应保持有界。

Rationale:

- 缓存已本地化模板可以避免重复解析和重复查找。
- 最终渲染后的 HTML 是 instance-specific 且带有安全敏感信息，因为其中包含 CSP nonce、bootstrap 数据、instance ID 和解析后的 URI。
- 小而有界的 cache 可以避免不必要的内存滞留。

Alternatives considered:

- 直接缓存 `getHtml()` 返回的最终 HTML。
  - 否决，因为这会带来复用过期 CSP nonce、过期 bootstrap state 或错误 webview instance 数据的风险。
- 完全不做缓存。
  - 否决，因为 Settings HTML 体量相对较大，本地化流程在 refresh/reload 中可能被重复触发。

### 5. Prefer stale-while-revalidate semantics within the same cache identity

当某个已本地化模板 cache entry 过期，但仍然匹配相同的 file、locale、source identity 与 catalog identity 时，host 可以先返回这份 stale 模板，并在后台刷新 cache。cache 不得跨 locale 或 catalog identity 复用 stale entry。

Rationale:

- 同 identity 的 stale entry 可以降低 refresh 延迟，并减少常见 webview reopen 路径上的重复工作。
- locale 或 catalog 变化是 correctness 边界，跨 locale 复用 stale entry 会直接显示错误语言。
- 在错误 locale 下返回英文 fallback，也比返回错误语言的本地化内容更安全。

Alternatives considered:

- 同步失效 stale entry，并强制每次调用都等待重新生成。
  - 否决，因为这会失去 stale cache 最核心的响应性收益。
- 不区分 locale，复用任意 stale entry。
  - 否决，因为这会直接显示错误语言。

## Risks / Trade-offs

- [Risk] 运行时本地化误改了非用户可见 HTML，例如 script 内容、style 内容、URL、VS Code token 占位符或数据载荷。 → Mitigation: 在 token 替换之前完成本地化，并使用只面向受控文本节点与可本地化属性的抽取/应用模型。
- [Risk] Settings HTML 在上游重构后导致生成 key 大量抖动。 → Mitigation: 优先使用稳定的结构性 identity，仅在无稳定 owner 时使用基于内容的 fallback。
- [Risk] stale cache 返回了错误 locale 或错误 catalog 版本的内容。 → Mitigation: 将 locale 与 catalog identity 纳入 cache key，并禁止跨 identity 复用 stale entry。
- [Risk] 运行时解析生成后的 HTML 成本过高，或无法同时兼容 desktop 与 webworker extension host。 → Mitigation: 能用构建期/工具期生成的本地化映射就尽量使用，并保持运行时应用逻辑轻量；同时验证 desktop 与 browser extension 两个目标。
- [Risk] 首阶段只覆盖 Settings，可能导致其他可见 webview 字符串仍未翻译。 → Mitigation: 明确将 Lit/TypeScript 运行时字符串作为后续 capability，在 host-boundary HTML 路径稳定后再处理。

## Migration Plan

1. 在 `i18n/webviews` 下增加针对首阶段 Settings 范围的 webview HTML catalog 抽取与同步工具。
2. 在 `getHtml()` 边界、`replaceWebviewHtmlTokens()` 之前加入 host-side webview HTML 本地化支持。
3. 增加有界的已本地化模板 cache，并确保它永远不存储最终渲染后的 webview HTML。
4. 生成英文与 zh-CN 的 webview catalog，并完成首批 Settings 条目的翻译。
5. 在 zh-CN 模式和英文 fallback 模式下验证 Settings webview 输出，并运行相关构建检查。
