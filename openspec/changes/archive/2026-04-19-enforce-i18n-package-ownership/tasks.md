## 1. Restore Upstream Ownership Boundaries

- [x] 1.1 Revert fork-local package NLS changes from `scripts/contributions/*` and `scripts/generateContributions.mts` so `./scripts` returns to an upstream-aligned state
- [x] 1.2 Audit branch-facing script entries and callers that currently assume upstream contribution scripts still own `package.json`

## 2. Build Fork-Local Package Manifest Generation

- [x] 2.1 Add or refactor `i18n/package` generation tooling so it consumes upstream `contributions.json` and emits the final `package.json`
- [x] 2.2 Extend the fork-local generator to emit `package.nls.json` keys for command, submenu, view, `viewsWelcome`, and `contributes.configuration` strings
- [x] 2.3 Keep `package.nls.zh-cn.json` synchronized from the generated English catalog while preserving existing translations and removing obsolete keys

## 3. Replace Default Automation

- [x] 3.1 Update `package.json` scripts so the branch-default package localization flow runs through `i18n/package` rather than upstream contribution writers
- [x] 3.2 Update `webpack.config.mjs` file-generator/watch behavior to prevent upstream scripts from rewriting `package.json`
- [x] 3.3 Block default `package.json -> contributions.json` extraction so localized manifest updates never rewrite upstream-owned inputs

## 4. Validate and Document the New Branch Workflow

- [x] 4.1 Regenerate `package.json`, `package.nls.json`, and `package.nls.zh-cn.json` and verify configuration metadata is included in the generated catalogs
- [x] 4.2 Verify that normal build/watch workflows no longer modify `contributions.json`
- [x] 4.3 Update branch-local localization documentation to state that `contributions.json` is upstream-owned input and `i18n/package` is the sole package manifest writer
