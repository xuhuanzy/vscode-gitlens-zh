## Why

GitLens still exposes many user-visible English strings from extension-host dynamic UI paths such as commit formatters and QuickPick item factories. These strings are outside the existing manifest and webview localization domains, but leaving them untracked makes the zh-cn branch visibly incomplete and makes future upstream merges harder to audit.

This change introduces a catalog-driven path for these dynamic runtime strings while preserving the branch's core i18n constraint: localization must not spread through large numbers of upstream call sites.

## What Changes

- Add a dedicated runtime dynamic localization capability for formatter and QuickPick item text that is generated from the shared catalog, authority, workset, and report workflow.
- Support extraction of controlled UI text slots from low-level source files, including ordinary UI string literals and syntax-bearing templates where the translatable segment has a stable boundary, such as Markdown command link titles.
- Generate localized runtime-facing outputs from the i18n workflow rather than hand-editing localized source copies or adding broad `l10n.t(...)` calls through feature code.
- Use a build-time webpack loader as the approved low-intrusion runtime consumption boundary, so generated `.work` source artifacts enter the extension bundle without editing formatter or QuickPick source call sites.
- Forbid broad rewrites of commands, picker flows, view nodes, webview providers, or other upper-layer feature code for localization coverage.
- Keep user, repository, and remote-provider data untranslated, including commit messages, PR titles, branch names, author names, file paths, SHAs, command identifiers, URI payloads, codicon syntax, telemetry source fields, and Git tokens.

## Capabilities

### New Capabilities

- `runtime-dynamic-localization`: Covers catalog extraction, reconciliation, and generated localization outputs for extension-host dynamic UI text in formatter and QuickPick item domains.

### Modified Capabilities

- `branch-localization-workflow`: Adds a hard workflow requirement that runtime dynamic localization must remain concentrated in controlled low-level generation boundaries and must not be implemented through large-scale application-source call-site edits.
- `message-catalog-sync`: Extends catalog sync behavior from deferred formatter/quickpick placeholders to supported runtime dynamic domains.

## Impact

- Affects i18n workflow code under `i18n/**`, generated catalog/workset/report files, and build/package wiring needed for generated runtime localization artifacts.
- Application source impact remains read-only for extraction targets. Runtime consumption is handled by build-level wiring; future application-source edits still require follow-up review and must not target upper-layer command or picker flow call sites.
- No dependency on `contributions.json` generation is introduced.
- No compatibility layer for superseded i18n-only structures is planned.
