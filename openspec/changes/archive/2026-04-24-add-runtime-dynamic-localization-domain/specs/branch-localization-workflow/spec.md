## ADDED Requirements

### Requirement: Runtime dynamic localization avoids broad upstream source edits

The branch localization workflow SHALL forbid runtime dynamic localization strategies that require broad modifications across upstream-maintained application source call sites. Runtime dynamic localization MUST be concentrated in controlled i18n workflow code, generated artifacts, and reviewed low-level runtime boundaries.

#### Scenario: A runtime dynamic localization implementation modifies upper-layer call sites

- **WHEN** a proposed implementation edits commands, picker orchestration, view nodes, services, or feature workflows broadly to add translation calls
- **THEN** the workflow treats the implementation as invalid for this change
- **AND** the work must return to design review before coding continues

#### Scenario: A source edit is believed to be unavoidable

- **WHEN** a runtime dynamic localization path cannot be completed without modifying application source
- **THEN** the exact source touch point, reason, and lower-intrusion alternatives are documented for follow-up discussion
- **AND** the edit is not performed until that follow-up design decision is made

#### Scenario: Build-level source injection can satisfy runtime dynamic localization

- **WHEN** generated runtime dynamic source artifacts can be consumed at the webpack build boundary
- **THEN** the workflow uses that build-level path instead of editing upstream application-source call sites
- **AND** the original `src/**` files remain unchanged

#### Scenario: Runtime dynamic gaps are discovered

- **WHEN** runtime dynamic UI text is outside the supported extraction or generation patterns
- **THEN** the workflow reports it as a deferred issue
- **AND** it does not use the gap as justification for broad call-site rewrites
