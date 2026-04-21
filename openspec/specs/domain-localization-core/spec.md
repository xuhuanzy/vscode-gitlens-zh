# domain-localization-core Specification

## Purpose

Define the domain-neutral i18n core that shared localization workflows build on.

## Requirements

### Requirement: I18n core model is domain-neutral and independent from any single localization source

The i18n system SHALL define its core catalog, workset, authority, and reporting model without embedding manifest-specific concepts such as package keys, manifest-only path fields, or package-specific context types.

#### Scenario: A future webviews domain needs to reuse the core model

- **WHEN** a new localization domain such as `webviews` is added after manifest support
- **THEN** the domain can represent its extracted messages, translation workset entries, and authority resolution using the shared core model
- **AND** it does not need a parallel copy of catalog or workset schema just because it lacks manifest keys

#### Scenario: Core model is reviewed for cross-domain suitability

- **WHEN** a maintainer inspects the core i18n types and schemas
- **THEN** the model exposes domain-neutral concepts such as occurrence identity, source reference, output reference, and selector-based overrides
- **AND** it does not require the reader to reinterpret manifest-specialized names as generic concepts

### Requirement: Source occurrences distinguish source references from output references

The i18n core SHALL represent where a message comes from and where its resolved translation is emitted as separate concepts. Each occurrence MUST carry a source reference, and MAY carry an output reference when the domain generates a keyed artifact or runtime bundle.

#### Scenario: Manifest message is extracted

- **WHEN** a manifest adapter extracts a translatable `package.json` field
- **THEN** the occurrence records a structured source reference for the manifest location
- **AND** it records a manifest output reference for the generated localization key

#### Scenario: Runtime-facing domain is extracted

- **WHEN** a future webviews adapter extracts a translatable HTML, Lit, or JSX string
- **THEN** the occurrence records a source-code reference to the originating file and range
- **AND** it can record a runtime-oriented output reference without pretending to be a manifest key

### Requirement: Translation worksets reference occurrences rather than manifest-only output keys

The i18n core SHALL store workset grouping references as occurrence identities rather than as manifest-only key arrays.

#### Scenario: Workset entry groups manifest occurrences

- **WHEN** multiple manifest occurrences map to the same authority message identity
- **THEN** the workset entry stores the grouped occurrence identities
- **AND** manifest-specific output keys are resolved by looking up those occurrences in the catalog rather than by duplicating manifest key arrays in the workset entry

#### Scenario: Non-manifest domain reuses the same workset shape

- **WHEN** a future domain creates a pending translation workset entry
- **THEN** it can use the same workset schema without inventing placeholder manifest keys
- **AND** the entry remains traceable back to the originating occurrences

### Requirement: Override data uses a unified selector model

The i18n core SHALL represent translation overrides through a unified selector structure rather than through separate files tied to manifest-only concepts.

#### Scenario: Specific output translation is overridden

- **WHEN** a resolved translation must differ for one generated output target
- **THEN** the override can target that output through a specific selector kind
- **AND** the system does not require a dedicated manifest-only override file to express it

#### Scenario: Broader contextual override is applied

- **WHEN** a translation should be overridden for a whole scope or anchor
- **THEN** the same override system can target the broader selector kind
- **AND** resolver precedence can still choose the more specific selector when multiple overrides match

### Requirement: Core workflow boundaries separate shared infrastructure from domain adapters

The i18n system SHALL organize shared storage, schema, authority, reconciliation, and context utilities separately from per-domain extraction and generation logic.

#### Scenario: Manifest workflow is implemented

- **WHEN** the manifest localization workflow runs
- **THEN** it consumes shared core infrastructure from a dedicated core layer
- **AND** its domain-specific extraction and generation logic lives in a manifest adapter layer

#### Scenario: Another localization domain is introduced later

- **WHEN** a later phase adds `webviews`, `quickpicks`, or `formatter`
- **THEN** that domain adds its own adapter code without moving shared authority or store logic back into a manifest-specific module
