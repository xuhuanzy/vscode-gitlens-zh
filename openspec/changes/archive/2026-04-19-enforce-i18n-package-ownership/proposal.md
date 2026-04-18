## Why

The archived package contribution localization change kept upstream `./scripts` in the default write path for `package.json` and preserved `package.json -> contributions.json` extraction. That model conflicts with this branch's purpose: `contributions.json` is upstream-owned input, while this i18n branch must exclusively own localized package manifest outputs.

## What Changes

- Re-scope package contribution localization around a one-way i18n branch workflow: consume upstream `contributions.json`, generate localized package artifacts locally, and never write branch-local manifest changes back into upstream contribution sources
- Move package manifest write ownership to fork-local tooling under `i18n/package`, including the final generation of `package.json`, `package.nls.json`, and `package.nls.zh-cn.json`
- Remove upstream `./scripts` contribution writers and reverse extraction from the default watch/build workflow for this branch
- Extend package manifest localization coverage to include `contributes.configuration` settings UI metadata in addition to command, submenu, view, and welcome content strings
- Restore `./scripts` changes introduced by the earlier fork-local NLS work so the branch can stay closer to upstream and keep customization isolated under `i18n/package`

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `package-contribution-localization`: change the capability from a reversible `contributions.json <-> package.json` flow into an upstream-read-only, fork-local, one-way package manifest generation model

## Impact

- Affected code: `webpack.config.mjs`, `package.json` script entries, `i18n/package/*`, and any fork-local package manifest generation entrypoints
- Upstream alignment: revert fork-local NLS ownership changes from `scripts/contributions/*` and `scripts/generateContributions.mts`
- Generated outputs: `package.json`, `package.nls.json`, `package.nls.zh-cn.json`
- Developer workflow: this branch will stop treating `extract:contributions` and upstream contribution writers as part of the default package localization flow
