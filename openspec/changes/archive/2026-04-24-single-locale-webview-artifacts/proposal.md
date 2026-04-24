## Why

This branch serves a single target locale and will not be merged upstream as a general multi-locale implementation. Keeping localized webview bundles under `dist/webviews/i18n/<locale>` adds runtime selection and duplicated artifacts that do not match the branch's deployment model.

## What Changes

- **BREAKING**: Dynamic webview localized artifacts will no longer be emitted as parallel runtime-selected bundles under `dist/webviews/i18n/zh-cn`.
- Generate localized webview output as the canonical `dist/webviews` artifacts for this branch, so the extension loads localized HTML, JS, and CSS through the existing standard webview paths.
- Keep upstream-oriented source files under `src/webviews/apps/**` unchanged; localization continues to happen through generated sources and build artifacts, not page-level `t()` plumbing.
- Remove `WebviewController` logic whose only purpose is selecting locale-specific dynamic script artifacts for supported webviews.
- Keep the translation authority, worksets, reports, and generated source workflow under `i18n/**` and `.work/i18n/**`, but stop publishing a second localized webview tree beside the standard webview output.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `webviews-localization`: Localized dynamic and supported static webview runtime artifacts become the branch's canonical `dist/webviews` output instead of locale-selected sibling artifacts.

## Impact

- Affects the webview i18n build workflow in `i18n/domains/webviews/**`.
- Affects webview webpack configuration and build orchestration in `webpack.config.mjs` and `scripts/build.mjs`.
- Affects `src/webviews/webviewController.ts` by removing dynamic script artifact selection paths that are no longer needed, and removes the obsolete `src/i18n` webview runtime helper modules and tests.
- Affects tests covering localized webview artifact lookup, HTML script replacement, and webview i18n workflow output layout.
- Reduces packaged VSIX webview artifact duplication by publishing one localized `dist/webviews` tree for this branch.
