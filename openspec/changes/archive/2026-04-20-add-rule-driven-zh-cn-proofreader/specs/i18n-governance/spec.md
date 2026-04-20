## ADDED Requirements

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
