## Context

The branch already has catalog-driven localization for manifest output and supported webview artifacts. Runtime text from extension-host paths remains outside that workflow, especially formatter output and QuickPick item text. These areas contain low-level UI templates, Markdown command link titles, tooltip strings, and status labels that are user-visible but are not managed by `package.nls*` or the webview i18n workflow.

The main constraint is maintenance. This branch must continue merging upstream GitLens, so the runtime dynamic localization path must not be implemented by adding localization calls across upper-layer commands, picker flows, views, or feature services. Any unavoidable application-source edits need a separate follow-up discussion and approval before implementation.

## Goals / Non-Goals

**Goals:**

- Add a catalog-driven runtime dynamic localization path for formatter and QuickPick item text.
- Keep extraction, workset, authority, reporting, and generation under the existing i18n workflow model.
- Support compile-time localization of controlled low-level UI text slots, including static string slots, bounded Markdown command link title slots, safe one-line dynamic Markdown title templates, and static HTML `title` attribute slots inside template literals.
- Preserve syntax-bearing content such as Markdown links, command URIs, codicons, telemetry fields, and Git identifiers while translating only the UI text slots.
- Make broad source-call-site localization changes explicitly invalid for this change.
- Require a follow-up source-touchpoint review before any application-source edits are made; build-level loader wiring is the approved low-intrusion consumption boundary for this change.

**Non-Goals:**

- This change does not approve a concrete patch list for `src/git/formatters/**`, `src/quickpicks/**`, or any other application-source files.
- This change does not require adding `l10n.t(...)` calls throughout feature code.
- This change does not attempt to localize all extension-host UI text in one rollout.
- This change does not translate user or remote data such as commit messages, PR titles, branch names, author names, file paths, SHAs, provider names, or repository names.
- This change does not build a general-purpose JavaScript internationalization compiler for arbitrary string manipulation.

## Decisions

### 1. Source minimization is a hard requirement

Runtime dynamic localization must be implemented through controlled i18n workflow boundaries first. The default path is extraction and generation from low-level source patterns, not call-site rewrites.

Broad edits to upper-layer command implementations, picker orchestration, view node flows, webview providers, or feature services are out of scope. If implementation discovers that a source edit is truly necessary, that edit must be raised in a follow-up design discussion before coding.

Alternative considered: manually wrapping every user-visible string with `l10n.t(...)`. This is rejected because it creates high rebase cost and violates the branch's minimal-intrusion i18n strategy.

### 2. Runtime dynamic domains reuse the existing catalog/authority model

Formatter and QuickPick runtime text should be represented as normal source occurrences with source references, anchors, authority ids, workset entries, pending reports, and generated outputs. They should not introduce a second translation store.

The implementation may use separate domain adapters for `formatter` and `quickpicks`, or a shared source extractor with per-domain target definitions. The important boundary is that extraction and generation remain under `i18n/**`, while runtime support remains under `src/i18n/**` when needed.

Alternative considered: maintaining hand-authored localized copies of affected source files. This is rejected as a long-term translation source because it increases merge conflicts and duplicates authority data.

### 3. Compile-time slot localization is the first-class strategy

Low-level runtime UI text should be localized by recognizing bounded source slots and generating localized runtime-facing artifacts. Supported first-round slots include ordinary complete UI string literals and stable sub-slots inside syntax-bearing templates, such as Markdown command link titles:

```text
](command-uri "Inspect Commit Details")
```

Safe one-line dynamic Markdown title templates and low-level QuickPick label templates are modeled with numbered placeholders so dynamic provider, branch, repository, or remote names remain source expressions:

```text
](command-uri "Open Commit on ${provider}")
```

is extracted as:

```text
Open Commit on ${slot1}
```

and static HTML tooltip/title slots:

```text
title="Inspect Commit Details"
```

The extractor/generator must replace the title text slot, not the whole template literal and not arbitrary substrings. Placeholder expressions must be restored into the generated source unchanged.

For approved QuickPick templates, the extractor may replace the whole template literal only when the template is a complete UI label/detail/description and each dynamic part is preserved as a placeholder expression in generated output. Shared package utilities can be read-only source targets when they provide complete UI display names directly consumed by an approved low-level QuickPick boundary.

The commit quick-wizard step is an explicit exception added after user feedback for untranslated commit action rows. Its scope is limited to complete `GitWizardQuickPickItem` label constructor arguments and `createQuickPickSeparator` labels in the commit-step path. This still uses generated build-time source injection and does not permit adding `l10n.t(...)` or broad rewrites across command flows.

Alternative considered: restructuring complex formatter methods into hand-built localizable helper calls as the default. This is deferred because it would decide application-source touch points too early.

### 4. Syntax-bearing templates require source-aware rules

Formatter output often mixes UI labels with Markdown command syntax, command URIs, codicons, escaped user data, and dynamic metadata. Runtime dynamic localization must preserve these syntactic boundaries.

Static Markdown titles and static visible labels can be extracted when their boundaries are clear. Safe one-line dynamic Markdown titles can be extracted with placeholders when only the UI skeleton is translated and dynamic expressions are preserved. Dynamic titles that include multiline descriptions, PR titles, states, dates, or other remote/user data remain deferred until explicit template modeling is approved. Unsupported patterns must be reported as deferred rather than silently skipped or guessed.

Alternative considered: simple English substring replacement across template text. This is rejected because it can corrupt Markdown syntax, command payloads, escaping, and user data.

### 5. Output strategy is generated build-time source injection

The generated runtime output is implemented as localized `.work` source artifacts consumed by a webpack loader during extension node/webworker builds. The loader keeps the original module resource path and replaces source text in memory before TypeScript transpilation, so relative imports and upstream source files remain unchanged.

This selected strategy satisfies the same constraints:

- no broad application-source call-site rewrites
- no hidden translation source outside authority/worksets/overrides
- deterministic regeneration after upstream merges
- support for both desktop and web extension builds

Application-source call-site edits remain out of scope and require a separate review if a future gap cannot be handled at the build boundary.

## Risks / Trade-offs

- [False positive extraction] A syntax-bearing template slot could be misidentified as UI text. Mitigation: support only explicit bounded patterns at first and report ambiguous patterns as deferred issues.
- [Under-coverage] The first rollout will leave upper-layer picker titles, placeholders, and complex formatter templates untranslated. Mitigation: use reports and deferred issues to make gaps visible without authorizing broad source churn.
- [Generated artifact complexity] Extension-host runtime text does not have the same artifact-selection path as webviews. Mitigation: consume generated `.work` sources through a webpack loader that preserves original module paths and runs for both node and webworker extension builds.
- [Merge cost regression] Even low-level source edits can become expensive if they expand. Mitigation: require explicit review of all proposed application-source touch points before coding.

## Migration Plan

1. Add runtime dynamic domain specs and workflow requirements.
2. Hold the source-touchpoint and output-strategy review before implementation starts.
3. Implement extraction/reporting with deferred issues before enabling any generated localized output.
4. Add generated build-time source injection only at approved build-level touch points.
5. Validate that regeneration after source changes updates catalog, workset, reports, and outputs deterministically.

## Open Questions

- Should `formatter` and `quickpicks` remain separate domain artifacts, or should they share one runtime dynamic source adapter with separate target groups?
