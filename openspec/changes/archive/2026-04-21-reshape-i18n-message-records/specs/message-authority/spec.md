## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: Translation worksets support iterative completion states before promotion into authority

The localization workflow SHALL maintain a separate machine-readable translation workset with explicit translation completion states so extraction can produce pending entries before final authority translations are available. Each workset entry MUST reuse the same bilingual message record shape as authority messages while adding only workflow-specific fields such as `status`, `keys`, `sourceHash`, or review notes.

#### Scenario: New source message creates a pending workset entry

- **WHEN** a new source message is extracted for the first time
- **THEN** the workflow creates a pending workset entry without requiring an unfinished translation to be written into authority
- **AND** the new workset entry uses the same bilingual message record shape that an authority message entry would use after promotion

#### Scenario: Approved workset entry is promoted into authority

- **WHEN** a workset entry reaches the approved state
- **THEN** its default translation is written into the authority source without changing the source-independent identity of the authority message
- **AND** the promotion step drops workset-only workflow fields instead of rebuilding a different message entry shape

#### Scenario: Translation entry requires later revision

- **WHEN** a translated workset entry is judged incomplete or contextually weak
- **THEN** its state can be changed to a review-required status without forcing an unfinished translation into authority
