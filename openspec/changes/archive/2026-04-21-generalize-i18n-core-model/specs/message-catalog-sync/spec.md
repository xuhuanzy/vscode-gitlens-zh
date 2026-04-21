## MODIFIED Requirements

### Requirement: Message occurrences, anchors, and patterns are tracked separately

The system SHALL model each extracted message as an occurrence linked to a stable anchor and a normalized message pattern. Each occurrence MUST use a domain-neutral structure that records source references independently from any manifest-specific output details.

#### Scenario: Stable anchor survives source reshaping

- **WHEN** a manifest message field is reordered or moved under the same stable identifier such as a command id or configuration key
- **THEN** the occurrence can be re-bound to the existing anchor instead of being treated as a brand new message

#### Scenario: No natural business identifier exists

- **WHEN** a message source lacks a stable domain identifier
- **THEN** the system records a structural locator and ordinal fallback for the occurrence and marks it as a higher-risk anchor

#### Scenario: Different domains use different source reference forms

- **WHEN** one domain extracts a structured JSON field and another domain extracts a source-code string literal
- **THEN** both occurrences can be represented by the same catalog model
- **AND** each occurrence uses the source reference shape appropriate to its domain rather than forcing all domains into manifest path fields

### Requirement: First-phase catalog sync supports the package manifest domain and preserves extension points for future domains

The system SHALL support message extraction from the package manifest domain in the first phase, and its catalog model SHALL preserve a domain-adapter boundary so future webview, quickpick, formatter, and related utility sources can be added without redesigning the catalog structure.

#### Scenario: Static manifest message is extracted

- **WHEN** a translatable `package.json` field is scanned
- **THEN** the manifest adapter emits occurrences with structural locators derived from the manifest path and domain identifiers
- **AND** the core catalog records those locators as a domain-neutral source reference plus a manifest-specific output reference

#### Scenario: Future domain is deferred without redesigning the model

- **WHEN** webview, quickpick, or formatter sources are not yet implemented in the first phase
- **THEN** the catalog model still retains domain and anchor abstractions needed to add those adapters later without changing authority or override semantics

### Requirement: Localized outputs are regenerated from catalog data

The system SHALL treat localized package or UI outputs as regenerable artifacts derived from the catalog, authority source, and override layers. Output targeting MUST be resolved through occurrence output references rather than by requiring manifest-only fields on every catalog consumer.

#### Scenario: Package manifest is regenerated

- **WHEN** the localization pipeline runs for the manifest domain
- **THEN** it rewrites the localized manifest output from the catalog and resolved translations rather than editing translations in place by hand
- **AND** the generator resolves the destination key through the occurrence output reference rather than a manifest-only field on the workset entry

#### Scenario: Future domains can reuse the same generation model

- **WHEN** a later phase adds a new supported domain
- **THEN** that domain can consume the same resolved message model without redefining authority or override precedence
