# commit-display-localization Specification

## Purpose

Define the i18n-branch workflow for localizing commit-related host-side display copy through `./i18n`-owned catalogs and minimal upstream touchpoints.

## Requirements

### Requirement: Commit display copy SHALL be localized through an i18n-owned commit-display workflow

系统 SHALL 通过 `./i18n` 主导的 commit-display localization 工作流本地化 `CommitFormatter` 与其后续 commit action QuickPick 发出的受控展示文案，而不是依赖 VS Code `l10n` manifest/catalog、`package.nls.json` 或 `webviews.nls.json`。

#### Scenario: Resolving commit display copy from an i18n-owned catalog

- **WHEN** `CommitFormatter` 需要输出受控的 command label、tooltip、签名提示、PR 展示文案或 author mail title
- **THEN** 它 MUST 通过 `./i18n` 下 commit-display localization workflow 生成并提供的 catalog 或派生产物解析这些文案
- **AND** 当当前 locale 没有可用翻译时，它 MUST 回退到现有英文文案

#### Scenario: Keeping commit display localization ownership under `./i18n`

- **WHEN** 当前分支为 `CommitFormatter` 新增 catalog、同步规则、待翻译报告或运行时查找表
- **THEN** 这些 branch-local 本地化能力 MUST 由 `./i18n` 下的脚本与资产负责
- **AND** 它 MUST NOT 以新的顶层 `l10n/` 目录或平行于 `./i18n` 的 ownership 模型作为默认路径

#### Scenario: Resolving commit action QuickPick copy from the commit-display workflow

- **WHEN** 用户通过 `CommitFormatter.commands()` 暴露的后续入口打开 commit action QuickPick
- **THEN** 该 QuickPick 的受控 action label、separator label、hint、远端资源操作 label 与顶部 stats 文案 MUST 通过同一 `./i18n` commit-display localization workflow 解析
- **AND** 它 MUST 保留 commit summary、provider 名称、branch 名称、SHA、文件路径等动态值

### Requirement: CommitFormatter localization SHALL use minimal source touchpoints

系统 SHALL 以最小侵入方式接入 `CommitFormatter` 本地化，只允许在少数受控展示边界或最终返回值附近进行转换。

#### Scenario: Localizing commands and other formatter surfaces through boundary conversion

- **WHEN** `CommitFormatter` 为 `commands()`、`message()`、`link()`、`pullRequest()`、`pullRequestState()`、`signature()` 或 author mail title 生成展示字符串
- **THEN** 实现 MUST 优先在这些 surface 的最终返回值、最终 tooltip/title 组装点或其他等价的边界位置接入本地化
- **AND** 它 MUST NOT 为同一 change 在 `CommitFormatter` 内进行大范围逐字符串重写或无关的结构重排

#### Scenario: Localizing commit action QuickPick through item boundaries

- **WHEN** commit action QuickPick 构造 command item、separator、hint 或通知文案
- **THEN** 实现 MUST 优先在 item / separator / hint 构造边界调用集中 helper
- **AND** 它 MUST NOT 改变 QuickPick item 的 command id、command args、图标或执行行为

#### Scenario: Preserving existing markdown and command behavior

- **WHEN** 本地化应用于 markdown command 链接、tooltip title 或 footnote 文案
- **THEN** 它 MUST 保持原有 command link、telemetry source payload、markdown 结构与 html 属性结构不变
- **AND** 它 MUST 只转换 catalog 中声明的受控展示文案

### Requirement: CommitFormatter localization SHALL preserve common formatting and dynamic data

系统 SHALL 仅本地化受控展示文案，不得改变日期、relative time、revision formatting 或动态用户数据的既有语义。

#### Scenario: Preserving date, relative time, and revision formatting

- **WHEN** `CommitFormatter` 输出日期、relative time、revision label、short SHA、stash 编号或其他通用格式内容
- **THEN** 本地化 MUST NOT 改变这些格式规则或默认结构

#### Scenario: Preserving dynamic values inside localized output

- **WHEN** `CommitFormatter` 输出 commit message 正文、PR 标题、provider 名称、邮箱地址、author 名称或其他动态值
- **THEN** 本地化 MUST 保留这些运行时值本身
- **AND** 它 MUST 只翻译围绕这些值的受控静态片段

### Requirement: Pull request state SHALL be localized only at CommitFormatter display time

系统 SHALL 仅在 `CommitFormatter` 展示层本地化 `PullRequest.state` 的显示值，不得改变模型层原始状态。

#### Scenario: Localizing pull request state labels in formatter output

- **WHEN** `CommitFormatter` 在 `pullRequest()` 或 `pullRequestState()` 中展示 `opened`、`closed`、`merged` 等状态
- **THEN** 它 MUST 使用展示层映射输出本地化状态标签
- **AND** `PullRequest.state` 的原始模型值 MUST 保持不变

#### Scenario: Keeping pending pull request lookup copy localized without changing behavior

- **WHEN** `CommitFormatter` 处于 pull request pending / loading 展示路径
- **THEN** 它 MUST 本地化该受控等待文案
- **AND** 它 MUST 保持现有的 pending 刷新行为与交互语义不变
