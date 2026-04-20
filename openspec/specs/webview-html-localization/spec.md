# webview-html-localization Specification

## Purpose

Define the i18n-branch workflow for localizing generated static webview HTML at the extension-host HTML boundary while minimizing changes to upstream-maintained webview source files and provider call sites.

## Requirements

### Requirement: Webview HTML localization SHALL be applied at the host-side HTML boundary

系统 SHALL 在 extension host 读取生成后的 webview HTML 模板之后、运行时 webview token 替换注入实例级值之前，对静态 webview HTML 完成本地化。

#### Scenario: 在运行时 token 替换前本地化静态 HTML

- **WHEN** host 为渲染而加载生成后的 webview HTML 文件
- **THEN** 它 MUST 在替换 `#{state}`、`#{cspNonce}`、`#{webviewId}`、`#{webviewInstanceId}`、`#{root}`、`#{webroot}` 等运行时 token 之前应用静态 HTML 本地化

#### Scenario: 保持现有运行时 token 行为不变

- **WHEN** host-side webview HTML 本地化运行时
- **THEN** 它 MUST NOT 改写或消费运行时 webview token 占位符
- **AND** 现有的运行时 token 替换步骤 MUST 继续负责注入实例级值

### Requirement: Static webview HTML localization SHALL minimize upstream source disruption

系统 SHALL 在不要求对上游维护的 webview HTML 源文件或 provider 调用点进行大范围逐字符串改写的前提下，完成首阶段静态 webview HTML 的本地化。

#### Scenario: 在不做大范围源码调用点改写的情况下本地化 Settings 静态 HTML

- **WHEN** 当前分支对首阶段 Settings webview 静态 HTML 面进行本地化时
- **THEN** 它 MUST 通过集中式的 host-boundary 工作流完成
- **AND** 它 MUST NOT 要求在 `src/webviews/apps/settings/**/*.html` 或 webview provider 实现中引入大范围逐字符串本地化函数调用

### Requirement: Webview HTML localization catalogs SHALL be independent from package manifest catalogs

系统 SHALL 通过一套独立的 catalog 工作流管理 webview HTML 本地化，并与 `package.nls.json`、`package.nls.zh-cn.json` 分离。

#### Scenario: 将运行时 HTML 字符串与 package 字符串分开管理

- **WHEN** 开发者生成或同步 webview HTML 本地化数据时
- **THEN** 该工作流 MUST 写入专用的 webview HTML catalog
- **AND** 它 MUST NOT 将这些运行时 HTML 字符串并入 package manifest 本地化 catalog

### Requirement: Webview HTML localization keys SHALL use stable structural ownership

系统 SHALL 在渲染后的 HTML 面存在稳定结构 owner 时，从这些结构 owner 派生 webview HTML 本地化 key；只有在没有稳定 owner 时，才 MUST 使用确定性的 fallback identity。

#### Scenario: 为 Settings 控件和分区生成 key

- **WHEN** 为静态 Settings webview 中的 label、section 标题、action link、hint 或 option 文本生成 key 时
- **THEN** 该 key 在可行时 MUST 包含稳定的结构 owner，例如 webview file、section identity、control identity 或属性目标
- **AND** 相同英文文本在不同 owner 下 MUST 允许生成不同 key

#### Scenario: 在没有结构 owner 时使用 fallback

- **WHEN** 某个可本地化 HTML 文本片段在不改写源码的前提下无法派生出稳定结构 owner 时
- **THEN** 系统 MUST 使用确定性的 fallback identity
- **AND** 对于未发生变化的源内容，该 fallback identity MUST 保持稳定

### Requirement: Localized webview HTML template caching SHALL exclude final rendered HTML

系统 SHALL 只缓存运行时 token 替换之前的已本地化 HTML 模板，并且 MUST NOT 缓存包含实例级或安全敏感数据的最终渲染 webview HTML。

#### Scenario: 安全地缓存已本地化模板

- **WHEN** host 复用缓存的 webview HTML 本地化结果时
- **THEN** 被缓存的单位 MUST 是运行时 token 替换之前的已本地化模板
- **AND** 它 MUST 排除包含 CSP nonce、bootstrap state、instance 标识或解析后 webview URI 的最终渲染内容

#### Scenario: 约束缓存内存占用

- **WHEN** host 存储已本地化的 webview HTML 模板 cache entry 时
- **THEN** cache MUST 使用有界保留策略
- **AND** 它 MUST 能在不影响正确性的前提下淘汰旧 entry

### Requirement: Localized webview HTML template caching SHALL respect locale and catalog identity

系统 SHALL 将 locale 与 catalog identity 视为已本地化 webview HTML 模板缓存的边界条件。

#### Scenario: 仅在相同 identity 内复用 stale 已本地化模板

- **WHEN** 某个缓存的已本地化模板已经 stale，但仍匹配相同的 webview file、locale、source template identity 与 catalog identity
- **THEN** host MAY 先返回这份 stale 的已本地化模板，同时为后续请求刷新 cache

#### Scenario: 防止跨 locale 复用 stale 模板

- **WHEN** 当前 active locale 或本地化 catalog identity 发生变化时
- **THEN** host MUST NOT 复用来自其他 locale 或其他 catalog identity 的 stale 已本地化模板
- **AND** 它 MUST 重新生成，或基于当前 identity 执行 fallback

### Requirement: Initial host-boundary coverage SHALL target static Settings webview HTML

host-boundary webview HTML 本地化的首阶段 rollout SHALL 聚焦于静态 Settings webview HTML 面，并 SHALL 将 Lit 或 TypeScript 运行时字符串排除在本次 change 范围之外。

#### Scenario: 定义首阶段 rollout 范围

- **WHEN** 第一个 host-boundary webview HTML 本地化 change 被实现时
- **THEN** 它 MUST 覆盖由 `src/webviews/apps/settings/settings.html` 及其 HTML partials 生成的输出面
- **AND** 它 MUST 将 Lit 渲染或 TypeScript 生成的运行时字符串视为该次 rollout 的范围外内容

### Requirement: Webview HTML zh-CN catalog maintenance SHALL use the shared proofreader

系统 SHALL 在维护 webview HTML 所属 zh-CN catalog 时优先应用共享 proofreader，并把 webview-specific exact override 限定为 exception 层。

#### Scenario: Applying proofreader before webview HTML exceptions

- **WHEN** tooling 为包含静态 HTML 文案的 webview catalog 同步 zh-CN locale 值
- **THEN** 它 MUST 先执行共享 proofreader，再执行 webview-specific exact exceptions
- **AND** 它 MUST NOT 继续把共享品牌词、短模板或通用术语长期堆积在 webview-specific overrides 中

#### Scenario: Keeping HTML-specific divergences as exceptions

- **WHEN** 某个静态 HTML 文案需要共享规则无法表达的上下文译法
- **THEN** tooling MUST 通过 webview-specific exact exception 覆盖该值
- **AND** 它 MUST 将这类覆盖限制为 exception-only 内容
