## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Contributions generation SHALL emit stable package NLS keys

**Reason**: The i18n branch no longer models package localization as a generic upstream contribution generation step. Ownership is split into upstream read-only inputs plus fork-local package manifest generation under `i18n/package`.

**Migration**: Use fork-local `i18n/package` generation as the branch-default path for producing `package.json` and package NLS catalogs instead of relying on upstream `generate:contributions` as the manifest writer.

### Requirement: Contributions extraction SHALL resolve NLS keys back to English

**Reason**: This branch no longer needs a reversible `package.json -> contributions.json` flow. Automatic reverse synchronization is now treated as harmful because it can write branch-local localized manifest changes back into upstream-owned inputs.

**Migration**: Stop using localized package manifest changes as a source for `contributions.json`. Treat `contributions.json` as upstream-owned input and keep any residual extraction tooling out of the default branch workflow.
