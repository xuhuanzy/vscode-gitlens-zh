## MODIFIED Requirements

### Requirement: Shared zh-CN proofreader SHALL apply deterministic layered rules

系统 SHALL 以确定性的分层规则处理 zh-CN 强校对，优先统一保留词、短模板句式与常用术语，并把 authority content 维护为 `./i18n` 下单独目录中的 JSON-backed 词典，而不是继续把这些权威内容散落在 TypeScript 常量集合里。

#### Scenario: Loading proofreader authority from shared JSON assets

- **WHEN** shared zh-CN proofreader 初始化通用 authority 内容
- **THEN** 它 MUST 从 `./i18n` 下独立 authority directory 的 shared assets 加载这些权威内容
- **AND** 它 SHOULD 优先使用 JSON 作为权威配置格式
- **AND** 它 MUST NOT 继续把 shared authority content 的长期真源维护在 `sharedZhCnPassthroughValues`、`sharedZhCnProtectedTerms` 之类的硬编码常量里

#### Scenario: Expressing preserved and translated terms through one authority dictionary

- **WHEN** 某个 canonical 词需要保留英文原样，或需要映射到确定的 zh-CN 输出
- **THEN** authority data SHOULD 使用统一的 source-to-localized dictionary 表达它
- **AND** identity-preserved 词 SHOULD 以 `"Blame": "Blame"` 这类 entry 表达，而不是要求维护者在多套常量集合里重复声明
- **AND** proofreader MAY 从同一词典派生 exact-match 与 segment-protection 所需的最小内部视图

### Requirement: Pending reports SHALL reuse proofreader outcomes

系统 SHALL 让待翻译报告复用与生成阶段一致的 proofreader、surface hook 与 authority validation，从而准确区分已覆盖值、stale manual translation 与仍待人工翻译的值。

#### Scenario: Classifying proofreader-covered values in a pending report

- **WHEN** report 命令评估某个新增或更新的英文值
- **THEN** 如果该值已被 accepted passthrough、template rule、glossary rule 或 surface exception 覆盖
- **THEN** report MUST 将其视为 already covered，而不是 pending

#### Scenario: Classifying authority-backed values in a pending report

- **WHEN** report 命令评估某个新增或更新的英文值，且 surface authoritative translation map 包含对应英文模板 key
- **THEN** 如果该 authority entry 仍对应当前 English 并且 translation 可用，report MUST 将其视为 already covered
- **AND** 如果该 authority key 已不再对应当前 English，report MUST 将其视为 pending updated，而不是复用旧译文

#### Scenario: Preserving unresolved values for manual translation

- **WHEN** 某个英文值未被共享 proofreader、surface exception 或有效 authority entry 覆盖
- **THEN** report MUST 将其保留为 pending
- **AND** 它 MUST 继续允许开发者导出稳定报告以处理这些值
