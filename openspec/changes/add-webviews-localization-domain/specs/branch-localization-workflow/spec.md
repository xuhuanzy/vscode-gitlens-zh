## MODIFIED Requirements

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
