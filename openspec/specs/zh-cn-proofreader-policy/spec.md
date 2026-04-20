# zh-cn-proofreader-policy Specification

## Purpose

TBD - created by archiving change add-rule-driven-zh-cn-proofreader. Update Purpose after archive.

## Requirements

### Requirement: Shared zh-CN proofreader SHALL remain a tooling-only workflow

系统 SHALL 在 `./i18n` 下集中维护共享 zh-CN proofreader，并且仅在 catalog 生成、同步与待翻译报告阶段执行这些规则。

#### Scenario: Applying the proofreader during locale sync

- **WHEN** 任一 surface 的 zh-CN locale catalog 在 tooling 中被生成或同步
- **THEN** 系统 MUST 在写入 locale catalog 之前执行共享 proofreader
- **AND** runtime adapter MUST 继续只消费 proofreader 输出后的 catalog

#### Scenario: Keeping proofreader logic out of runtime

- **WHEN** runtime 侧本地化 webview 或 commit-display 文案
- **THEN** 它 MUST 使用现有 exact-match catalog lookup
- **AND** 它 MUST NOT 导入或执行共享 proofreader 规则

### Requirement: Shared zh-CN proofreader SHALL apply deterministic layered rules

系统 SHALL 以确定性的分层规则处理 zh-CN 强校对，优先统一保留词、短模板句式与常用术语，并把 surface-specific exact 差异留给 exception 层。

#### Scenario: Resolving a value with protected terms and short templates

- **WHEN** 某个英文值同时包含应保留原意的词与可匹配的短模板句式
- **THEN** proofreader MUST 先保护这些词，再按最长匹配模板生成 canonical zh-CN 输出
- **AND** 它 MUST 只对剩余受控片段应用 glossary 规则

#### Scenario: Leaving surface-specific divergences to exception hooks

- **WHEN** 某个 surface 需要共享 proofreader 无法表达的精确上下文译法
- **THEN** 共享 proofreader MUST 允许该 surface 在 proofreader 之后追加 exact exception 覆盖
- **AND** 这些 exact exceptions MUST NOT 替代本应进入共享规则的通用模式

### Requirement: Pending reports SHALL reuse proofreader outcomes

系统 SHALL 让待翻译报告复用与生成阶段一致的 proofreader 与 surface hook，从而准确区分已覆盖值与仍待人工翻译的值。

#### Scenario: Classifying proofreader-covered values in a pending report

- **WHEN** report 命令评估某个新增或更新的英文值
- **THEN** 如果该值已被 accepted passthrough、template rule、glossary rule 或 surface exception 覆盖
- **THEN** report MUST 将其视为 already covered，而不是 pending

#### Scenario: Preserving unresolved values for manual translation

- **WHEN** 某个英文值未被共享 proofreader 或 surface exception 覆盖
- **THEN** report MUST 将其保留为 pending
- **AND** 它 MUST 继续允许开发者导出稳定报告以处理这些值
