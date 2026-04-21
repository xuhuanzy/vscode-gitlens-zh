## ADDED Requirements

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
