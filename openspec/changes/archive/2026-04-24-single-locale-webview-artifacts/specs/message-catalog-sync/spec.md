## MODIFIED Requirements

### Requirement: Localized outputs are regenerated from catalog data

The system SHALL treat localized package or UI outputs as regenerable artifacts derived from the catalog, authority source, and override layers. Output targeting MUST be resolved through occurrence output references rather than by requiring manifest-only fields on every catalog consumer.

#### Scenario: Package manifest is regenerated

- **WHEN** the localization pipeline runs for the manifest domain
- **THEN** it rewrites the localized manifest output from the catalog and resolved translations rather than editing translations in place by hand
- **AND** the generator resolves the destination key through the occurrence output reference rather than a manifest-only field on the workset entry

#### Scenario: Webview runtime bundle is regenerated

- **WHEN** the localization pipeline runs for the webviews domain
- **THEN** it rewrites the localized runtime bundle for supported pages from the catalog and resolved translations rather than maintaining a second hand-edited webview message store
- **AND** the generator groups outputs by runtime bundle target derived from the webview localization workflow

#### Scenario: Webview localized shell artifact is regenerated

- **WHEN** the localization pipeline runs for a supported static HTML webview shell
- **THEN** it rewrites the localized HTML artifact from the catalog and resolved translations rather than maintaining a second hand-edited locale HTML source file
- **AND** the generated shell artifact is emitted through the canonical `dist/webviews` build output rather than beside the upstream source template

#### Scenario: Runtime dynamic localization output is regenerated

- **WHEN** the localization pipeline runs for supported formatter or QuickPick runtime dynamic domains
- **THEN** it emits runtime-facing localized output from catalog occurrences and resolved authority translations
- **AND** it does not require hand-maintained localized source copies or broad application-source call-site edits

#### Scenario: Future domains can reuse the same generation model

- **WHEN** a later phase adds a new supported domain
- **THEN** that domain can consume the same resolved message model without redefining authority or override precedence
