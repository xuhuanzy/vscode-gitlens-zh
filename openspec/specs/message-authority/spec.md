# message-authority Specification

## Purpose

TBD - created by archiving change unify-i18n-message-model. Update Purpose after archive.

## Requirements

### Requirement: Authority translations are maintained independently from source locations

The system SHALL maintain an authority translation source that is independent from file paths, line numbers, and generated package keys. Each authority message entry MUST represent a default translation for a normalized message rather than a specific source occurrence, and MUST be stored as a single bilingual message record whose structural fields are declared once and shared by its source and translation values.

#### Scenario: Same English message appears in multiple manifest anchors

- **WHEN** the same English message is extracted from multiple package manifest anchors such as a command title and a view title
- **THEN** both occurrences map to the same authority message entry by default

#### Scenario: Source code moves without changing the message

- **WHEN** a message occurrence changes file path or ordering but retains the same normalized message structure
- **THEN** the authority entry remains reusable without requiring a new default translation

#### Scenario: Maintainer audits an authority entry

- **WHEN** a maintainer opens `authority/messages.json` to review a default translation
- **THEN** the entry presents source and translation values within the same bilingual record
- **AND** the maintainer does not need to mentally merge parallel `sourcePattern` and `translationPattern` objects

### Requirement: Authority translations are the lowest-priority translation layer

The system SHALL resolve final translations using layered precedence, where authority message translations are lower priority than selector-based overrides targeting broader or narrower scopes. The override layer MUST use a unified selector model rather than separate manifest-specific override stores.

#### Scenario: Scope override replaces authority default

- **WHEN** an authority entry provides a default translation and a matching scope override exists
- **THEN** the resolved translation uses the scope override instead of the authority default

#### Scenario: Specific output override replaces all broader layers

- **WHEN** a selector targeting a concrete output or equivalent most-specific override target exists for a message occurrence
- **THEN** the resolved translation uses that override regardless of any authority or broader contextual translation

#### Scenario: Future domains use the same override resolver

- **WHEN** a later domain such as webviews introduces an override against an occurrence or runtime output
- **THEN** the resolver can apply that override through the shared selector model
- **AND** it does not require a new domain-specific override file type to preserve precedence

### Requirement: Authority source supports message structures beyond plain strings

The authority translation source SHALL support structured message patterns including literal, template, select, plural, and rich message forms.

#### Scenario: Template message is stored in authority

- **WHEN** a message contains dynamic slots such as a provider or count placeholder
- **THEN** the authority entry preserves the slot structure instead of flattening the message into a plain string

#### Scenario: Rich message is stored in authority

- **WHEN** a package manifest message contains markdown formatting such as links or inline code spans
- **THEN** the authority entry preserves the rich message structure required to regenerate localized output safely

### Requirement: Authority source distinguishes default messages, terms, and aliases

The system SHALL maintain separate authority records for full message defaults, reusable terminology defaults, and manually confirmed aliases between equivalent source messages.

#### Scenario: Reusable product term is maintained centrally

- **WHEN** a term such as "Launchpad" is used across multiple messages
- **THEN** the terminology source can provide a shared default translation without replacing full-message authority entries

#### Scenario: Equivalent sources are manually aliased

- **WHEN** two source messages are confirmed to be equivalent despite benign formatting differences
- **THEN** the alias record links them to the same authority message instead of duplicating translations

### Requirement: Translation worksets support iterative completion states before promotion into authority

The localization workflow SHALL maintain a separate machine-readable translation workset with explicit translation completion states so extraction can produce pending entries before final authority translations are available. Each workset entry MUST reuse the same bilingual message record shape as authority messages while adding only workflow-specific fields such as `status`, `occurrenceIds`, `sourceHash`, or review notes.

#### Scenario: New source message creates a pending workset entry

- **WHEN** a new source message is extracted for the first time
- **THEN** the workflow creates a pending workset entry without requiring an unfinished translation to be written into authority
- **AND** the new workset entry uses the same bilingual message record shape that an authority message entry would use after promotion

#### Scenario: Approved workset entry is promoted into authority

- **WHEN** a workset entry reaches the approved state
- **THEN** its default translation is written into the authority source without changing the source-independent identity of the authority message
- **AND** the promotion step drops workset-only workflow fields instead of rebuilding a different message entry shape

#### Scenario: Workset entry no longer depends on manifest-only key arrays

- **WHEN** a workset entry references the source occurrences that need the translation
- **THEN** it stores occurrence identities rather than manifest-only key arrays
- **AND** the same workset shape can be reused by future non-manifest domains

### Requirement: Authority message files use file-level metadata instead of per-entry change stamps

The authority message source SHALL expose change tracking at the file level and SHALL NOT require per-entry timestamps or persisted fingerprints when those values can be derived from the entry identity or source message structure.

#### Scenario: Approved entries are promoted into authority

- **WHEN** one or more approved workset entries are promoted into `authority/messages`
- **THEN** the authority file updates its top-level change metadata
- **AND** the promoted entries do not need per-entry `promotedAt` or `updatedAt` fields to remain valid authority records

#### Scenario: Resolver needs stable message identity

- **WHEN** the workflow needs to compare or resolve an authority message entry
- **THEN** it uses the stable entry identity and message structure
- **AND** it does not require a separately persisted `patternFingerprint` field if that value can be derived or recalculated
