# commit-display-localization Specification

## Purpose

Define the i18n-branch workflow for localizing commit-related host-side display copy through `./i18n`-owned catalogs and minimal upstream touchpoints.

## Requirements

### Requirement: Commit display copy SHALL be localized through an i18n-owned commit-display workflow

系统 SHALL 通过 `./i18n` 主导的 commit-display localization tooling 与 `src/i18n/commitDisplay` 下的 runtime catalog/adapter 本地化 `CommitFormatter` 与其后续 commit action QuickPick 发出的受控展示文案，而不是依赖 VS Code `l10n` manifest/catalog、`package.nls.json` 或 `webviews.nls.json`。

#### Scenario: Resolving commit display copy from runtime catalogs

- **WHEN** `CommitFormatter` 需要输出受控的 command label、tooltip、签名提示、PR 展示文案或 author mail title
- **THEN** 它 MUST 通过 `src/i18n/commitDisplay` 下 runtime adapter 解析这些文案
- **AND** 该 adapter MUST consume the English and locale commit-display JSON catalogs as the runtime source of truth
- **AND** 当当前 locale 没有可用翻译时，它 MUST 回退到现有英文文案

#### Scenario: Keeping commit display tooling ownership under `./i18n`

- **WHEN** 当前分支为 `CommitFormatter` 新增 extraction/generation、catalog 同步、待翻译报告、glossary 或 merge-assist 规则
- **THEN** 这些 tooling 能力 MUST 由 `./i18n/commitDisplay` 与 `./i18n/shared` 负责
- **AND** 它 MUST NOT 以新的顶层 `l10n/` 目录或平行于 `./i18n` 的 tooling ownership 模型作为默认路径

#### Scenario: Resolving commit action QuickPick copy from the commit-display workflow

- **WHEN** 用户通过 `CommitFormatter.commands()` 暴露的后续入口打开 commit action QuickPick
- **THEN** 该 QuickPick 的受控 action label、separator label、hint、远端资源操作 label 与顶部 stats 文案 MUST 通过同一 commit-display runtime adapter 解析
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

### Requirement: Commit-display English canonical copy SHALL be organized as rule families plus leaf lexicon

系统 SHALL 将 commit-display 的 English canonical text 组织为规则族与少量 leaf lexicon，而不是长期依赖单一巨大平铺 entry 表。

#### Scenario: Deriving stable keys and canonical English from rule families

- **WHEN** commit-display 的 action、separator、stats、hint 或 resource-template 文案可以由受控模式表达
- **THEN** tooling MUST 从这些规则族生成稳定 key 与 canonical English 输出
- **AND** 它 MUST 继续保留现有动态参数占位符语义，例如 `{provider}`、`{resource}`、`{count}` 与 `{branch}`

#### Scenario: Keeping explicit leaf entries only for irreducible controlled copy

- **WHEN** 某条受控文案无法被现有规则族可靠表达
- **THEN** tooling MUST 允许该文案以 leaf lexicon entry 的形式显式存在
- **AND** 它 MUST 将这类 leaf copy 限制在少量无法进一步规则化的条目

### Requirement: Commit-display zh-CN maintenance SHALL use the shared proofreader

系统 SHALL 在 commit-display 的 zh-CN catalog 生成与 pending report 中复用共享 proofreader，而不是继续完全依赖手工维护的 exact English-to-zh-CN 表。

#### Scenario: Applying proofreader during commit-display zh-CN sync

- **WHEN** commit-display zh-CN catalog 从 English canonical catalog 同步
- **THEN** tooling MUST 在写入 zh-CN catalog 前执行共享 proofreader
- **AND** 它 MUST 保持 runtime 仍通过 commit-display catalog key 与参数模板输出最终文案

#### Scenario: Reporting unresolved commit-display copy

- **WHEN** report 命令比较 base ref 与当前 commit-display catalog
- **THEN** 它 MUST 使用与生成阶段相同的 proofreader 判定 already covered 与 pending
- **AND** 它 MUST 继续把未被规则覆盖的受控文案保留为待翻译项

### Requirement: Commit display runtime MUST NOT duplicate JSON catalogs into generated TypeScript catalogs

系统 SHALL 避免将 commit-display English/locale JSON catalogs 再生成一份等价 TypeScript catalog 作为运行时数据源。

#### Scenario: Consuming commit display JSON catalogs directly

- **WHEN** commit-display runtime 需要 English source strings 或 locale translations
- **THEN** 它 MUST consume the commit-display JSON catalogs under `src/i18n/commitDisplay`
- **AND** 它 MUST NOT rely on a generated TypeScript file that duplicates `commitDisplay.nls.json` and `commitDisplay.nls.zh-cn.json`

#### Scenario: Preserving key typing without catalog duplication

- **WHEN** TypeScript key typing is needed for commit-display localization keys
- **THEN** the implementation SHOULD derive key types from the English JSON catalog or another non-duplicating source
- **AND** it MUST NOT introduce a second generated catalog copy solely for typing
