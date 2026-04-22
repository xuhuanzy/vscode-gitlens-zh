## MODIFIED Requirements

### Requirement: First-phase catalog sync supports the package manifest domain and preserves extension points for future domains

The system SHALL support message extraction from the package manifest domain and from supported webview sources in the current phase, and its catalog model SHALL preserve a domain-adapter boundary so future quickpick, formatter, and related utility sources can be added without redesigning the catalog structure.

#### Scenario: Static manifest message is extracted

- **WHEN** a translatable `package.json` field is scanned
- **THEN** the manifest adapter emits occurrences with structural locators derived from the manifest path and domain identifiers
- **AND** the core catalog records those locators as a domain-neutral source reference plus a manifest-specific output reference

#### Scenario: Webview message is extracted

- **WHEN** a supported webview source such as static HTML, a Lit template, or a JSX subtree is scanned
- **THEN** the webviews adapter emits occurrences using the source reference shape appropriate to that source kind
- **AND** the occurrence records a runtime-oriented output reference rather than pretending to be a manifest key

#### Scenario: Future domain is deferred without redesigning the model

- **WHEN** quickpick, formatter, or unsupported webview source kinds are not yet implemented in the current phase
- **THEN** the catalog model still retains domain and anchor abstractions needed to add those adapters later without changing authority or override semantics

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
- **AND** the generated shell artifact is emitted under `src/i18n` rather than beside the upstream source template

#### Scenario: Future domains can reuse the same generation model

- **WHEN** a later phase adds a new supported domain
- **THEN** that domain can consume the same resolved message model without redefining authority or override precedence
