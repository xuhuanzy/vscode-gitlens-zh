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

The branch localization workflow SHALL preserve a discovery path for unsupported or newly introduced message sources so later phases can classify them without silently remaining untranslated. The workflow structure itself MUST separate shared i18n core infrastructure from per-domain adapters so future domains can be added without re-centering the workflow around the manifest implementation. When a domain such as `webviews` is introduced, the workflow MUST allow staged rollout by source kind and page family, so supported sources enter the normal catalog/report/generation path while unsupported sources remain explicitly deferred. Generated runtime-facing localization artifacts for webviews MUST remain under `src/i18n` rather than being hand-maintained beside upstream source templates under `src/webviews`.

#### Scenario: New runtime-generated message is encountered

- **WHEN** a message source is not yet covered by the first-phase manifest-focused workflow
- **THEN** the workflow design records it as a deferred source instead of treating it as part of the current implementation scope

#### Scenario: Unsupported source is later formalized

- **WHEN** a previously discovered message source receives a proper adapter or anchor definition
- **THEN** future workflow runs incorporate it into the normal catalog and regeneration pipeline

#### Scenario: Shared infrastructure is reviewed after manifest support exists

- **WHEN** a maintainer inspects the branch localization workflow after the manifest phase is already implemented
- **THEN** shared schema, authority, store, and reconciliation logic live in a core layer
- **AND** manifest-specific extraction and generation remain in a manifest adapter layer rather than continuing to define the workflow structure for all future domains

#### Scenario: Webviews rollout supports staged page-family adoption

- **WHEN** only a subset of webview source kinds or page families is formally supported
- **THEN** those supported webviews enter the normal extraction, report, and generation flow
- **AND** more complex webviews can remain explicitly deferred without blocking localized output for the supported subset

#### Scenario: Localized webview shell artifact is generated

- **WHEN** the workflow emits a localized static webview shell
- **THEN** the generated artifact lives under `src/i18n`
- **AND** the workflow does not introduce locale-specific HTML source files under `src/webviews`

### Requirement: Branch localization workflow uses controlled data files as the only default translation sources

The branch localization workflow SHALL treat authority files, override files, and translation worksets as the only maintained sources of default translation data. Helper scripts MAY transform, migrate, report, or validate those files, but MUST NOT act as hidden long-term stores of reusable default translations through hardcoded message maps. Breaking structural changes inside `i18n/**` MAY replace old schemas and data layouts directly, and the workflow MUST NOT preserve compatibility code for superseded i18n-only structures once the controlled data files have been rewritten.

#### Scenario: Maintainer wants to seed reusable default translations

- **WHEN** a maintainer needs to batch-introduce reusable default translations
- **THEN** the workflow materializes those translations into authority, overrides, or workset data files under `./i18n`
- **AND** the resulting data remains reviewable through the same files that future workflow runs consume

#### Scenario: Legacy seed helper contains hardcoded translation mappings

- **WHEN** a helper script contains inline translation tables that could approve or inject default translations
- **THEN** that script is not treated as a maintained translation source for the branch workflow
- **AND** the workflow requires the translations to live in controlled data files before they are considered part of the branch's authoritative localization state

#### Scenario: Core schema is hard-cut inside the i18n area

- **WHEN** the branch rewrites i18n-only core schema, store APIs, or controlled data layouts to support a domain-neutral model
- **THEN** the workflow updates the controlled data files and tests to the new structure directly
- **AND** it does not keep fallback readers, dual-write logic, or historical compatibility branches for superseded i18n-only formats

### Requirement: Runtime dynamic localization avoids broad upstream source edits

The branch localization workflow SHALL forbid runtime dynamic localization strategies that require broad modifications across upstream-maintained application source call sites. Runtime dynamic localization MUST be concentrated in controlled i18n workflow code, generated artifacts, and reviewed low-level runtime boundaries.

#### Scenario: A runtime dynamic localization implementation modifies upper-layer call sites

- **WHEN** a proposed implementation edits commands, picker orchestration, view nodes, services, or feature workflows broadly to add translation calls
- **THEN** the workflow treats the implementation as invalid for this change
- **AND** the work must return to design review before coding continues

#### Scenario: A source edit is believed to be unavoidable

- **WHEN** a runtime dynamic localization path cannot be completed without modifying application source
- **THEN** the exact source touch point, reason, and lower-intrusion alternatives are documented for follow-up discussion
- **AND** the edit is not performed until that follow-up design decision is made

#### Scenario: Build-level source injection can satisfy runtime dynamic localization

- **WHEN** generated runtime dynamic source artifacts can be consumed at the webpack build boundary
- **THEN** the workflow uses that build-level path instead of editing upstream application-source call sites
- **AND** the original `src/**` files remain unchanged

#### Scenario: Runtime dynamic gaps are discovered

- **WHEN** runtime dynamic UI text is outside the supported extraction or generation patterns
- **THEN** the workflow reports it as a deferred issue
- **AND** it does not use the gap as justification for broad call-site rewrites
