## Context

The branch currently localizes the package manifest by rewriting root `package.json` with `%key%` tokens and adding i18n scripts to the same file. That makes `package.json` the largest recurring merge conflict surface when rebasing onto upstream GitLens.

GitLens also has an upstream contributions workflow. `scripts/generateContributions.mts` can generate `package.json` contributions from `contributions.json`, or extract `contributions.json` from `package.json`. The current i18n branch disabled the webpack-triggered contribution generation path to avoid extracting tokenized manifest text back into `contributions.json`. Once root `package.json` stops being tokenized, that disablement should be removed to minimize divergence from upstream.

## Goals / Non-Goals

**Goals:**

- Keep root `package.json` aligned with upstream and free of generated i18n tokens or branch-local scripts.
- Generate tokenized package manifest files as replayable staging outputs.
- Restore upstream contributions automation so i18n does not carry a permanent fork of the build workflow.
- Provide a dedicated i18n CLI for sync, report, promote, generate, test, and review operations.
- Make localized build/debug/package flows explicitly consume staged manifest artifacts when localization is required.

**Non-Goals:**

- Do not change VS Code's package manifest localization semantics.
- Do not make `contributions.json` a translation source.
- Do not add compatibility layers for historical i18n script names in root `package.json`.
- Do not broaden translation coverage beyond the existing manifest, webview, formatter, and QuickPick workflow scope.

## Decisions

### Root package manifest remains upstream-owned

Root `package.json` will be restored to the branch point state and treated as an upstream-maintained source file. Manifest extraction may read it, but i18n generation must not write tokenized values back into it.

Alternative considered: keep committing tokenized `package.json` and rely on merge conflict resolution. That preserves current behavior but leaves the highest-churn file as a generated branch artifact, which is the core sustainability problem.

### Manifest localization emits staging output

Manifest generation will write the tokenized manifest and matching `package.nls.json` / `package.nls.zh-cn.json` into an i18n staging location under `.work/i18n`. The staged output is replayable and can be removed/regenerated after upstream merges.

The staged extension root can link most repository directories back to the real root, but package-time runtime and manifest asset directories that the extension host or packager must see as local files are materialized in staging. This includes `dist` for extension host identity, `images` for `vsce` manifest asset validation, and `walkthroughs` for walkthrough markdown/assets, because `vsce package` does not follow staged-root symlinks by default.

The staging directory should be treated as a build/runtime artifact, not as the authoritative translation source. Authority, overrides, worksets, and catalogs remain under `i18n/**`.

Alternative considered: write only `package.nls*` at root and inject `%key%` at runtime. VS Code reads manifest localization tokens from the extension manifest before extension activation, so token injection still needs to happen before VS Code loads the extension root.

### Restore contributions automation against root package only

The webpack plugin calls for `GenerateContributionsPlugin` and `ExtractContributionsPlugin` will be restored. They must operate on root `package.json`, which remains English/upstream-owned. No contributions automation should read from staged localized manifests.

Alternative considered: permanently disable contribution generators on the branch. That avoids accidental token extraction but creates unnecessary drift from upstream once the tokenized manifest moves out of root.

### Dedicated i18n CLI replaces root package scripts

Branch-local i18n commands will move to a dedicated CLI such as `node ./i18n/cli.mts <domain> <action>`. Root `package.json` will not carry i18n-specific scripts. Existing build code that needs i18n generation should call the CLI or underlying i18n scripts directly.

Alternative considered: keep root npm scripts as convenience aliases. That is convenient locally, but it keeps `package.json` divergent and undermines the purpose of this change.

### Localized consumers opt into the staged manifest

Default upstream development can continue to use root `package.json`. Localized debug, package, or validation flows must explicitly select the staged extension root or copy/link the staged manifest into an isolated output root.

Localized packaging must keep the staged extension root as a package input only. Any production bundle or prepublish-equivalent build should run from the real repository root before staging is consumed, and the staged `package.json` should not allow `vsce package` to trigger `vscode:prepublish` from inside `.work/i18n/extension-root/<locale>`.

Alternative considered: mutate root `package.json` during build and restore it afterward. That is fragile under watch mode, failed builds, and concurrent tooling.

## Risks / Trade-offs

- Staged extension roots can drift from root files if generation is skipped -> localized debug/package commands must run generation first and fail clearly when required staged files are missing.
- Restoring extraction from root `package.json` can rewrite `contributions.json` if root is accidentally tokenized -> tests or validation should assert root `package.json` remains free of `%key%` localization tokens before extraction.
- Developers may miss removed root i18n scripts -> i18n docs and generated workflow help must point to the dedicated CLI.
- VS Code extension debugging defaults to root `package.json` -> localized debugging needs a separate launch path or command that points `--extensionDevelopmentPath` at the staged root.

## Migration Plan

1. Restore root `package.json` to the branch point state.
2. Restore upstream contributions script entries and webpack contributions plugin calls.
3. Add the dedicated i18n CLI and update docs to use it.
4. Change manifest generation to emit staged package files instead of root outputs.
5. Wire localized build/debug/package paths to generate and consume staged manifest files.
6. Add validation that root `package.json` is not tokenized and `contributions.json` is not generated from staged localized manifests.

Rollback is straightforward: delete the new staging integration and CLI wiring, then restore the current manifest generator behavior. That rollback should not be needed once localized consumers are explicitly pointed at staging.

## Open Questions

- None currently. Localized debugging and packaging use the fuller `.work/i18n/extension-root/zh-cn` tree, with packaging builds executed from the real repository root before the staged root is consumed.
