## ADDED Requirements

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

The branch localization workflow SHALL provide a machine-readable pending translation report derived from the translation workset so Codex can iteratively translate pending entries and know how much work remains.

#### Scenario: Pending translation report is requested

- **WHEN** the reporting workflow runs after extraction or after a translation pass
- **THEN** it outputs machine-readable counts for at least total, translated, pending, needs-review, and approved entries

#### Scenario: Codex completes a translation pass

- **WHEN** Codex updates one or more pending translation entries
- **THEN** rerunning the report reflects the reduced pending count or updated review counts without requiring manual recounting

### Requirement: Workflow preserves a path for future unsupported message sources

The branch localization workflow SHALL preserve a discovery path for unsupported or newly introduced message sources so later phases can classify them without silently remaining untranslated.

#### Scenario: New runtime-generated message is encountered

- **WHEN** a message source is not yet covered by the first-phase manifest-focused workflow
- **THEN** the workflow design records it as a deferred source instead of treating it as part of the current implementation scope

#### Scenario: Unsupported source is later formalized

- **WHEN** a previously discovered message source receives a proper adapter or anchor definition
- **THEN** future workflow runs incorporate it into the normal catalog and regeneration pipeline
