## ADDED Requirements

### Requirement: Message occurrences, anchors, and patterns are tracked separately

The system SHALL model each extracted message as an occurrence linked to a stable anchor and a normalized message pattern.

#### Scenario: Stable anchor survives source reshaping

- **WHEN** a manifest message field is reordered or moved under the same stable identifier such as a command id or configuration key
- **THEN** the occurrence can be re-bound to the existing anchor instead of being treated as a brand new message

#### Scenario: No natural business identifier exists

- **WHEN** a message source lacks a stable domain identifier
- **THEN** the system records a structural locator and ordinal fallback for the occurrence and marks it as a higher-risk anchor

### Requirement: First-phase catalog sync supports the package manifest domain and preserves extension points for future domains

The system SHALL support message extraction from the package manifest domain in the first phase, and its catalog model SHALL preserve a domain-adapter boundary so future webview, quickpick, formatter, and related utility sources can be added without redesigning the catalog structure.

#### Scenario: Static manifest message is extracted

- **WHEN** a translatable `package.json` field is scanned
- **THEN** the manifest adapter emits occurrences with structural locators derived from the manifest path and domain identifiers

#### Scenario: Future domain is deferred without redesigning the model

- **WHEN** webview, quickpick, or formatter sources are not yet implemented in the first phase
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

The system SHALL treat localized package or UI outputs as regenerable artifacts derived from the catalog, authority source, and override layers.

#### Scenario: Package manifest is regenerated

- **WHEN** the localization pipeline runs for the manifest domain
- **THEN** it rewrites the localized manifest output from the catalog and resolved translations rather than editing translations in place by hand

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
