## Context

The current webviews i18n implementation treats localized dynamic webview bundles as sibling artifacts under `dist/webviews/i18n/zh-cn`. `WebviewController` keeps loading the English HTML shell from `dist/webviews` and rewrites selected script references to the localized bundle.

That split is appropriate for a general multi-locale extension, but this branch is intentionally single-locale. For this branch, the simplest runtime contract is that the standard webview artifact tree is already localized.

## Goals / Non-Goals

**Goals:**

- Make the branch's packaged webview output a single localized `dist/webviews` tree.
- Keep upstream source files under `src/webviews/apps/**` untouched and easy to rebase.
- Keep translation source of truth under `i18n/**` and generated localized source overlays under `.work/i18n/**`.
- Remove runtime dynamic script selection for supported localized webviews.
- Reduce duplicated packaged artifacts.

**Non-Goals:**

- Do not introduce a generic multi-locale runtime picker.
- Do not modify `contributions.json`.
- Do not add page-level `t()` / `localize()` calls to upstream-oriented webview source files.
- Do not localize currently deferred mixed-renderer boundaries such as unsupported JSX/TSX positions.
- Do not keep compatibility code for the retired `dist/webviews/i18n/<locale>` dynamic bundle layout.

## Decisions

### 1. Treat localized `dist/webviews` as the canonical branch artifact

The final packaged output for supported webviews will be localized in place under `dist/webviews`. Runtime code should keep using the existing webview descriptors and standard script references, for example `#{root}/dist/webviews/graph.js`.

Rationale:

- This matches the branch's deployment model: users of this branch expect the target language, not a runtime choice.
- It avoids publishing both English and localized dynamic bundles.

Alternative considered:

- Keep `dist/webviews/i18n/zh-cn` and patch `webpackResourceBasePath` when localized scripts are selected. This is a smaller local fix for the minimap failure, but it preserves a general multi-locale architecture that the branch does not need.

### 2. Preserve source-level AST derivation, not bundle post-processing

The workflow should continue generating localized source overlays under `.work/i18n/webviews-sources/<locale>` and then compile those overlays. The final output changes location; the derivation mechanism does not become a regex replacement pass over already bundled JavaScript.

Rationale:

- Source AST transformation preserves Lit template structure and expression boundaries.
- It keeps the i18n cut point below page call sites while avoiding fragile bundler-output rewrites.
- It remains compatible with ongoing upstream rebases because English source files are not edited.

Alternative considered:

- Build English webviews first, then mutate `dist/webviews/*.js` in place. This looks simple but depends on webpack output stability and makes source-to-translation audits harder.

### 3. Avoid parallel writers for `dist/webviews`

The build must not let an English webview compilation and a localized webview compilation write overlapping runtime artifacts to `dist/webviews` concurrently. Supported approaches are:

- make the normal webviews config consume localized entries/source overlays when the branch's single-locale i18n mode is enabled, or
- run an explicit localized overlay compilation after the normal shared assets are available and after any English writer for the same artifacts has stopped.

Rationale:

- The published tree should have one clear owner for each runtime artifact.
- Avoiding overlapping writers keeps the build deterministic and makes artifact audits straightforward.

### 4. Keep shared static assets under the standard webroot

`dist/webviews/media`, `codicon.ttf`, and CSS assets continue to live under the standard `dist/webviews` root. The standard `#{webroot}` token remains the resource base for webview runtime assets.

Rationale:

- Existing webview HTML and CSS already assume this location.
- The single-locale output model keeps all runtime webview resources in the same tree.

### 5. Retire dynamic localized script selection

`WebviewController` should no longer need to check for localized dynamic script artifacts or rewrite dynamic webview script references. Static shell selection can also be simplified where the localized shell becomes the canonical built shell.

Rationale:

- The runtime should not carry unused locale selection logic in a single-locale branch.
- Removing this code makes future regressions easier to reason about: a webview loads whatever is in `dist/webviews`.

### 6. Remove obsolete `src/i18n` webview runtime helpers

After localized dynamic bundles and static shells are published as canonical `dist/webviews` artifacts, the remaining `src/i18n` webview helpers are no longer production code. They should be removed with their tests rather than kept as placeholders.

Rationale:

- The branch localization source of truth and generation workflow remain under `i18n/**` and `.work/i18n/**`.
- Keeping unused runtime helpers would preserve a retired architecture and add rebase surface with no runtime consumer.

## Risks / Trade-offs

- [Loss of English runtime fallback] → Intentional for this branch. The translation workflow remains the place to report missing or stale translations before build completion.
- [Build ordering mistakes can produce mixed artifacts] → Add tests or build assertions that detect unexpected `dist/webviews/i18n` output and ensure canonical runtime artifacts are emitted by the localized workflow.
- [Static shell workflow may still mention `src/i18n` or `dist/webviews/i18n`] → Update docs/specs/tests so generated shell artifacts align with the single-locale output model and remove obsolete runtime helper files when they no longer have consumers.
- [Upstream rebase changes webpack config or webview entries] → Keep the i18n overlay isolated in `i18n/**` and a small number of build integration points.

## Migration Plan

1. Update the webviews i18n build model so localized dynamic entries compile to `dist/webviews`.
2. Ensure the normal webviews build does not race or overwrite localized output for supported dynamic pages.
3. Stop generating or packaging `dist/webviews/i18n/zh-cn/*.js` dynamic bundles.
4. Simplify `WebviewController` by removing dynamic script artifact selection and script-reference replacement.
5. Remove obsolete `src/i18n` webview runtime helper modules and tests after confirming no runtime consumers remain.
6. Update tests to assert that supported webview HTML continues to reference standard `dist/webviews/*.js` paths and that no dynamic localized bundle path is required at runtime.
7. Verify representative dynamic webviews load from the standard `dist/webviews` output tree.

## Open Questions

- Resolved: localized static shells are generated directly to `dist/webviews/*.html`; `src/i18n/webviews/<locale>` is not retained as an intermediate.
- Should this branch expose a single explicit build flag for "single-locale webview output", or should it be the default behavior for all webview builds on this branch?
