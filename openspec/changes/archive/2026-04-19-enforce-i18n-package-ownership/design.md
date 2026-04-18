## Context

The earlier package contribution localization work established `%key%`-based package catalogs but left the branch on top of upstream `scripts/generateContributions.mts` and the paired `package.json -> contributions.json` extraction workflow. That was workable for a reversible contributions flow, but it is the wrong ownership model for this branch.

This branch exists only to maintain localized package manifest outputs. `contributions.json` is effectively an upstream mirror that should be consumed, not edited. At the same time, the branch must localize more of `package.json` than upstream `scripts/contributions/*` knows about, especially `contributes.configuration`, whose settings UI strings are currently outside the generated catalog.

The implementation therefore needs to separate upstream-aligned contribution tooling from fork-local package manifest generation, without leaving any default watch/build path that can still rewrite `package.json` through upstream scripts or reverse-write localized `%key%` content into `contributions.json`.

## Goals / Non-Goals

**Goals:**

- Restore `./scripts` contribution tooling to an upstream-aligned state so fork-only package localization logic no longer lives there
- Make `i18n/package` the sole default writer of `package.json`, `package.nls.json`, and `package.nls.zh-cn.json`
- Block default `package.json -> contributions.json` synchronization in this branch
- Expand package manifest localization coverage to include `contributes.configuration` settings UI metadata as well as existing command, submenu, view, and welcome content strings
- Keep English package strings canonical in `package.nls.json` and continue deriving `package.nls.zh-cn.json` from that catalog

**Non-Goals:**

- Reintroducing reversible extraction from localized package outputs back into `contributions.json`
- Changing upstream semantics of `contributions.json` itself or inventing a fork-specific replacement source file for it
- Localizing runtime strings outside the package manifest
- Generalizing this branch-specific ownership model into upstream `./scripts`

## Decisions

### 1. Restore upstream `./scripts` and move branch-local manifest generation fully under `i18n/package`

Branch-specific package localization logic will not remain in `scripts/contributions/*` or `scripts/generateContributions.mts`. Those files will be restored to their upstream behavior, and all branch-local package manifest generation will move under `i18n/package`.

Rationale:

- This branch needs a clear ownership boundary: upstream `scripts` remain upstream-compatible, fork-local manifest generation stays fork-local
- Rebase cost is lower when branch customization is isolated from frequently synced upstream tooling
- This avoids continuing a hybrid model where upstream scripts appear canonical but still contain branch-specific package NLS logic

Alternatives considered:

- Keep patching upstream `scripts` and document the divergence
  - Rejected because it preserves the same ownership ambiguity and merge-conflict surface that caused the current problem

### 2. `i18n/package` becomes the only default writer for package manifest artifacts

The branch will treat `i18n/package` as the authoritative generation entrypoint for `package.json`, `package.nls.json`, and `package.nls.zh-cn.json`. Upstream contribution generators may still exist for upstream maintenance, but they will not remain in this branch's default write path.

Rationale:

- The branch needs one obvious place that owns final manifest output
- The generator must cover fields that upstream contribution scripts do not model, especially `contributes.configuration`
- A single fork-local writer avoids conflicting output from multiple generators touching the same files

Alternatives considered:

- Keep a two-stage flow where upstream scripts write `package.json` and `i18n/package` patches it afterward
  - Rejected because it leaves package ownership split across two writers and makes watch behavior fragile

### 3. Default automation must stop reverse synchronization from `package.json` into `contributions.json`

Watch/build automation will no longer trigger `extract:contributions` from `package.json` changes in this branch. Any remaining extraction command becomes non-default maintenance tooling at most, and must not run automatically from localized manifest updates.

Rationale:

- In this branch, `package.json` is a localized derived artifact, not an editable truth source
- Automatic extraction would immediately leak `%key%` references or branch-local configuration localization into upstream-owned `contributions.json`
- Blocking reverse sync is simpler and safer than trying to keep a fully reversible localized flow

Alternatives considered:

- Keep extraction but make it NLS-aware for all fields
  - Rejected because the branch has no need for reverse sync, and complete reversibility would add complexity without serving the branch contract

### 4. Package localization coverage must explicitly include configuration metadata

The new generator will treat `contributes.configuration` as part of the package-localizable surface, not as unmanaged static JSON. Category titles and setting metadata strings such as descriptions, markdown descriptions, enum descriptions, and deprecation messages will be emitted through stable `%key%` references and added to `package.nls.json`.

Rationale:

- Settings UI text is currently the largest uncovered package-localization surface in this repository
- If configuration strings remain unmanaged, package localization remains incomplete even if menu-related contributions are localized
- Configuration keys need owner-based naming for the same reason as commands and views: duplicated English strings are common

Alternatives considered:

- Limit this change to existing generated contribution fields and defer configuration
  - Rejected because it preserves the exact gap that triggered this proposal

### 5. English catalog ownership remains separate from Chinese synchronization

`package.nls.json` remains the canonical English catalog for generated package keys. `package.nls.zh-cn.json` will continue to be synchronized from that catalog, preserving existing translations, defaulting new keys to English, and removing obsolete keys.

Rationale:

- This preserves the useful separation already established between English canonical strings and localized synchronization
- The branch only needs to change who generates the catalog and manifest, not the zh-CN synchronization policy

Alternatives considered:

- Generate `package.nls.zh-cn.json` directly from source structures without an English catalog step
  - Rejected because it weakens the canonical source of generated keys and makes translation synchronization harder to audit

## Risks / Trade-offs

- [Risk] Restoring `./scripts` while changing default automation could leave hidden callers still invoking upstream writers -> Mitigation: audit script entries, webpack file generators, and documentation together, then validate that only `i18n/package` writes package artifacts in normal workflows
- [Risk] A fork-local generator that owns more of `package.json` can drift from upstream structure -> Mitigation: keep upstream `contributions.json` as read-only input, minimize fork-only transforms, and verify generated sections against current upstream manifest structure
- [Risk] Configuration localization introduces a large new key surface and more naming collisions -> Mitigation: define owner-based keys from category IDs, setting IDs, and field names rather than from English text
- [Risk] Removing automatic extraction may surprise contributors used to the old reversible flow -> Mitigation: document the branch contract clearly and keep any residual extraction tooling explicitly non-default

## Migration Plan

1. Restore `scripts/contributions/*` and `scripts/generateContributions.mts` to the upstream-aligned state used before fork-local package NLS ownership was added
2. Implement a fork-local generator under `i18n/package` that consumes upstream `contributions.json` plus existing manifest structure and emits final package artifacts
3. Update `package.json` scripts, webpack file-generator plugins, and any related watch/build entrypoints so default workflows call only the fork-local generator for package artifact writes
4. Validate that localized `package.json` updates no longer trigger writes to `contributions.json`
5. Regenerate `package.json`, `package.nls.json`, and `package.nls.zh-cn.json` and compare outputs against current branch expectations

## Open Questions

- Whether to keep any manual `extract:contributions` command in this branch for emergency maintenance, or remove it entirely from branch-facing workflows
- Whether the fork-local generator should reuse upstream builder code as a library input or duplicate only the minimal logic needed under `i18n/package`
