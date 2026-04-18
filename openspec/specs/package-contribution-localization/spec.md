# package-contribution-localization Specification

## Purpose

Define the i18n-branch workflow for generating localized package manifest artifacts from upstream-owned contribution sources without writing branch-local package changes back into those sources.

## Requirements

### Requirement: Upstream contribution sources SHALL remain read-only in the i18n branch

The system SHALL treat `contributions.json` as an upstream-owned input in this branch. Local package localization workflows MAY consume it, but they MUST NOT rewrite it as part of package manifest generation.

#### Scenario: Consuming upstream contribution updates

- **WHEN** upstream changes to `contributions.json` are synced into the i18n branch
- **THEN** local package localization tooling MUST consume those English contributions as input
- **AND** it MUST preserve `contributions.json` as the upstream-authored file

#### Scenario: Regenerating package localization outputs

- **WHEN** a developer regenerates localized package artifacts in this branch
- **THEN** the workflow MUST update derived package outputs only
- **AND** it MUST NOT rewrite `contributions.json`

### Requirement: Fork-local tooling SHALL be the sole writer of package manifest artifacts

The system SHALL generate `package.json`, `package.nls.json`, and `package.nls.zh-cn.json` through fork-local tooling under `i18n/package` rather than through upstream `./scripts` contribution writers.

#### Scenario: Generating localized package manifest outputs

- **WHEN** package manifest localization runs
- **THEN** `i18n/package` tooling MUST produce the final `package.json`
- **AND** it MUST produce the corresponding English and Chinese package catalogs

#### Scenario: Default automation ownership

- **WHEN** build or watch automation runs in this branch
- **THEN** it MUST NOT invoke upstream contribution scripts to rewrite `package.json`
- **AND** package manifest write ownership MUST remain with `i18n/package`

### Requirement: Reverse synchronization from package manifest to upstream contribution sources SHALL be blocked

The system SHALL block default workflows that propagate `package.json` changes back into `contributions.json` in this branch.

#### Scenario: Package manifest changes do not trigger extraction

- **WHEN** `package.json` changes because localized manifest generation ran
- **THEN** the default workflow MUST NOT trigger `package.json -> contributions.json` extraction
- **AND** no localized `%key%` references or branch-local manifest edits may be written into `contributions.json`

#### Scenario: Localized package strings remain isolated

- **WHEN** a localized package string changes in `package.json`, `package.nls.json`, or `package.nls.zh-cn.json`
- **THEN** the change MUST remain isolated to package manifest artifacts
- **AND** upstream contribution sources MUST remain untouched

### Requirement: Package manifest localization SHALL cover complete localizable contribution fields

The system SHALL generate localized package manifest strings for the full set of package contribution fields owned by this branch, including existing generated contributions and the VS Code settings UI metadata under `contributes.configuration`.

#### Scenario: Generating command, submenu, view, and welcome strings

- **WHEN** localized manifest generation processes command titles, submenu labels, view names, contextual titles, or `viewsWelcome.contents`
- **THEN** each generated package contribution string MUST use a `%key%` reference
- **AND** `package.nls.json` MUST contain the corresponding English source text for each key

#### Scenario: Generating configuration strings

- **WHEN** localized manifest generation processes `contributes.configuration`
- **THEN** configuration category titles and setting metadata strings MUST be emitted through `%key%` references
- **AND** the generated catalog MUST cover setting descriptions, markdown descriptions, enum descriptions, and deprecation messages used by the settings UI

### Requirement: Package contribution NLS keys SHALL follow owner-based naming rules

The system SHALL generate package contribution NLS keys from owning manifest fields rather than from English source strings.

#### Scenario: Generating command, submenu, view, and welcome keys

- **WHEN** a key is generated for a command title, submenu label, view name, contextual title, or `viewsWelcome.contents`
- **THEN** the key MUST include the normalized owner identifier and target field name
- **AND** identical English labels under different owners MUST produce different keys
- **AND** `viewsWelcome.contents` MUST use stable content-derived identity instead of positional index ordering

#### Scenario: Generating configuration keys

- **WHEN** a key is generated for a configuration category title or setting metadata string
- **THEN** the key MUST include the normalized configuration owner and target field name
- **AND** identical English text under different settings or categories MUST produce different keys

### Requirement: Package Chinese catalog SHALL be derived from the English package catalog

The system SHALL generate `package.nls.zh-cn.json` from `package.nls.json` by preserving existing translations and synchronizing the key set.

#### Scenario: Preserving existing Chinese translations

- **WHEN** the Chinese package catalog generator runs and an existing `package.nls.zh-cn.json` already contains translations for current keys
- **THEN** the generator MUST preserve those translated values

#### Scenario: Adding missing Chinese entries

- **WHEN** `package.nls.json` contains keys that do not exist in `package.nls.zh-cn.json`
- **THEN** the generator MUST add those keys to `package.nls.zh-cn.json`
- **AND** the initial value MUST default to the English source string

#### Scenario: Removing obsolete Chinese entries

- **WHEN** `package.nls.zh-cn.json` contains keys that no longer exist in `package.nls.json`
- **THEN** the generator MUST remove those obsolete keys from the generated Chinese catalog

#### Scenario: Reporting pending Chinese translations from a git base

- **WHEN** developers need to translate newly added or updated package English entries
- **THEN** `i18n/package` tooling MUST be able to compare the current `package.nls.json` against a specified git base revision
- **AND** it MUST report only the keys whose zh-cn value is missing or still equals the current English source
- **AND** it MUST treat passthrough values already accepted in the base zh-cn catalog as already covered rather than pending
