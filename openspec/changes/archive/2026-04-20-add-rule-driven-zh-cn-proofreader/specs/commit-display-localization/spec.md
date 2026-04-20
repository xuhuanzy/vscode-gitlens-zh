## ADDED Requirements

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
