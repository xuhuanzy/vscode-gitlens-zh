# message-catalog-sync Specification

## Purpose

TBD - created by archiving change unify-i18n-message-model. Update Purpose after archive.

## Requirements

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

### Requirement: Catalog sync detects message lifecycle changes after re-extraction

The system SHALL compare newly extracted occurrences against the existing catalog and report added, changed, moved, removed, and ambiguous messages.

#### Scenario: English source text changes under the same anchor

- **WHEN** a message is re-extracted with the same anchor but a different normalized source pattern
- **THEN** the catalog marks the message as changed and requires translation review

#### Scenario: Message can no longer be matched confidently

- **WHEN** re-extraction cannot determine whether a new occurrence maps to an existing anchor
- **THEN** the catalog marks the occurrence as ambiguous instead of silently remapping it

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

### Requirement: Catalog sync produces a separate pending translation workset before finalized output generation

The system SHALL be able to emit a separate machine-readable translation workset from extracted catalog entries before finalized localized output is generated.

#### Scenario: Manifest extraction finds untranslated messages

- **WHEN** the manifest catalog contains entries without resolved translations
- **THEN** the workflow emits those entries into a pending translation workset instead of requiring immediate inline translation or immediate authority updates

#### Scenario: Pending translations are later completed

- **WHEN** workset entries are approved and promoted into authority
- **THEN** the same catalog can be re-used to generate finalized manifest localization output without re-keying the messages
