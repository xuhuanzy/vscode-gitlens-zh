## MODIFIED Requirements

### Requirement: Runtime webview catalog SHALL be generated from conservative UI string extraction

系统 SHALL 从 webview runtime 源码中保守抽取可见 UI 文案，并与静态 HTML catalog 一起写入 `src/i18n/webviews` 下的 webview runtime catalog。

#### Scenario: 抽取 Lit/TS UI 文案

- **WHEN** 开发者运行 webview 本地化生成命令
- **THEN** 工具链 MUST 扫描 `src/webviews/apps`
- **AND** 它 SHOULD 抽取 Lit 模板中的文本节点和受控属性
- **AND** 它 SHOULD 抽取对象字面量中明确 UI 用途的 `title`、`label`、`placeholder`、`tooltip` 等字段
- **AND** it MUST write extracted runtime UI strings into the webview catalogs under `src/i18n/webviews`

#### Scenario: 避免抽取非用户可见片段

- **WHEN** 工具链遇到 CSS class、事件绑定、属性绑定、命令 ID、URL、路径或 placeholder token
- **THEN** 它 MUST NOT 将这些片段作为运行时 UI 文案写入 catalog

## ADDED Requirements

### Requirement: Webview runtime localization helpers SHALL be centralized under `src/i18n/webviews`

系统 SHALL 将 webview runtime localization 的 host/client helper 集中在 `src/i18n/webviews` 下。

#### Scenario: Loading runtime localization payload from centralized host helper

- **WHEN** host builds a runtime localization payload for a webview
- **THEN** it MUST use helper code owned by `src/i18n/webviews`
- **AND** that helper MUST read or import webview catalogs from `src/i18n/webviews`

#### Scenario: Localizing webview client DOM from centralized client helper

- **WHEN** webview client code localizes DOM text or attributes
- **THEN** it MUST use client helper code owned by `src/i18n/webviews`
- **AND** existing shared webview base classes MAY remain the display-boundary integration points that call the centralized helper
