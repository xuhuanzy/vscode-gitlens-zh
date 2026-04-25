## Why

The i18n branch currently makes `package.json` carry generated localization state, which creates large and recurring merge conflicts with upstream GitLens. The branch needs a sustainable workflow where upstream `package.json` remains the canonical source and i18n changes are replayed as generated artifacts.

## What Changes

- Restore root `package.json` to the upstream branch point state and keep it free of generated `%key%` localization tokens.
- Restore the upstream `contributions.json` automation that synchronizes contributions between `contributions.json` and root `package.json`.
- Move i18n workflow commands out of root `package.json` into a dedicated i18n CLI entry point.
- Change manifest localization generation so tokenized `package.json` and `package.nls*` files are generated into a staging/runtime output location, not committed back to the root manifest.
- Ensure build/debug/package flows that need localized manifest data consume the generated staging manifest explicitly.

## Capabilities

### New Capabilities

- `manifest-localization-staging`: Defines how package manifest localization is generated as replayable staging output while preserving root `package.json` as upstream-owned input.

### Modified Capabilities

- `branch-localization-workflow`: Requires the branch localization workflow to keep upstream-owned manifest and contributions automation mergeable, with local i18n commands exposed outside root `package.json`.

## Impact

- Affected files include `package.json`, `webpack.config.mjs`, `scripts/build.mjs`, `i18n/domains/manifest/*`, i18n workflow documentation, and new i18n CLI entry points.
- The change affects extension development, localized packaging/debugging, manifest i18n reports, and contributions generation behavior.
- No external runtime dependency is expected; the implementation should reuse existing Node-based i18n scripts and package tooling.
