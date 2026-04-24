## 1. Source-Touchpoint Design Gate

- [x] 1.1 Audit candidate runtime dynamic text sources and produce a short source-touchpoint review note before implementation.
- [x] 1.2 Classify each candidate as workflow-only, generated-output-only, low-level source boundary, or deferred.
- [x] 1.3 Get explicit follow-up agreement on any application-source file that must be edited; do not edit application source before this agreement.
- [x] 1.4 Reject any implementation plan that requires broad edits across upper-layer commands, picker flows, view nodes, services, or webview providers.

## 2. Domain Workflow Shape

- [x] 2.1 Define runtime dynamic domain context, storage, catalog, workset, reconciliation, and pending-report entry points under `i18n/**`.
- [x] 2.2 Decide whether formatter and QuickPick targets share one adapter or use separate adapters while preserving distinct domain scopes.
- [x] 2.3 Add scripts for sync, report, promote, and generate operations without involving `contributions.json` generation.
- [x] 2.4 Update i18n workflow documentation to describe runtime dynamic domains and deferred issue handling.

## 3. Extraction and Deferred Reporting

- [x] 3.1 Implement source-aware extraction for approved low-level complete UI string slots.
- [x] 3.2 Implement bounded Markdown command-link title extraction for approved formatter patterns.
- [x] 3.3 Exclude user data, remote data, command ids, command URIs, codicons, telemetry fields, Git identifiers, and file paths from extraction.
- [x] 3.4 Emit deferred issues for unsupported or ambiguous runtime dynamic strings instead of silently skipping them.

## 4. Generated Runtime Output

- [x] 4.1 Select the generated runtime output strategy approved by the source-touchpoint design gate.
- [x] 4.2 Generate localized runtime output from catalog occurrences and authority translations.
- [x] 4.3 Preserve syntax-bearing template boundaries when applying translated slots.
- [x] 4.4 Keep generated outputs deterministic across repeated workflow runs.

## 5. Validation

- [x] 5.1 Add workflow tests for extraction, deferred reporting, generation, and non-translatable data exclusion.
- [x] 5.2 Add representative tests for Markdown command-link title slot replacement without corrupting command syntax.
- [x] 5.3 Run the relevant i18n workflow tests and pending report commands.
- [x] 5.4 Run the relevant extension build after approved implementation work is complete.
