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

### Requirement: Branch-local i18n ownership SHALL live under `./i18n`

系统 SHALL 将 branch-local i18n 的规则、脚本、catalog、生成与报告能力集中在 `./i18n` 下维护。

#### Scenario: Adding a new localization workflow

- **WHEN** the branch introduces extraction, catalog generation, sync, or reporting for a new localization surface
- **THEN** the primary ownership for that workflow MUST be implemented under `./i18n`
- **AND** build or watch automation SHOULD invoke `./i18n` tooling as the authoritative path for that branch-local localization behavior

#### Scenario: Avoiding parallel ownership outside `./i18n`

- **WHEN** a developer considers introducing a new branch-local localization pipeline, catalog root, or generator outside `./i18n`
- **THEN** that approach MUST NOT become the default ownership model
- **AND** any unavoidable out-of-tree integration code MUST remain a thin adapter to `./i18n`-owned logic

### Requirement: i18n implementation SHALL preserve upstream data and common formatting semantics

系统 SHALL 仅本地化受控展示文案，不得借 i18n 之名改写动态用户数据或通用格式规则，除非某个 capability 明确要求。

#### Scenario: Handling dynamic data and common formatting

- **WHEN** localization touches content that mixes static copy with dates, relative time, identifiers, revision labels, provider names, or user-authored text
- **THEN** the implementation MUST translate only the controlled copy
- **AND** it MUST preserve the existing semantics of dynamic values and globally common formatting unless another spec explicitly says otherwise
