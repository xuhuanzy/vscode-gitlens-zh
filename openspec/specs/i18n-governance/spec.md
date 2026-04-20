# i18n-governance Specification

## Purpose

Define branch-wide governance for how this i18n fork localizes GitLens while keeping upstream-maintained source easy to sync.

## Requirements

### Requirement: i18n changes SHALL minimize intrusion into upstream-maintained source

系统 SHALL 以最小侵入方式实现 i18n，并优先避免在上游维护源码中做大范围逐字符串改写。

#### Scenario: Choosing an implementation strategy for a new localization surface

- **WHEN** a new UI surface needs localization in this branch
- **THEN** the design MUST first evaluate boundary-based, generated, or conversion-based approaches
- **AND** it MUST NOT default to scattered per-string source edits if the same result can be achieved with a more centralized approach

#### Scenario: Keeping direct source edits narrowly scoped

- **WHEN** direct changes to upstream-maintained source are unavoidable
- **THEN** those changes MUST be limited to a few controlled integration points nearest the display boundary, translation boundary, or final returned value
- **AND** they MUST NOT expand into unrelated formatting or data-shaping logic

### Requirement: i18n implementation SHALL preserve upstream data and common formatting semantics

系统 SHALL 仅本地化受控展示文案，不得借 i18n 之名改写动态用户数据或通用格式规则，除非某个 capability 明确要求。

#### Scenario: Handling dynamic data and common formatting

- **WHEN** localization touches content that mixes static copy with dates, relative time, identifiers, revision labels, provider names, or user-authored text
- **THEN** the implementation MUST translate only the controlled copy
- **AND** it MUST preserve the existing semantics of dynamic values and globally common formatting unless another spec explicitly says otherwise

### Requirement: Shared zh-CN correction policy SHALL be centralized under `./i18n`

系统 SHALL 将跨 surface 复用的 zh-CN 强校对规则集中维护在 `./i18n` 下，并优先通过共享规则解决重复出现的翻译漂移问题。

#### Scenario: Fixing repeated translation drift across surfaces

- **WHEN** 开发者发现多个 surface 反复出现相同的品牌词、短模板或常用术语漂移
- **THEN** 实现 MUST 优先将该修正沉淀为 `./i18n` 下的共享 proofreader 规则
- **AND** 它 MUST NOT 默认在多个 surface 中重复添加相同的 exact override

#### Scenario: Keeping surface-specific overrides as true exceptions

- **WHEN** 某个翻译差异只在单一 surface 的特定上下文中成立
- **THEN** 实现 MUST 将该差异保留为该 surface 的 exact exception
- **AND** 它 MUST 将该 exception 置于共享 proofreader 之后，而不是建立新的并行规则体系

### Requirement: i18n tooling and runtime ownership SHALL remain separated

系统 SHALL 将 i18n 工具链与运行时资产分离：`./i18n` 只承载抽取、生成、同步、报告、词库与翻译维护策略，`src/i18n` 只承载 extension/webview runtime 需要 import、bundle 或读取的 catalog、adapter 与 helper。

#### Scenario: Adding tooling for a localization surface

- **WHEN** 当前分支为某个 localization surface 新增 extraction、catalog generation、locale sync、pending report、glossary 或 merge-assist 能力
- **THEN** 该 tooling MUST 放在 `./i18n` 下
- **AND** 它 MUST NOT 作为 runtime import path 被 `src/` 代码消费

#### Scenario: Adding runtime i18n code or runtime catalogs

- **WHEN** 当前分支新增 extension host、webview host 或 webview client 在运行时需要执行或读取的 i18n code/catalog
- **THEN** 这些资产 MUST 放在 `src/i18n` 下
- **AND** 它 MUST NOT 分散到 unrelated `src/system`, `src/webviews`, formatter, quickpick 或 provider 目录中，除非该位置只是最小必要的 display-boundary 接入点

#### Scenario: Enforcing dependency direction

- **WHEN** runtime code 需要本地化数据或 helper
- **THEN** runtime code MUST import from `src/i18n` or surface-local runtime adapters
- **AND** runtime code MUST NOT import modules from `./i18n`
- **AND** `./i18n` tooling MAY read or write `src/i18n` catalog/runtime assets as part of generation and reporting workflows

### Requirement: Non-package runtime catalogs SHALL live with runtime i18n assets

系统 SHALL 将不受 VS Code manifest NLS 目录约束的 runtime catalog 放在 `src/i18n/<surface>/` 下，并与对应运行时 adapter 保持相邻 ownership。

#### Scenario: Organizing non-package catalogs

- **WHEN** 某个 catalog 不属于 VS Code package manifest localization
- **THEN** 它 MUST be organized under `src/i18n/<surface>/`
- **AND** English source catalog and locale catalogs for that surface MUST live in the same runtime i18n surface directory

#### Scenario: Keeping package manifest NLS at root

- **WHEN** catalog is `package.nls.json` or `package.nls.<locale>.json`
- **THEN** it MUST remain at the repository root next to `package.json`
- **AND** this exception MUST NOT be generalized to non-package runtime catalogs
