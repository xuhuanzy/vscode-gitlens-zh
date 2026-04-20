## ADDED Requirements

### Requirement: i18n tooling SHALL provide shared catalog lifecycle primitives

系统 SHALL 在 `./i18n` 下提供共享的 catalog lifecycle 工具，用于非运行时的抽取后处理、同步、diff 与稳定写入。

#### Scenario: Reusing catalog lifecycle logic

- **WHEN** package、webview 或 commit-display tooling 需要同步英文 catalog 与 zh-CN catalog
- **THEN** 它 MUST 使用共享 catalog lifecycle primitive 执行稳定排序、缺失 key 英文回退、过期 key 移除与 diff 统计
- **AND** 它 MUST NOT 在每个 surface 中复制同一套 diff/sync/has-changes 算法

#### Scenario: Keeping extractors surface-specific

- **WHEN** tooling 从 package manifest、webview HTML/runtime source 或 commit-display entry 集合提取英文 catalog
- **THEN** extractor MAY 保持 surface-specific
- **AND** extractor 输出的 English catalog MUST 进入共享 catalog lifecycle 后处理，而不是各自重新实现同步与报告基础逻辑

### Requirement: Pending translation reports SHALL use shared report infrastructure

系统 SHALL 使用 `./i18n` 下的共享 report 基础设施生成待翻译报告，同时允许每个 surface 提供必要的策略 hook。

#### Scenario: Reporting pending zh-CN translations from a base ref

- **WHEN** 开发者运行任意 `report:*:zh-cn:pending` 命令
- **THEN** 该命令 MUST 通过共享 report 基础设施读取当前英文 catalog、当前 zh-CN catalog、base ref 英文 catalog 与 base ref zh-CN catalog
- **AND** 它 MUST 基于 added/updated entries 计算 pending translations
- **AND** 它 MUST 支持共享的 `--base`、`--write`、`--fail-on-pending` 与 `--help` 行为

#### Scenario: Preserving surface-specific report policy

- **WHEN** 某个 surface 需要 accepted passthrough values、implicit passthrough predicates、value-level grouping 或自定义控制台展示
- **THEN** 共享 report 基础设施 MUST 提供 hook 让该 surface 注入这些策略
- **AND** 它 MUST NOT 强迫所有 surface 使用相同的 pending preview 格式

### Requirement: Shared translation-maintenance policy SHALL support zh-CN merging

系统 SHALL 在 `./i18n` 下集中维护可复用的 zh-CN 翻译维护策略，以降低后续上游合并时重复处理成本。

#### Scenario: Reusing accepted passthrough and glossary rules

- **WHEN** 多个 surface 都需要接受品牌词、产品名、命令 token 或其他无需翻译的英文直通值
- **THEN** 这些通用值 MUST 由共享策略维护
- **AND** 每个 surface MAY 增加自己的额外 accepted passthrough 或 override 规则

#### Scenario: Applying shared glossary only during tooling

- **WHEN** 共享 zh-CN glossary 或 override 规则用于预填、同步或报告
- **THEN** 它 MUST 只属于 `./i18n` tooling 行为
- **AND** runtime code MUST NOT depend on `./i18n` glossary modules
