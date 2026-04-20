## Context

The i18n branch now has three localization workflows:

- `package` uses VS Code manifest NLS and must keep `package.nls.json` / `package.nls.zh-cn.json` at the repository root.
- `webviews` extracts static HTML and runtime UI text into `webviews.nls*.json`, then uses host/client runtime helpers to localize webview output.
- `commitDisplay` defines a controlled host-side display-copy catalog and currently generates `src/system/-webview/commitDisplayLocalization.generated.ts`.

The workflows share catalog lifecycle logic but differ in extraction source. They also mix responsibilities: root-level non-package catalogs are runtime data, `./i18n` scripts are tooling, and new runtime helpers currently live under unrelated source folders.

## Goals / Non-Goals

**Goals:**

- Make `./i18n` the home for extraction, sync, reporting, glossary, passthrough, and translation-maintenance tooling.
- Make `src/i18n` the home for runtime-consumed i18n catalogs, runtime adapters, and runtime helper code.
- Move non-package source-of-truth catalogs next to their runtime consumers under `src/i18n/<surface>/`.
- Remove the commit-display generated TypeScript catalog duplication and consume JSON catalogs directly.
- Extract shared reporting/catalog lifecycle logic so package, webview, and commit-display reports behave consistently.
- Keep extractors surface-specific while sharing post-extraction catalog processing.

**Non-Goals:**

- Do not move `package.nls.json` or `package.nls.zh-cn.json`; VS Code manifest localization expects them at the package root.
- Do not rewrite existing webview components or commit formatter call sites beyond the minimum required import/path updates.
- Do not replace surface-specific extraction logic with a single generic extractor.
- Do not change the semantics of dynamic user data, dates, provider names, commit messages, branches, paths, or runtime tokens.

## Decisions

### 1. Split i18n ownership into tooling and runtime directories

`./i18n` is the branch-local tooling area. It owns CLI entry points, extraction logic, catalog synchronization, report generation, shared glossary rules, accepted passthrough rules, and merge-assist behavior.

`src/i18n` is the runtime area. It owns code and assets that are imported, bundled, or otherwise consumed by the extension/webview runtime.

Rationale:

- This keeps Node-only CLI code out of the application compilation graph.
- This makes runtime data discoverable next to runtime adapters.
- This clarifies dependency direction: tooling may read/write runtime catalog assets, but runtime code must not import tooling modules.

Alternative considered: keep all i18n-owned artifacts under `./i18n`. This preserves the earlier ownership model but fails to distinguish runtime assets from maintenance scripts, and it leaves runtime helpers scattered across unrelated `src/` areas.

### 2. Keep package manifest NLS at repository root

Package manifest catalogs remain root files because VS Code's manifest localization mechanism requires `package.nls*.json` next to `package.json`.

Rationale:

- This is an external platform constraint, not an internal organization choice.
- Moving package manifest catalogs under `src/i18n` would break VS Code's package localization contract.

Alternative considered: create proxy files or generated root copies from `src/i18n/package`. That adds churn and duplicate sources of truth without improving runtime organization.

### 3. Move non-package catalogs to `src/i18n/<surface>/`

`commitDisplay.nls.json`, `commitDisplay.nls.zh-cn.json`, `webviews.nls.json`, and `webviews.nls.zh-cn.json` should move under `src/i18n/commitDisplay` and `src/i18n/webviews`.

Rationale:

- These catalogs are not constrained by VS Code manifest layout.
- They are runtime data for branch-local runtime adapters.
- Keeping English and locale files together reduces confusion during translation and review.

Generated webview HTML templates and metadata stay in `dist/webviews` because they are build artifacts tied to generated webview HTML output, not catalog source-of-truth files.

### 4. Remove commit-display generated TypeScript catalog duplication

The commit-display runtime adapter should import/read JSON catalogs directly from `src/i18n/commitDisplay` and derive key typing from the English JSON catalog when possible. The generated TypeScript module should be removed unless a concrete bundling limitation is found.

Rationale:

- The generated module duplicates the English and zh-CN JSON catalogs.
- `resolveJsonModule` is enabled, so TypeScript can import JSON modules.
- Removing the generated copy reduces stale artifact risk and merge noise.

Alternative considered: keep the generated file only for key typing and tree-shaking. This still duplicates data; if key typing is needed, deriving `keyof typeof englishCatalog` from JSON keeps the type without generating a parallel catalog.

### 5. Share catalog lifecycle/reporting, not extractors

Each surface keeps its extractor:

- `package` walks contribution/manifest structures and inserts `%key%` placeholders.
- `webviews` parses generated HTML and webview runtime source with parse5/TypeScript.
- `commitDisplay` builds a controlled owner-based catalog from explicit entries.

Shared tooling should cover only the common post-extraction lifecycle:

- read/write stable JSON
- diff catalogs
- sync localized catalogs
- collect accepted equal values
- compute pending translations
- read base catalogs from git
- parse common report CLI options
- write stable reports
- apply shared glossary and accepted passthrough policy through explicit hooks

Rationale:

- The extractor inputs and output side effects are materially different.
- The repeated code is concentrated in sync/report logic, not extraction logic.
- Hooks allow `webviews` to keep value-level grouping and implicit passthrough rules without overfitting the shared core.

## Risks / Trade-offs

- Catalog move may break packaging if JSON assets under `src/i18n` are not copied or bundled as expected. Mitigation: verify both desktop and web builds, and explicitly include runtime JSON assets in the relevant build path if needed.
- Direct JSON import may behave differently between node and webworker bundles. Mitigation: validate extension node and browser builds before removing the generated TypeScript fallback entirely.
- Shared report abstractions may become too generic. Mitigation: extract only the currently duplicated core and keep surface-specific rendering/policy in each report script.
- Moving runtime helper files can create broad import churn. Mitigation: keep public function names stable and move modules first, then update imports without changing behavior.

## Migration Plan

1. Introduce `src/i18n` runtime folders and move commit-display/webview catalogs there.
2. Update `./i18n` tooling paths so generators and reports read/write the new catalog locations while package NLS remains at root.
3. Move runtime helpers/adapters under `src/i18n`, preserving current exported APIs through direct imports or temporary re-export shims.
4. Replace `commitDisplayLocalization.generated.ts` consumption with direct JSON catalog consumption and remove generation of the duplicate TS asset.
5. Add shared `./i18n/shared` catalog/report utilities, then migrate package and commit-display reports first.
6. Migrate webview report to the shared core with hooks for accepted passthrough, implicit passthrough, and value-level grouping.
7. Run generation, pending-report, and build verification commands.

## Open Questions

- Should `src/i18n/webviews` JSON catalogs be bundled into the extension output via JSON imports, or read via `workspace.fs` as extension assets?
- Should moved runtime modules leave temporary re-export shims at old paths for one change to reduce import churn, or should this change update all imports directly?
- Should the shared zh-CN glossary apply only during generation/sync, or also influence pending reports by treating known glossary-preserved English as accepted passthrough values?
