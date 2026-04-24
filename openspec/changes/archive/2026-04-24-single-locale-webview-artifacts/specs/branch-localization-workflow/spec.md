## MODIFIED Requirements

### Requirement: Branch localization tooling is isolated to dedicated i18n directories

The system SHALL place extraction, reporting, reconciliation, and generation tooling under `./i18n`. Runtime localization support MAY be implemented under `./src/i18n` only when application runtime code still consumes branch-localization helpers directly.

#### Scenario: New extraction workflow is added

- **WHEN** a new branch-specific localization tool is introduced
- **THEN** it is implemented under `./i18n` rather than `./scripts`

#### Scenario: Runtime support is needed in application code

- **WHEN** a runtime localization helper is required by extension or webview code
- **THEN** it is implemented under `./src/i18n`

#### Scenario: Runtime support is no longer needed

- **WHEN** a localization domain publishes branch-localized runtime artifacts through canonical build outputs without runtime helper lookup
- **THEN** the implementation does not keep unused `./src/i18n` modules solely as historical placeholders

### Requirement: Workflow preserves a path for future unsupported message sources

The branch localization workflow SHALL preserve a discovery path for unsupported or newly introduced message sources so later phases can classify them without silently remaining untranslated. The workflow structure itself MUST separate shared i18n core infrastructure from per-domain adapters so future domains can be added without re-centering the workflow around the manifest implementation. When a domain such as `webviews` is introduced, the workflow MUST allow staged rollout by source kind and page family, so supported sources enter the normal catalog/report/generation path while unsupported sources remain explicitly deferred. Generated runtime-facing localization artifacts for webviews MUST be emitted as canonical build outputs rather than being hand-maintained beside upstream source templates under `src/webviews`.

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
- **THEN** the generated artifact is published through the canonical `dist/webviews` build output
- **AND** the workflow does not introduce locale-specific HTML source files under `src/webviews`
