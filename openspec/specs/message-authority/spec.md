# message-authority Specification

## Purpose

TBD - created by archiving change unify-i18n-message-model. Update Purpose after archive.

## Requirements

### Requirement: Authority translations are maintained independently from source locations

The system SHALL maintain an authority translation source that is independent from file paths, line numbers, and generated package keys. Each authority message entry MUST represent a default translation for a message pattern rather than a specific source occurrence.

#### Scenario: Same English message appears in multiple manifest anchors

- **WHEN** the same English message is extracted from multiple package manifest anchors such as a command title and a view title
- **THEN** both occurrences map to the same authority message entry by default

#### Scenario: Source code moves without changing the message

- **WHEN** a message occurrence changes file path or ordering but retains the same normalized message pattern
- **THEN** the authority entry remains reusable without requiring a new default translation

### Requirement: Authority translations are the lowest-priority translation layer

The system SHALL resolve final translations using layered precedence, where authority message translations are lower priority than scope, anchor, or key-specific overrides.

#### Scenario: Scope override replaces authority default

- **WHEN** an authority entry provides a default translation and a matching scope override exists
- **THEN** the resolved translation uses the scope override instead of the authority default

#### Scenario: Key override replaces all broader layers

- **WHEN** a key-specific override exists for a message occurrence
- **THEN** the resolved translation uses the key override regardless of any authority or scope translation

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

The localization workflow SHALL maintain a separate machine-readable translation workset with explicit translation completion states so extraction can produce pending entries before final authority translations are available.

#### Scenario: New source message creates a pending workset entry

- **WHEN** a new source message is extracted for the first time
- **THEN** the workflow creates a pending workset entry without requiring an unfinished translation to be written into authority

#### Scenario: Approved workset entry is promoted into authority

- **WHEN** a workset entry reaches the approved state
- **THEN** its default translation is written into the authority source without changing the source-independent identity of the authority message

#### Scenario: Translation entry requires later revision

- **WHEN** a translated workset entry is judged incomplete or contextually weak
- **THEN** its state can be changed to a review-required status without forcing an unfinished translation into authority
