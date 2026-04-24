# Source Touchpoint Review

## Decision

This implementation phase does not modify application source under `src/git/**`, `src/quickpicks/**`, `packages/**`, `src/views/**`, `src/commands/**`, or webview providers. Runtime dynamic consumption is connected at the webpack build boundary: localized `.work` source artifacts are injected in memory for matching source modules while preserving their original module paths.

After user feedback identified untranslated commit action rows, `src/commands/quick-wizard/steps/commits.ts` is added as a narrowly approved read-only QuickPick source target. This approval is limited to `getShowCommitOrStashStepItems`/commit-step complete `GitWizardQuickPickItem` labels and separator labels, consumed through the same build-time loader path. It does not authorize broader command or picker-flow call-site edits.

Application-source call-site consumption remains deferred to a follow-up design discussion. The approved build-level touch points are `webpack.config.mjs`, `i18n/domains/runtimeDynamic/webpack.mjs`, and `i18n/domains/runtimeDynamic/localizedRuntimeDynamicSourceLoader.cjs`.

## Candidate Classification

| Candidate                                                                       | Classification                                      | Rationale                                                                                                                                                 |
| ------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `i18n/domains/runtimeDynamic/**`                                                | workflow/build boundary                             | New domain adapter, extractor, generator, workflow, tests, CLI entry points, webpack plugin, and localized source loader.                                 |
| `i18n/catalog/{formatter,quickpicks}.catalog.json`                              | generated-output-only                               | Derived catalog outputs from workflow runs.                                                                                                               |
| `i18n/worksets/{formatter,quickpicks}.zh-cn.json`                               | generated-output-only                               | Derived translation worksets from workflow runs.                                                                                                          |
| `i18n/reports/{formatter,quickpicks}-*.json`                                    | generated-output-only                               | Derived reconciliation and pending reports.                                                                                                               |
| `.work/i18n/runtime-dynamic-sources/zh-cn/**`                                   | generated-output-only                               | Localized source artifacts generated for inspection and build-time in-memory loader consumption.                                                          |
| `webpack.config.mjs`                                                            | approved build boundary                             | Registers generation and loader consumption for extension node/webworker builds without source call-site edits.                                           |
| `src/git/formatters/commitFormatter.ts`                                         | read-only low-level source target                   | Extracted and build-time localized through loader; source file itself is not edited.                                                                      |
| `src/git/formatters/statusFormatter.ts`                                         | read-only low-level source target                   | Extracted and build-time localized through loader; source file itself is not edited.                                                                      |
| `src/git/utils/-webview/commit.utils.ts`                                        | read-only low-level source target                   | Formatter-adjacent stats text extracted and build-time localized through loader; source file itself is not edited.                                        |
| `src/git/utils/-webview/fileChange.utils.ts`                                    | read-only low-level source target                   | Formatter-adjacent stats text extracted and build-time localized through loader; source file itself is not edited.                                        |
| `src/quickpicks/remoteProviderPicker.ts`                                        | read-only low-level source target                   | Remote-provider QuickPick labels are extracted and build-time localized through loader; source file itself is not edited.                                 |
| `src/quickpicks/items/*.ts`                                                     | read-only low-level source target                   | Extracted and build-time localized through loader; source files themselves are not edited.                                                                |
| `packages/git/src/utils/remote.utils.ts`                                        | read-only low-level source target                   | Remote resource display names used by low-level QuickPick labels are extracted and build-time localized through loader; source file itself is not edited. |
| `src/commands/quick-wizard/steps/commits.ts`                                    | narrowly approved read-only QuickPick source target | User-identified commit action QuickPick labels are extracted and build-time localized through loader; source file itself is not edited.                   |
| Upper-layer commands, picker flows, view nodes, services, and webview providers | rejected                                            | Broad call-site localization edits violate the change design and remain out of scope.                                                                     |

## Rejected Plan

The implementation will not add `l10n.t(...)` calls broadly across application source. It will not rewrite command handlers, picker orchestration, view node flows, or service logic to chase runtime UI text coverage.

## Follow-Up Requirement

Before any application-source file is edited to consume runtime dynamic localization output, the exact file path, reason, and lower-intrusion alternatives must be discussed and approved separately. Build-level loader consumption is the current approved lower-intrusion path.
