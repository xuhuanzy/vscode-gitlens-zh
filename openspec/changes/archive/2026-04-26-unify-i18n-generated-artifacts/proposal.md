## Why

The i18n workflow currently scatters rebuildable intermediate artifacts across separate `.work/i18n` directories and treats the settings webview as a post-build `dist/webviews/settings.html` shell. This makes the generated file layout harder to reason about, adds special snapshot/overwrite handling, and hides the source files that actually own settings UI text.

## What Changes

- Consolidate rebuildable i18n intermediate artifacts under `.work/i18n/generated/<locale>/<repo-relative-path>`.
- Keep `.work/i18n/extension-root/<locale>` as the explicit runnable/packageable extension staging root, separate from generated source mirrors.
- Generate localized webview dynamic sources at their repository-relative paths under `.work/i18n/generated/zh-cn`.
- Generate runtime dynamic localized source mirrors at their repository-relative paths under `.work/i18n/generated/zh-cn`.
- Stop treating `settings` as a post-build aggregated shell source; instead localize `src/webviews/apps/settings/settings.html` and `src/webviews/apps/settings/partials/*.html` as source HTML files.
- Let webpack/html-loader aggregate localized settings partials during the normal webview build rather than having the i18n workflow pre-aggregate them.
- Remove the need for a dedicated English settings shell snapshot path by extracting from upstream-oriented source files.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `webviews-localization`: Static webview HTML generation should operate on source HTML files and partials, and localized webview build inputs should use the unified generated mirror.
- `runtime-dynamic-localization`: Runtime dynamic generated sources should use the unified generated mirror instead of a domain-specific generated source directory.

## Impact

- Affected code:
  - `i18n/domains/webviews/*`
  - `i18n/domains/runtimeDynamic/*`
  - `webpack.config.mjs`
  - webview i18n tests and CLI tests
  - `i18n/README.md`
- Generated artifact paths under `.work/i18n` will change.
- Final runtime artifacts remain canonical `dist/webviews/*` and extension bundle outputs.
- Root upstream source files under `src/**`, `packages/**`, and root manifest files remain maintained English inputs.
