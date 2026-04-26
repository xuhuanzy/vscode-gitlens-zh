## 1. Generated Mirror Foundation

- [x] 1.1 Add shared i18n generated-root helpers for `.work/i18n/generated/<locale>` and repo-relative generated paths.
- [x] 1.2 Add collision detection for generated mirror paths across planned producers.
- [x] 1.3 Update tests or add focused tests for generated mirror path resolution and collision reporting.

## 2. Webview Generated Sources

- [x] 2.1 Move webview localized dynamic source writes/reads from `.work/i18n/webviews-sources/<locale>` to `.work/i18n/generated/<locale>/<repo-relative-path>`.
- [x] 2.2 Update localized webview webpack entry resolution and module replacement to read from the generated mirror.
- [x] 2.3 Update webpack TypeScript include paths and watch ignore paths for the generated mirror.
- [x] 2.4 Update existing webview i18n tests that assert old generated webview source paths.

## 3. Settings HTML Source Targets

- [x] 3.1 Replace settings shell extraction from `dist/webviews/settings.html` with source HTML targets for `src/webviews/apps/settings/settings.html` and `src/webviews/apps/settings/partials/*.html`.
- [x] 3.2 Generate localized settings HTML source mirrors without inlining partial contents.
- [x] 3.3 Teach localized webview webpack config to use the generated settings template while preserving canonical `dist/webviews/settings.html` output.
- [x] 3.4 Remove settings shell snapshot and post-build overwrite plumbing.
- [x] 3.5 Add or update tests proving settings generation does not require prebuilt English `dist/webviews/settings.html`.

## 4. Runtime Dynamic Generated Sources

- [x] 4.1 Move runtime dynamic generated source writes from `.work/i18n/runtime-dynamic-sources/<locale>/<domain>` to `.work/i18n/generated/<locale>/<repo-relative-path>`.
- [x] 4.2 Update `localizedRuntimeDynamicSourceLoader.cjs` to resolve generated mirror paths by repo-relative source path.
- [x] 4.3 Update runtime dynamic webpack generation/watch behavior for the generated mirror.
- [x] 4.4 Update runtime dynamic tests that assert old generated runtime source paths.

## 5. CLI, Documentation, and Verification

- [x] 5.1 Update CLI messages and aggregate generate behavior to refer to generated mirrors instead of domain-specific `.work/i18n` roots.
- [x] 5.2 Update `i18n/README.md` to document `.work/i18n/generated/<locale>/<repo-relative-path>` and the separate `extension-root` staging boundary.
- [x] 5.3 Run `node --test i18n/domains/webviews/__tests__/webviewNlsWorkflow.test.mts`.
- [x] 5.4 Run `node --test i18n/domains/runtimeDynamic/__tests__/runtimeDynamicWorkflow.test.mts`.
- [x] 5.5 Run `node --test i18n/__tests__/cli.test.mts`.
- [x] 5.6 Run `pnpm run build:webviews:quick` and `pnpm run build:quick`.
