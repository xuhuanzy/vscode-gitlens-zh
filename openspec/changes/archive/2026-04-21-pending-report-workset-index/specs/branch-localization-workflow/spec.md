## ADDED Requirements

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

## MODIFIED Requirements

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
