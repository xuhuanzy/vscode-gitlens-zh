# runtime-dynamic-localization Specification

## Purpose

TBD - created by archiving change add-runtime-dynamic-localization-domain. Update Purpose after archive.

## Requirements

### Requirement: Runtime dynamic localization extracts only controlled extension-host UI text slots

The system SHALL extract translatable runtime dynamic UI text from explicitly supported low-level extension-host source patterns. It MUST NOT treat arbitrary strings in commands, picker flows, view nodes, services, telemetry, command ids, or data models as translatable by default.

#### Scenario: QuickPick item factory text is extracted from a supported low-level pattern

- **WHEN** a supported QuickPick item factory or item class contains a complete static UI label, description, or detail string
- **THEN** the runtime dynamic localization workflow records that string as a source occurrence
- **AND** the occurrence preserves source reference, domain, scope, anchor, and output reference data needed for regeneration

#### Scenario: QuickPick nullish assignment fallback text is extracted

- **WHEN** a supported QuickPick item factory assigns a complete UI label, description, or detail string through `??=`
- **THEN** the runtime dynamic localization workflow records that string as a source occurrence
- **AND** generated output preserves the assignment operator and replaces only the string literal content

#### Scenario: Safe QuickPick label templates preserve dynamic expressions

- **WHEN** a supported low-level QuickPick label, description, or detail is a complete UI template with dynamic provider, resource, branch, repository, or remote values
- **THEN** the workflow extracts the static UI skeleton as a template with numbered slots
- **AND** generated output restores the original dynamic expressions unchanged
- **AND** it translates only the static UI skeleton

#### Scenario: QuickPick templates with pluralized slot expressions are deferred

- **WHEN** a supported QuickPick UI template has a dynamic slot expression that still formats English text through pluralization
- **THEN** the workflow reports the template as deferred
- **AND** it does not approve or generate a mixed-language translation for that template

#### Scenario: Narrowly approved commit quick-wizard labels are localized

- **WHEN** the approved commit quick-wizard step contains complete `GitWizardQuickPickItem` labels or QuickPick separator labels
- **THEN** the workflow may extract those labels under the QuickPick runtime dynamic domain
- **AND** generated output preserves command ids, state objects, branch names, repository data, and other dynamic expressions unchanged
- **AND** this does not authorize broad command or picker-flow localization rewrites

#### Scenario: Formatter Markdown title text is extracted from a bounded slot

- **WHEN** a supported formatter template contains a Markdown command link title with a complete static UI string
- **THEN** the workflow extracts only the title text slot
- **AND** it does not extract or rewrite the command URI, Markdown delimiters, codicon syntax, command id, or dynamic data expressions

#### Scenario: Safe formatter Markdown title templates preserve dynamic expressions

- **WHEN** a supported formatter template contains a one-line Markdown command link title whose UI skeleton is static but includes dynamic expressions such as a remote provider name
- **THEN** the workflow extracts the title as a template with numbered slots
- **AND** generated output restores the original dynamic expressions unchanged
- **AND** it translates only the static UI skeleton

#### Scenario: Formatter Markdown visible label text is extracted from a bounded slot

- **WHEN** a supported formatter template contains a Markdown command link visible label with a complete static UI string after optional codicon syntax
- **THEN** the workflow extracts only the visible label text slot
- **AND** it does not extract or rewrite the command URI, Markdown delimiters, codicon syntax, command id, or dynamic data expressions

#### Scenario: Safe formatter Markdown visible label templates preserve dynamic expressions

- **WHEN** a supported formatter template contains a one-line Markdown command link visible label whose UI skeleton is static but includes dynamic expressions such as a remote provider name or ellipsis expression
- **THEN** the workflow extracts the label as a template with numbered slots
- **AND** generated output restores the original dynamic expressions unchanged
- **AND** it translates only the static UI skeleton

#### Scenario: Formatter HTML title text is extracted from a bounded slot

- **WHEN** a supported formatter template contains a static HTML `title` attribute with a complete static UI string
- **THEN** the workflow extracts only the attribute value slot
- **AND** it does not extract or rewrite the surrounding element syntax, command URI, class names, codicon syntax, or dynamic data expressions

#### Scenario: Formatter HTML wrapper templates are not extracted as UI text

- **WHEN** a supported formatter template contains only an HTML wrapper and dynamic slots
- **THEN** the workflow does not record the wrapper as a translatable occurrence
- **AND** it preserves the wrapper syntax unchanged in generated output

#### Scenario: User and remote data are not extracted

- **WHEN** formatter or QuickPick output includes commit messages, PR titles, branch names, author names, provider names, repository names, file paths, SHAs, command payloads, or telemetry source fields
- **THEN** the workflow excludes those values from translation
- **AND** it does not create catalog occurrences for those values

#### Scenario: Shared package display names can be read-only source targets

- **WHEN** a package utility returns complete UI display names directly consumed by a supported low-level runtime dynamic UI boundary
- **THEN** the workflow may treat that utility as a read-only source target
- **AND** build-time source injection preserves the original package module path without editing the package source file

#### Scenario: Unsupported runtime dynamic source remains deferred

- **WHEN** a runtime dynamic string is outside the supported low-level patterns or has ambiguous syntax boundaries
- **THEN** the workflow reports the source as deferred
- **AND** it does not silently localize or silently ignore the source

### Requirement: Runtime dynamic localization output is generated from catalog authority data

The system SHALL generate runtime-facing localization outputs from catalog occurrences and resolved authority translations. It MUST NOT require hand-maintained localized source copies or hidden hardcoded translation maps.

#### Scenario: Runtime dynamic output is regenerated

- **WHEN** the runtime dynamic localization generation workflow runs
- **THEN** it resolves translations through authority, overrides, and workset state
- **AND** it emits deterministic generated output for supported runtime dynamic domains

#### Scenario: Missing translation remains visible

- **WHEN** a supported runtime dynamic occurrence has no resolved translation
- **THEN** the generated report marks it unresolved or pending
- **AND** the workflow does not replace it with guessed translation text

#### Scenario: Generated output preserves syntax boundaries

- **WHEN** generated output replaces a supported slot inside syntax-bearing formatter text
- **THEN** only the translated UI text slot changes
- **AND** Markdown syntax, HTML attribute syntax, command URIs, escaped dynamic content, placeholder expressions, and non-translatable data remain intact

#### Scenario: Extension build consumes generated runtime dynamic output

- **WHEN** the extension node or webworker bundle is built
- **THEN** the build runs runtime dynamic source generation for supported domains
- **AND** webpack injects the generated localized source content in memory for matching modules while preserving original module paths
- **AND** upstream `src/**` files are not rewritten

### Requirement: Runtime dynamic localization forbids broad source call-site edits

The system SHALL treat broad application-source call-site localization as invalid for this capability. Runtime dynamic consumption SHOULD use the approved build-level loader boundary. Any application-source touch point required after that boundary MUST be reviewed and approved in a follow-up design step before implementation.

#### Scenario: Implementation proposes upper-layer call-site rewrites

- **WHEN** an implementation approach requires editing many commands, picker flows, view nodes, feature services, or webview providers to add localization calls
- **THEN** the approach is rejected for this capability
- **AND** the implementation must return to design review instead of proceeding

#### Scenario: A low-level source touch point may be necessary

- **WHEN** implementation discovers a small low-level source edit may be necessary to connect generated runtime localization output
- **THEN** the exact source path and rationale are captured for follow-up discussion
- **AND** the edit is not made as part of this proposal without that review
