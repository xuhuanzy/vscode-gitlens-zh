## ADDED Requirements

### Requirement: Runtime dynamic generated intermediates use repository-relative source mirrors

The runtime dynamic localization workflow SHALL write rebuildable localized runtime dynamic source intermediates under `.work/i18n/generated/<locale>/<repo-relative-path>`. The generated mirror MUST preserve the source file's repository-relative path and MUST NOT require a runtime-domain-specific generated root such as `.work/i18n/runtime-dynamic-sources`.

#### Scenario: Formatter source is generated

- **WHEN** the runtime dynamic workflow generates a localized source file such as `src/git/formatters/commitFormatter.ts`
- **THEN** the generated source is written under `.work/i18n/generated/zh-cn/src/git/formatters/commitFormatter.ts`
- **AND** the extension build consumes that generated source while preserving the original module path

#### Scenario: Shared package source is generated

- **WHEN** the runtime dynamic workflow generates a localized source file such as `packages/git/src/utils/remote.utils.ts`
- **THEN** the generated source is written under `.work/i18n/generated/zh-cn/packages/git/src/utils/remote.utils.ts`
- **AND** the package source file remains an upstream-oriented English input

#### Scenario: Runtime dynamic loader resolves generated mirror paths

- **WHEN** webpack processes a supported runtime dynamic source module
- **THEN** the runtime dynamic loader checks `.work/i18n/generated/<locale>/<repo-relative-path>` for localized source content
- **AND** it falls back to the original source when no generated mirror exists

### Requirement: Runtime dynamic generated mirror paths have a single producer

The runtime dynamic localization workflow SHALL avoid writing multiple localized outputs to the same `.work/i18n/generated/<locale>/<repo-relative-path>` from different runtime dynamic domains or generation passes. A path collision MUST be reported as an implementation error instead of being resolved by last-writer-wins behavior.

#### Scenario: Two runtime dynamic domains claim the same generated path

- **WHEN** two runtime dynamic target definitions resolve to the same generated mirror path
- **THEN** the workflow reports the collision
- **AND** it does not silently overwrite one generated artifact with the other
