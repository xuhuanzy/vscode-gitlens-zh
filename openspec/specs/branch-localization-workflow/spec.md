# branch-localization-workflow Specification

## Purpose

TBD - created by archiving change unify-i18n-message-model. Update Purpose after archive.

## Requirements

### Requirement: Branch localization tooling is isolated to dedicated i18n directories

The system SHALL place extraction, reporting, reconciliation, and generation tooling under `./i18n`, and runtime localization support under `./src/i18n`.

#### Scenario: New extraction workflow is added

- **WHEN** a new branch-specific localization tool is introduced
- **THEN** it is implemented under `./i18n` rather than `./scripts`

#### Scenario: Runtime support is needed in application code

- **WHEN** a runtime localization helper is required by extension or webview code
- **THEN** it is implemented under `./src/i18n`

### Requirement: Branch localization workflow does not depend on contributions generation

The branch localization workflow SHALL NOT rely on `contributions.json`, `generate:contributions`, `extract:contributions`, or related webpack-triggered contribution regeneration as i18n inputs or maintenance steps.

#### Scenario: Manifest localization pipeline runs

- **WHEN** the branch localization pipeline processes manifest messages
- **THEN** it uses package-derived catalog data and i18n authority data without requiring `contributions.json`

#### Scenario: Legacy contribution generator is present

- **WHEN** an existing build path would otherwise rewrite contribution-related manifest fields
- **THEN** the branch workflow treats that generator as out of scope for i18n and prevents it from becoming part of translation maintenance

### Requirement: Branch localization workflow actively guards against legacy contribution generators

The branch localization workflow SHALL provide a guardrail so `generate:contributions`, `extract:contributions`, or equivalent legacy contribution regeneration paths cannot be mistaken for valid i18n maintenance operations on this branch.

#### Scenario: Maintainer invokes a legacy contribution generator during i18n maintenance

- **WHEN** `generate:contributions` or `extract:contributions` is invoked while maintaining branch-localized manifest outputs
- **THEN** the workflow fails fast, reports the command as out of scope for branch i18n maintenance, or otherwise prevents the resulting mutation from being accepted as a valid localization update

#### Scenario: Legacy generator mutates i18n-managed outputs

- **WHEN** a legacy contribution regeneration path changes files managed by the branch i18n pipeline
- **THEN** validation detects the mutation and rejects it until the dedicated i18n workflow regenerates the affected outputs

### Requirement: Upstream merges are reconciled through regeneration, not hand-edited localized artifacts

The branch localization workflow SHALL resolve upstream message changes by re-extracting from the merged English sources, reconciling catalog changes, and regenerating localized outputs.

#### Scenario: Upstream modifies a localized source file

- **WHEN** upstream changes land in a source file that contributes localized messages
- **THEN** maintainers update the branch by re-running extraction and reconciliation instead of manually editing existing localized output files in place

#### Scenario: Localized artifact conflicts during rebase

- **WHEN** a generated localized artifact conflicts during an upstream rebase
- **THEN** the workflow favors regenerating the artifact from the post-merge source state rather than preserving manual edits to the generated file

### Requirement: Workflow exposes pending translation progress for Codex-driven translation loops

The branch localization workflow SHALL provide a machine-readable pending translation report derived from the translation workset so Codex can iteratively translate pending entries and know how much work remains. The report SHALL act as a read-only index into the workset rather than as a second editable translation dataset.

#### Scenario: Pending translation report is requested

- **WHEN** the reporting workflow runs after extraction or after a translation pass
- **THEN** it outputs machine-readable counts for at least total, translated, pending, needs-review, and approved entries
- **AND** it outputs reliable workset locator data for each reported entry
- **AND** it does not duplicate full occurrence context or candidate translation payloads that already live in the workset or catalog

#### Scenario: Codex completes a translation pass

- **WHEN** Codex updates one or more pending translation entries
- **THEN** Codex uses the pending report to find the corresponding workset entries rather than editing files under `i18n/reports`
- **AND** rerunning the report reflects the reduced pending count or updated review counts without requiring manual recounting

### Requirement: Reports directory is treated as derived guidance rather than an editable translation source

The branch localization workflow SHALL treat files under `i18n/reports` as derived outputs for inspection and agent guidance rather than as editable translation sources.

#### Scenario: Codex reads a pending report during translation work

- **WHEN** Codex opens a file under `i18n/reports`
- **THEN** the workflow guidance directs Codex to use the report only for progress tracking and workset lookup
- **AND** it directs Codex to edit `i18n/worksets` instead of editing files under `i18n/reports`

#### Scenario: Maintainer needs different report content

- **WHEN** a maintainer needs the pending report to expose different fields
- **THEN** the expected workflow is to change the generating schema or workflow code and regenerate the report
- **AND** direct manual edits to generated report JSON are not treated as valid localization updates

### Requirement: Workflow preserves a path for future unsupported message sources

The branch localization workflow SHALL preserve a discovery path for unsupported or newly introduced message sources so later phases can classify them without silently remaining untranslated.

#### Scenario: New runtime-generated message is encountered

- **WHEN** a message source is not yet covered by the first-phase manifest-focused workflow
- **THEN** the workflow design records it as a deferred source instead of treating it as part of the current implementation scope

#### Scenario: Unsupported source is later formalized

- **WHEN** a previously discovered message source receives a proper adapter or anchor definition
- **THEN** future workflow runs incorporate it into the normal catalog and regeneration pipeline

### Requirement: Branch localization workflow uses controlled data files as the only default translation sources

The branch localization workflow SHALL treat authority files, override files, and translation worksets as the only maintained sources of default translation data. Helper scripts MAY transform, migrate, report, or validate those files, but MUST NOT act as hidden long-term stores of reusable default translations through hardcoded message maps.

#### Scenario: Maintainer wants to seed reusable default translations

- **WHEN** a maintainer needs to batch-introduce reusable default translations
- **THEN** the workflow materializes those translations into authority, terms, overrides, or workset data files under `./i18n`
- **AND** the resulting data remains reviewable through the same files that future workflow runs consume

#### Scenario: Legacy seed helper contains hardcoded translation mappings

- **WHEN** a helper script contains inline translation tables that could approve or inject default translations
- **THEN** that script is not treated as a maintained translation source for the branch workflow
- **AND** the workflow requires the translations to live in controlled data files before they are considered part of the branch's authoritative localization state
