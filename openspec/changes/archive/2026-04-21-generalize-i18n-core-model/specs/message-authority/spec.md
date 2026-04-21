## MODIFIED Requirements

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
