## 1. Restore Upstream-Owned Package Surfaces

- [x] 1.1 Restore root `package.json` to the branch point state so generated `%key%` manifest values and branch-local i18n script entries are removed.
- [x] 1.2 Restore root package contribution script entries for `extract:contributions` and `generate:contributions`.
- [x] 1.3 Restore webpack contribution generation plugin wiring for `GenerateContributionsPlugin`, `ExtractContributionsPlugin`, and `GenerateCommandTypesPlugin`.
- [x] 1.4 Verify `contributions.json` remains unchanged after package restoration and contribution generation checks.

## 2. Add Dedicated I18n CLI

- [x] 2.1 Add an `i18n/cli.mts` entry point that dispatches existing manifest, webview, runtime dynamic, and authority workflows.
- [x] 2.2 Move documented i18n command examples from root `pnpm run ...` aliases to `node ./i18n/cli.mts ...` invocations.
- [x] 2.3 Update build-time i18n calls that currently depend on root i18n scripts to call the CLI or underlying i18n scripts directly.

## 3. Stage Manifest Localization Outputs

- [x] 3.1 Extend manifest workflow options to support a staging output root for tokenized package manifest artifacts.
- [x] 3.2 Change manifest generation so root `package.json` is read-only and generated `package.json`, `package.nls.json`, and `package.nls.zh-cn.json` are written to staging.
- [x] 3.3 Add validation that manifest generation does not mutate root `package.json` or `contributions.json`.
- [x] 3.4 Add validation that root `package.json` does not contain generated `%key%` localization tokens in translatable manifest fields.

## 4. Wire Localized Consumers

- [x] 4.1 Decide and implement the staged extension-root layout for localized manifest debug/package consumption.
- [x] 4.2 Ensure localized package/debug flows generate staged manifest artifacts before use.
- [x] 4.3 Preserve default upstream development builds so they use root `package.json` without localized manifest mutation.
- [x] 4.4 Ensure localized packaging builds from the real repository root and disables staged-root prepublish execution before invoking `vsce`.
- [x] 4.5 Materialize staged package runtime and manifest asset directories required by `vsce package`.
- [x] 4.6 Generate a package-only staged ignore file so `vsce package` does not scan linked staging directories as files.

## 5. Tests and Verification

- [x] 5.1 Update manifest workflow tests to assert root package immutability and staged package output contents.
- [x] 5.2 Add or update tests for the i18n CLI dispatch paths.
- [x] 5.3 Run focused i18n workflow tests for manifest, webview, runtime dynamic, and authority commands.
- [x] 5.4 Run the relevant build command and confirm restored contributions automation does not produce unwanted diffs.
