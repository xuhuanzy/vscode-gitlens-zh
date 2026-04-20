# webview-runtime-localization Specification

## Purpose

Define the i18n-branch workflow for localizing webview runtime text at the host injection and shared DOM rendering boundaries while avoiding broad per-component source rewrites.

## Requirements

### Requirement: Webview runtime localization SHALL be injected at the host HTML boundary

系统 SHALL 在 host 生成 webview HTML 时注入当前 locale 与运行时翻译 payload，使 webview 运行时可以在不修改各 provider 调用点的情况下读取本地化数据。

#### Scenario: 注入运行时本地化 payload

- **WHEN** host 为任意 webview 加载 HTML 模板
- **THEN** 它 MUST 基于当前 `env.language` 选择 webview catalog
- **AND** 当存在非英文 locale 翻译表时，它 MUST 注入一个受 CSP nonce 保护的运行时 i18n payload
- **AND** 它 SHOULD 设置最终 HTML 的 `lang` 属性为当前 locale

### Requirement: Runtime localization SHALL minimize upstream source disruption

系统 SHALL 在共享 webview 渲染边界处理运行时文案，而不是要求每个页面或每个组件逐字符串改写。

#### Scenario: 在共享基类层本地化 Lit/legacy DOM 输出

- **WHEN** webview app 或 Lit 组件完成连接并渲染 DOM
- **THEN** 共享基类 MUST 自动尝试本地化其 root 或 `document.body`
- **AND** 页面组件 SHOULD NOT 需要为每个静态字符串显式调用本地化函数

### Requirement: Runtime localization SHALL only rewrite controlled visible text and attributes

系统 SHALL 仅对完整匹配的用户可见文本节点和受控属性应用翻译，并避免猜测动态用户数据。

#### Scenario: 本地化完整文本节点和受控属性

- **WHEN** 运行时 DOM 本地化扫描节点
- **THEN** 它 MAY 替换完整文本节点
- **AND** 它 MAY 替换 `title`、`aria-label`、`placeholder` 等受控属性
- **AND** 它 MUST 保留原始首尾空白

#### Scenario: 避免误改非 UI 或动态内容

- **WHEN** 运行时 DOM 本地化遇到 script、style、code、pre 或未知动态文本
- **THEN** 它 MUST NOT 修改这些内容，除非存在完整 exact-match 翻译

### Requirement: Runtime webview catalog SHALL be generated from conservative UI string extraction

系统 SHALL 从 webview runtime 源码中保守抽取可见 UI 文案，并与静态 HTML catalog 一起写入 `webviews.nls.json`。

#### Scenario: 抽取 Lit/TS UI 文案

- **WHEN** 开发者运行 webview 本地化生成命令
- **THEN** 工具链 MUST 扫描 `src/webviews/apps`
- **AND** 它 SHOULD 抽取 Lit 模板中的文本节点和受控属性
- **AND** 它 SHOULD 抽取对象字面量中明确 UI 用途的 `title`、`label`、`placeholder`、`tooltip` 等字段

#### Scenario: 避免抽取非用户可见片段

- **WHEN** 工具链遇到 CSS class、事件绑定、属性绑定、命令 ID、URL、路径或 placeholder token
- **THEN** 它 MUST NOT 将这些片段作为运行时 UI 文案写入 catalog

### Requirement: Runtime value-level translation map SHALL avoid ambiguous collisions

系统 SHALL 将 catalog 转换为运行时 exact-match 翻译表，但 MUST 避免把同一英文文案映射到多个不同译文。

#### Scenario: 同一英文文案存在冲突译文

- **WHEN** 同一英文值在 catalog 中对应多个不同 localized 值
- **THEN** 运行时值级翻译表 MUST 丢弃该英文值
- **AND** 它 MUST NOT 随机选择其中一个译文

### Requirement: Runtime webview zh-CN maintenance SHALL combine shared proofreader with webview hooks

系统 SHALL 在 runtime webview catalog 的 zh-CN 生成与报告阶段复用共享 proofreader，并保留 webview surface 必需的 value-level hook。

#### Scenario: Applying shared proofreader to runtime-extracted UI text

- **WHEN** runtime UI 文案被抽取进统一的 webview English catalog 并同步到 zh-CN locale catalog
- **THEN** tooling MUST 对这些值应用共享 proofreader
- **AND** 它 MUST 在 proofreader 之后继续保留 webview-specific exact exceptions 的执行点，以处理少量上下文差异

#### Scenario: Preserving webview-specific value grouping behavior in reports

- **WHEN** pending report 以英文值去重或处理 runtime value-level 统计
- **THEN** 它 MUST 在复用共享 proofreader 的同时保留现有 webview-specific grouping 与 implicit passthrough hook
- **AND** 它 MUST 仅把 proofreader 与 exception 都无法覆盖的值保留为 pending
