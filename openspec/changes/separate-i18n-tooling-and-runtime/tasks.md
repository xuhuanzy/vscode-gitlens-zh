## 1. Runtime Directory Structure

- [x] 1.1 Create `src/i18n/commitDisplay` and move commit-display English/zh-CN JSON catalogs into that directory.
- [x] 1.2 Create `src/i18n/webviews` and move webview English/zh-CN JSON catalogs into that directory.
- [x] 1.3 Move commit-display runtime adapter code from `src/system/-webview` into `src/i18n/commitDisplay`, preserving the public localization helper API.
- [x] 1.4 Move webview host/runtime localization helpers into `src/i18n/webviews`, preserving current host and client integration behavior.
- [x] 1.5 Update all imports and runtime catalog read paths to the new `src/i18n` locations.

## 2. Commit Display Catalog Consumption

- [x] 2.1 Replace `commitDisplayLocalization.generated.ts` imports with direct JSON catalog consumption from `src/i18n/commitDisplay`.
- [x] 2.2 Derive commit-display localization key typing from the English JSON catalog or another non-duplicating source.
- [x] 2.3 Remove generation and consumption of `src/system/-webview/commitDisplayLocalization.generated.ts`.
- [x] 2.4 Update commit-display generation scripts to write only the JSON catalogs and any necessary non-duplicating runtime assets.

## 3. Shared Tooling Core

- [x] 3.1 Add `./i18n/shared` utilities for stable JSON/file writing and JSON catalog reads.
- [x] 3.2 Add shared catalog diff/sync/has-changes/pending-translation utilities.
- [x] 3.3 Add shared git base-ref catalog reading and common report CLI option parsing.
- [x] 3.4 Add shared zh-CN accepted passthrough/glossary policy with surface-specific extension hooks.

## 4. Report Migration

- [x] 4.1 Migrate package pending report to the shared report/catalog core while keeping package-specific root paths and accepted passthrough values.
- [x] 4.2 Migrate commit-display pending report to the shared report/catalog core with the new `src/i18n/commitDisplay` catalog paths.
- [x] 4.3 Migrate webview pending report to the shared report/catalog core while preserving implicit passthrough and value-level grouping behavior.
- [x] 4.4 Ensure all `--base`, `--write`, `--fail-on-pending`, and `--help` behaviors remain consistent across reports.

## 5. Generator Migration

- [x] 5.1 Update package tooling only where shared utilities can be reused, keeping `package.nls*.json` at the repository root.
- [x] 5.2 Update commit-display generators to read/write catalogs under `src/i18n/commitDisplay`.
- [x] 5.3 Update webview generators to read/write catalogs under `src/i18n/webviews` while keeping generated HTML templates/metadata under `dist/webviews`.
- [x] 5.4 Preserve surface-specific extractors and route their extracted English catalogs through shared post-processing.

## 6. Documentation and Governance

- [x] 6.1 Update i18n README documentation to state that `./i18n` is tooling and `src/i18n` is runtime.
- [x] 6.2 Update package/webview/commit-display README files with the new catalog paths and ownership rules.
- [x] 6.3 Update package scripts or script comments if command behavior or artifact paths change.

## 7. Verification

- [x] 7.1 Run commit-display generation and pending-report commands to confirm the new JSON catalog layout works.
- [x] 7.2 Run webview generation and pending-report commands to confirm catalog relocation and report grouping still work.
- [x] 7.3 Run package pending-report command to confirm shared report core did not change manifest NLS behavior.
- [x] 7.4 Run the relevant TypeScript/build verification for desktop and web targets.
- [x] 7.5 Run related formatter/webview localization tests or update them to cover direct JSON catalog consumption and new module paths.
