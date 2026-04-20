## MODIFIED Requirements

### Requirement: Shared translation-maintenance policy SHALL support zh-CN merging

系统 SHALL 在 `./i18n` 下集中维护可复用的 zh-CN 翻译维护策略，以降低后续上游合并时重复处理成本；该策略 MAY 包含与 generated locale catalog 分离的 authority-backed manual translation workflow。

#### Scenario: Reusing accepted passthrough and glossary rules

- **WHEN** 多个 surface 都需要接受品牌词、产品名、命令 token 或其他无需翻译的英文直通值
- **THEN** 这些通用值 MUST 由共享策略维护
- **AND** 每个 surface MAY 增加自己的额外 accepted passthrough 或 override 规则

#### Scenario: Validating authoritative manual translations against current English

- **WHEN** 某个 surface 为 manual zh-CN 维护 tooling-owned 的 authoritative translation map
- **THEN** 该 map MUST 存放在 `./i18n` 下独立的 authority directory 中
- **AND** 它 MUST 允许 surface 直接以当前 English 模板作为 key 记录人工确认译文
- **AND** tooling MUST 在生成 runtime locale catalog 前验证 authority entry 中的 English 是否仍与当前 English 一致
- **AND** 当两者不一致时，它 MUST 将该 manual translation 视为 stale，并且 MUST NOT 要求开发者直接编辑 generated runtime locale catalog 来修复

#### Scenario: Organizing shared and branch-owned authority assets

- **WHEN** `./i18n` 需要维护 zh-CN proofreader 的通用 authority 内容或某个 surface / branch-owned authority 内容
- **THEN** 这些 authority assets MUST 位于同一 authority directory ownership 下
- **AND** 它 SHOULD 优先使用 JSON 作为权威配置格式
- **AND** 它 MUST 同时支持 shared authority content 与 branch-owned / surface-owned authority content

#### Scenario: Applying shared glossary only during tooling

- **WHEN** 共享 zh-CN glossary 或 override 规则用于预填、同步或报告
- **THEN** 它 MUST 只属于 `./i18n` tooling 行为
- **AND** runtime code MUST NOT depend on `./i18n` glossary modules
