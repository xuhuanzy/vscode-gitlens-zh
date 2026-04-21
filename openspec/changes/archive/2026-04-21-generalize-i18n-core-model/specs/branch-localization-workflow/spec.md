## MODIFIED Requirements

### Requirement: Workflow preserves a path for future unsupported message sources

The branch localization workflow SHALL preserve a discovery path for unsupported or newly introduced message sources so later phases can classify them without silently remaining untranslated. The workflow structure itself MUST separate shared i18n core infrastructure from per-domain adapters so future domains can be added without re-centering the workflow around the manifest implementation.

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
